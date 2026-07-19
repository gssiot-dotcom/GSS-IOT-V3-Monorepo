ALTER TABLE "GatewayAlarmLevelApplication"
  ADD COLUMN "desiredEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "appliedEnabled" BOOLEAN;
