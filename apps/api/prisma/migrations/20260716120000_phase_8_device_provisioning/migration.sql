-- Phase 8: MQTT-backed node provisioning request state.

ALTER TABLE "NodeGatewayAssignment"
ADD COLUMN "sourceCommandId" UUID;

CREATE TABLE "NodeGatewayProvisioningRequest" (
  "id" UUID NOT NULL,
  "commandId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "buildingId" UUID NOT NULL,
  "gatewayId" UUID NOT NULL,
  "nodeTypeId" UUID NOT NULL,
  "status" "GatewayCommandStatus" NOT NULL DEFAULT 'PENDING',
  "responsePayload" JSONB,
  "failureReason" TEXT,
  "requestedByType" "AuditActorType" NOT NULL,
  "requestedById" UUID,
  "appliedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NodeGatewayProvisioningRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NodeGatewayProvisioningItem" (
  "id" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "nodeId" UUID NOT NULL,
  "assignmentId" UUID,
  "appliedAt" TIMESTAMP(3),
  "failureReason" TEXT,

  CONSTRAINT "NodeGatewayProvisioningItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NodeGatewayProvisioningRequest_commandId_key"
ON "NodeGatewayProvisioningRequest"("commandId");

CREATE INDEX "NodeGatewayProvisioningRequest_companyId_status_idx"
ON "NodeGatewayProvisioningRequest"("companyId", "status");

CREATE INDEX "NodeGatewayProvisioningRequest_buildingId_status_idx"
ON "NodeGatewayProvisioningRequest"("buildingId", "status");

CREATE INDEX "NodeGatewayProvisioningRequest_gatewayId_status_idx"
ON "NodeGatewayProvisioningRequest"("gatewayId", "status");

CREATE INDEX "NodeGatewayProvisioningRequest_createdAt_idx"
ON "NodeGatewayProvisioningRequest"("createdAt");

CREATE UNIQUE INDEX "NodeGatewayProvisioningItem_assignmentId_key"
ON "NodeGatewayProvisioningItem"("assignmentId");

CREATE UNIQUE INDEX "NodeGatewayProvisioningItem_requestId_nodeId_key"
ON "NodeGatewayProvisioningItem"("requestId", "nodeId");

CREATE INDEX "NodeGatewayProvisioningItem_nodeId_idx"
ON "NodeGatewayProvisioningItem"("nodeId");

CREATE INDEX "NodeGatewayAssignment_sourceCommandId_idx"
ON "NodeGatewayAssignment"("sourceCommandId");

ALTER TABLE "NodeGatewayProvisioningRequest"
ADD CONSTRAINT "NodeGatewayProvisioningRequest_commandId_fkey"
FOREIGN KEY ("commandId") REFERENCES "GatewayCommand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NodeGatewayProvisioningRequest"
ADD CONSTRAINT "NodeGatewayProvisioningRequest_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NodeGatewayProvisioningRequest"
ADD CONSTRAINT "NodeGatewayProvisioningRequest_buildingId_fkey"
FOREIGN KEY ("buildingId") REFERENCES "ConstructionBuilding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NodeGatewayProvisioningRequest"
ADD CONSTRAINT "NodeGatewayProvisioningRequest_gatewayId_fkey"
FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NodeGatewayProvisioningRequest"
ADD CONSTRAINT "NodeGatewayProvisioningRequest_nodeTypeId_fkey"
FOREIGN KEY ("nodeTypeId") REFERENCES "NodeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NodeGatewayProvisioningItem"
ADD CONSTRAINT "NodeGatewayProvisioningItem_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "NodeGatewayProvisioningRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NodeGatewayProvisioningItem"
ADD CONSTRAINT "NodeGatewayProvisioningItem_nodeId_fkey"
FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NodeGatewayProvisioningItem"
ADD CONSTRAINT "NodeGatewayProvisioningItem_assignmentId_fkey"
FOREIGN KEY ("assignmentId") REFERENCES "NodeGatewayAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
