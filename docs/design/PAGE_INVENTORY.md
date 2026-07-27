# GSS IoT V3 — Page Inventory and Page-Level Specification

## GSS Admin Portal

| Route                                     | Purpose                      | Main blocks                                                                                       | Permission                                           |
| ----------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `/admin/welcome`                          | login landing/profile        | profile summary, quick links                                                                      | authenticated                                        |
| `/admin/dashboard`                        | global operational overview  | approved recent report jobs/status summary and report link                                        | `dashboard.view`                                     |
| `/admin/companies`                        | company management           | filters, table, create/edit/deactivate                                                            | `gss.companies.view`                                 |
| `/admin/companies/:id`                    | company detail               | profile, sites, buildings, users, devices, audit                                                  | `gss.companies.view`                                 |
| `/admin/companies/:id/construction-sites` | site management              | site list/CRUD                                                                                    | `gss.construction-sites.view`                        |
| `/admin/companies/:id/buildings`          | building management          | buildings, plans, stats                                                                           | `gss.buildings.view`                                 |
| `/admin/companies/:id/users`              | company users and positions  | role, status, scope, position assignments                                                         | `gss.company-users.view`                             |
| `/admin/devices`                          | unified inventory            | gateway/node filters and lifecycle                                                                | `gss.devices.view`                                   |
| `/admin/gateways`                         | gateway operations           | online state, assignment, commands                                                                | `gss.gateways.view`                                  |
| `/admin/nodes`                            | node operations              | node type/status/assignment                                                                       | `gss.nodes.view`                                     |
| `/admin/device-assignments`               | assignment history           | active/history, move/unassign                                                                     | `gss.device-assignments.view`                        |
| `/admin/gateway-commands`                 | outbox/command status        | pending/sent/ack/failed, retry/cancel                                                             | `gss.gateway-commands.view`                          |
| `/admin/monitoring`                       | global monitoring            | company/site/building selectors, operational summary, node-type drilldown, realtime/detail drawer | `gss.monitoring.view`                                |
| `/admin/alarms`                           | global alarm operations      | list, filters, detail, ack/resolve                                                                | `gss.alarms.view`                                    |
| `/admin/alarm-rules`                      | rule/policy management       | threshold/rule/policy matrix                                                                      | `gss.alarm-rules.view`                               |
| `/admin/reports`                          | report jobs/exports          | type/filter/job status/download                                                                   | `reports.view` + `reports.export` for export actions |
| `/admin/audit-logs`                       | critical history             | actor/action/entity/diff                                                                          | `gss.audit-logs.view`                                |
| `/admin/settings/admin-users`             | GSS users                    | user/role/status                                                                                  | `gss.admin-users.view`                               |
| `/admin/settings/roles`                   | GSS roles                    | roles and permission assignment                                                                   | `gss.admin-roles.view`                               |
| `/admin/settings/permissions`             | read-only permission catalog | searchable GSS/BOTH keys, descriptions, module, action and scope                                  | `permissions.view`                                   |
| `/admin/settings/system`                  | global config                | MQTT/provider/retention-safe settings                                                             | `gss.settings.system.view`                           |

## Company Dashboard

