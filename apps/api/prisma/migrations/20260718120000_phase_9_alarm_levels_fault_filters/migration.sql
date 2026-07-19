-- Phase 9 alarm levels, fault filters and authoritative classification.

ALTER TYPE "SensorReadingStatus" ADD VALUE IF NOT EXISTS 'UNCONFIGURED';

ALTER TABLE "SensorReading"
  ADD COLUMN "classificationEvidence" JSONB,
  ADD COLUMN "faultFiltered" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "LatestNodeState"
  ADD COLUMN "classificationEvidence" JSONB,
  ADD COLUMN "faultFiltered" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "BuildingAlarmLevelConfiguration" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "buildingId" UUID NOT NULL,
  "nodeTypeId" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "cautionThreshold" DOUBLE PRECISION,
  "warningThreshold" DOUBLE PRECISION,
  "dangerThreshold" DOUBLE PRECISION,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedByType" "AuditActorType" NOT NULL,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BuildingAlarmLevelConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BuildingAlarmLevelConfigurationHistory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "configurationId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "cautionThreshold" DOUBLE PRECISION,
  "warningThreshold" DOUBLE PRECISION,
  "dangerThreshold" DOUBLE PRECISION,
  "updatedByType" "AuditActorType" NOT NULL,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BuildingAlarmLevelConfigurationHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GatewayAlarmLevelApplication" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "buildingId" UUID NOT NULL,
  "gatewayId" UUID NOT NULL,
  "nodeTypeId" UUID NOT NULL,
  "configurationId" UUID NOT NULL,
  "configurationVersion" INTEGER NOT NULL,
  "desiredCommandId" UUID,
  "desiredStatus" "GatewayCommandStatus" NOT NULL DEFAULT 'PENDING',
  "appliedConfigurationId" UUID,
  "appliedConfigurationVersion" INTEGER,
  "appliedCommandId" UUID,
  "appliedRequestId" UUID,
  "lastSuccessfulPayload" JSONB,
  "appliedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "updatedByType" "AuditActorType" NOT NULL,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GatewayAlarmLevelApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GatewayFaultFilterDesiredState" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "gatewayId" UUID NOT NULL,
  "nodeTypeId" UUID NOT NULL,
  "nodeId" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "desiredCommandId" UUID,
  "desiredStatus" "GatewayCommandStatus" NOT NULL DEFAULT 'PENDING',
  "failureReason" TEXT,
  "updatedByType" "AuditActorType" NOT NULL,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GatewayFaultFilterDesiredState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GatewayFaultFilterAppliedState" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "gatewayId" UUID NOT NULL,
  "nodeTypeId" UUID NOT NULL,
  "nodeId" UUID NOT NULL,
  "applied" BOOLEAN NOT NULL DEFAULT false,
  "appliedCommandId" UUID,
  "appliedRequestId" UUID,
  "lastSuccessfulPayload" JSONB,
  "appliedAt" TIMESTAMP(3),
  "status" "GatewayCommandStatus" NOT NULL DEFAULT 'PENDING',
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GatewayFaultFilterAppliedState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BuildingAlarmLevelConfiguration_buildingId_nodeTypeId_key"
  ON "BuildingAlarmLevelConfiguration"("buildingId", "nodeTypeId");
CREATE INDEX "BuildingAlarmLevelConfiguration_companyId_idx"
  ON "BuildingAlarmLevelConfiguration"("companyId");
CREATE INDEX "BuildingAlarmLevelConfiguration_nodeTypeId_idx"
  ON "BuildingAlarmLevelConfiguration"("nodeTypeId");

CREATE UNIQUE INDEX "BuildingAlarmLevelConfigurationHistory_configurationId_version_key"
  ON "BuildingAlarmLevelConfigurationHistory"("configurationId", "version");
CREATE INDEX "BuildingAlarmLevelConfigurationHistory_createdAt_idx"
  ON "BuildingAlarmLevelConfigurationHistory"("createdAt");

CREATE INDEX "GatewayAlarmLevelApplication_desiredCommandId_idx"
  ON "GatewayAlarmLevelApplication"("desiredCommandId");
CREATE INDEX "GatewayAlarmLevelApplication_appliedCommandId_idx"
  ON "GatewayAlarmLevelApplication"("appliedCommandId");
