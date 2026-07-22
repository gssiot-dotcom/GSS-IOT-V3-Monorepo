# CODEX TASK 06 — GSS Admin Roles, Admin System Settings and Company Settings

Complete Tasks 02–05 first. Read RBAC security documents and inspect current GSS role models, permission seed, safe-admin policy, Company model and placeholder routes.

## Goal

Complete the meaningful empty pages from user Requirement 5:

```txt
/admin/settings/roles
/admin/settings/system
/company/settings
```

Do not create fake settings or unsafe controls merely to fill a page.

## Part A — GSS Admin Roles

### Backend

Implement a dedicated GSS role management vertical slice using existing models:

- list roles with user count and permissions;
- read GSS-scoped permission catalog;
- create custom non-system roles;
- update custom role name/key under safe validation;
- replace role permissions transactionally;
- delete an unused custom role;
- protect system roles;
- protect the super-admin role and last active safe admin;
- audit every mutation.

Use existing permissions:

```txt
admin-roles.view
admin-roles.manage
```

Never allow GSS roles to receive Company-only permissions.

If a role is in use, deletion must be rejected with a clear conflict; do not cascade users.

### Frontend

Build a real role page with:

- role list and system/super-admin badges;
- user count;
- permission count;
- create/edit custom role;
- grouped permission editor;
- read-only presentation for protected system roles;
- self-lockout/backend conflict messages;
- loading/empty/error states;
- permission-wrapped actions.

Use a full page or large drawer for permission editing, not a cramped modal.

## Part B — GSS Admin System Settings

Build a useful operational settings/status page based on actual current configuration and readiness. At minimum, expose a redacted read model for safe fields such as:

- application/API version and environment label;
- MQTT enabled/connected/readiness state;
- report storage driver/readiness without credentials or sensitive paths;
- report worker enabled/mode/readiness;
- command expiry/retry policy summaries;
- current documented sensor-history retention value;
- feature flags that already exist.

Requirements:

- protect with `settings.system.view`;
- redact credentials, tokens, passwords, full connection strings and secret paths;
- do not return raw environment variables;
- do not add mutation toggles unless a persisted, approved runtime setting model already exists;
- if no approved mutable setting exists, make the page intentionally read-only and explain that production/deployment controls remain Phase 14.

`settings.system.manage` must not be used to invent unsafe runtime mutation.

## Part C — Company Settings

Implement authenticated Company settings using the current Company entity and server-derived company context.

- GET Company settings/profile with `settings.company.view`;
- update approved company profile/contact fields with `settings.company.manage`;
- never accept/trust companyId from the client;
- audit updates;
- apply validation and optimistic/clear success feedback.

Safe default policy unless an approved document says otherwise:

- editable: address, phone, email and other non-security contact/profile fields;
- read-only/GSS-controlled: company id, status and system identifiers;
- company legal/display name and code must remain read-only if ownership is not explicitly approved.

If current docs conflict, record `OPEN_DECISION` and implement the conservative read-only behavior for disputed fields.

## Tests

Cover:

- GSS role view/manage separation;
- system role immutability;
- super-admin and last-safe-admin protection;
- Company-only permission rejection;
- role-in-use delete conflict;
- audit writes;
- system settings redaction;
- no secret values in API response or UI;
- Company settings view/manage separation;
- authenticated company context and cross-company tampering rejection;
- UI placeholders are removed;
- action buttons are hidden without permission.

Run focused unit/E2E/web tests plus lint, typecheck, format, build and diff check.

## Out of scope

- GSS admin-user management unless strictly required to test role safety;
- production deployment configuration;
- production S3 or worker deployment;
- password/profile credential changes;
- arbitrary runtime env mutation.

## Definition of Done

- All three routes are meaningful and no longer placeholders.
- RBAC and scope protections are backend-enforced.
- System settings expose only safe real information.
- Company settings use authenticated context.
- Tests and manual acceptance pass.
