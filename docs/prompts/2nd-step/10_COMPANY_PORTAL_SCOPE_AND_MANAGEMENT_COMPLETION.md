# CODEX PROMPT - Phase 10: Company portal scope and management completion

Read `AGENTS.md`, completed Phase 7-9 docs, RBAC requirements and latest architecture blueprint.

Confirm Phase 9 is complete. Start only Phase 10.

Preserve the completed Phase 8 MQTT requestId/outbox protocol and Phase 9 desired/applied configuration state. This phase must not redesign command correlation, publish configuration directly, or update applied hardware state without ACK.

## Goal

Complete the Company Platform Manager, Site Manager, Building Manager and Viewer management experience so permissions, scopes and CompanyPosition can actually be configured from the UI before alarm recipients are implemented.

## Confirmed current gaps

- Company user page supports create/deactivate only.
- User role, active status, direct permissions, site/building scope and positions cannot be edited in UI.
- Company role create sends `permissionIds: []`; no permission editor exists.
- Site/building pages are list/create/deactivate only; detail/edit/plan workflow is incomplete.
- Some company sidebar routes are placeholders.

## In scope

### Role management

Implement Company role detail/editor:

- role name/key rules;
- list company-allowed permission catalog grouped by module;
- assign/remove permissions;
- show effective role permissions;
- system role protections;
- no-permission role behavior;
- self-lockout/last platform manager protections.

Company users may assign fixed platform permissions to roles. They must not create arbitrary global permission keys.

### User management

Implement create and edit workflows for:

- name/email/contact fields supported by schema;
- role;
- active/inactive status;
- direct allow/deny permissions if approved by existing backend;
- site access with view/manage;
- building access with view/manage;
- CompanyPosition assignments with optional site/building scope;
- audit trail.

Show effective permissions and effective accessible resources in a read-only preview.

### CompanyPosition management

Implement company position catalog and user position assignment.

Position is not a platform role. It will be used by Phase 11-12 alarm recipient resolution.

Support default seeded templates and custom company positions according to approved docs.

### Site/building detail

Complete:

```txt
/company/areas/:areaId
/company/buildings/:buildingId
/company/buildings/:buildingId/plan
```

Include edit/status, assigned users, assigned devices and monitoring links. Implement building plan upload/storage only if the repository already has an approved storage abstraction; otherwise create a clean local/dev abstraction and document production storage deferral.

### Scoped dashboard and sidebar

- Platform manager sees company-wide allowed pages.
- Site manager sees only assigned sites and their buildings.
- Building manager sees assigned buildings.
- Viewer sees read-only pages within scope.
- No-permission user sees only Welcome/Profile/Logout.
- A sidebar item must require permission; resource lists must still be backend scoped.
- Placeholder pages for company setup/management covered by this phase must be removed.

## Tests

Add E2E and frontend tests for:

- role permission create/update;
- permission catalog cannot be arbitrarily created by company user;
- user scope assignment and removal;
- site access implies approved child-building access rules;
- building-only user cannot access sibling building;
- position assignment scope validation;
- no-permission sidebar/API behavior;
- last platform manager/self-lockout cases;
- inactive user existing token rejection;
- role/direct allow/deny effective permission preview.

## Out of scope

- No occurrence-count engine yet.
- No notification delivery or alarm operations UI.
- No reports.
- Do not start Phase 11.

## Definition of Done

- Company management can be performed without direct DB edits.
- Roles have a real permission editor.
- Users can receive role, scope and position assignments.
- Company pages reflect permission + scope correctly.
- No-permission and self-lockout edge cases work end to end.
- Existing Phase 1-9 tests remain green.
