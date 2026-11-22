import "dotenv/config";
import { prisma } from "../src/db/prisma.js";

const upazilas = [
  {
    code: "STARTER-RANGPUR-SADAR",
    nameEn: "Rangpur Sadar",
    nameBn: "রংপুর সদর",
    districtEn: "Rangpur",
    districtBn: "রংপুর",
    divisionEn: "Rangpur",
    divisionBn: "রংপুর",
    latitude: 25.7468,
    longitude: 89.2508,
    centerNameEn: "Rangpur Sadar Collection Center",
    centerNameBn: "রংপুর সদর সংগ্রহ কেন্দ্র",
  },
  {
    code: "STARTER-BOGURA-SADAR",
    nameEn: "Bogura Sadar",
    nameBn: "বগুড়া সদর",
    districtEn: "Bogura",
    districtBn: "বগুড়া",
    divisionEn: "Rajshahi",
    divisionBn: "রাজশাহী",
    latitude: 24.8465,
    longitude: 89.3773,
    centerNameEn: "Bogura Sadar Collection Center",
    centerNameBn: "বগুড়া সদর সংগ্রহ কেন্দ্র",
  },
  {
    code: "STARTER-JASHORE-SADAR",
    nameEn: "Jashore Sadar",
    nameBn: "যশোর সদর",
    districtEn: "Jashore",
    districtBn: "যশোর",
    divisionEn: "Khulna",
    divisionBn: "খুলনা",
    latitude: 23.1667,
    longitude: 89.2167,
    centerNameEn: "Jashore Sadar Collection Center",
    centerNameBn: "যশোর সদর সংগ্রহ কেন্দ্র",
  },
] as const;

const crops = [
  { code: "rice", nameEn: "Rice", nameBn: "ধান", unit: "kg" },
  { code: "potato", nameEn: "Potato", nameBn: "আলু", unit: "kg" },
  { code: "onion", nameEn: "Onion", nameBn: "পেঁয়াজ", unit: "kg" },
  { code: "tomato", nameEn: "Tomato", nameBn: "টমেটো", unit: "kg" },
  { code: "maize", nameEn: "Maize", nameBn: "ভুট্টা", unit: "kg" },
  { code: "lentil", nameEn: "Lentil", nameBn: "মসুর ডাল", unit: "kg" },
  { code: "mango", nameEn: "Mango", nameBn: "আম", unit: "kg" },
] as const;

async function seedReferenceData() {
  for (const item of upazilas) {
    const upazila = await prisma.upazila.upsert({
      where: { code: item.code },
      update: {
        nameEn: item.nameEn,
        nameBn: item.nameBn,
        districtEn: item.districtEn,
        districtBn: item.districtBn,
        divisionEn: item.divisionEn,
        divisionBn: item.divisionBn,
        latitude: item.latitude,
        longitude: item.longitude,
      },
      create: {
        code: item.code,
        nameEn: item.nameEn,
        nameBn: item.nameBn,
        districtEn: item.districtEn,
        districtBn: item.districtBn,
        divisionEn: item.divisionEn,
        divisionBn: item.divisionBn,
        latitude: item.latitude,
        longitude: item.longitude,
      },
    });

    const center = await prisma.collectionCenter.findFirst({
      where: { upazilaId: upazila.id, nameEn: item.centerNameEn },
      select: { id: true },
    });
    const centerData = {
      nameBn: item.centerNameBn,
      nameEn: item.centerNameEn,
      upazilaId: upazila.id,
      address: `${item.nameBn} — স্টার্টার রেফারেন্স কেন্দ্র`,
      capacityKg: 10000,
      isActive: true,
    };
    if (center) {
      await prisma.collectionCenter.update({ where: { id: center.id }, data: centerData });
    } else {
      await prisma.collectionCenter.create({ data: centerData });
    }
  }

  for (const crop of crops) {
    await prisma.crop.upsert({
      where: { code: crop.code },
      update: { nameEn: crop.nameEn, nameBn: crop.nameBn, unit: crop.unit, isActive: true },
      create: { ...crop, isActive: true },
    });
  }
}

seedReferenceData()
  .then(() => console.info("Reference data seeded."))
  .catch((error: unknown) => {
    console.error("Failed to seed reference data.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
