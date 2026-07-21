-- Phase 11 alarm occurrence-count engine.

CREATE TYPE "AlarmSeverity" AS ENUM ('CAUTION', 'WARNING', 'DANGER');
CREATE TYPE "AlarmTargetType" AS ENUM ('POSITION', 'SPECIFIC_USER');
CREATE TYPE "AlarmChannel" AS ENUM ('IN_APP', 'SMS', 'TELEGRAM', 'EMAIL', 'WEB_PUSH');
CREATE TYPE "AlarmCounterStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RESET');
CREATE TYPE "AlarmEventStatus" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "AlarmResolutionReason" AS ENUM (
  'SAFE',
  'SEVERITY_TRANSITION',
  'FAULT_FILTERED',
  'ALARM_DESIRED_DISABLED',
  'POLICY_DISABLED',
  'CONFIGURATION_CHANGED',
  'REASSIGNMENT',
  'RULE_DISABLED'
);

CREATE TABLE "AlarmRule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "areaId" UUID NOT NULL,
  "buildingId" UUID NOT NULL,
  "nodeTypeId" UUID NOT NULL,
  "severity" "AlarmSeverity" NOT NULL,
  "name" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "activeKey" TEXT NOT NULL DEFAULT 'active',
  "evaluationVersion" INTEGER NOT NULL DEFAULT 1,
  "createdByType" "AuditActorType" NOT NULL,
  "createdById" UUID,
  "updatedByType" "AuditActorType" NOT NULL,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "disabledAt" TIMESTAMP(3),

  CONSTRAINT "AlarmRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AlarmRule_activeKey_consistency_chk"
    CHECK (("isActive" = true AND "activeKey" = 'active') OR ("isActive" = false AND "activeKey" <> 'active'))
);

CREATE TABLE "AlarmRecipientPolicy" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ruleId" UUID NOT NULL,
  "targetType" "AlarmTargetType" NOT NULL,
  "positionId" UUID,
  "specificUserId" UUID,
  "targetKey" TEXT NOT NULL,
  "requiredOccurrenceCount" INTEGER NOT NULL,
  "countIntervalSeconds" INTEGER NOT NULL,
  "channel" "AlarmChannel" NOT NULL DEFAULT 'IN_APP',
  "channelKey" TEXT NOT NULL DEFAULT 'in_app',
  "channelMetadata" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "activeKey" TEXT NOT NULL DEFAULT 'active',
  "evaluationVersion" INTEGER NOT NULL DEFAULT 1,
  "createdByType" "AuditActorType" NOT NULL,
  "createdById" UUID,
  "updatedByType" "AuditActorType" NOT NULL,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "disabledAt" TIMESTAMP(3),

  CONSTRAINT "AlarmRecipientPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AlarmRecipientPolicy_count_chk" CHECK ("requiredOccurrenceCount" >= 1),
  CONSTRAINT "AlarmRecipientPolicy_interval_chk" CHECK ("countIntervalSeconds" >= 0),
  CONSTRAINT "AlarmRecipientPolicy_target_chk"
    CHECK (
      ("targetType" = 'POSITION' AND "positionId" IS NOT NULL AND "specificUserId" IS NULL AND "targetKey" = ('position:' || "positionId"::text))
      OR
      ("targetType" = 'SPECIFIC_USER' AND "specificUserId" IS NOT NULL AND "positionId" IS NULL AND "targetKey" = ('user:' || "specificUserId"::text))
    ),
  CONSTRAINT "AlarmRecipientPolicy_activeKey_consistency_chk"
    CHECK (("isActive" = true AND "activeKey" = 'active') OR ("isActive" = false AND "activeKey" <> 'active'))
);

CREATE TABLE "AlarmCounterState" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "policyId" UUID NOT NULL,
  "ruleId" UUID NOT NULL,
  "nodeId" UUID NOT NULL,
  "nodeTypeId" UUID NOT NULL,
  "severity" "AlarmSeverity" NOT NULL,
  "currentCount" INTEGER NOT NULL DEFAULT 0,
  "cycleNo" INTEGER NOT NULL DEFAULT 1,
  "cycleStartedAt" TIMESTAMP(3),
  "firstCountedReadingId" UUID,
  "lastCountedReadingId" UUID,
  "lastCountedAt" TIMESTAMP(3),
  "nextCountAt" TIMESTAMP(3),
  "latestValue" JSONB,
  "evidence" JSONB,
  "assignmentProvenance" JSONB,
  "evaluationVersion" INTEGER NOT NULL,
  "status" "AlarmCounterStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AlarmCounterState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AlarmCounterState_count_chk" CHECK ("currentCount" >= 0),
  CONSTRAINT "AlarmCounterState_cycle_chk" CHECK ("cycleNo" >= 1),
  CONSTRAINT "AlarmCounterState_version_chk" CHECK ("version" >= 0)
);

