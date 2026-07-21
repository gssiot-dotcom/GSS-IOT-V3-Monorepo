-- Phase 12 enum/type additions. AlarmEventStatus.ACKNOWLEDGED is consumed by the
-- following migration because PostgreSQL requires enum additions to commit first.

ALTER TYPE "AlarmEventStatus" ADD VALUE IF NOT EXISTS 'ACKNOWLEDGED';
ALTER TYPE "AlarmResolutionReason" ADD VALUE IF NOT EXISTS 'MANUAL_RESOLVE';

CREATE TYPE "AlarmTriggerDispatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'DISPATCHED', 'FAILED');
CREATE TYPE "AlarmNotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED', 'CANCELLED');
CREATE TYPE "AlarmDeliveryAttemptStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');
