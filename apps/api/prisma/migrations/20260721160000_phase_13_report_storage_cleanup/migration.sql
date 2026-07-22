-- Phase 13: preserve export history while recording successful storage cleanup.
ALTER TABLE "ReportExport" ADD COLUMN "storageDeletedAt" TIMESTAMP(3);

CREATE INDEX "ReportExport_expiresAt_storageDeletedAt_idx"
ON "ReportExport"("expiresAt", "storageDeletedAt");
