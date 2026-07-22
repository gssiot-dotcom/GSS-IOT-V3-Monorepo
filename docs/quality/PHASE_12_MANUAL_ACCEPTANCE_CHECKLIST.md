# Phase 12 manual end-to-end acceptance checklist

Status: passed on 2026-07-21.

This checklist was run together with the Phase 11 manual sensor-flow acceptance. Phase 11 and Phase 12 are complete as of 2026-07-21.

Manual pre-check evidence on 2026-07-21 found a Phase 12 maintenance blocker on `/company/alarm-rules`: selecting Building `Company A / 성수동 A-15`, Node type `Gangform Node`, Severity `DANGER` and typing in the Name field crashed the frontend before the rule was saved. The exact root cause was a React event-lifetime defect in the shared create-rule form: `event.currentTarget.value` was read inside a functional state updater after React could clear `currentTarget`, producing `TypeError: Cannot read properties of null (reading 'value')` in the browser/test environment. The maintenance fix keeps the rule draft local, reads the input value synchronously, contains validation/API errors in the modal, resets the draft on close/reopen and prevents required selector deselection. Retest this rule-creation pre-check before continuing the full sensor-to-operations flow.

The post-fix manual closeout verified the counter, trigger, recipient, notification and shared alarm-event flow end to end. The unsafe-resolve UI carryover was implemented as the first Phase 13 task: the shared Company/Admin alarm detail now shows localized inline feedback with the safe backend 4xx message, preserves alarm status on failure, resets loading state and prevents duplicate submissions. Focused web regression coverage passes; Phase 13 manual acceptance remains outstanding.

## Combined sensor-to-operations flow

- Publish/script danger readings that satisfy `requiredOccurrenceCount` and `countIntervalSeconds`.
- Confirm one `SensorReading` per unique payload and one `AlarmPolicyTrigger` per policy cycle.
- Confirm scoped CompanyPosition recipients receive one `AlarmNotification` per trigger/user/channel.
- Confirm the Company notification bell unread count increments through authorized realtime.
- Confirm `/company/notifications` shows the notification and read/read-all decrement the unread count.
- Confirm `/company/alarms` lists the event and `/company/alarms/:alarmId` shows trigger/notification evidence.
- Acknowledge the alarm and verify status becomes `ACKNOWLEDGED` without resetting counters.
- While latest state remains unsafe, verify manual resolve returns 409.
- Publish/script safe state and verify the acknowledged alarm becomes `RESOLVED`.
- Confirm later unsafe readings reopen a new event only after the previous active episode is resolved.

## Negative checks

- Same position assigned to another building does not receive the notification.
- Inactive user and ended position assignment do not receive active delivery.
- In-app recipient without `notifications.view` is skipped with `MISSING_NOTIFICATIONS_VIEW`.
- External channel with no approved provider is skipped with `PROVIDER_UNCONFIGURED`.
- Company user outside building scope cannot open alarm detail or perform ack/resolve.
- Socket client cannot join arbitrary room names; only `notifications:join` is accepted and server-derived.

## Evidence to record

- Trigger id, alarm event id, notification ids and delivery log ids.
- API responses for list/detail/inbox/unread/read/ack/resolve.
- DB snapshots for `AlarmPolicyTrigger.dispatchStatus`, `AlarmNotification.status`, `AlarmDeliveryLog`.
- Browser screenshots for alarm list/detail, rule config, notification inbox and bell badge.

## Recorded results

- Alarm recipient resolution through CompanyPosition and scope worked.
- A scoped Site Manager received notifications through the CompanyPosition policy.
- The Platform Manager policy independently generated notifications according to its own occurrence-count and interval configuration.
- Multiple eligible policy triggers created multiple notifications while one continuous unsafe node episode used one shared `AlarmEvent`.
- The alarm detail correctly showed separate Triggers and Notifications tabs.
- Acknowledge performed by the Site Manager updated the shared `AlarmEvent`, and the acknowledged state was also visible to the Platform Manager.
- Resolve was correctly rejected while the node remained in `DANGER`.
- The rejected unsafe resolve did not incorrectly change the alarm to `RESOLVED`.
- When the node returned to `SAFE`, automatic alarm resolution worked.
- Manual resolve also worked after the node was `SAFE`.
- The counter/notification flow and shared `AlarmEvent` behavior were manually verified end to end.
