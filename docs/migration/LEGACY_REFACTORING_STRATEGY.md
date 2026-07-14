# Legacy Refactoring and Migration Strategy

## Core decision

This is not an in-place cleanup of the old Express/Mongoose repository. Build a new target repository and migrate behavior/data deliberately.

## What to extract from old GSS

- MQTT subscribe/publish topics.
- Command payloads and response shapes for cmd 2, 3, 4 and 5.
- Node type numeric mapping and sensor payload fields.
- Device identification rules.
- Existing building plan/image behavior.
- Existing report business fields.
- Existing Korean/English terminology.
- Three immutable node-type images and selection-card interaction.
- Any real business rule not yet captured in the blueprint.

## What not to copy

- hardcoded `admin|manager|worker` authorization;
- mixed route/controller/service modules;
- inline device assignment fields without history;
- unauthenticated or partially protected route groups;
- naming inconsistencies;
- empty/unused permission constants;
- duplicate legacy services/routes;
- Mongo document design that conflicts with relational history/RBAC;
- old build artifacts and generated `dist` code.

## Legacy-to-target module map

| Legacy                                     | Target                                       |
| ------------------------------------------ | -------------------------------------------- |
| `auth` + role middleware                   | `AuthModule` + RBAC guards                   |
| `users`, `CompanyMember`, `BuildingWorker` | CompanyUsers + Roles + Scope + Positions     |
| company module                             | CompaniesModule                              |
| building module                            | ConstructionSites + ConstructionBuildings    |
| gateway/node inline assignment             | DeviceAssignments history modules            |
| MQTT infrastructure                        | typed MqttModule + GatewayCommand outbox     |
| node histories                             | SensorReadings + LatestNodeState             |
| BuildingAlarmLevel/GatewayAlarmSetting     | AlarmLevels + AlarmRules + RecipientPolicies |
| AlertLog                                   | AlarmEvent + Notification + DeliveryLog      |
| reports                                    | ReportJob + scoped exports                   |
| admin/manager/worker dashboards            | permission + scope driven routes             |

## Migration sequence

1. Export legacy Mongo collections without modifying source.
2. Build a field mapping/reconciliation document.
3. Normalize identifiers and node-type names.
4. Load organization and users.
5. Create role/scope mapping from old userType and assignments.
6. Load inventory and active assignment history baseline.
7. Load latest states and optionally selected sensor history.
8. Load legacy alerts as imported historical events with source metadata.
9. Reconcile counts and orphan records.
10. Rehearse cutover and rollback.

## Data quality rules

- Never silently drop orphan references.
- Place invalid/orphan rows in a quarantine report.
- Preserve original legacy IDs in migration metadata.
- Use idempotent import scripts.
- Produce row counts before/after for every entity.
- Store migration run ID and timestamp.
