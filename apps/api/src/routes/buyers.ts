import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { getAuthUser, requireAuth, requireRoles } from "../middleware/requireAuth.js";

const router = Router();
const idSchema = z.string().uuid();
const buyerTypes = ["WHOLESALER", "RETAIL_SHOP", "RESTAURANT", "PROCESSOR", "OTHER"] as const;
const buyerSchema = z.object({
  upazilaId: idSchema,
  buyerType: z.enum(buyerTypes),
  businessName: z.string().trim().max(160).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
}).strict();
const buyerPatchSchema = buyerSchema.partial().refine((value) => Object.keys(value).length > 0);

router.use(requireAuth);

router.get("/", requireRoles("ADMIN", "FIELD_WORKER"), async (request, response) => {
  const user = getAuthUser(request);
  const worker = user.role === "FIELD_WORKER"
    ? await prisma.fieldWorkerProfile.findUnique({ where: { userId: user.id }, select: { upazilaId: true } })
    : null;
  if (user.role === "FIELD_WORKER" && !worker) {
    response.status(403).json({ error: "A field-worker area has not been assigned." });
    return;
  }
  response.json(await prisma.buyerProfile.findMany({
    where: worker ? { upazilaId: worker.upazilaId } : undefined,
    include: { user: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: "desc" },
  }));
});

router.get("/me", requireRoles("BUYER"), async (request, response) => {
  const user = getAuthUser(request);
  const buyer = await prisma.buyerProfile.findUnique({ where: { userId: user.id }, include: { demands: true } });
  if (!buyer) {
    response.status(404).json({ error: "Buyer profile not found." });
    return;
  }
  response.json(buyer);
});

router.post("/me", requireRoles("BUYER"), async (request, response) => {
  const input = buyerSchema.parse(request.body);
  const user = getAuthUser(request);
  response.status(201).json(await prisma.buyerProfile.create({
    data: { ...input, userId: user.id },
  }));
});

router.patch("/me", requireRoles("BUYER"), async (request, response) => {
  const input = buyerPatchSchema.parse(request.body);
  const user = getAuthUser(request);
  response.json(await prisma.buyerProfile.update({
    where: { userId: user.id },
    data: input,
  }));
});

router.delete("/me", requireRoles("BUYER"), async (request, response) => {
  const user = getAuthUser(request);
  await prisma.buyerProfile.delete({ where: { userId: user.id } });
  response.status(204).end();
});

export default router;
