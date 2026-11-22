import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import { getAuthUser, requireAuth, requireRoles } from "../middleware/requireAuth.js";

const router = Router();
const idSchema = z.string().uuid();
const grades = ["PREMIUM", "GRADE_A", "GRADE_B", "GRADE_C", "REJECTED"] as const;
const stages = ["INTAKE", "SORTED", "GRADED", "DRIED", "PACKED", "STORED", "DISPATCHED", "WASTE"] as const;
const intakeSchema = z.object({
  centerId: idSchema,
  farmerId: idSchema,
  cropId: idSchema,
  receivedKg: z.number().positive().max(1_000_000_000),
  acceptedKg: z.number().nonnegative().max(1_000_000_000),
  grade: z.enum(grades).nullable().optional(),
  stage: z.enum(stages).optional(),
  batchCode: z.string().trim().min(1).max(40).nullable().optional(),
  notesBn: z.string().trim().max(500).nullable().optional(),
}).strict().refine((value) => value.acceptedKg <= value.receivedKg, {
  message: "acceptedKg cannot exceed receivedKg.",
});
const intakePatchSchema = z.object({
  acceptedKg: z.number().nonnegative().max(1_000_000_000).optional(),
  grade: z.enum(grades).nullable().optional(),
  stage: z.enum(stages).optional(),
  dryingStartedAt: z.coerce.date().nullable().optional(),
  dryingEndedAt: z.coerce.date().nullable().optional(),
  packedAt: z.coerce.date().nullable().optional(),
  batchCode: z.string().trim().min(1).max(40).nullable().optional(),
  notesBn: z.string().trim().max(500).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

router.use(requireAuth);

async function workerUpazila(userId: string): Promise<string> {
  const worker = await prisma.fieldWorkerProfile.findUnique({ where: { userId }, select: { upazilaId: true } });
  if (!worker) throw new HttpError(403, "A field-worker area has not been assigned.");
  return worker.upazilaId;
}

router.get("/centers", requireRoles("ADMIN", "FIELD_WORKER", "COLLECTION_MANAGER"), async (request, response) => {
  const user = getAuthUser(request);
  const upazilaId = user.role === "FIELD_WORKER" ? await workerUpazila(user.id) : undefined;
  response.json(await prisma.collectionCenter.findMany({
    where: upazilaId ? { upazilaId, isActive: true } : { isActive: true },
    include: { upazila: { select: { id: true, nameBn: true, nameEn: true } } },
    orderBy: { nameEn: "asc" },
  }));
});

router.get("/", async (request, response) => {
  const user = getAuthUser(request);
  if (user.role === "FARMER") {
    const farmer = await prisma.farmerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!farmer) {
      response.status(404).json({ error: "Farmer profile not found." });
      return;
    }
    response.json(await prisma.collectionIntake.findMany({
      where: { farmerId: farmer.id },
      include: { crop: true, center: true },
      orderBy: { receivedAt: "desc" },
    }));
    return;
  }

  if (!["ADMIN", "FIELD_WORKER", "COLLECTION_MANAGER"].includes(user.role)) {
    response.status(403).json({ error: "You do not have permission to view collection records." });
    return;
  }
  const upazilaId = user.role === "FIELD_WORKER" ? await workerUpazila(user.id) : undefined;
  response.json(await prisma.collectionIntake.findMany({
    where: upazilaId ? { center: { upazilaId } } : undefined,
    include: { crop: true, center: true, farmer: { include: { user: { select: { id: true, name: true } } } } },
    orderBy: { receivedAt: "desc" },
  }));
});

router.get("/:id", async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const user = getAuthUser(request);
  const intake = await prisma.collectionIntake.findUnique({
    where: { id },
    include: { crop: true, center: true },
  });
  if (!intake) {
    response.status(404).json({ error: "Collection intake not found." });
    return;
  }
  if (user.role === "FARMER") {
    const farmer = await prisma.farmerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!farmer || intake.farmerId !== farmer.id) {
      response.status(404).json({ error: "Collection intake not found." });
      return;
    }
  } else if (user.role === "FIELD_WORKER" && intake.center.upazilaId !== await workerUpazila(user.id)) {
    response.status(404).json({ error: "Collection intake not found." });
    return;
  } else if (!["ADMIN", "FIELD_WORKER", "COLLECTION_MANAGER"].includes(user.role)) {
    response.status(403).json({ error: "You do not have permission to view collection records." });
    return;
  }
  response.json(intake);
});

router.post("/", requireRoles("ADMIN", "FIELD_WORKER", "COLLECTION_MANAGER"), async (request, response) => {
  const input = intakeSchema.parse(request.body);
  const user = getAuthUser(request);
  const [center, farmer] = await Promise.all([
    prisma.collectionCenter.findUnique({ where: { id: input.centerId }, select: { upazilaId: true } }),
    prisma.farmerProfile.findUnique({ where: { id: input.farmerId }, select: { upazilaId: true } }),
  ]);
  if (!center || !farmer) {
    response.status(404).json({ error: "Collection center or farmer profile not found." });
    return;
  }
  if (center.upazilaId !== farmer.upazilaId) {
    response.status(400).json({ error: "The collection center and farmer must be in the same upazila." });
    return;
  }
  if (user.role === "FIELD_WORKER" && center.upazilaId !== await workerUpazila(user.id)) {
    response.status(403).json({ error: "This collection center is outside your assigned upazila." });
    return;
  }
  response.status(201).json(await prisma.collectionIntake.create({ data: input }));
});

router.patch("/:id", requireRoles("ADMIN", "FIELD_WORKER", "COLLECTION_MANAGER"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const input = intakePatchSchema.parse(request.body);
  const user = getAuthUser(request);
  const existing = await prisma.collectionIntake.findUnique({
    where: { id },
    include: { center: { select: { upazilaId: true } } },
  });
  if (!existing) {
    response.status(404).json({ error: "Collection intake not found." });
    return;
  }
  if (user.role === "FIELD_WORKER" && existing.center.upazilaId !== await workerUpazila(user.id)) {
    response.status(404).json({ error: "Collection intake not found." });
    return;
  }
  if (input.acceptedKg !== undefined && input.acceptedKg > Number(existing.receivedKg)) {
    response.status(400).json({ error: "acceptedKg cannot exceed receivedKg." });
    return;
  }
  response.json(await prisma.collectionIntake.update({ where: { id }, data: input }));
});

router.delete("/:id", requireRoles("ADMIN", "FIELD_WORKER", "COLLECTION_MANAGER"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const user = getAuthUser(request);
  const existing = await prisma.collectionIntake.findUnique({
    where: { id },
    include: { center: { select: { upazilaId: true } } },
  });
  if (!existing) {
    response.status(404).json({ error: "Collection intake not found." });
    return;
  }
  if (user.role === "FIELD_WORKER" && existing.center.upazilaId !== await workerUpazila(user.id)) {
    response.status(404).json({ error: "Collection intake not found." });
    return;
  }
  await prisma.collectionIntake.delete({ where: { id } });
  response.status(204).end();
});

export default router;