CREATE TABLE "AlarmEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "areaId" UUID NOT NULL,
  "buildingId" UUID NOT NULL,
  "gatewayId" UUID NOT NULL,
  "nodeId" UUID NOT NULL,
  "nodeTypeId" UUID NOT NULL,
  "ruleId" UUID NOT NULL,
  "severity" "AlarmSeverity" NOT NULL,
  "status" "AlarmEventStatus" NOT NULL DEFAULT 'OPEN',
  "activeKey" TEXT NOT NULL DEFAULT 'active',
  "openedAt" TIMESTAMP(3) NOT NULL,
  "lastTriggeredAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "resolutionReason" "AlarmResolutionReason",
  "evidence" JSONB,
  "assignmentProvenance" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AlarmEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AlarmEvent_activeKey_consistency_chk"
    CHECK (("status" = 'OPEN' AND "activeKey" = 'active') OR ("status" <> 'OPEN' AND "activeKey" <> 'active')),
  CONSTRAINT "AlarmEvent_resolution_chk"
    CHECK (("status" = 'OPEN' AND "resolvedAt" IS NULL AND "resolutionReason" IS NULL) OR ("status" = 'RESOLVED' AND "resolvedAt" IS NOT NULL AND "resolutionReason" IS NOT NULL))
);

CREATE TABLE "AlarmPolicyTrigger" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "policyId" UUID NOT NULL,
  "ruleId" UUID NOT NULL,
  "alarmEventId" UUID NOT NULL,
  "nodeId" UUID NOT NULL,
  "triggerReadingId" UUID NOT NULL,
  "triggerCycleNo" INTEGER NOT NULL,
  "triggerOccurrenceCount" INTEGER NOT NULL,
  "countIntervalSeconds" INTEGER NOT NULL,
  "evaluationVersion" INTEGER NOT NULL,
  "firstCountedReadingId" UUID,
  "lastCountedReadingId" UUID,
  "triggeredAt" TIMESTAMP(3) NOT NULL,
  "evidence" JSONB,
  "assignmentProvenance" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AlarmPolicyTrigger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AlarmPolicyTrigger_cycle_chk" CHECK ("triggerCycleNo" >= 1),
  CONSTRAINT "AlarmPolicyTrigger_count_chk" CHECK ("triggerOccurrenceCount" >= 1),
  CONSTRAINT "AlarmPolicyTrigger_interval_chk" CHECK ("countIntervalSeconds" >= 0)
);

CREATE UNIQUE INDEX "AlarmRule_buildingId_nodeTypeId_severity_activeKey_key"
  ON "AlarmRule"("buildingId", "nodeTypeId", "severity", "activeKey");
CREATE INDEX "AlarmRule_companyId_isActive_idx" ON "AlarmRule"("companyId", "isActive");
CREATE INDEX "AlarmRule_areaId_idx" ON "AlarmRule"("areaId");
CREATE INDEX "AlarmRule_nodeTypeId_severity_idx" ON "AlarmRule"("nodeTypeId", "severity");

CREATE UNIQUE INDEX "AlarmRecipientPolicy_ruleId_targetKey_channelKey_activeKey_key"
  ON "AlarmRecipientPolicy"("ruleId", "targetKey", "channelKey", "activeKey");
CREATE INDEX "AlarmRecipientPolicy_positionId_idx" ON "AlarmRecipientPolicy"("positionId");
CREATE INDEX "AlarmRecipientPolicy_specificUserId_idx" ON "AlarmRecipientPolicy"("specificUserId");
CREATE INDEX "AlarmRecipientPolicy_ruleId_isActive_idx" ON "AlarmRecipientPolicy"("ruleId", "isActive");

