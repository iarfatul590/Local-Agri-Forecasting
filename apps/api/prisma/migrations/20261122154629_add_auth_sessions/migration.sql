-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FARMER', 'BUYER', 'FIELD_WORKER', 'ADMIN', 'COLLECTION_MANAGER');

-- CreateEnum
CREATE TYPE "BuyerType" AS ENUM ('WHOLESALER', 'RETAIL_SHOP', 'RESTAURANT', 'PROCESSOR', 'OTHER');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('MANUAL', 'MARKET_FEED', 'SCRAPER', 'GOVERNMENT');

-- CreateEnum
CREATE TYPE "DemandStatus" AS ENUM ('DRAFT', 'OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SUGGESTED', 'CONTACTED', 'ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QualityGrade" AS ENUM ('PREMIUM', 'GRADE_A', 'GRADE_B', 'GRADE_C', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProcessingStage" AS ENUM ('INTAKE', 'SORTED', 'GRADED', 'DRIED', 'PACKED', 'STORED', 'DISPATCHED', 'WASTE');

-- CreateEnum
CREATE TYPE "StorageMovementType" AS ENUM ('PUT_AWAY', 'TRANSFER_IN', 'TRANSFER_OUT', 'DISPATCH', 'ADJUSTMENT', 'LOSS');

-- CreateEnum
CREATE TYPE "FeeStatus" AS ENUM ('PENDING', 'PAID', 'WAIVED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'SMS', 'WHATSAPP', 'PUSH', 'VOICE');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'READ');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "phoneVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneOtpChallenge" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "phone" VARCHAR(16) NOT NULL,
    "codeHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upazila" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "nameEn" VARCHAR(100) NOT NULL,
    "nameBn" VARCHAR(100) NOT NULL,
    "districtEn" VARCHAR(100) NOT NULL,
    "districtBn" VARCHAR(100) NOT NULL,
    "divisionEn" VARCHAR(100) NOT NULL,
    "divisionBn" VARCHAR(100) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Upazila_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crop" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "nameEn" VARCHAR(80) NOT NULL,
    "nameBn" VARCHAR(80) NOT NULL,
    "unit" VARCHAR(16) NOT NULL DEFAULT 'kg',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Crop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmerProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "upazilaId" UUID NOT NULL,
    "landSizeAcres" DECIMAL(8,2) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "preferredVoice" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmerCrop" (
    "id" UUID NOT NULL,
    "farmerId" UUID NOT NULL,
    "cropId" UUID NOT NULL,
    "plantedAt" DATE,
    "expectedHarvestAt" DATE,
    "areaAcres" DECIMAL(8,2),
    "expectedYieldKg" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmerCrop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "upazilaId" UUID NOT NULL,
    "buyerType" "BuyerType" NOT NULL,
    "businessName" VARCHAR(160),
    "address" VARCHAR(300),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldWorkerProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "upazilaId" UUID NOT NULL,
    "employeeCode" VARCHAR(32),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldWorkerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" UUID NOT NULL,
    "cropId" UUID NOT NULL,
    "upazilaId" UUID NOT NULL,
    "observedAt" DATE NOT NULL,
    "source" "PriceSource" NOT NULL,
    "marketName" VARCHAR(120),
    "minPriceBdtKg" DECIMAL(12,2),
    "maxPriceBdtKg" DECIMAL(12,2),
    "averageBdtKg" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropForecast" (
    "id" UUID NOT NULL,
    "cropId" UUID NOT NULL,
    "upazilaId" UUID NOT NULL,
    "forecastDate" DATE NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weatherSummaryBn" VARCHAR(500) NOT NULL,
    "weatherSummaryEn" VARCHAR(500),
    "minTempC" DECIMAL(5,2),
    "maxTempC" DECIMAL(5,2),
    "rainfallMm" DECIMAL(7,2),
    "rainProbability" INTEGER,
    "forecastPriceBdt" DECIMAL(12,2),
    "forecastDemandKg" DECIMAL(14,2),
    "adviceBn" TEXT,
    "source" VARCHAR(40) NOT NULL DEFAULT 'MOCK',

    CONSTRAINT "CropForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandPost" (
    "id" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "cropId" UUID NOT NULL,
    "upazilaId" UUID NOT NULL,
    "quantityKg" DECIMAL(14,2) NOT NULL,
    "fulfilledKg" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "targetPriceBdtKg" DECIMAL(12,2),
    "deliveryFrom" DATE,
    "deliveryBy" DATE,
    "status" "DemandStatus" NOT NULL DEFAULT 'OPEN',
    "notesBn" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmerBuyerMatch" (
    "id" UUID NOT NULL,
    "farmerId" UUID NOT NULL,
    "demandPostId" UUID NOT NULL,
    "cropId" UUID NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'SUGGESTED',
    "matchScore" DECIMAL(5,2) NOT NULL,
    "quantityKg" DECIMAL(14,2) NOT NULL,
    "proposedPrice" DECIMAL(12,2),
    "contactedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmerBuyerMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionCenter" (
    "id" UUID NOT NULL,
    "nameBn" VARCHAR(120) NOT NULL,
    "nameEn" VARCHAR(120) NOT NULL,
    "upazilaId" UUID NOT NULL,
    "address" VARCHAR(300),
    "capacityKg" DECIMAL(14,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionIntake" (
    "id" UUID NOT NULL,
    "centerId" UUID NOT NULL,
    "farmerId" UUID NOT NULL,
    "cropId" UUID NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedKg" DECIMAL(14,2) NOT NULL,
    "acceptedKg" DECIMAL(14,2) NOT NULL,
    "grade" "QualityGrade",
    "stage" "ProcessingStage" NOT NULL DEFAULT 'INTAKE',
    "dryingStartedAt" TIMESTAMP(3),
    "dryingEndedAt" TIMESTAMP(3),
    "packedAt" TIMESTAMP(3),
    "batchCode" VARCHAR(40),
    "notesBn" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionIntake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageMovement" (
    "id" UUID NOT NULL,
    "centerId" UUID NOT NULL,
    "intakeId" UUID NOT NULL,
    "movement" "StorageMovementType" NOT NULL,
    "quantityKg" DECIMAL(14,2) NOT NULL,
    "location" VARCHAR(80),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" VARCHAR(300),

    CONSTRAINT "StorageMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeCalculation" (
    "id" UUID NOT NULL,
    "matchId" UUID,
    "intakeId" UUID,
    "payerId" UUID NOT NULL,
    "basisAmountBdt" DECIMAL(14,2),
    "commissionRate" DECIMAL(5,2) NOT NULL,
    "commissionBdt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "serviceFeeBdt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalFeeBdt" DECIMAL(14,2) NOT NULL,
    "status" "FeeStatus" NOT NULL DEFAULT 'PENDING',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "FeeCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "titleBn" VARCHAR(160),
    "bodyBn" TEXT NOT NULL,
    "voiceAssetUrl" VARCHAR(500),
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failureCode" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementEvent" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "upazilaId" UUID,
    "eventType" VARCHAR(60) NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "PhoneOtpChallenge_phone_createdAt_idx" ON "PhoneOtpChallenge"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneOtpChallenge_expiresAt_consumedAt_idx" ON "PhoneOtpChallenge"("expiresAt", "consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_expiresAt_idx" ON "AuthSession"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Upazila_code_key" ON "Upazila"("code");

-- CreateIndex
CREATE INDEX "Upazila_districtEn_nameEn_idx" ON "Upazila"("districtEn", "nameEn");

-- CreateIndex
CREATE UNIQUE INDEX "Crop_code_key" ON "Crop"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FarmerProfile_userId_key" ON "FarmerProfile"("userId");

-- CreateIndex
CREATE INDEX "FarmerProfile_upazilaId_idx" ON "FarmerProfile"("upazilaId");

-- CreateIndex
CREATE INDEX "FarmerCrop_cropId_expectedHarvestAt_idx" ON "FarmerCrop"("cropId", "expectedHarvestAt");

-- CreateIndex
CREATE UNIQUE INDEX "FarmerCrop_farmerId_cropId_key" ON "FarmerCrop"("farmerId", "cropId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerProfile_userId_key" ON "BuyerProfile"("userId");

-- CreateIndex
CREATE INDEX "BuyerProfile_upazilaId_buyerType_idx" ON "BuyerProfile"("upazilaId", "buyerType");

-- CreateIndex
CREATE UNIQUE INDEX "FieldWorkerProfile_userId_key" ON "FieldWorkerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldWorkerProfile_employeeCode_key" ON "FieldWorkerProfile"("employeeCode");

-- CreateIndex
CREATE INDEX "FieldWorkerProfile_upazilaId_idx" ON "FieldWorkerProfile"("upazilaId");

-- CreateIndex
CREATE INDEX "MarketPrice_upazilaId_observedAt_idx" ON "MarketPrice"("upazilaId", "observedAt");

-- CreateIndex
CREATE INDEX "MarketPrice_cropId_observedAt_idx" ON "MarketPrice"("cropId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPrice_cropId_upazilaId_observedAt_source_marketName_key" ON "MarketPrice"("cropId", "upazilaId", "observedAt", "source", "marketName");

-- CreateIndex
CREATE INDEX "CropForecast_upazilaId_forecastDate_idx" ON "CropForecast"("upazilaId", "forecastDate");

-- CreateIndex
CREATE UNIQUE INDEX "CropForecast_cropId_upazilaId_forecastDate_generatedAt_key" ON "CropForecast"("cropId", "upazilaId", "forecastDate", "generatedAt");

-- CreateIndex
CREATE INDEX "DemandPost_cropId_upazilaId_status_idx" ON "DemandPost"("cropId", "upazilaId", "status");

-- CreateIndex
CREATE INDEX "DemandPost_status_deliveryBy_idx" ON "DemandPost"("status", "deliveryBy");

-- CreateIndex
CREATE INDEX "FarmerBuyerMatch_farmerId_status_idx" ON "FarmerBuyerMatch"("farmerId", "status");

-- CreateIndex
CREATE INDEX "FarmerBuyerMatch_demandPostId_status_idx" ON "FarmerBuyerMatch"("demandPostId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FarmerBuyerMatch_farmerId_demandPostId_key" ON "FarmerBuyerMatch"("farmerId", "demandPostId");

-- CreateIndex
CREATE INDEX "CollectionCenter_upazilaId_isActive_idx" ON "CollectionCenter"("upazilaId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionIntake_batchCode_key" ON "CollectionIntake"("batchCode");

-- CreateIndex
CREATE INDEX "CollectionIntake_centerId_receivedAt_idx" ON "CollectionIntake"("centerId", "receivedAt");

-- CreateIndex
CREATE INDEX "CollectionIntake_farmerId_receivedAt_idx" ON "CollectionIntake"("farmerId", "receivedAt");

-- CreateIndex
CREATE INDEX "StorageMovement_centerId_occurredAt_idx" ON "StorageMovement"("centerId", "occurredAt");

-- CreateIndex
CREATE INDEX "StorageMovement_intakeId_occurredAt_idx" ON "StorageMovement"("intakeId", "occurredAt");

-- CreateIndex
CREATE INDEX "FeeCalculation_payerId_status_idx" ON "FeeCalculation"("payerId", "status");

-- CreateIndex
CREATE INDEX "FeeCalculation_calculatedAt_idx" ON "FeeCalculation"("calculatedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_status_createdAt_idx" ON "Notification"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_channel_status_scheduledAt_idx" ON "Notification"("channel", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "EngagementEvent_upazilaId_eventType_occurredAt_idx" ON "EngagementEvent"("upazilaId", "eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "EngagementEvent_userId_occurredAt_idx" ON "EngagementEvent"("userId", "occurredAt");

-- AddForeignKey
ALTER TABLE "PhoneOtpChallenge" ADD CONSTRAINT "PhoneOtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerProfile" ADD CONSTRAINT "FarmerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerProfile" ADD CONSTRAINT "FarmerProfile_upazilaId_fkey" FOREIGN KEY ("upazilaId") REFERENCES "Upazila"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerCrop" ADD CONSTRAINT "FarmerCrop_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "FarmerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerCrop" ADD CONSTRAINT "FarmerCrop_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerProfile" ADD CONSTRAINT "BuyerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerProfile" ADD CONSTRAINT "BuyerProfile_upazilaId_fkey" FOREIGN KEY ("upazilaId") REFERENCES "Upazila"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldWorkerProfile" ADD CONSTRAINT "FieldWorkerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldWorkerProfile" ADD CONSTRAINT "FieldWorkerProfile_upazilaId_fkey" FOREIGN KEY ("upazilaId") REFERENCES "Upazila"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPrice" ADD CONSTRAINT "MarketPrice_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPrice" ADD CONSTRAINT "MarketPrice_upazilaId_fkey" FOREIGN KEY ("upazilaId") REFERENCES "Upazila"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropForecast" ADD CONSTRAINT "CropForecast_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropForecast" ADD CONSTRAINT "CropForecast_upazilaId_fkey" FOREIGN KEY ("upazilaId") REFERENCES "Upazila"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandPost" ADD CONSTRAINT "DemandPost_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "BuyerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandPost" ADD CONSTRAINT "DemandPost_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandPost" ADD CONSTRAINT "DemandPost_upazilaId_fkey" FOREIGN KEY ("upazilaId") REFERENCES "Upazila"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerBuyerMatch" ADD CONSTRAINT "FarmerBuyerMatch_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "FarmerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerBuyerMatch" ADD CONSTRAINT "FarmerBuyerMatch_demandPostId_fkey" FOREIGN KEY ("demandPostId") REFERENCES "DemandPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerBuyerMatch" ADD CONSTRAINT "FarmerBuyerMatch_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionCenter" ADD CONSTRAINT "CollectionCenter_upazilaId_fkey" FOREIGN KEY ("upazilaId") REFERENCES "Upazila"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionIntake" ADD CONSTRAINT "CollectionIntake_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "CollectionCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionIntake" ADD CONSTRAINT "CollectionIntake_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "FarmerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionIntake" ADD CONSTRAINT "CollectionIntake_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageMovement" ADD CONSTRAINT "StorageMovement_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "CollectionCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageMovement" ADD CONSTRAINT "StorageMovement_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "CollectionIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCalculation" ADD CONSTRAINT "FeeCalculation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "FarmerBuyerMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCalculation" ADD CONSTRAINT "FeeCalculation_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "CollectionIntake"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCalculation" ADD CONSTRAINT "FeeCalculation_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementEvent" ADD CONSTRAINT "EngagementEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementEvent" ADD CONSTRAINT "EngagementEvent_upazilaId_fkey" FOREIGN KEY ("upazilaId") REFERENCES "Upazila"("id") ON DELETE SET NULL ON UPDATE CASCADE;
