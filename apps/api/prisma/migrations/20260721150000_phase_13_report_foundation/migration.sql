-- Phase 13 report job/export foundation.

CREATE TYPE "ReportRequesterType" AS ENUM ('GSS_ADMIN', 'COMPANY_USER');
CREATE TYPE "ReportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "ReportType" AS ENUM (
  'COMPANY_SUMMARY',
  'SITE_SUMMARY',
  'BUILDING_SUMMARY',
  'DEVICE_INVENTORY',
  'DEVICE_ASSIGNMENT_HISTORY',
  'GATEWAY_STATUS_HISTORY',
  'NODE_STATUS_HISTORY',
  'SENSOR_HISTORY',
  'ALARM_HISTORY',
  'MQTT_COMMAND_HISTORY',
  'USER_ACTIVITY',
  'AUDIT_LOG'
);
CREATE TYPE "ReportFileFormat" AS ENUM ('CSV', 'XLSX');

CREATE TABLE "ReportJob" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "requestedByType" "ReportRequesterType" NOT NULL,
  "requestedById" UUID NOT NULL,
  "companyId" UUID,
  "areaId" UUID,
  "buildingId" UUID,
  "reportType" "ReportType" NOT NULL,
  "filters" JSONB NOT NULL,
  "scopeSnapshot" JSONB NOT NULL,
  "status" "ReportJobStatus" NOT NULL DEFAULT 'PENDING',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReportJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReportJob_progress_chk" CHECK ("progress" >= 0 AND "progress" <= 100)
);

CREATE TABLE "ReportExport" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reportJobId" UUID NOT NULL,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "format" "ReportFileFormat" NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER,
  "checksum" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdByType" "AuditActorType" NOT NULL,
  "createdById" UUID,
  "downloadedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReportExport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReportExport_size_chk" CHECK ("sizeBytes" IS NULL OR "sizeBytes" >= 0)
);

CREATE INDEX "ReportJob_requestedByType_requestedById_createdAt_idx"
  ON "ReportJob"("requestedByType", "requestedById", "createdAt");
CREATE INDEX "ReportJob_companyId_createdAt_idx" ON "ReportJob"("companyId", "createdAt");
CREATE INDEX "ReportJob_reportType_status_createdAt_idx"
  ON "ReportJob"("reportType", "status", "createdAt");
CREATE INDEX "ReportJob_status_createdAt_idx" ON "ReportJob"("status", "createdAt");
CREATE INDEX "ReportJob_createdAt_idx" ON "ReportJob"("createdAt");

CREATE UNIQUE INDEX "ReportExport_storageKey_key" ON "ReportExport"("storageKey");
CREATE INDEX "ReportExport_reportJobId_createdAt_idx"
  ON "ReportExport"("reportJobId", "createdAt");
CREATE INDEX "ReportExport_expiresAt_idx" ON "ReportExport"("expiresAt");
CREATE INDEX "ReportExport_createdByType_createdById_createdAt_idx"
  ON "ReportExport"("createdByType", "createdById", "createdAt");

ALTER TABLE "ReportJob"
  ADD CONSTRAINT "ReportJob_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ReportJob_areaId_fkey"
    FOREIGN KEY ("areaId") REFERENCES "ConstructionArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ReportJob_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "ConstructionBuilding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReportExport"
  ADD CONSTRAINT "ReportExport_reportJobId_fkey"
    FOREIGN KEY ("reportJobId") REFERENCES "ReportJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
