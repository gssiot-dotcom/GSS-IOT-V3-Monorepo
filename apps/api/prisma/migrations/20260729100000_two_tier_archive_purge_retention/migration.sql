-- Two-tier archive metadata, tenant provenance and durable deletion orchestration.
-- This migration is forward-only and intentionally preserves all existing history.

CREATE TYPE "ArchiveEntityType" AS ENUM (
  'COMPANY',
  'CONSTRUCTION_AREA',
  'CONSTRUCTION_BUILDING',
  'COMPANY_USER',
  'COMPANY_POSITION',
  'COMPANY_ROLE',
  'ALARM_RULE',
  'ALARM_RECIPIENT_POLICY',
  'ALARM_EVENT',
  'ALARM_NOTIFICATION',
  'GATEWAY_COMMAND',
  'SENSOR_READING_FILTER'
);

CREATE TYPE "DeletionJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TYPE "DeletionJobPhase" AS ENUM (
  'PREPARE',
  'OPERATIONAL_TEARDOWN',
  'STORAGE_CLEANUP',
  'SENSOR_READINGS',
  'EVIDENCE',
  'TENANT_RELATIONS',
  'ROOT',
  'COMPLETE'
);

ALTER TABLE "Company"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedByType" "AuditActorType",
  ADD COLUMN "deletedById" UUID,
  ADD COLUMN "deleteReason" TEXT;

ALTER TABLE "ConstructionArea"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedByType" "AuditActorType",
  ADD COLUMN "deletedById" UUID,
  ADD COLUMN "deleteReason" TEXT;

ALTER TABLE "ConstructionBuilding"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedByType" "AuditActorType",
  ADD COLUMN "deletedById" UUID,
  ADD COLUMN "deleteReason" TEXT;

ALTER TABLE "CompanyUser"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedByType" "AuditActorType",
  ADD COLUMN "deletedById" UUID,
  ADD COLUMN "deleteReason" TEXT;

ALTER TABLE "CompanyRole"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedByType" "AuditActorType",
  ADD COLUMN "deletedById" UUID,
  ADD COLUMN "deleteReason" TEXT;

ALTER TABLE "CompanyPosition" ADD COLUMN "deleteReason" TEXT;
ALTER TABLE "AlarmRule" ADD COLUMN "deleteReason" TEXT;
ALTER TABLE "AlarmRecipientPolicy" ADD COLUMN "deleteReason" TEXT;
ALTER TABLE "AlarmEvent" ADD COLUMN "deleteReason" TEXT;
ALTER TABLE "AlarmNotification" ADD COLUMN "deleteReason" TEXT;

ALTER TABLE "GatewayCommand"
  ADD COLUMN "companyId" UUID,
  ADD COLUMN "areaId" UUID,
  ADD COLUMN "buildingId" UUID,
  ADD COLUMN "scopeSnapshot" JSONB,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedByType" "AuditActorType",
  ADD COLUMN "deletedById" UUID,
  ADD COLUMN "deleteReason" TEXT;

ALTER TABLE "AuditLog"
  ADD COLUMN "companyId" UUID,
  ADD COLUMN "areaId" UUID,
  ADD COLUMN "buildingId" UUID,
  ADD COLUMN "scopeSnapshot" JSONB;

CREATE TABLE "DeletionJob" (
  "id" UUID NOT NULL,
  "rootType" "ArchiveEntityType" NOT NULL,
  "rootId" UUID,
  "targetKey" TEXT NOT NULL,
  "requesterAdminId" UUID NOT NULL,
  "companyId" UUID,
  "areaId" UUID,
  "buildingId" UUID,
  "typedFilter" JSONB NOT NULL,
  "previewHash" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "activeKey" TEXT NOT NULL DEFAULT 'active',
  "status" "DeletionJobStatus" NOT NULL DEFAULT 'PENDING',
  "currentPhase" "DeletionJobPhase" NOT NULL DEFAULT 'PREPARE',
  "totalCounts" JSONB NOT NULL,
  "deletedCounts" JSONB NOT NULL,
  "failedCounts" JSONB NOT NULL,
  "safeErrorSummary" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeletionJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurgeReceipt" (
  "id" UUID NOT NULL,
  "deletionJobId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "rootEntityType" "ArchiveEntityType" NOT NULL,
  "deletedGroupCounts" JSONB NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL,
  "status" "DeletionJobStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PurgeReceipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Company_deletedAt_name_id_idx" ON "Company"("deletedAt", "name", "id");
CREATE INDEX "ConstructionArea_companyId_deletedAt_name_id_idx" ON "ConstructionArea"("companyId", "deletedAt", "name", "id");
CREATE INDEX "ConstructionBuilding_companyId_deletedAt_title_id_idx" ON "ConstructionBuilding"("companyId", "deletedAt", "title", "id");
CREATE INDEX "ConstructionBuilding_areaId_deletedAt_title_id_idx" ON "ConstructionBuilding"("areaId", "deletedAt", "title", "id");
CREATE INDEX "CompanyUser_companyId_deletedAt_isActive_name_id_idx" ON "CompanyUser"("companyId", "deletedAt", "isActive", "name", "id");
CREATE INDEX "CompanyRole_companyId_deletedAt_name_id_idx" ON "CompanyRole"("companyId", "deletedAt", "name", "id");
CREATE INDEX "GatewayCommand_companyId_deletedAt_createdAt_id_idx" ON "GatewayCommand"("companyId", "deletedAt", "createdAt", "id");
CREATE INDEX "GatewayCommand_areaId_deletedAt_createdAt_id_idx" ON "GatewayCommand"("areaId", "deletedAt", "createdAt", "id");
CREATE INDEX "GatewayCommand_buildingId_deletedAt_createdAt_id_idx" ON "GatewayCommand"("buildingId", "deletedAt", "createdAt", "id");
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");
CREATE INDEX "AuditLog_areaId_createdAt_idx" ON "AuditLog"("areaId", "createdAt");
CREATE INDEX "AuditLog_buildingId_createdAt_idx" ON "AuditLog"("buildingId", "createdAt");

CREATE UNIQUE INDEX "DeletionJob_idempotencyKey_key" ON "DeletionJob"("idempotencyKey");
CREATE UNIQUE INDEX "DeletionJob_targetKey_activeKey_key" ON "DeletionJob"("targetKey", "activeKey");
CREATE INDEX "DeletionJob_status_createdAt_idx" ON "DeletionJob"("status", "createdAt");
CREATE INDEX "DeletionJob_companyId_status_createdAt_idx" ON "DeletionJob"("companyId", "status", "createdAt");
CREATE UNIQUE INDEX "PurgeReceipt_deletionJobId_key" ON "PurgeReceipt"("deletionJobId");
CREATE INDEX "PurgeReceipt_completedAt_idx" ON "PurgeReceipt"("completedAt");

ALTER TABLE "DeletionJob"
  ADD CONSTRAINT "DeletionJob_requesterAdminId_fkey"
  FOREIGN KEY ("requesterAdminId") REFERENCES "GssAdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurgeReceipt"
  ADD CONSTRAINT "PurgeReceipt_deletionJobId_fkey"
  FOREIGN KEY ("deletionJobId") REFERENCES "DeletionJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

