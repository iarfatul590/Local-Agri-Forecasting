import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth, requireRoles } from "../middleware/requireAuth.js";

const router = Router();
const idSchema = z.string().uuid();
const cropSchema = z.object({
  code: z.string().trim().min(1).max(30),
  nameEn: z.string().trim().min(1).max(80),
  nameBn: z.string().trim().min(1).max(80),
  unit: z.string().trim().min(1).max(16).optional(),
  isActive: z.boolean().optional(),
}).strict();
const cropPatchSchema = cropSchema.partial().refine((value) => Object.keys(value).length > 0);

router.use(requireAuth);

router.get("/", async (request, response) => {
  const isAdmin = request.user?.role === "ADMIN";
  response.json(await prisma.crop.findMany({
    where: isAdmin && request.query.includeInactive === "true" ? undefined : { isActive: true },
    orderBy: { nameEn: "asc" },
  }));
});

router.get("/:id", async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const crop = await prisma.crop.findUnique({ where: { id } });
  if (!crop || (!crop.isActive && request.user?.role !== "ADMIN")) {
    response.status(404).json({ error: "Crop not found." });
    return;
  }
  response.json(crop);
});

router.post("/", requireRoles("ADMIN"), async (request, response) => {
  const input = cropSchema.parse(request.body);
  response.status(201).json(await prisma.crop.create({ data: input }));
});

router.patch("/:id", requireRoles("ADMIN"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const input = cropPatchSchema.parse(request.body);
  response.json(await prisma.crop.update({ where: { id }, data: input }));
});

router.delete("/:id", requireRoles("ADMIN"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  await prisma.crop.delete({ where: { id } });
  response.status(204).end();
});

export default router;
