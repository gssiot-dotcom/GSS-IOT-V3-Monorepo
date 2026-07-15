-- Phase 5 GatewayCommand outbox and lifecycle.
CREATE TYPE "GatewayCommandStatus" AS ENUM ('PENDING', 'SENT', 'ACKNOWLEDGED', 'FAILED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "GatewayCommandType" AS ENUM ('REGISTER_NODES', 'WAKE_SECURITY', 'SET_ALARM_LEVELS', 'SET_FAULT_FILTER');

CREATE TABLE "GatewayCommand" (
  "id" UUID NOT NULL,
  "gatewayId" UUID NOT NULL,
  "commandType" "GatewayCommandType" NOT NULL,
  "commandNumber" INTEGER NOT NULL,
  "status" "GatewayCommandStatus" NOT NULL DEFAULT 'PENDING',
  "topic" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "responsePayload" JSONB,
  "requesterType" "AuditActorType" NOT NULL,
  "requesterId" UUID,
  "correlationKey" TEXT NOT NULL,
  "activeKey" TEXT NOT NULL DEFAULT 'active',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lastAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "cancelledAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GatewayCommand_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GatewayCommand_terminal_active_key_chk" CHECK (
    ("status" IN ('PENDING', 'SENT', 'FAILED') AND "activeKey" = 'active')
    OR ("status" IN ('ACKNOWLEDGED', 'EXPIRED', 'CANCELLED') AND "activeKey" <> 'active')
  )
);

CREATE UNIQUE INDEX "GatewayCommand_gatewayId_commandNumber_activeKey_key"
  ON "GatewayCommand"("gatewayId", "commandNumber", "activeKey");
CREATE UNIQUE INDEX "GatewayCommand_correlationKey_activeKey_key"
  ON "GatewayCommand"("correlationKey", "activeKey");
CREATE INDEX "GatewayCommand_gatewayId_status_idx" ON "GatewayCommand"("gatewayId", "status");
CREATE INDEX "GatewayCommand_status_expiresAt_idx" ON "GatewayCommand"("status", "expiresAt");
CREATE INDEX "GatewayCommand_createdAt_idx" ON "GatewayCommand"("createdAt");

ALTER TABLE "GatewayCommand"
  ADD CONSTRAINT "GatewayCommand_gatewayId_fkey"
  FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
