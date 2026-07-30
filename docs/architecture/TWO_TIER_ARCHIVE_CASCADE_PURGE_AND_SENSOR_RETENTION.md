# Two-tier archive, cascade purge, and sensor retention

Status: repository implementation and local verification complete; production rollout remains gated only by the external decisions below.

## Lifecycle

```text
ACTIVE
  -> Company Delete or GSS archive
ARCHIVED
  -> GSS Archive Center + archive.purge + domain permission + preview + typed confirmation
PURGED
```

`PURGED` is not a database status. It means the root and its strictly owned evidence no longer exist in the application database/private object storage. Restore is outside this lifecycle.

Company-context Delete is always archive. The canonical metadata is `deletedAt`, `deletedByType`, `deletedById`, and `deleteReason`. Company APIs return `404` for explicitly or ancestor-archived resources. Normal GSS lists also exclude them. Archived evidence is read-only and authoritative only through `/admin/archive`.

## Ownership and FK strategy

| Parent         | Strictly owned                                                                                                                                                            | Preserved global references                                              | Purge strategy                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Company        | sites, buildings, users, custom roles, positions, access/position rows, tenant alarms, readings/latest state, reports/exports, scoped commands/provisioning, scoped audit | Gateway, Node, NodeType, Permission, GSS identities/roles                | explicit ordered cleanup; company device assignments are removed                       |
| Site           | child buildings and their scoped evidence                                                                                                                                 | company device assignments; Gateway/Node                                 | explicit child-building subtree cleanup                                                |
| Building       | images, access/position scope, building assignments, alarm configuration/evidence, readings/latest state, reports, scoped commands/provisioning                           | Gateway/Node and their company assignment; independent node-gateway link | explicit ordered cleanup                                                               |
| Alarm Rule     | policies, counters, events, triggers, notifications/delivery logs                                                                                                         | Node/NodeType/Gateway; shared reading until orphaned                     | delivery -> notification -> trigger/event -> counter/policy -> rule -> orphan readings |
| Alarm Event    | its triggers and notifications/delivery logs                                                                                                                              | rule/policy and shared readings                                          | delivery -> notification -> trigger -> event -> orphan readings                        |
| Notification   | delivery logs                                                                                                                                                             | event, trigger, reading                                                  | delivery -> notification                                                               |
| GatewayCommand | its provisioning request/items when present                                                                                                                               | Gateway and inventory metadata                                           | only terminal archived commands; SetNull operational application links first           |

FK cascade is retained only where ownership was already unambiguous (pure joins, delivery logs, configuration history, provisioning children). Tenant roots and global inventory references remain Restrict and are handled by the domain purge adapter. This avoids circular cascades and accidental Gateway/Node deletion.

## Parent-derived archive

Archiving a Site does not rewrite every Building. A Building is archived for normal-query purposes when `building.deletedAt`, `building.area.deletedAt`, or `building.company.deletedAt` is set. The Archive detail endpoint assembles the parent subtree, including children without their own archive timestamp. The same ancestor predicate is applied to authentication, scope guards, dashboard, device options, monitoring ingestion/Socket.IO, alarm evaluation/dispatch, reports, commands, uploads, and selectors.

## Operational archive teardown

1. Lock and mark the root archived with actor/reason metadata.
2. Revoke Company/user sessions when applicable.
3. End active Gateway-Building assignments; preserve Gateway/Node and CompanyDeviceAssignment.
4. Disable scoped Alarm Rules/Recipient Policies and reset mutable counters.
5. Resolve/cancel scoped pending operational work using existing terminal lifecycle semantics.
6. Reject new sensor persistence, command, provisioning, report, assignment, branding, and image writes through active-ancestor checks.
7. Retain database and private-storage evidence for GSS Archive.

Node-Gateway assignment is building-independent and is preserved unless deterministic command provenance proves it is tenant-owned. Ambiguous legacy provenance is never guessed.

## Archive Center and permissions

The only archive UI/API surface is `/admin/archive`. Groups are Organizations, Company Management, Alarm Configuration, Alarm Operations, and Device Operations. Filters and 50/100 pagination are backend-authoritative.

| Action                       | Context   | Required permissions                              |
| ---------------------------- | --------- | ------------------------------------------------- |
| view/detail/preview          | GSS Admin | `archive.view`                                    |
| Company purge                | GSS Admin | `archive.purge` + `companies.delete`              |
| Site purge                   | GSS Admin | `archive.purge` + `areas.delete`                  |
| Building purge               | GSS Admin | `archive.purge` + `buildings.delete`              |
| user/position/role purge     | GSS Admin | `archive.purge` + canonical management permission |
| alarm rule/policy purge      | GSS Admin | `archive.purge` + `alarm-rules.manage`            |
| alarm event purge            | GSS Admin | `archive.purge` + `alarms.manage`                 |
| notification purge           | GSS Admin | `archive.purge` + `notifications.manage`          |
| GatewayCommand purge         | GSS Admin | `archive.purge` + `mqtt-commands.manage`          |
| filtered SensorReading purge | GSS Admin | `archive.purge` + `sensor-readings.purge`         |
| archive export/download      | GSS Admin | `archive.view` + `reports.export`                 |

