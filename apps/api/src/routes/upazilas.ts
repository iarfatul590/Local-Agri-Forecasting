import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", requireAuth, async (_request, response) => {
  const upazilas = await prisma.upazila.findMany({
    select: {
      id: true,
      code: true,
      nameBn: true,
      nameEn: true,
      districtBn: true,
      districtEn: true,
      divisionBn: true,
      divisionEn: true,
    },
    orderBy: [{ divisionEn: "asc" }, { districtEn: "asc" }, { nameEn: "asc" }],
  });
  response.json(upazilas);
});

export default router;
