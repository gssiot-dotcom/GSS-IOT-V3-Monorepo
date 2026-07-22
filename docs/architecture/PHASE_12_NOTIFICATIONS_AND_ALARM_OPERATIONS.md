# Phase 12 — Notifications and alarm operations UI

## Scope

Phase 12 consumes Phase 11 `AlarmPolicyTrigger` rows and delivers the operational alarm product:

- durable trigger dispatch/reconciliation;
- CompanyPosition/scope recipient resolution;
- `AlarmNotification` and `AlarmDeliveryLog`;
- in-app notification inbox and unread badge;
- alarm list/detail, acknowledge and resolve workflows;
- alarm rule/policy configuration UI;
- authorized notification realtime rooms.

Phase 12 does not change MQTT ingestion, SensorReading persistence, Phase 9 classification, occurrence counters, GatewayCommand requestId correlation, cmd 2/4/5 behavior, reports, exports, retention, partitioning or real external vendor integration.

## Dispatch decision

`AlarmPolicyTrigger` is the durable bridge from occurrence counting to delivery. Phase 12 adds dispatch fields directly to `AlarmPolicyTrigger`:

- `dispatchStatus`: `PENDING`, `PROCESSING`, `DISPATCHED`, `FAILED`;
- `dispatchAttemptCount`;
- `dispatchClaimedAt`;
- `dispatchCompletedAt`;
- `dispatchFailureReason`.

The in-memory `alarm.policy-triggered` event is only a wake-up signal. Startup reconciliation scans pending trigger rows so restart recovery does not depend on process memory. Trigger dispatch creates idempotent notification rows through unique `(policyTriggerId, recipientUserId, channel)`.

## Recipient resolution

Position-based recipients require:

- active `CompanyUser`;
- active `CompanyPosition`;
- active `CompanyUserPositionAssignment` with no `endedAt`;
- same company as the alarm event;
- assignment scope intersecting the event scope:
  - company-wide assignment matches company;
  - area assignment matches event area;
  - building assignment matches event building.

Specific-user recipients require active same-company user plus effective building scope through company owner role, direct building access or area-inherited building access.

CompanyRole and GSS roles are not recipient categories. For `IN_APP`, the recipient also needs `notifications.view`; otherwise the notification is persisted as `SKIPPED` with `MISSING_NOTIFICATIONS_VIEW`.

## Providers and delivery

In-app is the mandatory configured provider. External channels (`SMS`, `TELEGRAM`, `EMAIL`, `WEB_PUSH`) are represented in the model but default to `SKIPPED` with `PROVIDER_UNCONFIGURED` until a vendor decision supplies approved secrets and adapters. A deterministic test provider mode is available through policy metadata for automated retry/terminal-failure coverage without real credentials.

Every attempted delivery writes `AlarmDeliveryLog` with sanitized metadata only. No provider secrets, password hashes or unrestricted raw provider payloads are exposed.

## Alarm lifecycle

Supported event statuses are `OPEN`, `ACKNOWLEDGED` and `RESOLVED`.

- Acknowledge requires `alarms.acknowledge`, event scope, actor/time/note and audit log. It is idempotent and does not reset counters, stop counting or change classification.
- Acknowledged unsafe episodes keep `activeKey = active`; later Phase 11 cycles reuse the same event and can produce new triggers/notifications.
- Resolve requires `alarms.resolve`, event scope, actor/time/note and audit log.
- Manual resolve rejects with 409 while latest state is unsafe, fault filtering is not active, desired alarm state is enabled and active assignment rows still exist.
- Safe, fault-filtered, desired-disabled and assignment-ended/latest-non-unsafe states may resolve. Phase 11 automatic safe/fault/disabled resolution now closes both `OPEN` and `ACKNOWLEDGED` active events.
- `IGNORED` remains unimplemented because it is not approved.

## API summary

Admin and Company paths mirror each other under `/admin/*` and `/company/*`:

