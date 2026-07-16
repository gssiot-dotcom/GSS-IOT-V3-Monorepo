# Phase 7 Prompt — Alarm Occurrence Count

Read:

- architecture blueprint alarm section;
- `docs/quality/ALARM_OCCURRENCE_TEST_CASES.md`;
- `docs/quality/RBAC_SECURITY_CHECKLIST.md`.

Implement AlarmLevel, AlarmRule, AlarmRecipientPolicy, AlarmCounterState, AlarmEvent, AlarmNotification and AlarmDeliveryLog.

Non-negotiable semantics:

- caution/warning/danger are distinct.
- `회수 = requiredOccurrenceCount`.
- `지속시간 = countIntervalSeconds`.
- interval controls eligibility for counting, not send delay.
- each unique reading is persisted.
- counter state is one mutable PostgreSQL row per node-policy.
- after trigger, the next eligible reading starts a new cycle.
- safe/severity transition resets relevant cycles.
- recipients are resolved by position/specific user intersected with scope.
- duplicate/concurrent readings cannot double count or double notify.

Implement and pass every applicable mandatory alarm test case. Show timeline evidence in tests.
