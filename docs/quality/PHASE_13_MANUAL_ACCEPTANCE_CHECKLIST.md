# Phase 13 frontend report acceptance checklist

Status: `PHASE_13_COMPLETE` (accepted 2026-07-21). Phase 14 is not started.

This record separates the browser evidence supplied for this acceptance from
permission and scope cases supported by automated tests. A security case is
not marked as browser-passed unless the supplied browser evidence covers it.

## Preconditions and phase boundary

- [x] The API and web application were exercised with the non-test local report
      configuration. Report files were created in the API local data/report
      storage directory and were downloadable through the application.
- [ ] Production credentials, production S3 objects and deployment-provider
      configuration were not exercised by this browser run and are not claimed as
      passed here.
- [x] Phase 13 verified private local report storage, CSV/XLSX generation,
      backend-authorized download, export expiry and cleanup behavior through the
      implementation and automated tests.
- [x] Production S3 execution, standalone production worker deployment,
      deployment manifests/rollback and long-term sensor retention are recorded as
      Phase 14 scope. They are deferred and were not started or executed.

## GSS Admin browser evidence

- [x] `/admin/reports` opened and worked correctly, including the approved
      Reports route/sidebar integration.
- [x] Report jobs initially appeared as `PENDING` and later reached
      `READY`/`COMPLETED`; polling and lifecycle status updates worked correctly.
- [x] CSV and XLSX report generation and download worked correctly.
- [x] The report job UI exposed the tested lifecycle and download workflow.
- [ ] A GSS view-only permission account was not part of the supplied browser
      evidence. The separation is covered by the focused automated web test and
      backend permission guards listed below.
- [ ] GSS category permission filtering, every supported filter combination,
      date-limit error display and expired-download UX were not separately claimed
      as browser evidence in this record.

## Company browser evidence

- [x] `/company/reports` opened and worked correctly with the authenticated
      Company context.
- [x] Company report jobs initially appeared as `PENDING` and later reached
      `READY`/`COMPLETED`; polling and lifecycle status updates worked correctly.
- [x] Company CSV and XLSX report generation and download worked correctly.
- [ ] A Company view-only/no-permission account, cross-company attempt,
      resource-selector edge case and expired/failed export were not separately
      claimed as browser evidence in this record. The applicable security and
      scope behavior is covered by automated tests listed below.

## Dashboard and approved parity browser evidence

- [x] Admin and Company dashboard recent report summaries and links to Reports
      worked correctly.
- [x] The browser workflow exposed only the approved report categories and
      CSV/XLSX export behavior. No undocumented legacy direct-file or unsafe
      storage behavior was recreated.

## Automated supporting evidence

- [x] `apps/web/src/test/reports.spec.tsx` covers missing report-view API
      suppression, GSS Admin and Company view-only list access without export
      submission, Company omission of client-supplied `companyId`, site/building
      reset helper, sensor-history 31-day validation, CSV/XLSX submission,
      active-job polling termination, authorized download, expired-download UX,
      redacted failure UI and GSS/Company endpoint separation.
- [x] `apps/api/test/e2e/reports.e2e-spec.ts` covers separate GSS/Company view
      and export guards, Company view-only behavior, cross-company and
      construction-site/building scope rejection, approved report types, date
      limits, lifecycle processing, sanitized failures, authorized downloads,
      expiry, download audit and idempotent cleanup.
- [x] Report storage and worker unit tests cover private local/memory/S3
      provider behavior, safe opaque keys, bounded processing, overlap prevention,
      graceful shutdown and cleanup retry behavior. These tests do not claim a
      production S3 or standalone worker deployment.
- [x] Shared alarm unsafe-resolve regression remains covered by
      `apps/web/src/test/alarm-operations.spec.tsx` and the alarm API E2E suite.

## Evidence and closeout

- [x] Browser evidence was recorded without exposing storage keys, local paths
      in API responses, bucket details, provider URLs, credentials or internal
      failure data. The local storage path is recorded only as an operational test
      fact, not exposed through the UI.
- [x] Focused report tests, report API E2E coverage, prior complete web/API
      suites, lint, typecheck, format checks, builds and `git diff --check` were
      run or are recorded in the project verification history; the final commands
      for this acceptance are reported with this update.
- [x] Phase 13 closeout is approved after the browser evidence and automated
      supporting evidence above. Phase 14 remains explicitly deferred.

## Manual acceptance procedure for future reruns

1. Start the API with local non-test report storage and the web app against its
   API base URL. Use authorized GSS Admin and Company test accounts.
2. Open `/admin/reports` and `/company/reports`; verify the sidebar permission,
   report types, supported filters, date limits, CSV/XLSX request, one request
   per click, `PENDING`/`PROCESSING` polling, terminal status and dashboard
   recent-job links.
3. Download a completed unexpired export through the UI and verify the backend
   filename/MIME type. Verify expired exports cannot be downloaded and that a
   new request is available only to an export-authorized user.
4. Repeat the view-only, no-permission, cross-company and site/building scope
   checks using the automated tests and, when available, dedicated accounts.
5. Confirm local files are private and cleanup removes expired objects while
   preserving report history. Do not treat this procedure as production S3,
   standalone worker, deployment-manifest or long-term-retention acceptance.
