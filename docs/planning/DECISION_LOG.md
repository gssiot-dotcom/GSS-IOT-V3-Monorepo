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
