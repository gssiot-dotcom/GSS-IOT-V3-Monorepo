# Phase 13 Reports and Export Operations

## Status

Phase 13 is `PHASE_13_COMPLETE` as of 2026-07-21. Phase 11 and Phase 12 are
complete. Phase 14 is not started.

Browser acceptance verified `/admin/reports` and `/company/reports`, report
jobs moving from `PENDING` to `READY`/`COMPLETED`, CSV/XLSX generation and
download, polling/lifecycle updates, dashboard recent-report summaries and
links, and generated files in the API local data/report storage directory.
Permission, scope, failure, expiry, download authorization and cleanup cases
not directly observed in that browser session are supported by the focused web
and API automated tests recorded in the Phase 13 checklist.

## Report worker

Reports use an internal Nest lifecycle worker. The worker owns only scheduling and operational coordination; it calls `ReportJobProcessorService.processPending()` for generation and `ReportExportCleanupService.cleanupExpired()` for expired-object cleanup.

Each cycle claims at most `REPORT_WORKER_BATCH_SIZE` jobs through the existing conditional `PENDING -> PROCESSING` update. Jobs are ordered oldest-first by `createdAt`, then `id`. Generation remains idempotent because only the successful claimant can complete a job and create its export. A cycle has one in-flight promise, so timer ticks cannot overlap. Each job failure is contained so later jobs in the bounded batch continue.

The worker is disabled automatically for `NODE_ENV=test` unless explicitly enabled. Application shutdown clears the timer, prevents new claims and waits for the active cycle. Worker and cleanup failures are caught and logged as safe counts/status messages; report content, storage keys, paths, URLs, credentials and provider payloads are never logged.

The default development cadence is 30 seconds for report processing and 5 minutes for cleanup. Defaults are conservative and configurable through the validated API environment. No Redis/BullMQ worker was introduced because the repository has no approved report queue integration.

`PROCESSING` jobs left by a crashed process are not automatically reclaimed. Retry/recovery semantics were not approved, and generating another export could duplicate confidential output. This remains an explicit operational decision for a later approved slice.

## Storage providers

`ReportStorageService` is the provider-neutral boundary. It accepts opaque keys and exposes only put/get/delete operations:

- `memory`: test-only isolated in-memory storage;
- `local`: development filesystem storage under `REPORT_LOCAL_STORAGE_DIR`, with path containment, atomic writes and private metadata sidecars;
- `s3`: production-capable S3-compatible storage using private server-side requests and AWS Signature Version 4. Objects are never public and the API never returns provider URLs, bucket internals, filesystem paths or credentials.

Downloads remain authorized backend streams. The application checks permission, current company/resource scope, completion and expiry before reading the object. No permanent or unauthenticated object URL is issued.

## Expiration cleanup

Cleanup selects only expired exports with no `storageDeletedAt`, in bounded oldest-expiry order. It deletes the object first, then conditionally records `storageDeletedAt` in the same export history row. A missing object is treated as an idempotent delete. Failed deletes leave the row eligible for a later cleanup attempt, and one failure does not stop the batch. ReportJob and ReportExport history is preserved; no hard delete is performed. Successful cleanup writes one SYSTEM `report-export.storage-cleanup` audit row after the conditional database update.

## Environment configuration

Required worker/cleanup settings and defaults:

```text
REPORT_WORKER_ENABLED=true                 # false in tests by default
REPORT_WORKER_INTERVAL_MS=30000
REPORT_WORKER_BATCH_SIZE=10
REPORT_CLEANUP_ENABLED=true
REPORT_CLEANUP_INTERVAL_MS=300000
REPORT_CLEANUP_BATCH_SIZE=100
REPORT_STORAGE_PROVIDER=local              # memory in test; s3 required in production
REPORT_LOCAL_STORAGE_DIR=.data/report-exports
```

Production `s3` configuration requires `REPORT_S3_REGION`, `REPORT_S3_BUCKET`, `REPORT_S3_ACCESS_KEY_ID` and `REPORT_S3_SECRET_ACCESS_KEY`; `REPORT_S3_ENDPOINT` is optional for AWS and supported for S3-compatible services. These values must be supplied through the deployment secret/configuration system, never committed.

## Phase boundary and deferred operational work

The approved execution order places retention, migration, hardening and
deployment in Phase 14. Therefore Phase 13 closeout verifies the local private
storage path and the implemented bounded, idempotent export expiry cleanup; it
does not claim that production S3 was configured or exercised.

The Phase 13 worker is an internal Nest lifecycle polling worker and was
verified through local behavior and automated worker tests. A standalone
production worker deployment, deployment manifests, production migration and
rollback runbooks remain deferred Phase 14 work. Long-term `SensorReading`
retention, partitioning, archival and purge are also Phase 14 work. No Phase 14
implementation was started as part of this closeout.

## Frontend report pages and dashboard integration

The approved frontend routes are `/admin/reports` and `/company/reports`. Both sidebar entries use the portal-local `reports.view` permission and both routes are protected by the corresponding authenticated portal context. `reports.export` remains separate: it gates export submission and authorized, unexpired downloads. A view-only user can list and inspect jobs but cannot cause a request or download API call.

The Admin page exposes the backend-supported report types, including audit and user activity only when the GSS report permission for that category is present. The Company page exposes all backend-supported company report types except `USER_ACTIVITY` and `AUDIT_LOG`. Supported filters are company (Admin where the company resource is available), construction site (`areaId`), building (`buildingId`), gateway (`gatewayId`), node type (`nodeTypeId`), node (`nodeId`) and date bounds (`from`/`to`) only for report types that accept them. Status and severity controls are not rendered because they are not part of the approved `ReportFiltersDto`. Empty identifiers are omitted, and Company requests never include a client-supplied `companyId`.

Date bounds are checked in the browser before submission: 366 days for general date-filtered reports and 31 days for `SENSOR_HISTORY`. Changing report type removes incompatible device/date values; changing the parent site resets a building value outside that site. The backend remains the final permission and scope boundary.

Visible `PENDING` and `PROCESSING` jobs are refreshed every two seconds. Polling is cleaned up when all visible jobs are terminal, and background refresh preserves the current list. The UI displays `COMPLETED`/`FAILED`, progress, created/completed/expiration information and only the redacted backend failure summary. Downloads use the authorized backend stream, preserve the returned filename and MIME type, and never construct or display a storage URL. Expired exports are marked `Expired` and cannot be downloaded.

The Admin and Company dashboards include an authorized recent-report-jobs/status summary using their separate report-list endpoint. No new analytics metrics or legacy storage behavior were added. Legacy parity is limited to the approved report categories and CSV/XLSX export workflow; undocumented legacy layouts or unsafe direct-file behavior remain deferred.
