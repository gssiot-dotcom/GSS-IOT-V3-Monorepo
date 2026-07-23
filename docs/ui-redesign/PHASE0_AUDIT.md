# UI Redesign Phase 0 Audit Reference

This is the durable summary of the completed Phase 0 audit used by the implementation and verification passes.

## Route and layout findings

- The current portal shell is shared by Admin and Company contexts and already filters navigation through `filterSidebarItems`.
- Entity collections suitable for cards: Admin companies; Company sites; Company buildings; buildings inside site/company detail; Company monitoring building selection; Admin company-detail site/building sections.
- Dense tables remain appropriate for users, roles, device inventory, gateway command history, alarm history, sensor history, report jobs/exports, and other large operational datasets.
- Route-backed contextual navigation is approved for the Admin company workspace (`overview`, `sites`, `buildings`, `users`, `devices`) and structured form workspaces; the existing route paths remain unchanged.
- Keep the realtime monitoring tabs (`latest states`, `history`, `alarm levels`, `fault filters`), the existing card/table toggle, and tightly related alarm-detail `Triggers`/`Notifications` tabs.
- Keep scoped gateway/node inventory tabs unless a safer route-backed replacement is proven by current code structure.

## Protected discrepancies

- The current router uses `/sites`; older inventory documentation mentions `/construction-sites`. The redesign preserves `/sites`.
- Current navigation uses `monitoring.view`; older documentation mentions `monitoring.admin-overview`. Permission keys are not changed.
- `/company/buildings/:buildingId/alarm-levels` is documented as a route, while the current monitoring implementation keeps alarm-level controls as tabs; the redesign preserves the current interaction model.

## Baseline visual evidence

Prior public/design-system and login captures remain under:
`C:\Users\stran\.codex\visualizations\2026\07\23\019f8d14-7a79-7463-b04f-4954f90ee099\gss-baseline\`

The new protected-route capture fixture is `apps/web/e2e/ui-redesign.visual.spec.ts` and writes screenshots under Playwright `test-results/ui-redesign.visual-*/*/screenshots/`.

