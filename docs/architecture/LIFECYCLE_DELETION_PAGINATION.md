# Lifecycle, deletion, unassignment and pagination architecture

Status: implemented correction contract (2026-07-27). This document refines the lifecycle language
in the architecture blueprint under `DEC-2026-0727`; it does not start Phase 14.

## Lifecycle versus deletion

`ACTIVE`/`INACTIVE` and alarm `enabled` are reversible lifecycle state. They use explicit
`PATCH .../status` operations, update/manage permissions and audit records. Company-user status
changes always increment `tokenVersion`; activation therefore cannot revive an earlier token.
Last active GSS super-admin and Company platform-manager protections remain transactional.

Permanent deletion is a different operation. Company, Area, Building, CompanyUser,
CompanyPosition, custom CompanyRole/GssRole, AlarmRule and AlarmRecipientPolicy can use hard delete
only while pristine. The API returns a `DeleteCapability`:

```ts
{ allowed, mode: "HARD_DELETE" | "SOFT_DELETE" | "NOT_ALLOWED", blocker, code }
```

Capabilities are presentation hints only. The service repeats dependency/history checks inside the
delete transaction and returns structured `409` details with a blocker code and a safer lifecycle,
unassignment or archive alternative. Organization legacy `DELETE` endpoints remain temporary
deactivation adapters; new UI uses `PATCH .../status` and `DELETE .../permanent`.

Company logo deletion uses the provider-neutral storage boundary. Database deletion and storage
cleanup are failure-safe: storage failure blocks completion, and a failed database transaction
restores the object when the provider supports restoration.

## Alarm evidence archive

Alarm events, trigger evidence and notification delivery history are operational evidence and are
never cascade-erased. A resolved AlarmEvent can be archived with `alarms.manage`. A notification
can be archived by its recipient or a correctly scoped `notifications.manage` principal. Additive
`deletedAt`, `deletedByType` and `deletedById` fields retain actor and time; normal lists and unread
counts exclude archived rows. Reports/audit relations remain intact. Active unsafe alarms cannot be
archived.

Alarm Rule/Recipient Policy activation rechecks active uniqueness and resets mutable counter state
and evaluation version before further occurrence evaluation. Rule/policy hard delete remains
pristine-only.

## Assignment ending

- Gateway company unassignment requires `gateways.assign` and is blocked while an active building
  or node relationship exists. The `409` response includes exact active counts.
- Node company unassignment requires `nodes.assign`, ends the active node-gateway row first, then
  ends the company row in one transaction, and audits both.
- Building and gateway unassignment end assignment history rows; they do not delete history.
- Concurrent duplicate endings use active-status predicates so only one request can succeed.
- No MQTT unregister command is invented. Database membership history may differ from physical
  gateway membership until the approved `REPLACE` provisioning flow completes.

## Permission map

| Operation                              | Permission                                      |
| -------------------------------------- | ----------------------------------------------- |
| Company lifecycle / permanent delete   | `companies.update` / `companies.delete`         |
| Area and Building lifecycle / delete   | matching `.update` / `.delete`                  |
| Company User lifecycle / delete        | `company-users.update` / `company-users.delete` |
| Company Position lifecycle / delete    | `company-users.manage` / `company-users.delete` |
| Company or GSS custom role delete      | `company-roles.manage` / `admin-roles.manage`   |
| Gateway or Node lifecycle              | `gateways.update` / `nodes.update`              |
| Gateway or Node assignment ending      | `gateways.assign` / `nodes.assign`              |
| Alarm rule/policy lifecycle and delete | `alarm-rules.manage`                            |
| Resolved alarm archive                 | `alarms.manage`                                 |
| Notification archive                   | recipient or scoped `notifications.manage`      |

Backend guards, company ownership and Area/Building scope remain the security boundary. Frontend
capabilities and hidden actions are UX only.

## Collection pagination

User-facing collection endpoints return `{ items, page, pageSize, total }`. Page defaults to `1`;
page size defaults to `50` and accepts only `50|100`. DTO validation rejects all other sizes.
Filtering/search is part of the database `where` before `skip/take`; ordering has an ID tie-breaker.
The shared header pagination displays localized range/total, size selector and page navigation.
Search/filter/size changes reset page one. Fixed enums, node types, detail records and permission
checkbox options are not paginated; selectors use dedicated option endpoints.

Covered collection families are Companies, Areas, Buildings, Company Users/Positions/Roles,
GSS Roles, permission catalogs, Admin and Company device inventory, company-detail nested
resources, gateway commands, sensor history, alarm rules/policies/events/counters/triggers,
notifications and report jobs.

## Migration and rollback

Migration `20260727090000_lifecycle_deletion_pagination` adds only nullable archive columns and
supporting indexes. Forward deployment order is migrate, deploy API, then deploy web. Rolling back
application code is safe while columns remain. A database rollback must first preserve/export any
archive actor metadata written after deployment, then drop the new indexes and columns; it cannot
restore a hard-deleted pristine record. Applied migration history must never be rewritten.