CREATE UNIQUE INDEX "GatewayAlarmLevelApplication_buildingId_gatewayId_nodeTypeId_key"
  ON "GatewayAlarmLevelApplication"("buildingId", "gatewayId", "nodeTypeId");
CREATE INDEX "GatewayAlarmLevelApplication_gatewayId_desiredStatus_idx"
  ON "GatewayAlarmLevelApplication"("gatewayId", "desiredStatus");
CREATE INDEX "GatewayAlarmLevelApplication_configurationId_idx"
  ON "GatewayAlarmLevelApplication"("configurationId");

CREATE UNIQUE INDEX "GatewayFaultFilterDesiredState_gatewayId_nodeTypeId_nodeId_key"
  ON "GatewayFaultFilterDesiredState"("gatewayId", "nodeTypeId", "nodeId");
CREATE INDEX "GatewayFaultFilterDesiredState_desiredCommandId_idx"
  ON "GatewayFaultFilterDesiredState"("desiredCommandId");
CREATE INDEX "GatewayFaultFilterDesiredState_gatewayId_nodeTypeId_desiredStatus_idx"
  ON "GatewayFaultFilterDesiredState"("gatewayId", "nodeTypeId", "desiredStatus");

CREATE UNIQUE INDEX "GatewayFaultFilterAppliedState_gatewayId_nodeTypeId_nodeId_key"
  ON "GatewayFaultFilterAppliedState"("gatewayId", "nodeTypeId", "nodeId");
CREATE INDEX "GatewayFaultFilterAppliedState_appliedCommandId_idx"
  ON "GatewayFaultFilterAppliedState"("appliedCommandId");
CREATE INDEX "GatewayFaultFilterAppliedState_gatewayId_nodeTypeId_applied_idx"
  ON "GatewayFaultFilterAppliedState"("gatewayId", "nodeTypeId", "applied");

ALTER TABLE "BuildingAlarmLevelConfiguration"
  ADD CONSTRAINT "BuildingAlarmLevelConfiguration_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "BuildingAlarmLevelConfiguration_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "ConstructionBuilding"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "BuildingAlarmLevelConfiguration_nodeTypeId_fkey"
    FOREIGN KEY ("nodeTypeId") REFERENCES "NodeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BuildingAlarmLevelConfigurationHistory"
  ADD CONSTRAINT "BuildingAlarmLevelConfigurationHistory_configurationId_fkey"
    FOREIGN KEY ("configurationId") REFERENCES "BuildingAlarmLevelConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GatewayAlarmLevelApplication"
  ADD CONSTRAINT "GatewayAlarmLevelApplication_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "ConstructionBuilding"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GatewayAlarmLevelApplication_gatewayId_fkey"
    FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GatewayAlarmLevelApplication_nodeTypeId_fkey"
    FOREIGN KEY ("nodeTypeId") REFERENCES "NodeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GatewayAlarmLevelApplication_configurationId_fkey"
    FOREIGN KEY ("configurationId") REFERENCES "BuildingAlarmLevelConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GatewayAlarmLevelApplication_desiredCommandId_fkey"
    FOREIGN KEY ("desiredCommandId") REFERENCES "GatewayCommand"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "GatewayAlarmLevelApplication_appliedCommandId_fkey"
    FOREIGN KEY ("appliedCommandId") REFERENCES "GatewayCommand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GatewayFaultFilterDesiredState"
  ADD CONSTRAINT "GatewayFaultFilterDesiredState_gatewayId_fkey"
    FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GatewayFaultFilterDesiredState_nodeTypeId_fkey"
    FOREIGN KEY ("nodeTypeId") REFERENCES "NodeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GatewayFaultFilterDesiredState_nodeId_fkey"
    FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GatewayFaultFilterDesiredState_desiredCommandId_fkey"
    FOREIGN KEY ("desiredCommandId") REFERENCES "GatewayCommand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GatewayFaultFilterAppliedState"
  ADD CONSTRAINT "GatewayFaultFilterAppliedState_gatewayId_fkey"
    FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GatewayFaultFilterAppliedState_nodeTypeId_fkey"
    FOREIGN KEY ("nodeTypeId") REFERENCES "NodeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GatewayFaultFilterAppliedState_nodeId_fkey"
    FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GatewayFaultFilterAppliedState_appliedCommandId_fkey"
    FOREIGN KEY ("appliedCommandId") REFERENCES "GatewayCommand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
