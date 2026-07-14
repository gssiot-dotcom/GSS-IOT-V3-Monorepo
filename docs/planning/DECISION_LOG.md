# GSS IoT V3 — Decision Log

## Format

```txt
DEC-YYYY-NNN
Status: proposed | accepted | superseded
Context:
Decision:
Consequences:
Files affected:
```

## DEC-2026-001

**Status:** accepted

**Context:** Eski GSS loyihada Express/Mongoose modul va route responsibilitylari aralash.

**Decision:** Yangi greenfield pnpm monorepo quriladi. Eski code production architecture sifatida ko‘chirilmaydi.

**Consequences:** Legacy business flow, MQTT contracts va assets extraction qilinadi; implementation NestJS/Prisma orqali qayta yoziladi.

## DEC-2026-002

**Status:** accepted

**Context:** Parfumbox admin componentlari izchil, eski GSS rang va node cardlari domain identityni saqlaydi.

**Decision:** UI component system Mantine + Tabler icons va Parfumbox admin patterns bo‘ladi. Ranglar GSS palette’dan olinadi. Old GSS node-type card rasmlari va image-first layout saqlanadi.

**Consequences:** Yangi loyihada Mantine va shadcn parallel primary systems sifatida ishlatilmaydi.

## DEC-2026-003

**Status:** accepted

**Context:** Alarm manualidagi `회수` notification send count deb noto‘g‘ri talqin qilinishi mumkin.

**Decision:** `회수 = requiredOccurrenceCount`; `지속시간 = countIntervalSeconds`, ya’ni eligible sensor counts orasidagi minimal interval.

**Consequences:** Counting PostgreSQL transaction state bilan yuritiladi; BullMQ timing source-of-truth emas.

## DEC-2026-004

**Status:** accepted

**Context:** Alarm manualidagi lavozimlar RBAC role emas.

**Decision:** `CompanyRole`, `CompanyPosition` va resource scope alohida modellardir. Position + scope notification recipientni, role permissions esa UI/API accessni boshqaradi.

## DEC-2026-005

**Status:** accepted

**Context:** Counter history sensor history bilan birga tez o‘sishi xavfi.

**Decision:** `alarm_counter_states` har node-policy uchun bitta mutable row bo‘ladi. Eligible reading IDs faqat event evidence sifatida kerakli darajada saqlanadi.

## DEC-2026-006

**Status:** accepted

**Context:** Phase 0 initially resolved Prisma 7.8.0 while the repository schema used the Prisma 6 datasource configuration with `url` in `schema.prisma`.

**Decision:** Pin `prisma` and `@prisma/client` to the same explicit version, `6.19.0`, and keep the existing environment-backed PostgreSQL datasource configuration.

**Consequences:** Prisma validation remains compatible with the Phase 0 schema and does not introduce Prisma 7 configuration or business schema changes. Future Prisma upgrades require a separate documented decision and validation pass.

**Files affected:** `apps/api/package.json`, `apps/api/prisma/schema.prisma`, `pnpm-lock.yaml`.

## DEC-2026-007

**Status:** accepted

**Context:** Workspace source aliases caused app builds to compile arbitrary files outside their configured projects and broke project-reference checks.

**Decision:** Use a root TypeScript solution that references buildable workspace projects. Shared packages publish their compiled `dist` declarations and runtime entry points through package exports; apps import workspace package names rather than source-relative paths.

**Consequences:** `pnpm typecheck` and `pnpm build` have one consistent dependency order, while package boundaries remain explicit for later feature work.

**Files affected:** `tsconfig.json`, `tsconfig.base.json`, `apps/api/tsconfig.build.json`, `apps/web/tsconfig.build.json`, `packages/*/package.json`.

## DEC-2026-008

**Status:** accepted

**Context:** The blueprint migration appendix labels inventory extraction as Phase 1, while the repository delivery plan and approved Phase 1 prompt define the next deliverable as database/auth/RBAC foundation.

**Decision:** Repository delivery phases follow the approved prompt and planning documents. The blueprint appendix remains an architectural migration sequence, not the execution phase numbering.

**Consequences:** Phase 1 implements the RBAC foundation without starting legacy inventory migration.

## DEC-2026-009

**Status:** accepted

**Context:** `PAGE_INVENTORY.md` uses prefixed permission keys and construction-site terminology that conflict with the authoritative architecture blueprint.

**Decision:** Use the blueprint's unprefixed `module.action` permission keys and `ConstructionArea`/`areas` persistence terminology. Korean UI copy may still use the normalized construction-site translation key.

**Consequences:** Page inventory documentation will be reconciled in a documentation-focused follow-up; Phase 1 does not introduce a second permission namespace.

## DEC-2026-010

**Status:** accepted

**Context:** Token transport, lifetime, and revocation were not previously specified.

**Decision:** Phase 1 uses separate short-lived bearer JWT contexts with explicit audiences and per-user `tokenVersion` invalidation on logout. A logout invalidates all active tokens for that user; refresh-token and per-device session support are deferred.

**Consequences:** The API checks the persisted user status and token version on every authenticated request. The web application keeps the access token in memory for this foundation.

## DEC-2026-011

**Status:** accepted

**Context:** Phase 1 API E2E verification must use the same local environment source as the runtime API. The API entry point loads `apps/api/.env` through `dotenv/config`, while the E2E setup previously only supplied fallback values.

**Decision:** Load `dotenv/config` first in the API E2E setup, then retain non-secret fallback values only for absent test environment variables.

