# CODEX PROMPT - Phase 14: Retention, migration, hardening and deployment readiness

Read `AGENTS.md` and all completed phase docs. Confirm Phase 13 is complete. Start only Phase 14.

## Goal

Make GSS IoT V3 production-ready: telemetry retention, legacy data migration, performance, security, observability, backup/restore, CI/CD and deployment runbooks.

## Sensor retention and partitioning

Implement and document:

- production partition strategy for SensorReading;
- default retention target currently documented as 180 days;
- purge/archive job;
- safe batch deletion;
- index strategy for building/node/type/time history;
- archival storage if required;
- monitoring of job success/failure;
- no impact on LatestNodeState.

Do not run destructive retention automatically without environment gating and dry-run support.

## Legacy migration

Build repeatable scripts for approved data:

- companies;
- users/roles mapping;
- buildings -> sites/buildings mapping;
- gateways/nodes;
- active and historical assignments when data permits;
- node type normalization (`vertical` -> `gangform_node`);
- alarm settings;
- sensor history if migration is approved;
- alert/report metadata if approved.

Requirements:

- dry run;
- idempotency;
- validation and reconciliation report;
- rejected-row log;
- no plaintext passwords;
- rollback/restore plan.

## Security hardening

- dependency and secret scan;
- rate limits for auth and expensive APIs;
- CORS review;
- secure headers;
- token expiry/rotation strategy;
- file upload validation;
- object-level authorization review;
- Socket.IO auth review;
- MQTT credentials and TLS review;
- audit log tamper considerations;
- production env validation;
- remove debug/fake ACK behavior from production mode.

## Reliability and observability

- structured logs with correlation IDs;
- health/readiness checks for DB, MQTT, queue/storage;
- metrics for ingestion, dedupe, command latency, ACK/failure, alarm evaluation, notification delivery;
- graceful shutdown;
- retry/backoff limits;
- dead-letter handling where used;
- gateway last-seen/offline monitoring.

## CI/CD and deployment

Provide:

- production Dockerfiles/compose or target platform manifests;
- migration-before-start strategy;
- seed policy without overwriting runtime roles;
- staging deployment;
- smoke test script;
- backup and restore test;
- blue/green or safe rollback plan;
- release checklist;
- UAT checklist.

## Performance tests

At minimum test:

- sustained telemetry ingestion;
- history pagination;
- Socket.IO fan-out;
- alarm counter concurrency;
- report generation;
- command reconnect burst.

Document tested dataset/rate and bottlenecks.

## Definition of Done

- Production deployment is reproducible.
- Migration and rollback are rehearsable.
- Retention jobs are safe and observable.
- Security and authorization review has no unresolved critical issue.
- Backup/restore and smoke tests are documented and run.
- Final `PROJECT_STATE.md` accurately distinguishes completed product, optional items and operational follow-up.
