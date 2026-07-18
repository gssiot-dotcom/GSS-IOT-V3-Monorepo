# CODEX PROMPT - Phase 12: Notifications and alarm operations UI

Read `AGENTS.md`, completed Phase 11 docs/code and the latest alarm blueprint.

Confirm Phase 11 is complete. Start only Phase 12.

Preserve the completed Phase 8 GatewayCommand/requestId outbox unchanged. Notification job IDs and provider idempotency keys are separate domains and must not reuse or overwrite MQTT GatewayCommand requestIds.

## Goal

Deliver the operational alarm product: recipient resolution, in-app notifications, provider adapters, alarm list/detail, realtime badges, acknowledge and resolve workflows for GSS and Company users.

## Recipient resolution

A recipient must satisfy all of the following:

- active CompanyUser;
- matches policy CompanyPosition or specific user;
- active position assignment if position-based;
- event company/site/building scope intersects assignment scope;
- configured channel/contact exists;
- not blocked by documented notification preference.

Platform RBAC controls what the user can view or acknowledge in the app. CompanyPosition controls who receives the notification. Do not merge these concepts.

## Notification architecture

Implement:

- NotificationOrchestrator;
- recipient resolver;
- provider interface;
- in-app provider as mandatory first provider;
- external provider adapters only for confirmed configured channels;
- delivery queue/retry with idempotency;
- `AlarmDeliveryLog` for every attempt;
- pending/sent/failed/cancelled/skipped states;
- retry policy and terminal failure;
- provider secrets only through env/config.

Do not hardcode real vendor credentials.

## Alarm lifecycle

Support:

```txt
open
acknowledged
resolved
ignored (only if approved)
```

Define and implement:

- acknowledgement records actor/time/note;
- resolve records actor/time/note;
- safe sensor state auto-resolve behavior from Phase 11;
- manual resolve authorization and whether a still-unsafe node can immediately reopen;
- repeated occurrence policies during acknowledged state;
- audit logs.

## Realtime

Create server-authorized Socket.IO alarm rooms. Never accept arbitrary room names.

At minimum support scoped updates for:

- new alarm/open;
- notification badge change;
- acknowledged;
- resolved;
- delivery status when relevant.

Use permission + company/site/building scope on joins.

## UI

### Company Dashboard

Implement:

```txt
/company/alarms
/company/alarms/:alarmId
/company/alarm-rules
/company/notifications
```

Include:

- filters by site/building/node type/severity/status/date;
- list and detail;
- sensor/count evidence;
- occurrence count and interval evidence;
- recipient/delivery status allowed by permission;
- acknowledge/resolve buttons by permission;
- realtime badge and updates;
- empty/loading/error/offline states.

### GSS Admin

Implement:

```txt
/admin/alarms
/admin/alarms/:alarmId
/admin/alarm-rules
/admin/notifications
```

GSS can view global data only with GSS permissions. Company data isolation remains explicit.

## Permissions

Enforce backend and UI:

- `alarms.view`
- `alarms.acknowledge`
- `alarms.resolve`
- `alarm-rules.view`
- `alarm-rules.manage`
- `notifications.view`
- `notifications.manage`

## Tests

Required E2E:

- recipient by position and building scope;
- same position in another building is not notified;
- inactive user and ended assignment are skipped;
- duplicate trigger does not duplicate notification;
- provider retry and terminal failure;
- in-app realtime badge only to authorized room;
- unauthorized socket join rejected;
- acknowledge/resolve permission and scope;
- auto-resolve on safe;
- manual resolve/reopen rule;
- audit logs;
- no-permission user does not call protected notification endpoints.

## Out of scope

- Reports and exports belong to Phase 13.
- Do not implement unconfirmed external vendors.
- Do not start Phase 13.

## Definition of Done

- Alarm occurrence reaches the correct scoped recipients.
- Delivery attempts are auditable and idempotent.
- GSS and Company alarm operations pages are usable.
- Realtime badges and state transitions are authorized.
- All previous phases remain green.
