-- Task 09: durable APPEND/REPLACE provisioning membership and replacement history.

CREATE TYPE "ProvisioningMode" AS ENUM ('APPEND', 'REPLACE');

ALTER TABLE "NodeGatewayProvisioningRequest"
ADD COLUMN "mode" "ProvisioningMode" NOT NULL DEFAULT 'REPLACE';

ALTER TABLE "NodeGatewayProvisioningItem"
ADD COLUMN "selected" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "NodeGatewayProvisioningEndedAssignment" (
  "id" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "assignmentId" UUID NOT NULL,
  "nodeId" UUID NOT NULL,
  "endedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NodeGatewayProvisioningEndedAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NodeGatewayProvisioningEndedAssignment_requestId_assignmentId_key"
ON "NodeGatewayProvisioningEndedAssignment"("requestId", "assignmentId");

CREATE INDEX "NodeGatewayProvisioningEndedAssignment_nodeId_idx"
ON "NodeGatewayProvisioningEndedAssignment"("nodeId");

ALTER TABLE "NodeGatewayProvisioningEndedAssignment"
ADD CONSTRAINT "NodeGatewayProvisioningEndedAssignment_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "NodeGatewayProvisioningRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NodeGatewayProvisioningEndedAssignment"
ADD CONSTRAINT "NodeGatewayProvisioningEndedAssignment_assignmentId_fkey"
FOREIGN KEY ("assignmentId") REFERENCES "NodeGatewayAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NodeGatewayProvisioningEndedAssignment"
ADD CONSTRAINT "NodeGatewayProvisioningEndedAssignment_nodeId_fkey"
FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