| Route                                                 | Purpose                      | Main blocks                                                                          | Permission + scope                                           |
| ----------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `/company/welcome`                                    | landing/profile              | profile and assigned scope                                                           | authenticated                                                |
| `/company/dashboard`                                  | company overview             | approved recent report jobs/status summary and report link                           | `dashboard.view` + `reports.view` for the report card        |
| `/company/profile`                                    | company profile              | profile/detail                                                                       | `company-profile.view`                                       |
| `/company/areas`                                      | accessible sites             | scoped list/CRUD                                                                     | `areas.view` + scope                                         |
| `/company/areas/:areaId`                              | site detail                  | buildings, users                                                                     | `areas.view` + site scope                                    |
| `/company/buildings`                                  | accessible buildings         | cards/table, status                                                                  | `buildings.view` + scope                                     |
| `/company/buildings/:buildingId`                      | building detail              | overview, devices, plans, monitoring entry                                           | `buildings.view` + building scope                            |
| `/company/buildings/:buildingId/plan`                 | plan/images                  | provider-neutral image metadata                                                      | `building-plans.view` + building scope                       |
| `/company/buildings/:buildingId/monitoring`           | node-type selection          | 3 immutable image-first cards + counts, loading/empty/error/forbidden states         | `monitoring.view` + building scope                           |
| `/company/buildings/:buildingId/monitoring/:nodeType` | realtime monitoring          | TABLE/CARD toggle, typed status cards, realtime state, bounded history detail drawer | same + realtime permission for socket                        |
| `/company/buildings/:buildingId/alarm-levels`         | thresholds                   | caution/warning/danger settings                                                      | `company.alarm-levels.view` + scope                          |
| `/company/alarm-rules`                                | recipient policies           | position/count/interval/channel matrix                                               | `company.alarm-rules.view` + scope                           |
| `/company/alarms`                                     | scoped alarm history         | filters, detail, ack/resolve                                                         | `company.alarms.view` + event scope                          |
| `/company/reports`                                    | scoped reports               | type/filter/job status/download                                                      | `reports.view` + `reports.export` for export actions + scope |
| `/company/users`                                      | company users                | roles, scopes, positions                                                             | `company-users.view`                                         |
| `/company/roles`                                      | role management              | fixed permission catalog assignment                                                  | `company-roles.view`                                         |
| `/company/permissions`                                | read-only permission catalog | searchable COMPANY/BOTH keys, descriptions, module, action and scope                 | `company-permissions.view`                                   |
| `/company/settings`                                   | company settings             | allowed company config                                                               | `settings.company.view`                                      |

## Detailed page acceptance template

Every page implementation task must state:

```txt
Route:
Audience:
Required permission:
Required scope:
Queries/mutations:
Main components:
Loading state:
Empty state:
Error state:
Forbidden state:
Responsive behavior:
Audit effects:
E2E scenarios:
```

## Final cross-route UX contract

The active route inventory is implemented with the shared Mantine shell, `PageHeader`, responsive content grids, permission-aware actions, state components and bounded tables/workspaces. Admin monitoring adds global selector/summary/drilldown behavior; Company monitoring preserves the three legacy image-first node-type cards and adds the shared card/table/detail presentation. Mobile navigation is a drawer, tables scroll or switch to a mobile-friendly detail representation, and page headers wrap actions below the hierarchy when needed.

Protected-route permission and scope behavior remains a backend/API security concern and is not inferred from visual state. Authenticated multi-viewport browser acceptance for every inventory row is intentionally deferred until a deterministic session fixture exists; representative login, protected redirect, legacy card, responsive overflow and no-placeholder smoke coverage is recorded in `apps/web/e2e/bootstrap.spec.ts`.

## Targeted company-logo inventory amendment

| Surface                                   | Read behavior                                                                 | Mutation behavior                                                 | States                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| shared Admin/Company header               | platform Activity mark, wordmark and translated route context                 | none                                                              | responsive compact mark; existing right controls preserved                                      |
| Company sidebar                           | authenticated own-company logo and session company name                       | refreshed by shared branding state                                | skeleton, contained logo, initials fallback, two-line name                                      |
| `/company/settings`                       | metadata with `settings.company.view`; logo bytes need no settings permission | upload/replace/remove with `settings.company.manage`              | loading, read-only, selected preview, progress, success, validation/API error, confirmed remove |
| `/admin/companies/:companyId` edit dialog | metadata/logo with `companies.view`                                           | logo with `companies.update`; name/code remains independent PATCH | contained preview, selected preview/cancel, progress, error, confirmed remove                   |

The binary logo endpoints are documented in `docs/architecture/COMPANY_LOGO_STORAGE.md`. No route,
sidebar permission key, Company scope rule or Phase 14 inventory item is added.