**Consequences:** Runtime and API E2E commands use the same configured `DATABASE_URL` when `apps/api/.env` exists. This does not change authentication, RBAC, database architecture, or deployment configuration.

**Files affected:** `apps/api/test/setup-env.ts`.

## DEC-2026-012

**Status:** accepted

**Context:** Phase 1 verification confirmed that the API runtime and API E2E both load `apps/api/.env`, and that PostgreSQL accepts the corrected credentials but reports `P1003` because the configured `gss_iot_v3` database does not exist.

**Decision:** Do not alter application architecture, credentials, migrations, or seed behavior to compensate for the missing database. Database provisioning remains an external environment prerequisite.

**Consequences:** Phase 1 remains blocked until the target database is provisioned and the existing migration, seed, and API E2E commands pass.

**Files affected:** `docs/planning/PROJECT_STATE.md`, `docs/planning/TODO.md`.

## DEC-2026-013

**Status:** accepted

**Context:** Database seed verification found that the `platform_manager` company role template received GSS-only permissions from the complete catalog.

**Decision:** Company role templates may receive only permissions whose scope type is `COMPANY` or `BOTH`. GSS-only permissions remain available only to GSS roles.

**Consequences:** The seed preserves separate GSS and Company authorization contexts while keeping `platform_manager` as the most privileged company template.

**Files affected:** `apps/api/prisma/seed.ts`.

## DEC-2026-014

**Status:** accepted

**Context:** Database-backed API E2E found that login attempted to provide the JWT audience both in the payload and signing options, which the JWT library rejects.

**Decision:** Set the JWT audience through the signing options only; the verified payload type permits the resulting `aud` claim.

**Consequences:** GSS and Company token issuance retains explicit audience separation and the RBAC E2E suite can exercise authenticated endpoints.

**Files affected:** `apps/api/src/common/auth.types.ts`, `apps/api/src/modules/auth/auth.service.ts`.

## DEC-2026-015

**Status:** accepted

**Context:** The external `gss_iot_v3` database prerequisite was completed and Phase 1 migration, seed, RBAC verification, idempotency check, and quality gates were rerun successfully.

**Decision:** Record Phase 1 as complete. Do not start Phase 2 without an explicit prompt.

**Consequences:** The applied migration history is preserved; any future schema change must use a new forward migration. The canonical seed can be rerun safely without duplicating permissions, roles, templates, or the GSS super admin.

**Files affected:** `docs/planning/PROJECT_STATE.md`, `docs/planning/TODO.md`, `docs/planning/DECISION_LOG.md`.

## DEC-2026-016

**Status:** accepted

**Context:** Phase 2 added web component tests while the root `pnpm test` command runs API and web Vitest suites concurrently on Windows. The default web Vitest fork pool can fail with `spawn EPERM` in that concurrent run even when the web tests pass in isolation.

**Decision:** Configure the web Vitest suite to use the `threads` pool.

**Consequences:** The root workspace test gate runs reliably without changing application behavior, RBAC behavior, database schema, seed data or browser E2E coverage.

**Files affected:** `apps/web/vitest.config.ts`.

## DEC-2026-017

**Status:** accepted

**Context:** Phase 2 requires a browser-verifiable story/demo surface for shared UI primitives before real organization and device data exists.

**Decision:** Add a public `/phase-2/demo` route that renders typed fixtures for the GSS theme, universal states, status/table primitives and the three legacy node-type cards. Keep real Admin and Company shell routes protected by the existing Phase 1 auth/permission guards.

**Consequences:** Phase 2 browser checks can verify the UI foundation without adding mock business APIs or bypassing production auth behavior. Phase 3 can replace placeholders with real organization/user flows.

**Files affected:** `apps/web/src/app/router.tsx`, `apps/web/src/features/shell/DesignSystemDemoPage.tsx`, `apps/web/e2e/bootstrap.spec.ts`.

## DEC-2026-018

**Status:** accepted

**Context:** The Phase 2 web app runs from Vite at `http://127.0.0.1:5173` by default, while API requests target `http://localhost:3000`. Browsers treat `localhost` and `127.0.0.1` as different origins, and the API previously did not enable CORS.

**Decision:** Add environment-driven API CORS configuration through `CORS_ALLOWED_ORIGINS`. Development and test defaults allow `http://localhost:5173` and `http://127.0.0.1:5173`; production defaults to no browser origins unless explicitly configured. Auth remains bearer-token based, so CORS credentials stay disabled and login does not set cookies.

**Consequences:** Local browser login works from both Vite origins without using wildcard CORS or weakening RBAC/auth guards. Unknown browser origins do not receive CORS allow headers.

**Files affected:** `packages/config/src/env.ts`, `apps/api/src/common/cors.ts`, `apps/api/src/bootstrap.ts`, `apps/api/src/main.ts`, `.env.example`, `apps/api/.env.example`, `apps/api/test/e2e/rbac.e2e-spec.ts`, `packages/config/test/env.spec.ts`.

## DEC-2026-019

**Status:** accepted

**Context:** Phase 3 requires building plan/real-image records, but the object-storage provider and browser upload transport remain explicit open decisions.

**Decision:** Phase 3 persists validated `BuildingPlanImage` metadata through an auditable `storageKey` API boundary. It does not introduce a local-file shortcut, provider credentials, or an unapproved S3 adapter.

**Consequences:** Organization and building-plan workflows have durable, permission- and scope-protected image references now. Binary upload and signed URL delivery will be added only with the future storage-provider decision.

**Files affected:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260714150000_organization_users/migration.sql`, `apps/api/src/modules/organizations/`.
