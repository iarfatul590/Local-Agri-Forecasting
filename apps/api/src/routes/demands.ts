import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { getAuthUser, requireAuth, requireRoles } from "../middleware/requireAuth.js";

const router = Router();
const idSchema = z.string().uuid();
const demandStatus = ["DRAFT", "OPEN", "PARTIALLY_FILLED", "FILLED", "CANCELLED", "EXPIRED"] as const;
const createDemandSchema = z.object({
  cropId: idSchema,
  upazilaId: idSchema,
  quantityKg: z.number().positive().max(1_000_000_000),
  targetPriceBdtKg: z.number().positive().max(1_000_000).nullable().optional(),
  deliveryFrom: z.coerce.date().nullable().optional(),
  deliveryBy: z.coerce.date().nullable().optional(),
  notesBn: z.string().trim().max(500).nullable().optional(),
}).strict().refine((value) => !value.deliveryFrom || !value.deliveryBy || value.deliveryFrom <= value.deliveryBy, {
  message: "deliveryFrom must be on or before deliveryBy.",
});
const updateDemandSchema = z.object({
  cropId: idSchema.optional(),
  upazilaId: idSchema.optional(),
  quantityKg: z.number().positive().max(1_000_000_000).optional(),
  targetPriceBdtKg: z.number().positive().max(1_000_000).nullable().optional(),
  deliveryFrom: z.coerce.date().nullable().optional(),
  deliveryBy: z.coerce.date().nullable().optional(),
  notesBn: z.string().trim().max(500).nullable().optional(),
  status: z.enum(demandStatus).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

router.use(requireAuth);

router.get("/", async (request, response) => {
  const user = getAuthUser(request);
  if (user.role === "BUYER") {
    const buyer = await prisma.buyerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!buyer) {
      response.status(404).json({ error: "Buyer profile not found." });
      return;
    }
    response.json(await prisma.demandPost.findMany({
      where: { buyerId: buyer.id },
      orderBy: { createdAt: "desc" },
    }));
    return;
  }

  let where: { status?: "OPEN"; upazilaId?: string } | undefined;
  if (user.role === "FIELD_WORKER") {
    const worker = await prisma.fieldWorkerProfile.findUnique({ where: { userId: user.id }, select: { upazilaId: true } });
    if (!worker) {
      response.status(403).json({ error: "A field-worker area has not been assigned." });
      return;
    }
    where = { upazilaId: worker.upazilaId };
  } else if (user.role !== "ADMIN") {
    where = { status: "OPEN" };
  }
  response.json(await prisma.demandPost.findMany({ where, orderBy: { createdAt: "desc" } }));
});

router.get("/:id", async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const user = getAuthUser(request);
  const demand = await prisma.demandPost.findUnique({ where: { id } });
  if (!demand) {
    response.status(404).json({ error: "Demand post not found." });
    return;
  }
  if (user.role === "BUYER") {
    const buyer = await prisma.buyerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!buyer || demand.buyerId !== buyer.id) {
      response.status(404).json({ error: "Demand post not found." });
      return;
    }
  } else if (user.role === "FIELD_WORKER") {
    const worker = await prisma.fieldWorkerProfile.findUnique({ where: { userId: user.id }, select: { upazilaId: true } });
    if (!worker) {
      response.status(403).json({ error: "A field-worker area has not been assigned." });
      return;
    }
    if (demand.status !== "OPEN" || demand.upazilaId !== worker.upazilaId) {
      response.status(404).json({ error: "Demand post not found." });
      return;
    }
  } else if (user.role !== "ADMIN" && demand.status !== "OPEN") {
    response.status(404).json({ error: "Demand post not found." });
    return;
  }
  response.json(demand);
});

router.post("/", requireRoles("BUYER"), async (request, response) => {
  const input = createDemandSchema.parse(request.body);
  const user = getAuthUser(request);
  const buyer = await prisma.buyerProfile.findUnique({ where: { userId: user.id }, select: { id: true, upazilaId: true } });
  if (!buyer) {
    response.status(404).json({ error: "Buyer profile not found." });
    return;
  }
  if (buyer.upazilaId !== input.upazilaId) {
    response.status(403).json({ error: "Demand must be posted for the buyer's registered upazila." });
    return;
  }
  response.status(201).json(await prisma.demandPost.create({
    data: { ...input, buyerId: buyer.id },
  }));
});

router.patch("/:id", requireRoles("BUYER"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const input = updateDemandSchema.parse(request.body);
  const user = getAuthUser(request);
  const buyer = await prisma.buyerProfile.findUnique({ where: { userId: user.id }, select: { id: true, upazilaId: true } });
  if (!buyer) {
    response.status(404).json({ error: "Buyer profile not found." });
    return;
  }
  if (input.upazilaId && input.upazilaId !== buyer.upazilaId) {
    response.status(403).json({ error: "Demand must remain in the buyer's registered upazila." });
    return;
  }
  const updated = await prisma.demandPost.updateMany({ where: { id, buyerId: buyer.id }, data: input });
  if (!updated.count) {
    response.status(404).json({ error: "Demand post not found." });
    return;
  }
  response.json(await prisma.demandPost.findUnique({ where: { id } }));
});

router.delete("/:id", requireRoles("BUYER"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const user = getAuthUser(request);
  const buyer = await prisma.buyerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!buyer) {
    response.status(404).json({ error: "Buyer profile not found." });
    return;
  }
  const deleted = await prisma.demandPost.deleteMany({ where: { id, buyerId: buyer.id } });
  if (!deleted.count) {
    response.status(404).json({ error: "Demand post not found." });
    return;
  }
  response.status(204).end();
});

export default router;
