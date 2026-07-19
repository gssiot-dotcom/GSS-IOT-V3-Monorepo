# GSS IoT V3 — Page Inventory and Page-Level Specification

## GSS Admin Portal

| Route                                     | Purpose                     | Main blocks                                      | Permission                    |
| ----------------------------------------- | --------------------------- | ------------------------------------------------ | ----------------------------- |
| `/admin/welcome`                          | login landing/profile       | profile summary, quick links                     | authenticated                 |
| `/admin/dashboard`                        | global operational overview | company/device/alarm KPIs, recent events         | `gss.dashboard.view`          |
| `/admin/companies`                        | company management          | filters, table, create/edit/deactivate           | `gss.companies.view`          |
| `/admin/companies/:id`                    | company detail              | profile, sites, buildings, users, devices, audit | `gss.companies.view`          |
| `/admin/companies/:id/construction-sites` | site management             | site list/CRUD                                   | `gss.construction-sites.view` |
| `/admin/companies/:id/buildings`          | building management         | buildings, plans, stats                          | `gss.buildings.view`          |
| `/admin/companies/:id/users`              | company users and positions | role, status, scope, position assignments        | `gss.company-users.view`      |
| `/admin/devices`                          | unified inventory           | gateway/node filters and lifecycle               | `gss.devices.view`            |
| `/admin/gateways`                         | gateway operations          | online state, assignment, commands               | `gss.gateways.view`           |
| `/admin/nodes`                            | node operations             | node type/status/assignment                      | `gss.nodes.view`              |
| `/admin/device-assignments`               | assignment history          | active/history, move/unassign                    | `gss.device-assignments.view` |
| `/admin/gateway-commands`                 | outbox/command status       | pending/sent/ack/failed, retry/cancel            | `gss.gateway-commands.view`   |
| `/admin/monitoring`                       | global monitoring           | scope selectors, node status overview            | `gss.monitoring.view`         |
| `/admin/alarms`                           | global alarm operations     | list, filters, detail, ack/resolve               | `gss.alarms.view`             |
| `/admin/alarm-rules`                      | rule/policy management      | threshold/rule/policy matrix                     | `gss.alarm-rules.view`        |
| `/admin/reports`                          | report jobs/exports         | type/filter/job status/download                  | `gss.reports.view`            |
| `/admin/audit-logs`                       | critical history            | actor/action/entity/diff                         | `gss.audit-logs.view`         |
| `/admin/settings/admin-users`             | GSS users                   | user/role/status                                 | `gss.admin-users.view`        |
| `/admin/settings/roles`                   | GSS roles                   | roles and permission assignment                  | `gss.admin-roles.view`        |
| `/admin/settings/permissions`             | catalog                     | read/manage global keys                          | `gss.permissions.view`        |
| `/admin/settings/system`                  | global config               | MQTT/provider/retention-safe settings            | `gss.settings.system.view`    |

## Company Dashboard

| Route                                                 | Purpose              | Main blocks                                | Permission + scope                     |
| ----------------------------------------------------- | -------------------- | ------------------------------------------ | -------------------------------------- |
| `/company/welcome`                                    | landing/profile      | profile and assigned scope                 | authenticated                          |
| `/company/dashboard`                                  | company overview     | accessible site/building/device/alarm KPIs | `dashboard.view`                       |
| `/company/profile`                                    | company profile      | profile/detail                             | `company-profile.view`                 |
| `/company/areas`                                      | accessible sites     | scoped list/CRUD                           | `areas.view` + scope                   |
| `/company/areas/:areaId`                              | site detail          | buildings, users                           | `areas.view` + site scope              |
| `/company/buildings`                                  | accessible buildings | cards/table, status                        | `buildings.view` + scope               |
| `/company/buildings/:buildingId`                      | building detail      | overview, devices, plans, monitoring entry | `buildings.view` + building scope      |
| `/company/buildings/:buildingId/plan`                 | plan/images          | provider-neutral image metadata            | `building-plans.view` + building scope |
| `/company/buildings/:buildingId/monitoring`           | node-type selection  | 3 immutable image cards + counts           | `monitoring.view` + building scope     |
| `/company/buildings/:buildingId/monitoring/:nodeType` | realtime monitoring  | node cards/table, realtime, history        | same + realtime permission for socket  |
| `/company/buildings/:buildingId/alarm-levels`         | thresholds           | caution/warning/danger settings            | `company.alarm-levels.view` + scope    |
| `/company/alarm-rules`                                | recipient policies   | position/count/interval/channel matrix     | `company.alarm-rules.view` + scope     |
| `/company/alarms`                                     | scoped alarm history | filters, detail, ack/resolve               | `company.alarms.view` + event scope    |
| `/company/reports`                                    | scoped reports       | job/export                                 | `company.reports.view` + scope         |
| `/company/users`                                      | company users        | roles, scopes, positions                   | `company-users.view`                   |
| `/company/roles`                                      | role management      | fixed permission catalog assignment        | `company-roles.view`                   |
| `/company/settings`                                   | company settings     | allowed company config                     | `settings.company.view`                |

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
