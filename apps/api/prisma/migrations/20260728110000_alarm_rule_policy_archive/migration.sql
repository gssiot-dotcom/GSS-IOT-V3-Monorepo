-- Alarm configuration is removed from normal operator views without deleting
-- immutable occurrence, event, notification, delivery, or audit evidence.
ALTER TABLE "AlarmRule"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedByType" "AuditActorType",
ADD COLUMN "deletedById" UUID;

ALTER TABLE "AlarmRecipientPolicy"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedByType" "AuditActorType",
ADD COLUMN "deletedById" UUID;

CREATE INDEX "AlarmRule_companyId_deletedAt_createdAt_id_idx"
ON "AlarmRule"("companyId", "deletedAt", "createdAt", "id");

CREATE INDEX "AlarmRecipientPolicy_ruleId_deletedAt_createdAt_id_idx"
ON "AlarmRecipientPolicy"("ruleId", "deletedAt", "createdAt", "id");
