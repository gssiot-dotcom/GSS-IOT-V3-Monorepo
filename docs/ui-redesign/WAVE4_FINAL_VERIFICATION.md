# GSS IoT V3 UI Redesign — Wave 4 Final Verification

Date: 2026-07-23  
Scope: final visual QA and consistency pass only. No Wave 5 work is planned.

## Outcome

Wave 4 fixes are implemented and the protected exact-viewport fixture passes.
The final UI slice preserves routes, API contracts, RBAC, Company scope,
MQTT/realtime behavior, alarm/report semantics, i18n, and legacy monitoring
interaction behavior.

Formal release readiness remains conditional: the full web E2E aggregate timed
out after ten minutes because the legacy dark shared-surface evidence capture
hangs. The isolated protected, exact-viewport, no-permission, dark-shell,
Wave 1, Wave 2, and dark computed-style checks pass. API E2E passed on retry
(64 passed, 7 skipped); the first API attempt exposed a transient database
cleanup race and was not a product failure.

## Final Wave 4 fixes

| Finding                                                                            | Correction                                                                    | Evidence                                                      |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Dashboard report counts rendered literal placeholders and raw report statuses.     | Lowercase interpolation keys and shared semantic `StatusBadge`.               | Unit suite plus Admin dashboard exact captures.               |
| Monitoring rendered raw lifecycle values and duplicated realtime status on mobile. | Shared lifecycle/realtime badges; hide the page badge below small breakpoint. | Protected monitoring and exact viewport captures.             |
| Monitoring mobile tables hid gateway, age, and history action.                     | Compact mobile node-state cards while retaining desktop tables.               | Admin/Company monitoring captures and no-overflow assertions. |
| Dashboard/report mobile status badges clipped in flex rows.                        | `flexShrink: 0` wrappers and compact mobile job cards.                        | Exact 390x844 captures.                                       |
| Admin company device detail rendered raw lifecycle text.                           | Existing shared device lifecycle badge helper.                                | Typecheck, lint, unit suite and route audit.                  |

## Route inventory and final audit

All routes remain router-backed and permission-gated. `Visual` means a
representative protected capture or exact viewport fixture; `Audit` means
router/navigation/source/test review where no dedicated final capture exists.
No permission key or route path changed.

| Portal  | Route                                                                                                                   | Result                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Public  | `/`, `/login`, `/phase-2/demo`                                                                                          | Audit: public entry, login and legacy image-first demo preserved.                                          |
| Admin   | `/admin/welcome`, `/admin/profile`                                                                                      | Audit: protected welcome/profile shell preserved.                                                          |
| Admin   | `/admin/dashboard`                                                                                                      | Visual: KPI, severity, alarm, gateway and report states at 1440x900, 1280x800, 1024x768, 390x844.          |
| Admin   | `/admin/companies`                                                                                                      | Visual: card/table collection, scoped actions and empty/error/forbidden paths.                             |
| Admin   | `/admin/companies/:companyId`, `/:companyId/sites`, `/:companyId/buildings`, `/:companyId/users`, `/:companyId/devices` | Visual/Audit: route-backed company workspace, contextual navigation, relationships and assignment history. |
| Admin   | `/admin/devices`                                                                                                        | Audit: gateway/node inventory and provisioning tabs.                                                       |
| Admin   | `/admin/gateway-commands`                                                                                               | Visual: MQTT status, lifecycle table, drawer and action placement.                                         |
| Admin   | `/admin/monitoring`                                                                                                     | Audit: selectors, cards/table, drawer and realtime state.                                                  |
| Admin   | `/admin/alarms`, `/admin/alarms/:alarmId`                                                                               | Visual/Audit: operations table, detail evidence, semantic statuses and safe/unsafe resolve behavior.       |
| Admin   | `/admin/alarm-rules`                                                                                                    | Audit: structured rule editor and occurrence/count-interval evidence.                                      |
| Admin   | `/admin/notifications`                                                                                                  | Audit: notification history and read state.                                                                |
| Admin   | `/admin/reports`                                                                                                        | Visual: scoped filters, export-disabled state, job lifecycle and mobile cards.                             |
| Admin   | `/admin/settings/roles`, `/admin/settings/system`, `/admin/design-system`                                               | Audit: role protections, read-only system status and design fixture.                                       |
| Company | `/company/welcome`, `/company/profile`                                                                                  | Audit: protected welcome/profile shell preserved.                                                          |
| Company | `/company/dashboard`                                                                                                    | Visual: scoped KPI, operational and report surfaces at all required viewports.                             |
| Company | `/company/areas`, `/company/areas/:areaId`                                                                              | Visual/Audit: scoped area cards/table and detail.                                                          |
| Company | `/company/buildings`, `/company/buildings/:buildingId`, `/company/buildings/:buildingId/plan`                           | Visual/Audit: scoped building cards, detail and plan workflow.                                             |
| Company | `/company/buildings/:buildingId/monitoring`                                                                             | Visual/Audit: legacy node-type selection card and monitoring entry.                                        |
| Company | `/company/buildings/:buildingId/monitoring/:nodeType`                                                                   | Visual: semantic monitoring states, mobile cards, tabs, realtime and drawer.                               |
| Company | `/company/devices`, `/company/monitoring`                                                                               | Audit: scoped device inventory and building monitoring selection.                                          |
| Company | `/company/alarms`, `/company/alarms/:alarmId`                                                                           | Visual/Audit: scoped operations, detail evidence and resolve behavior.                                     |
| Company | `/company/alarm-rules`, `/company/notifications`, `/company/reports`                                                    | Visual/Audit: scoped editors/histories/report jobs and export gating.                                      |
| Company | `/company/users`, `/company/roles`, `/company/settings`                                                                 | Audit: scoped management, company-only permissions and settings status.                                    |
| Both    | `/admin/*`, `/company/*`, `*`                                                                                           | Audit: existing forbidden/not-found routing preserved.                                                     |

## State, responsive and accessibility audit

| Concern                                        | Evidence/result                                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Loading, empty, filtered empty, error          | Existing shared state components and route branches remain; no fetch or API contract changed.                                                                |
| Forbidden, inactive/expired session, not found | Existing guards, `ForbiddenState`, auth-routing tests and wildcard routes remain authoritative.                                                              |
| Realtime                                       | Shared connected/reconnecting/offline badges remain; Socket.IO joins/events were not changed.                                                                |
| Desktop/mobile                                 | Exact captures at 1440x900, 1280x800, 1024x768 and 390x844; existing protected captures also cover 375px. Every exact viewport asserts no document overflow. |
| Keyboard/labels                                | Semantic controls, labelled selectors, action-menu aria labels, focus styles and reduced-motion rules remain covered by existing tests and audit.            |
| Status semantics                               | Backend enums are converted to localized shared badges; status is not conveyed by color alone.                                                               |

## Evidence and release assessment

Final exact-viewport screenshots are under:
`test-results/ui-redesign.visual-capture-95a40--exact-responsive-viewports/`.
The fixture uses only test-only session/API interception; production auth and
backend guards remain unchanged.

The Wave 4 implementation is ready for UI review and targeted integration.
Do not mark the overall redesign release-ready until the hanging aggregate
web E2E dark-surface evidence helper is completed, fixed or explicitly
accepted by the repository owner. No Wave 5 feature work should start.
