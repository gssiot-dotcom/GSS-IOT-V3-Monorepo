# Phase 0 Prompt — Repository Bootstrap

Read `AGENTS.md` and every mandatory document it references. Do not implement business features yet.

Create the new GSS IoT V3 pnpm monorepo with:

```txt
apps/api
apps/web
packages/ui
packages/contracts
packages/config
```

Requirements:

1. NestJS TypeScript API scaffold.
2. React/Vite/TypeScript web scaffold.
3. Prisma/PostgreSQL and Redis/local MQTT Docker Compose for development.
4. Strict TypeScript, ESLint, formatting, unit tests, API E2E test skeleton and browser E2E test skeleton.
5. Root scripts for lint, typecheck, test and build.
6. Environment validation and `.env.example` files.
7. Copy the legacy node images into the final web asset structure without visual modification.
8. Create a legacy source inventory report with exact paths for MQTT, RBAC reference, NodeTypeCard and design tokens.
9. Do not copy old application architecture or feature code.
10. Update `PROJECT_STATE.md`, `TODO.md` and `DECISION_LOG.md`.

Before editing, show the planned file tree and commands. After editing, run all root quality commands and report exact results.