- `GET /alarm-rules/options` — `alarm-rules.view`;
- rule/policy CRUD — `alarm-rules.view/manage`;
- `GET /alarms`, `GET /alarms/:alarmId`, `GET /alarms/:alarmId/triggers`, `GET /alarms/:alarmId/notifications` — `alarms.view`;
- `PATCH /alarms/:alarmId/acknowledge` — `alarms.acknowledge`;
- `PATCH /alarms/:alarmId/resolve` — `alarms.resolve`;
- `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` — `notifications.view`;
- `GET /notifications/providers/status` — `notifications.manage`.

Company endpoints enforce same-company and building scope on alarm resources. Inbox endpoints return only the authenticated company user’s notifications. GSS admin inbox currently returns an empty own-inbox because Phase 12 notification recipients are Company users.

## UI summary

Implemented pages:

- `/admin/alarms`, `/admin/alarms/:alarmId`, `/admin/alarm-rules`, `/admin/notifications`;
- `/company/alarms`, `/company/alarms/:alarmId`, `/company/alarm-rules`, `/company/notifications`.

Pages use Mantine/Tabler, shared GSS UI primitives and i18n keys. Rule configuration uses server-provided selectors for buildings, node types, positions and users rather than raw UUID entry. Alarm rule `name` is a human-readable display label only; canonical identity remains the database id plus release-supported evaluation scope of building, node type and severity. The create-rule modal keeps its own local draft until Save, trims/validates the display label, prevents required selector deselection and contains API validation failures inside the modal. The shell notification bell calls notification APIs only when `notifications.view` is present.

## Realtime

Socket.IO clients call `notifications:join` without a room name. The server authenticates the token, checks `notifications.view` and derives one room:

- `company-user:{userId}`;
- `gss-admin:{adminId}`.

Notification badge updates emit compact `notifications:update` payloads with unread count and optional notification id.

## Verification

Automated coverage extends `apps/api/test/e2e/alarms.e2e-spec.ts` for:

- in-app recipient notification + delivery log;
- unread count and read operation;
- acknowledge workflow;
- unsafe manual resolve rejection;
- auto-resolve after safe state while acknowledged;
- deterministic provider retry and terminal failure without duplicate notification rows.

Focused web regression coverage in `apps/web/src/test/alarm-rules.spec.tsx` covers Company and Admin alarm-rule creation, typing/editing the rule name without a pre-save API request, required selector stability, whitespace-name validation, API failure containment and clean modal reopen.

Manual end-to-end acceptance passed on 2026-07-21. Phase 12 status is `PHASE_12_COMPLETE`.

## Manual acceptance closeout

Manual acceptance passed on 2026-07-21. The verified live flow confirmed:

- Alarm recipient resolution through CompanyPosition and scope worked.
- A scoped Site Manager received notifications through the CompanyPosition policy.
- The Platform Manager policy independently generated notifications according to its own occurrence-count and interval configuration.
- Multiple eligible policy triggers created multiple notifications while one continuous unsafe node episode used one shared `AlarmEvent`.
- Alarm detail correctly showed separate Triggers and Notifications tabs.
- Acknowledge performed by the Site Manager updated the shared `AlarmEvent`, and the acknowledged state was also visible to the Platform Manager.
- Resolve was correctly rejected while the node remained in `DANGER`.
- The rejected unsafe resolve did not incorrectly change the alarm to `RESOLVED`.
- When the node returned to `SAFE`, automatic alarm resolution worked.
- Manual resolve also worked after the node was `SAFE`.
- The counter/notification flow and shared `AlarmEvent` behavior were manually verified end to end.

The Phase 13 first compatible task resolved the recorded unsafe-resolve UI carryover. The shared Company/Admin alarm detail now renders a localized inline error containing the safe backend 4xx message when Resolve is rejected because the node is still unsafe; the failed mutation leaves the alarm status unchanged, resets loading state and prevents duplicate submissions. Focused web regression coverage verifies rejected unsafe Resolve in Company and successful SAFE Resolve in Admin.

This closeout does not change MQTT ingestion, alarm occurrence-count semantics, recipient resolution, `AlarmEvent` identity rules, automatic safe resolution or Phase 9 alarm-level behavior.
