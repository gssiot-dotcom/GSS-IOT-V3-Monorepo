-- Preserve operational alarm and notification evidence while allowing audited user-facing archive.
ALTER TABLE "AlarmEvent"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedByType" "AuditActorType",
ADD COLUMN "deletedById" UUID;

ALTER TABLE "AlarmNotification"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedByType" "AuditActorType",
ADD COLUMN "deletedById" UUID;

-- Deterministic collection pagination and deleted-state filters.
CREATE INDEX "Company_status_name_id_idx" ON "Company"("status", "name", "id");
CREATE INDEX "GssRole_name_id_idx" ON "GssRole"("name", "id");
CREATE INDEX "ConstructionArea_companyId_status_name_id_idx" ON "ConstructionArea"("companyId", "status", "name", "id");
CREATE INDEX "ConstructionBuilding_companyId_status_title_id_idx" ON "ConstructionBuilding"("companyId", "status", "title", "id");
CREATE INDEX "ConstructionBuilding_areaId_status_title_id_idx" ON "ConstructionBuilding"("areaId", "status", "title", "id");
CREATE INDEX "Gateway_status_serialNumber_id_idx" ON "Gateway"("status", "serialNumber", "id");
CREATE INDEX "Node_status_number_id_idx" ON "Node"("status", "number", "id");
CREATE INDEX "GatewayCommand_status_createdAt_id_idx" ON "GatewayCommand"("status", "createdAt", "id");
CREATE INDEX "CompanyRole_companyId_name_id_idx" ON "CompanyRole"("companyId", "name", "id");
CREATE INDEX "CompanyUser_companyId_isActive_name_id_idx" ON "CompanyUser"("companyId", "isActive", "name", "id");
CREATE INDEX "CompanyPosition_companyId_isActive_name_id_idx" ON "CompanyPosition"("companyId", "isActive", "name", "id");
CREATE INDEX "AlarmRule_companyId_isActive_createdAt_id_idx" ON "AlarmRule"("companyId", "isActive", "createdAt", "id");
CREATE INDEX "AlarmRecipientPolicy_ruleId_isActive_createdAt_id_idx" ON "AlarmRecipientPolicy"("ruleId", "isActive", "createdAt", "id");
CREATE INDEX "AlarmEvent_companyId_deletedAt_openedAt_id_idx" ON "AlarmEvent"("companyId", "deletedAt", "openedAt", "id");
CREATE INDEX "AlarmEvent_buildingId_deletedAt_openedAt_id_idx" ON "AlarmEvent"("buildingId", "deletedAt", "openedAt", "id");
CREATE INDEX "AlarmNotification_recipientUserId_deletedAt_createdAt_id_idx" ON "AlarmNotification"("recipientUserId", "deletedAt", "createdAt", "id");
CREATE INDEX "ReportJob_requestedByType_requestedById_createdAt_id_idx" ON "ReportJob"("requestedByType", "requestedById", "createdAt", "id");
