import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { getAuthUser, requireAuth, requireRoles } from "../middleware/requireAuth.js";

const router = Router();
const idSchema = z.string().uuid();
const profileSchema = z.object({
  upazilaId: idSchema,
  landSizeAcres: z.number().positive().max(100000),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  preferredVoice: z.boolean().optional(),
}).strict();
const profilePatchSchema = profileSchema.partial().refine((value) => Object.keys(value).length > 0);
const cropPlanSchema = z.object({
  cropId: idSchema,
  plantedAt: z.coerce.date().nullable().optional(),
  expectedHarvestAt: z.coerce.date().nullable().optional(),
  areaAcres: z.number().positive().max(100000).nullable().optional(),
  expectedYieldKg: z.number().nonnegative().max(1_000_000_000).nullable().optional(),
}).strict();
const cropPlanPatchSchema = cropPlanSchema.partial().refine((value) => Object.keys(value).length > 0);

router.use(requireAuth);

router.get("/", requireRoles("ADMIN", "FIELD_WORKER", "COLLECTION_MANAGER"), async (request, response) => {
  const user = getAuthUser(request);
  const worker = user.role === "FIELD_WORKER"
    ? await prisma.fieldWorkerProfile.findUnique({ where: { userId: user.id }, select: { upazilaId: true } })
    : null;
  if (user.role === "FIELD_WORKER" && !worker) {
    response.status(403).json({ error: "A field-worker area has not been assigned." });
    return;
  }
  const farmers = await prisma.farmerProfile.findMany({
    where: worker ? { upazilaId: worker.upazilaId } : undefined,
    include: { user: { select: { id: true, name: true, phone: true, phoneVerifiedAt: true } } },
    orderBy: { createdAt: "desc" },
  });
  response.json(farmers);
});

router.get("/me", requireRoles("FARMER"), async (request, response) => {
  const user = getAuthUser(request);
  const farmer = await prisma.farmerProfile.findUnique({
    where: { userId: user.id },
    include: { crops: true },
  });
  if (!farmer) {
    response.status(404).json({ error: "Farmer profile not found." });
    return;
  }
  response.json(farmer);
});

router.post("/me", requireRoles("FARMER"), async (request, response) => {
  const input = profileSchema.parse(request.body);
  const user = getAuthUser(request);
  const farmer = await prisma.farmerProfile.create({
    data: { ...input, userId: user.id },
  });
  response.status(201).json(farmer);
});

router.patch("/me", requireRoles("FARMER"), async (request, response) => {
  const input = profilePatchSchema.parse(request.body);
  const user = getAuthUser(request);
  const farmer = await prisma.farmerProfile.update({
    where: { userId: user.id },
    data: input,
  });
  response.json(farmer);
});

router.delete("/me", requireRoles("FARMER"), async (request, response) => {
  const user = getAuthUser(request);
  await prisma.farmerProfile.delete({ where: { userId: user.id } });
  response.status(204).end();
});

router.get("/me/crops", requireRoles("FARMER"), async (request, response) => {
  const user = getAuthUser(request);
  const farmer = await prisma.farmerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!farmer) {
    response.status(404).json({ error: "Farmer profile not found." });
    return;
  }
  response.json(await prisma.farmerCrop.findMany({
    where: { farmerId: farmer.id },
    include: { crop: true },
    orderBy: { createdAt: "desc" },
  }));
});

router.post("/me/crops", requireRoles("FARMER"), async (request, response) => {
  const input = cropPlanSchema.parse(request.body);
  const user = getAuthUser(request);
  const farmer = await prisma.farmerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!farmer) {
    response.status(404).json({ error: "Farmer profile not found." });
    return;
  }
  const cropPlan = await prisma.farmerCrop.create({ data: { ...input, farmerId: farmer.id } });
  response.status(201).json(cropPlan);
});

router.patch("/me/crops/:id", requireRoles("FARMER"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const input = cropPlanPatchSchema.parse(request.body);
  const user = getAuthUser(request);
  const farmer = await prisma.farmerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!farmer) {
    response.status(404).json({ error: "Farmer profile not found." });
    return;
  }
  const updated = await prisma.farmerCrop.updateMany({ where: { id, farmerId: farmer.id }, data: input });
  if (!updated.count) {
    response.status(404).json({ error: "Crop plan not found." });
    return;
  }
  response.json(await prisma.farmerCrop.findUnique({ where: { id }, include: { crop: true } }));
});

router.delete("/me/crops/:id", requireRoles("FARMER"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const user = getAuthUser(request);
  const farmer = await prisma.farmerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!farmer) {
    response.status(404).json({ error: "Farmer profile not found." });
    return;
  }
  const deleted = await prisma.farmerCrop.deleteMany({ where: { id, farmerId: farmer.id } });
  if (!deleted.count) {
    response.status(404).json({ error: "Crop plan not found." });
    return;
  }
  response.status(204).end();
});

export default router;
