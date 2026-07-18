# GSS IoT V3 - Open business and protocol decisions

These decisions should be resolved before or during the named phase. Codex must not silently invent answers.

## Resolved by Phase 8 live protocol verification

- Backend owns `requestId`, and it equals `GatewayCommand.id`.
- Gateway echoes `cmd`, the same `requestId`, and `resp`.
- cmd 2/3/4/5 now return GATE_RES responses.
- Success is `resp: "success"`; failure is `resp: "fail"` with optional `errorCode`, `message`, and legacy `reason`.
- cmd 2 and cmd 5 node arrays use JSON numbers.
- Exact requestId correlation is primary; legacy gateway+explicit-cmd matching is fallback only.
- Retry reuses the same requestId.
- A cmd 2 request contains one node type.
- Live cmd 2 request/response reached ACKNOWLEDGED with cmd + requestId using selected gateway `0300` and GatewayCommand `160b3e5c-139d-479b-8535-a82f25f95b02`. The selected serial is run evidence, not a permanent architecture constant.

## Remaining Phase 8 hardware lifecycle decisions

1. Is there a hardware command to unregister/remove nodes, or only full register-list replacement?
2. When moving a node, must the old gateway receive an updated full node list before the new gateway command?
3. Should a future explicit full-sync command be added for drift reconciliation?
4. Should the gateway persist recent requestIds for duplicate execution protection across restart, or is backend idempotency sufficient for the current release?

## Phase 9 alarm levels/classification

1. Exact threshold meaning for angle/gangform:
   - cumulative absolute angle?
   - max(abs(X), abs(Y))?
   - calibrated delta from baseline?
2. Mapping of legacy green/yellow/red to safe/caution/warning/danger.
3. Are thresholds building+nodeType only, or can gateways/nodes override?
4. Does door node have only safe/danger, or caution/warning states too?
5. Is angle calibration required in V3 before classification?
6. What should happen when no alarm config exists: unconfigured, safe, or default seed thresholds?
7. Fault-filtered readings: store history but skip counters, or ignore entirely? Recommended: store with evidence and skip alarm counting.

## Phase 10 company management

1. Can company users create custom CompanyPosition names?
2. Can non-platform managers manage users in their own site/building?
3. Does site scope automatically include all current/future child buildings?
4. Are direct user deny permissions required in Company UI or only GSS support tools?
5. Required building plan image count/types and node coordinate behavior.

## Phase 11-12 alarms/notifications

1. Confirm channels for first release: in-app, SMS, Telegram, email, web push.
2. Provider vendors and retry/SLA rules.
3. Does acknowledged alarm continue counting and trigger later policies? Current blueprint default says yes while unsafe.
4. Can manual resolve close an alarm while sensor remains unsafe?
5. Does unsafe reading after manual resolve immediately reopen?
6. Should cancelled/skipped notification attempts be visible to company managers?
7. How long should alarm events/notifications/delivery logs be retained?

## Phase 13 legacy parity

1. Is weather/typhoon feature still required?
2. Is HWPX export mandatory?
3. Is angle calibration mandatory?
4. Is building plan node placement mandatory for first production release?
5. Which exact dashboard KPIs are needed by GSS management and company managers?
6. Is gateway online/offline history required or only current lastSeenAt?

## Phase 14 production

1. Production hosting target.
2. MQTT broker/TLS/auth details.
3. S3-compatible storage provider.
4. Queue/Redis availability.
5. Sensor history retention beyond 180 days and archive requirements.
6. Legacy sensor history migration volume and cutoff date.
7. Backup RPO/RTO.
