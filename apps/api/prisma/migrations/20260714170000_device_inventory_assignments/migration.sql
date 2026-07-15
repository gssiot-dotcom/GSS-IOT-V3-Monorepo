-- Phase 4 device inventory and assignment history.
CREATE TYPE "DeviceLifecycleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RETIRED');
CREATE TYPE "GatewayType" AS ENUM ('NODES_GATEWAY', 'SECURITY_OFFICE_GATEWAY');
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');

CREATE TABLE "NodeType" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "numericCode" INTEGER NOT NULL,
  "imageAssetKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NodeType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Gateway" (
  "id" UUID NOT NULL,
  "serialNumber" TEXT NOT NULL,
  "gatewayType" "GatewayType" NOT NULL,
  "status" "DeviceLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
  "installedLocation" TEXT,
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Gateway_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Node" (
  "id" UUID NOT NULL,
  "nodeTypeId" UUID NOT NULL,
  "number" TEXT NOT NULL,
  "status" "DeviceLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
  "installedLocation" TEXT,
  "batteryLevel" INTEGER,
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyDeviceAssignment" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "gatewayId" UUID,
  "nodeId" UUID,
  "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unassignedAt" TIMESTAMP(3),
  "activeKey" TEXT NOT NULL DEFAULT 'active',
  CONSTRAINT "CompanyDeviceAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompanyDeviceAssignment_one_device_chk" CHECK ((("gatewayId" IS NOT NULL)::int + ("nodeId" IS NOT NULL)::int) = 1),
  CONSTRAINT "CompanyDeviceAssignment_active_key_chk" CHECK (("status" = 'ACTIVE' AND "activeKey" = 'active' AND "unassignedAt" IS NULL) OR ("status" = 'ENDED' AND "activeKey" <> 'active' AND "unassignedAt" IS NOT NULL))
);

CREATE TABLE "GatewayBuildingAssignment" (
  "id" UUID NOT NULL,
  "gatewayId" UUID NOT NULL,
  "buildingId" UUID NOT NULL,
  "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unassignedAt" TIMESTAMP(3),
  "activeKey" TEXT NOT NULL DEFAULT 'active',
  CONSTRAINT "GatewayBuildingAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GatewayBuildingAssignment_active_key_chk" CHECK (("status" = 'ACTIVE' AND "activeKey" = 'active' AND "unassignedAt" IS NULL) OR ("status" = 'ENDED' AND "activeKey" <> 'active' AND "unassignedAt" IS NOT NULL))
);

CREATE TABLE "NodeGatewayAssignment" (
  "id" UUID NOT NULL,
  "nodeId" UUID NOT NULL,
  "gatewayId" UUID NOT NULL,
  "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unassignedAt" TIMESTAMP(3),
  "activeKey" TEXT NOT NULL DEFAULT 'active',
  CONSTRAINT "NodeGatewayAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NodeGatewayAssignment_active_key_chk" CHECK (("status" = 'ACTIVE' AND "activeKey" = 'active' AND "unassignedAt" IS NULL) OR ("status" = 'ENDED' AND "activeKey" <> 'active' AND "unassignedAt" IS NOT NULL))
);

CREATE UNIQUE INDEX "NodeType_key_key" ON "NodeType"("key");
CREATE UNIQUE INDEX "NodeType_numericCode_key" ON "NodeType"("numericCode");
CREATE UNIQUE INDEX "Gateway_serialNumber_key" ON "Gateway"("serialNumber");
CREATE UNIQUE INDEX "Node_number_key" ON "Node"("number");
CREATE UNIQUE INDEX "CompanyDeviceAssignment_gatewayId_activeKey_key" ON "CompanyDeviceAssignment"("gatewayId", "activeKey");
CREATE UNIQUE INDEX "CompanyDeviceAssignment_nodeId_activeKey_key" ON "CompanyDeviceAssignment"("nodeId", "activeKey");
CREATE INDEX "CompanyDeviceAssignment_companyId_status_idx" ON "CompanyDeviceAssignment"("companyId", "status");
CREATE UNIQUE INDEX "GatewayBuildingAssignment_gatewayId_activeKey_key" ON "GatewayBuildingAssignment"("gatewayId", "activeKey");
CREATE INDEX "GatewayBuildingAssignment_buildingId_status_idx" ON "GatewayBuildingAssignment"("buildingId", "status");
CREATE UNIQUE INDEX "NodeGatewayAssignment_nodeId_activeKey_key" ON "NodeGatewayAssignment"("nodeId", "activeKey");
CREATE INDEX "NodeGatewayAssignment_gatewayId_status_idx" ON "NodeGatewayAssignment"("gatewayId", "status");

ALTER TABLE "Node"
  ADD CONSTRAINT "Node_nodeTypeId_fkey"
  FOREIGN KEY ("nodeTypeId") REFERENCES "NodeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompanyDeviceAssignment"
  ADD CONSTRAINT "CompanyDeviceAssignment_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CompanyDeviceAssignment_gatewayId_fkey"
  FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CompanyDeviceAssignment_nodeId_fkey"
  FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GatewayBuildingAssignment"
  ADD CONSTRAINT "GatewayBuildingAssignment_gatewayId_fkey"
  FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GatewayBuildingAssignment_buildingId_fkey"
  FOREIGN KEY ("buildingId") REFERENCES "ConstructionBuilding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NodeGatewayAssignment"
  ADD CONSTRAINT "NodeGatewayAssignment_nodeId_fkey"
  FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "NodeGatewayAssignment_gatewayId_fkey"
  FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
