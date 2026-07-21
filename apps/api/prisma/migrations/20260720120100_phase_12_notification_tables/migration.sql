-- Phase 12 notification tables, trigger dispatch state and alarm lifecycle fields.

ALTER TABLE "AlarmEvent"
  ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
  ADD COLUMN "acknowledgedByType" "AuditActorType",
  ADD COLUMN "acknowledgedById" UUID,
  ADD COLUMN "acknowledgeNote" TEXT,
  ADD COLUMN "resolvedByType" "AuditActorType",
  ADD COLUMN "resolvedById" UUID,
  ADD COLUMN "resolveNote" TEXT;

ALTER TABLE "AlarmEvent" DROP CONSTRAINT "AlarmEvent_activeKey_consistency_chk";
ALTER TABLE "AlarmEvent" DROP CONSTRAINT "AlarmEvent_resolution_chk";

ALTER TABLE "AlarmEvent"
  ADD CONSTRAINT "AlarmEvent_activeKey_consistency_chk"
    CHECK (
      ("status" IN ('OPEN', 'ACKNOWLEDGED') AND "activeKey" = 'active')
      OR
      ("status" = 'RESOLVED' AND "activeKey" <> 'active')
    ),
  ADD CONSTRAINT "AlarmEvent_lifecycle_chk"
    CHECK (
      (
        "status" = 'OPEN'
        AND "acknowledgedAt" IS NULL
        AND "acknowledgedByType" IS NULL
        AND "resolvedAt" IS NULL
        AND "resolutionReason" IS NULL
      )
      OR
      (
        "status" = 'ACKNOWLEDGED'
        AND "acknowledgedAt" IS NOT NULL
        AND "acknowledgedByType" IS NOT NULL
        AND "resolvedAt" IS NULL
        AND "resolutionReason" IS NULL
      )
      OR
      (
        "status" = 'RESOLVED'
        AND "resolvedAt" IS NOT NULL
        AND "resolutionReason" IS NOT NULL
      )
    );

ALTER TABLE "AlarmPolicyTrigger"
  ADD COLUMN "dispatchStatus" "AlarmTriggerDispatchStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "dispatchAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "dispatchClaimedAt" TIMESTAMP(3),
  ADD COLUMN "dispatchCompletedAt" TIMESTAMP(3),
  ADD COLUMN "dispatchFailureReason" TEXT,
  ADD CONSTRAINT "AlarmPolicyTrigger_dispatch_attempt_chk" CHECK ("dispatchAttemptCount" >= 0);

CREATE TABLE "AlarmNotification" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "alarmEventId" UUID NOT NULL,
  "policyTriggerId" UUID NOT NULL,
  "policyId" UUID NOT NULL,
  "recipientUserId" UUID NOT NULL,
  "channel" "AlarmChannel" NOT NULL,
  "status" "AlarmNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "templateSnapshot" JSONB,
  "severitySnapshot" JSONB,
  "scopeSnapshot" JSONB,
  "triggerSnapshot" JSONB,
  "destinationMetadata" JSONB,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "nextAttemptAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AlarmNotification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AlarmNotification_attempt_chk" CHECK ("attemptCount" >= 0 AND "maxAttempts" >= 1)
);

CREATE TABLE "AlarmDeliveryLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "notificationId" UUID NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "providerKey" TEXT NOT NULL,
  "channel" "AlarmChannel" NOT NULL,
  "status" "AlarmDeliveryAttemptStatus" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "sanitizedRequestMetadata" JSONB,
  "sanitizedResponseMetadata" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "retryable" BOOLEAN NOT NULL DEFAULT false,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AlarmDeliveryLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AlarmDeliveryLog_attempt_chk" CHECK ("attemptNumber" >= 1)
);

CREATE UNIQUE INDEX "AlarmNotification_policyTriggerId_recipientUserId_channel_key"
  ON "AlarmNotification"("policyTriggerId", "recipientUserId", "channel");
CREATE INDEX "AlarmNotification_alarmEventId_idx" ON "AlarmNotification"("alarmEventId");
CREATE INDEX "AlarmNotification_recipientUserId_status_readAt_idx"
  ON "AlarmNotification"("recipientUserId", "status", "readAt");
CREATE INDEX "AlarmNotification_status_nextAttemptAt_idx"
  ON "AlarmNotification"("status", "nextAttemptAt");

CREATE INDEX "AlarmDeliveryLog_notificationId_attemptNumber_idx"
  ON "AlarmDeliveryLog"("notificationId", "attemptNumber");
CREATE INDEX "AlarmDeliveryLog_status_timestamp_idx"
  ON "AlarmDeliveryLog"("status", "timestamp");

CREATE INDEX "AlarmPolicyTrigger_dispatchStatus_triggeredAt_idx"
  ON "AlarmPolicyTrigger"("dispatchStatus", "triggeredAt");

ALTER TABLE "AlarmNotification"
  ADD CONSTRAINT "AlarmNotification_alarmEventId_fkey"
    FOREIGN KEY ("alarmEventId") REFERENCES "AlarmEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmNotification_policyTriggerId_fkey"
    FOREIGN KEY ("policyTriggerId") REFERENCES "AlarmPolicyTrigger"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmNotification_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "AlarmRecipientPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmNotification_recipientUserId_fkey"
    FOREIGN KEY ("recipientUserId") REFERENCES "CompanyUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AlarmDeliveryLog"
  ADD CONSTRAINT "AlarmDeliveryLog_notificationId_fkey"
    FOREIGN KEY ("notificationId") REFERENCES "AlarmNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