Company roles never receive `archive.view`, `archive.purge`, or `sensor-readings.purge`. Frontend checks are presentation only; the backend re-resolves both purge permissions.

## Purge orchestration

`DeletionJob` stores the root/filter, requester, scope provenance, preview hash, idempotency key,
phase, safe progress counts, timestamps, attempt count, database lease owner, heartbeat and lease
expiry. A unique active target and unique idempotency key block duplicate jobs. Workers claim
pending or stale-leased running jobs with a conditional database update, refresh the lease while
processing, and resume idempotent phases after a crash. A stale preview returns
`DELETE_PREVIEW_STALE`. Active roots cannot be purged.

Organization purge order is:

1. resolve private keys internally;
2. remove building images, company logo, and report objects outside a DB transaction;
3. delete alarm delivery/evidence relations in dependency order;
4. delete SensorReading in bounded batches;
5. delete exports/jobs, latest state, provisioning/commands, alarm configuration, access/position scope, building assignments, and scoped audit payloads;
6. remove company assignments only for a Company purge;
7. delete users/positions/roles, buildings/sites, and finally the root;
8. store a sanitized `PurgeReceipt` containing only job/actor/root type/count/status/time.

The job is idempotent across retry: completed phases may observe already-missing objects/rows.
`CompanyUser`, `CompanyPosition`, and custom `CompanyRole` have explicit fail-closed adapters.
Historical specific-user/position policy targets and notification recipients are detached while
their immutable snapshots remain; active policies, protected roles and assigned roles still reject
purge. Raw database, storage keys, MQTT payloads, and provider errors are never returned to the
browser.

## SensorReading retention

Default retention is 180 days. The worker is disabled by default in tests and requires explicit enablement. Destructive mode also requires `SENSOR_RETENTION_DRY_RUN=false`.

A reading is eligible only when it is older than cutoff and has no trigger reading, first/last trigger evidence, or first/last counter reference. It is deleted directly (no `deletedAt`) in bounded batches up to the configured cycle cap. `LatestNodeState` is never touched. Filtered history queries use server-side typed filters; Company users have no purge action.

Validated settings: `SENSOR_RETENTION_DAYS`, `SENSOR_RETENTION_ENABLED`, `SENSOR_RETENTION_DRY_RUN`, `SENSOR_RETENTION_BATCH_SIZE`, `SENSOR_RETENTION_INTERVAL_MS`, and `SENSOR_RETENTION_MAX_ROWS_PER_CYCLE`.

## Storage and rollback semantics

Archive does not delete objects. Purge resolves keys on the backend, performs provider deletion outside database transactions, and retries safely. Local/memory provider deletion is physical.

`OPEN_DECISION`: S3 version/delete-marker enumeration and permanent removal is not yet approved. Ordinary S3 DELETE is not proof that every historical version is gone.

`OPEN_DECISION`: backup retention, legal hold, restore authorization, and backup-level purge SLA are not approved. Application rollback cannot restore a completed purge. Schema rollback can remove additive code paths, but hard-purged data requires an approved backup restore procedure.

## Production runbook

1. Take and verify an approved backup; resolve backup/legal-hold decisions.
2. Apply forward migrations; never use `prisma db push`.
3. Deploy API archive filtering before enabling new Delete UI semantics.
4. Seed GSS-only permissions and verify Company roles contain none of them. Existing GSS Admin
   sessions must log out and log in again (or otherwise refresh `/auth/gss/me`) before the UI can
   observe newly assigned effective permissions.
5. Start workers with validated `DELETION_WORKER_HEARTBEAT_MS` and
   `DELETION_WORKER_LEASE_MS` (`lease > 2 × heartbeat`), initially in a single-consumer staging
   deployment; then verify stale-lease recovery before scaling replicas.
6. Verify Archive Center security, preview hashes, storage provider deletion, and sanitized receipts in staging.
7. Enable destructive retention/purge only after the S3 and backup decisions are accepted.
8. Reconcile tenant-owned tables, global device preservation, orphan FKs, storage objects, and failed jobs after every large purge.

## Verification and remaining production gates

Repository-complete behavior includes Archive capability separation, parent-derived evidence,
detail and subtree inspection, CSV/XLSX through the existing ReportJob/private-storage pipeline,
job polling/failure/retry, server-filtered Sensor History selectors/chart/export, GSS-only filtered
reading purge, database lease ownership and stale recovery, crash-after-root-delete completion,
exactly-one receipt, and the sanitized reconciliation report.

The isolated performance gate inserts 100,001 readings, preserves the one alarm-referenced row and
removes 100,000 eligible rows in 1,000-row batches while observing concurrent query latency and
database lock waits. Unit, build, API E2E and aggregate Playwright gates are required to be green in
the final task handoff; documentation must not substitute for their command output.

Only these external production decisions remain:

- `OPEN_DECISION`: permanent S3 version/delete-marker removal policy and real production credentials;
- `OPEN_DECISION`: backup retention, legal hold, restore authorization and purge SLA;
- production backup/bucket provisioning and the authorized migrate → API/worker → Web rollout.

The repository implementation is not an authorization to enable destructive production purge
before those decisions are accepted.
