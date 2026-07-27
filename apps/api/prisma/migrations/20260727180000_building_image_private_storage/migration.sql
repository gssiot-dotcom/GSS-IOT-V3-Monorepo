CREATE TYPE "BuildingImageDeletionState" AS ENUM ('ACTIVE', 'PENDING_DELETE', 'DELETE_FAILED');

ALTER TABLE "BuildingPlanImage"
ADD COLUMN "contentType" TEXT,
ADD COLUMN "byteSize" INTEGER,
ADD COLUMN "deletionState" "BuildingImageDeletionState" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN "deletionRequestedByType" "AuditActorType",
ADD COLUMN "deletionRequestedById" UUID,
ADD COLUMN "deletionAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "deletionFailureCode" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP INDEX "BuildingPlanImage_buildingId_kind_orderIndex_key";
CREATE UNIQUE INDEX "BuildingPlanImage_buildingId_kind_orderIndex_key"
ON "BuildingPlanImage"("buildingId", "kind", "orderIndex");
CREATE INDEX "BuildingPlanImage_buildingId_kind_deletionState_orderIndex_idx"
ON "BuildingPlanImage"("buildingId", "kind", "deletionState", "orderIndex");
CREATE INDEX "BuildingPlanImage_deletionState_deletionRequestedAt_idx"
ON "BuildingPlanImage"("deletionState", "deletionRequestedAt");

ALTER TABLE "BuildingPlanImage" DROP CONSTRAINT "BuildingPlanImage_buildingId_fkey";
ALTER TABLE "BuildingPlanImage"
ADD CONSTRAINT "BuildingPlanImage_buildingId_fkey"
FOREIGN KEY ("buildingId") REFERENCES "ConstructionBuilding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
