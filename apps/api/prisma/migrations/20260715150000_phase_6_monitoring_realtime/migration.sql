-- CreateEnum
CREATE TYPE "SensorReadingStatus" AS ENUM ('SAFE', 'CAUTION', 'WARNING', 'DANGER', 'OFFLINE');

-- CreateTable
CREATE TABLE "SensorReading" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "areaId" UUID NOT NULL,
    "buildingId" UUID NOT NULL,
    "gatewayId" UUID NOT NULL,
    "nodeId" UUID NOT NULL,
    "nodeTypeId" UUID NOT NULL,
    "status" "SensorReadingStatus" NOT NULL,
    "values" JSONB NOT NULL,
    "measuredAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deduplicationKey" TEXT NOT NULL,
    "deduplicationSource" TEXT NOT NULL,
    "sourceTopic" TEXT,
    "gatewayMessageId" TEXT,
    "gatewaySequence" TEXT,
    "valueHash" TEXT NOT NULL,

    CONSTRAINT "SensorReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LatestNodeState" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "areaId" UUID NOT NULL,
    "buildingId" UUID NOT NULL,
    "gatewayId" UUID NOT NULL,
    "nodeId" UUID NOT NULL,
    "nodeTypeId" UUID NOT NULL,
    "status" "SensorReadingStatus" NOT NULL,
    "values" JSONB NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LatestNodeState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SensorReading_deduplicationKey_key" ON "SensorReading"("deduplicationKey");

-- CreateIndex
CREATE INDEX "SensorReading_buildingId_nodeTypeId_receivedAt_idx" ON "SensorReading"("buildingId", "nodeTypeId", "receivedAt");

-- CreateIndex
CREATE INDEX "SensorReading_gatewayId_receivedAt_idx" ON "SensorReading"("gatewayId", "receivedAt");

-- CreateIndex
CREATE INDEX "SensorReading_nodeId_receivedAt_idx" ON "SensorReading"("nodeId", "receivedAt");

-- CreateIndex
CREATE INDEX "SensorReading_receivedAt_idx" ON "SensorReading"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LatestNodeState_nodeId_key" ON "LatestNodeState"("nodeId");

-- CreateIndex
CREATE INDEX "LatestNodeState_buildingId_nodeTypeId_updatedAt_idx" ON "LatestNodeState"("buildingId", "nodeTypeId", "updatedAt");

-- CreateIndex
CREATE INDEX "LatestNodeState_gatewayId_idx" ON "LatestNodeState"("gatewayId");

-- CreateIndex
CREATE INDEX "LatestNodeState_lastSeenAt_idx" ON "LatestNodeState"("lastSeenAt");

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "ConstructionArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "ConstructionBuilding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_nodeTypeId_fkey" FOREIGN KEY ("nodeTypeId") REFERENCES "NodeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LatestNodeState" ADD CONSTRAINT "LatestNodeState_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LatestNodeState" ADD CONSTRAINT "LatestNodeState_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "ConstructionArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LatestNodeState" ADD CONSTRAINT "LatestNodeState_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "ConstructionBuilding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LatestNodeState" ADD CONSTRAINT "LatestNodeState_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LatestNodeState" ADD CONSTRAINT "LatestNodeState_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LatestNodeState" ADD CONSTRAINT "LatestNodeState_nodeTypeId_fkey" FOREIGN KEY ("nodeTypeId") REFERENCES "NodeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