CREATE UNIQUE INDEX "AlarmCounterState_policyId_nodeId_key"
  ON "AlarmCounterState"("policyId", "nodeId");
CREATE INDEX "AlarmCounterState_nodeId_severity_status_idx"
  ON "AlarmCounterState"("nodeId", "severity", "status");
CREATE INDEX "AlarmCounterState_ruleId_idx" ON "AlarmCounterState"("ruleId");

CREATE UNIQUE INDEX "AlarmEvent_nodeId_ruleId_severity_activeKey_key"
  ON "AlarmEvent"("nodeId", "ruleId", "severity", "activeKey");
CREATE INDEX "AlarmEvent_companyId_status_idx" ON "AlarmEvent"("companyId", "status");
CREATE INDEX "AlarmEvent_buildingId_status_idx" ON "AlarmEvent"("buildingId", "status");
CREATE INDEX "AlarmEvent_openedAt_idx" ON "AlarmEvent"("openedAt");

CREATE UNIQUE INDEX "AlarmPolicyTrigger_policyId_nodeId_triggerCycleNo_key"
  ON "AlarmPolicyTrigger"("policyId", "nodeId", "triggerCycleNo");
CREATE INDEX "AlarmPolicyTrigger_alarmEventId_idx" ON "AlarmPolicyTrigger"("alarmEventId");
CREATE INDEX "AlarmPolicyTrigger_ruleId_idx" ON "AlarmPolicyTrigger"("ruleId");
CREATE INDEX "AlarmPolicyTrigger_triggeredAt_idx" ON "AlarmPolicyTrigger"("triggeredAt");

ALTER TABLE "AlarmRule"
  ADD CONSTRAINT "AlarmRule_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmRule_areaId_fkey"
    FOREIGN KEY ("areaId") REFERENCES "ConstructionArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmRule_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "ConstructionBuilding"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmRule_nodeTypeId_fkey"
    FOREIGN KEY ("nodeTypeId") REFERENCES "NodeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AlarmRecipientPolicy"
  ADD CONSTRAINT "AlarmRecipientPolicy_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "AlarmRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmRecipientPolicy_positionId_fkey"
    FOREIGN KEY ("positionId") REFERENCES "CompanyPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmRecipientPolicy_specificUserId_fkey"
    FOREIGN KEY ("specificUserId") REFERENCES "CompanyUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AlarmCounterState"
  ADD CONSTRAINT "AlarmCounterState_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "AlarmRecipientPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmCounterState_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "AlarmRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmCounterState_nodeId_fkey"
    FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmCounterState_nodeTypeId_fkey"
    FOREIGN KEY ("nodeTypeId") REFERENCES "NodeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmCounterState_firstCountedReadingId_fkey"
    FOREIGN KEY ("firstCountedReadingId") REFERENCES "SensorReading"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmCounterState_lastCountedReadingId_fkey"
    FOREIGN KEY ("lastCountedReadingId") REFERENCES "SensorReading"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AlarmEvent"
  ADD CONSTRAINT "AlarmEvent_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmEvent_areaId_fkey"
    FOREIGN KEY ("areaId") REFERENCES "ConstructionArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmEvent_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "ConstructionBuilding"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmEvent_gatewayId_fkey"
    FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmEvent_nodeId_fkey"
    FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmEvent_nodeTypeId_fkey"
    FOREIGN KEY ("nodeTypeId") REFERENCES "NodeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmEvent_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "AlarmRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AlarmPolicyTrigger"
  ADD CONSTRAINT "AlarmPolicyTrigger_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "AlarmRecipientPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmPolicyTrigger_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "AlarmRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmPolicyTrigger_alarmEventId_fkey"
    FOREIGN KEY ("alarmEventId") REFERENCES "AlarmEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmPolicyTrigger_nodeId_fkey"
    FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmPolicyTrigger_triggerReadingId_fkey"
    FOREIGN KEY ("triggerReadingId") REFERENCES "SensorReading"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmPolicyTrigger_firstCountedReadingId_fkey"
    FOREIGN KEY ("firstCountedReadingId") REFERENCES "SensorReading"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AlarmPolicyTrigger_lastCountedReadingId_fkey"
    FOREIGN KEY ("lastCountedReadingId") REFERENCES "SensorReading"("id") ON DELETE SET NULL ON UPDATE CASCADE;
