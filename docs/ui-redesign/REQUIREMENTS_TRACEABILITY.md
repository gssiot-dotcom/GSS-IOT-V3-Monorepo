# GSS IoT V3 UI Redesign Requirements Traceability

This matrix is maintained during the redesign and completed during Verification Pass 1. The redesign is presentation-only: route contracts, backend scope filtering, authorization guards, API contracts, MQTT behavior, alarm classification/counting, notifications, reports, and project phase statuses remain outside scope.

| Requirement | Implementation file/component | Route/page | Permission behavior | Responsive status | Test evidence | Screenshot evidence | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Semantic GSS light/dark tokens | `packages/ui/src/theme.ts` | shared | none | pending | pending | pending | in progress | No user-facing theme switcher while deferred by decision log. |
| Permission-filtered global navigation | `apps/web/src/features/shell/PortalLayout.tsx`, `navigation.ts` | `/admin/*`, `/company/*` | `filterSidebarItems`, existing permissions preserved | pending | existing sidebar tests + new checks | pending | in progress | Route and permission keys are not renamed. |
| Entity cards for approved collections | organizations feature pages + `@gss-iot/ui` entity primitives | companies, areas, buildings, monitoring building selection | existing `Can` and guarded routes preserved | pending | pending | pending | pending | Cards consume existing API records; no client-side scope inference. |
| Dense operational data remains tables | `DataTable` and feature pages | devices, commands, alarms, reports, users, roles | existing guards preserved | pending | existing feature tests | pending | pending | Mobile uses horizontal scroll/detail patterns where needed. |
| Contextual inner navigation | organization/workspace pages + shared layout primitive | admin company workspace and approved form workspaces | existing route guards preserved | pending | pending | pending | pending | Realtime monitoring tabs remain tabs. |
| Monitoring tabs unchanged | monitoring feature pages | building/node monitoring | existing monitoring permission/socket behavior | pending | monitoring tests | pending | pending | Keep latest/history/alarm-level/fault-filter tabs and card/table toggle. |
| Protected visual verification fixture | Playwright fixture/spec support | representative protected pages | test-only session/mocks; production guards unchanged | pending | pending | pending | pending | Must support admin/company/no-permission/scope variants. |
| Full responsive/accessibility polish | shared CSS/primitives + feature pages | all current routes | no permission changes | pending | full suite | required widths | pending | Includes focus, labels, contrast, overflow, touch targets, reduced motion. |

