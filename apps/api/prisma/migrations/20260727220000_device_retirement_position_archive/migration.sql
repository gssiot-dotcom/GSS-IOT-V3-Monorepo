ALTER TABLE "CompanyPosition"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedByType" "AuditActorType",
ADD COLUMN "deletedById" UUID;

CREATE INDEX "CompanyPosition_companyId_deletedAt_isActive_name_id_idx"
ON "CompanyPosition"("companyId", "deletedAt", "isActive", "name", "id");
