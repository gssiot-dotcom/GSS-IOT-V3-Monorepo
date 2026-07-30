-- Forward-only hardening for multi-instance deletion workers and user evidence retention.

ALTER TABLE "DeletionJob"
  ADD COLUMN "leaseOwner" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "heartbeatAt" TIMESTAMP(3),
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "DeletionJob_status_leaseExpiresAt_createdAt_idx"
  ON "DeletionJob"("status", "leaseExpiresAt", "createdAt");

ALTER TABLE "AlarmNotification"
  ALTER COLUMN "recipientUserId" DROP NOT NULL;

ALTER TABLE "AlarmNotification"
  DROP CONSTRAINT "AlarmNotification_recipientUserId_fkey";

ALTER TABLE "AlarmNotification"
  ADD CONSTRAINT "AlarmNotification_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "CompanyUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
