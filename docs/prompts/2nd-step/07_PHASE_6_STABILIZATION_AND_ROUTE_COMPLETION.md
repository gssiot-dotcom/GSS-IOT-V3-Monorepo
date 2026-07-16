# CODEX PROMPT - Phase 7: Phase 6 stabilization and route completion

Read `AGENTS.md` first.

Then read:

- `docs/planning/PROJECT_STATE.md`
- `docs/planning/TODO.md`
- `docs/planning/DECISION_LOG.md`
- `docs/planning/IMPLEMENTATION_PLAN.md`
- `docs/architecture/PHASE_6_MONITORING_REALTIME.md`
- current router/auth/organization frontend code
- organization/auth backend controllers and E2E tests

Confirm Phase 6 code exists. Do not assume the user-facing flow is complete because Phase 6 is marked complete.

## Goal

Stabilize the existing Phase 0-6 product before adding new domains. Fix broken navigation/session behavior and complete the minimum GSS company-detail flow required to use already implemented organization APIs.

## Confirmed current issues

1. `CompaniesPage` navigates to `/admin/companies/:companyId`, but no route exists, so wildcard redirects to `/login`.
2. Auth session exists only in React memory. Browser refresh or direct deep-link loses session.
3. GSS Admin company detail, sites, buildings, users and assigned devices are not connected into a usable UI flow.
4. Many nav routes are placeholders. This phase must only replace placeholders directly needed for company setup and Phase 0-6 acceptance.
5. Existing backend security is authoritative and must not be weakened to solve frontend issues.

## In scope

### Auth/session stabilization

- Add safe session persistence and startup restoration for GSS and Company contexts.
- Preferred pattern:
  - persist access token and auth context in session storage or another approved current-project mechanism;
  - on app bootstrap call the matching `/auth/gss/me` or `/auth/company/me` endpoint;
  - rebuild `AuthSession` from server data;
  - clear invalid/expired sessions and redirect to login;
  - do not treat a missing frontend route as an auth failure.
- Preserve separate GSS and Company token contexts.
- Add a real NotFound page or context-aware fallback instead of redirecting every unknown route to `/login`.
- Preserve 401 -> logout and 403 -> Forbidden semantics.

### GSS company detail route

Implement:

```txt
/admin/companies/:companyId
/admin/companies/:companyId/sites
/admin/companies/:companyId/buildings
/admin/companies/:companyId/users
/admin/companies/:companyId/devices
```

The detail page may use tabs/subroutes, but route structure must be explicit and deep-link safe.

Use already existing backend APIs where possible. Add compatible APIs only when current API shape cannot support the page.

Company detail must show at least:

- company profile and status;
- platform manager/basic company users;
- construction sites;
- buildings;
- assigned gateways/nodes snapshot;
- links/actions allowed by existing permissions.

### Existing organization UI completion

- Company create form: add validation, loading, API error display and duplicate email/name feedback.
- Add edit and deactivate actions if backend already supports them.
- Do not hard-delete business data.
- Ensure action buttons are wrapped in matching permission checks.
- Ensure backend endpoint permissions remain enforced.

### Tests

Add frontend tests for:

- GSS login -> Companies -> Open -> company detail, without redirecting to login.
- Refresh/deep-link on an authenticated admin route restores session.
- Expired/invalid session redirects to login.
- Unknown authenticated route shows NotFound, not login.
- 403 shows Forbidden.
- Company user cannot open GSS routes and vice versa.

Add/extend backend E2E only if new API behavior is added.

## Out of scope

- Do not implement integrated node MQTT provisioning yet.
- Do not implement alarm levels, fault filters, occurrence counters, notifications or reports.
- Do not redesign RBAC or merge GSS and Company auth.
- Do not start Phase 8.

## Architecture invariants

- Backend remains the real security boundary.
- Super admin bypass remains `role.isSuperAdmin`.
- Company endpoints still require permission + scope.
- No token is accepted across the wrong auth context.
- No protected page is made public to avoid redirects.

## Definition of Done

- Clicking Open on a company never goes to login unless the session is actually invalid.
- Company detail and subroutes work on direct URL and browser refresh.
- Existing Phase 1-6 tests still pass.
- New browser/router/auth tests pass.
- No placeholder remains for the company setup routes listed above.
- Docs and planning state are updated accurately.

## Required verification

Run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
git diff --check
```

At the end, report:

- exact files changed;
- root cause of the login redirect;
- session persistence mechanism;
- routes/pages completed;
- tests added;
- deferred items.
