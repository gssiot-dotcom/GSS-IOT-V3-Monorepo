-- Phase 3 organization, company-user, position, image-metadata, and audit foundation.
ALTER TABLE "Company"
  ADD COLUMN "address" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "logoKey" TEXT;

ALTER TABLE "ConstructionArea"
  ADD COLUMN "address" TEXT,
  ADD COLUMN "description" TEXT;

ALTER TABLE "ConstructionBuilding"
  ADD COLUMN "number" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "buildingType" TEXT,
  ADD COLUMN "startDate" TIMESTAMP(3);

CREATE TYPE "BuildingImageKind" AS ENUM ('PLAN', 'REAL');
CREATE TYPE "PositionAssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');
CREATE TYPE "AuditActorType" AS ENUM ('GSS_ADMIN', 'COMPANY_USER', 'SYSTEM');

CREATE TABLE "BuildingPlanImage" (
  "id" UUID NOT NULL,
  "buildingId" UUID NOT NULL,
  "kind" "BuildingImageKind" NOT NULL,
  "storageKey" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BuildingPlanImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyPosition" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyPosition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyUserPositionAssignment" (
  "id" UUID NOT NULL,
  "companyUserId" UUID NOT NULL,
  "positionId" UUID NOT NULL,
  "areaId" UUID,
  "buildingId" UUID,
  "status" "PositionAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "CompanyUserPositionAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" UUID NOT NULL,
  "actorType" "AuditActorType" NOT NULL,
  "actorId" UUID,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" UUID,
  "oldValue" JSONB,
  "newValue" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BuildingPlanImage_buildingId_kind_orderIndex_key"
  ON "BuildingPlanImage"("buildingId", "kind", "orderIndex");
CREATE UNIQUE INDEX "CompanyPosition_companyId_key_key"
  ON "CompanyPosition"("companyId", "key");
CREATE UNIQUE INDEX "CompanyUserPositionAssignment_active_scope_key"
  ON "CompanyUserPositionAssignment"("companyUserId", "positionId", COALESCE("areaId", '00000000-0000-0000-0000-000000000000'::uuid), COALESCE("buildingId", '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE "status" = 'ACTIVE';
CREATE INDEX "CompanyUserPositionAssignment_companyUserId_status_idx"
  ON "CompanyUserPositionAssignment"("companyUserId", "status");
CREATE INDEX "CompanyUserPositionAssignment_positionId_status_idx"
  ON "CompanyUserPositionAssignment"("positionId", "status");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_actorType_actorId_idx" ON "AuditLog"("actorType", "actorId");

ALTER TABLE "BuildingPlanImage"
  ADD CONSTRAINT "BuildingPlanImage_buildingId_fkey"
  FOREIGN KEY ("buildingId") REFERENCES "ConstructionBuilding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyPosition"
  ADD CONSTRAINT "CompanyPosition_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyUserPositionAssignment"
  ADD CONSTRAINT "CompanyUserPositionAssignment_companyUserId_fkey"
  FOREIGN KEY ("companyUserId") REFERENCES "CompanyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CompanyUserPositionAssignment_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "CompanyPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CompanyUserPositionAssignment_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "ConstructionArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CompanyUserPositionAssignment_buildingId_fkey"
  FOREIGN KEY ("buildingId") REFERENCES "ConstructionBuilding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
