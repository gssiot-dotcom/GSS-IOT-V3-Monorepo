# CODEX TASK 07 — Device inventory edit/delete rules and compact action UX

Complete Tasks 02–06 first. Read device assignment architecture, Prisma relations, audit rules and current device E2E tests.

## Goal

Implement user Requirement 6:

- edit actions are clear and permission-controlled;
- pristine gateways/nodes can be hard-deleted;
- any device with assignment/reference history cannot be hard-deleted;
- dense table actions use accessible icons/menus when needed.

## Business rule — pristine inventory deletion only

A device is hard-deletable only when it has never participated in business history.

### Gateway deletion blockers

At minimum check all relevant relations, including:

- any CompanyDeviceAssignment, active or ended;
- any GatewayBuildingAssignment, active or ended;
- any NodeGatewayAssignment;
- any GatewayCommand;
- any provisioning request;
- monitoring/latest state/sensor readings;
- alarm level applications;
- fault-filter desired/applied state;
- alarms or other domain references.

### Node deletion blockers

At minimum check:

- any CompanyDeviceAssignment, active or ended;
- any NodeGatewayAssignment, active or ended;
- any provisioning request item;
- sensor readings/latest state;
- alarm counter/event/trigger/notification references;
- fault-filter desired/applied state;
- other domain references.

Being currently unassigned is not enough. If history exists, return a clear `409 Conflict` and direct users toward lifecycle `INACTIVE/RETIRED` rather than deleting history.

Do not use cascading deletion to erase history.

## Backend/API

Use existing permissions:

```txt
gateways.update
gateways.delete
nodes.update
nodes.delete
```

Add guarded endpoints for pristine deletion. Perform blocker checks and audit logging transactionally.

Prefer returning server-derived deletion capability/blocker information in inventory records or a dedicated capability endpoint so the frontend does not duplicate the full business rule.

Error responses must be structured enough for localized UI feedback without exposing internals.

## Frontend

Improve Gateway and Node inventory tables:

- edit action with existing update permissions;
- assign/unassign actions remain permission-aware;
- delete action appears only with delete permission and server capability;
- compact `ActionIcon` or action menu with tooltip/aria-label when space is limited;
- destructive confirmation includes serial/number and impact;
- show why deletion is unavailable when useful;
- mutation success/error feedback;
- responsive/mobile action behavior.

Do not reintroduce a raw UUID-only node-to-gateway assignment UI. Hardware provisioning remains the approved flow.

## Tests

API/E2E fixtures must prove:

- brand-new gateway delete succeeds;
- brand-new node delete succeeds;
- currently assigned device delete fails;
- previously assigned then unassigned device delete still fails;
- command/provisioning/history-referenced device delete fails;
- delete permission is enforced;
- update permission is separate;
- no history rows are cascaded away;
- successful delete is audited.

Frontend tests must cover action visibility, confirmation, success, conflict and responsive action menu behavior.

Run focused devices tests, full relevant E2E, typecheck, lint, format, build and diff check.

## Out of scope

- bulk node creation (Task 08);
- append/replace provisioning (Task 09);
- soft-delete redesign;
- production inventory migration.

## Definition of Done

- Pristine devices can be deleted safely.
- Historical devices cannot be hard-deleted.
- Edit/delete/assign actions are compact, accessible and permission-correct.
- Existing assignment history and MQTT behavior do not regress.
