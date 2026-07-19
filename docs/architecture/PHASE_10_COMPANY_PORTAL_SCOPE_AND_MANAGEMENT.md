# Phase 10 — Company Portal scope and management completion

## Scope

Phase 10 makes the existing Company RBAC, user scope and CompanyPosition models operational through supported APIs and Company Portal UI. It does not implement occurrence counting, alarm recipient resolution, notification delivery, reports, retention, migration or deployment.

Phase 9 remains `PHASE_9_IMPLEMENTED_AUTOMATED_VERIFIED_LIVE_PENDING`; Phase 10 preserves the Phase 8 GatewayCommand requestId/outbox protocol and Phase 9 desired/applied alarm configuration state.

## Repository audit summary

- Phase 3 already added Prisma models and guarded APIs for companies, construction areas, buildings, building image metadata, company users, company-owned roles, direct user permissions, area/building access, CompanyPosition and scoped user-position assignments.
- Phase 3 also added idempotent company-owned default role provisioning for `platform_manager`, `site_manager`, `building_manager`, `viewer` and `no_permission`.
- Phase 7 completed GSS Admin company detail/deep-link routes and session restoration, but Company Portal management routes remained thin.
- Phase 8 added device provisioning and command observability; no role/scope schema changes were needed for Phase 10.
- Phase 9 added alarm-level/fault-filter state and monitoring UI tabs; Phase 10 did not alter MQTT command correlation or applied hardware state.
- Company role/user/scope/position APIs existed before Phase 10, but role update/delete, position update, inactive-position assignment rejection and effective-access preview were incomplete.
- Company Portal role/user pages were real pages, not pure placeholders, but they exposed only create/deactivate or empty-permission create flows.
- `/company/areas/:areaId`, `/company/buildings/:buildingId` and `/company/buildings/:buildingId/plan` were not implemented as Company Portal detail workflows.

## Backend behavior

Company management remains under the Company auth context and existing guards:

- role list: `company-roles.view`;
- role create/update/delete: `company-roles.manage`;
- permission catalog list: `company-permissions.view`;
- user list/effective preview: `company-users.view`;
- user create/update/deactivate: `company-users.create/update/delete`;
- position catalog and user-position assignment: `company-users.manage`;
- area/building detail and updates: existing `areas.*`, `buildings.*` plus scope guards;
- building plan metadata: `building-plans.view/manage` plus building scope.

Company Portal management read endpoints derive company context from the authenticated company user and then rely on effective permissions plus scoped query/guard behavior. Normal reads must not require the `isCompanyOwnerRole` platform-manager policy. The owner policy remains reserved for protected management mutations and last-platform-manager safety checks.

Custom role keys and position keys are normalized to lowercase underscore keys and rejected if they do not match the canonical key format after normalization. Company users may assign only fixed Company/BOTH-scope permissions from the global catalog; they cannot create arbitrary `Permission` rows or assign GSS-only permissions.

Custom company roles can be edited and deleted only when they are not protected system/default roles, not owner roles and not assigned to users. Protected default roles remain immutable through normal Company Portal APIs. This preserves `platform_manager` and `no_permission` semantics.

User effective-access preview reports:

- role permissions;
- direct allow permissions;
- direct deny permissions;
- final effective permissions after direct deny;
- assigned construction sites;
- directly assigned buildings;
- buildings inherited through site access;
- active CompanyPosition assignments with optional site/building scope.

Position assignment validation rejects cross-company scopes, mismatched site/building combinations, duplicate active assignments and new assignments to inactive positions.

## Frontend behavior

The Company Portal now exposes guided management workflows without raw UUID entry:

- `/company/roles`: role list, user count, protected/default indicators, create/edit permission editor grouped by permission module and safe custom-role delete.
- `/company/users`: user create/edit with role, active status, phone, direct allow/deny permissions, site/building scope, per-scope access level, CompanyPosition assignments and read-only effective-access preview.
- `/company/users` also exposes CompanyPosition catalog create/deactivate controls.
- `/company/areas/:areaId`: site detail, edit flow, scoped buildings and assigned users.
- `/company/buildings/:buildingId`: building detail, edit flow, assigned users, assigned gateways, monitoring link and plan link.
- `/company/buildings/:buildingId/plan`: provider-neutral building plan image metadata list and storage-key add flow.

The plan page intentionally remains at the approved `BuildingPlanImage.storageKey` API boundary. No direct local filesystem, S3 or provider-specific upload implementation is introduced before the production storage decision.

Area/building detail pages load the primary scoped resource independently from optional panels. Assigned users, assigned gateways/devices, role catalogs and permission catalogs are requested only when the session has the matching route permission. A forbidden optional request must not replace an otherwise authorized detail page with a full-page error.

## Scope semantics

Backend scope filtering remains mandatory:

- platform manager can access company-wide allowed resources;
- non-owner users see only directly assigned sites/buildings and buildings inherited from assigned sites;
- direct building access and area-inherited building access remain distinguishable in the effective preview;
- building-only access does not grant sibling buildings;
- no user can access another company.

Frontend filtering is UX only; backend guards and scoped queries remain the security boundary.

## Verification

Phase 10 automated coverage adds:

- custom company role create/update with normalized key and permission replacement;
- GSS-only permission assignment rejection;
- cross-company role mutation denial;
- direct deny overriding role/direct allow in effective preview;
- site-to-child-building inherited access preview;
- CompanyPosition assignment, inactive-position assignment rejection and scope validation;
- no-permission user `/auth/company/me` success plus protected API 403;
- inactive existing-token rejection after deactivation;
- Company Portal role editor mutation;
- no-permission sidebar filtering;
- building-plan metadata route and storage-key add flow.
- scoped non-platform-manager users opening assigned area/building detail pages;
- direct-allow `company-users.view` and `company-roles.view` users listing users/roles/positions without platform-manager identity;
- area/building detail pages skipping optional `/company/users` requests when `company-users.view` is absent;
- optional assigned-user 403 handling without full-page failure;
- Company users/roles pages rendering from explicit view permissions without hidden role-identity assumptions;
- missing permission, missing scope, sibling scope and cross-company scope denial for detail reads;
- last-platform-manager self-lockout protection after the read-path fix.

Manual browser acceptance is still required before Phase 10 can be called complete.
