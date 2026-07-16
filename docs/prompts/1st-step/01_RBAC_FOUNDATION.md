# Phase 1 Prompt — Auth, RBAC and Scope Foundation

Read the architecture blueprint and RBAC security checklist.

Implement only the Phase 1 vertical slice:

- Prisma models for permissions, GSS roles/users/direct permissions, companies, company roles/users/direct permissions, construction sites/buildings and user scope access.
- GSS and Company auth contexts.
- Active user checks.
- Effective permission resolver with super-admin bypass and direct deny precedence.
- Admin/company endpoint decorators and permission/scope guards.
- Permission/default role/super-admin seed.
- Frontend auth bootstrap, `RequireAuth`, `RequirePermission`, `Can` and permission-filtered sidebars with placeholder pages.
- Tests for super admin, no-permission, inactive user, cross-company and cross-building denial, and self-lockout policy.

Do not implement device/MQTT/monitoring features in this phase.
Update project docs and run all quality gates.
