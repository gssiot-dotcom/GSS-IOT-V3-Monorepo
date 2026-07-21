# Phase 12 Prisma schema notes

Migrations:

- `20260720120000_phase_12_notifications_alarm_operations` adds enum values/types only.
- `20260720120100_phase_12_notification_tables` adds lifecycle columns, trigger dispatch columns, `AlarmNotification` and `AlarmDeliveryLog`.

The enum-only migration is intentionally separate because PostgreSQL requires a new enum value to commit before it is used in a check constraint.

Key constraints:

- `AlarmEvent` active key remains `active` for `OPEN` and `ACKNOWLEDGED`, and changes to the event id for `RESOLVED`.
- `AlarmNotification` uniqueness is `(policyTriggerId, recipientUserId, channel)`.
- `AlarmDeliveryLog` is append-only per attempt and cascades only when its notification is deleted by test cleanup.

No provider secrets or unrestricted raw provider payloads are modeled.
