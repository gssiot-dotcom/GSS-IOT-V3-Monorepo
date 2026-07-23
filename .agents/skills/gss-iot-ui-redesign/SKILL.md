---
name: gss-iot-ui-redesign
description: Audit, redesign, and visually polish the GSS IoT V3 React and Mantine dashboard. Use when asked to modernize the GSS Admin or Company UI, fix poor card or table action placement, improve the application shell, define a code-first design system, refactor management and monitoring pages, run visual QA, or prepare phased Codex prompts for the GSS IoT V3 repository. Preserve APIs, routes, RBAC, scope security, business behavior, i18n, and legacy node-monitoring behavior.
---

# GSS IoT V3 UI Redesign

## Start every redesign task

1. Read repository `AGENTS.md` and the mandatory documents it names.
2. Inspect the current implementation before proposing visual changes.
3. Read these skill references as needed:
   - current repository specifics: `references/repository-context.md`
   - visual direction and tokens: `references/design-direction.md`
   - button and action placement: `references/action-placement-rules.md`
   - phased delivery: `references/workflow.md`
   - acceptance criteria: `references/page-acceptance-checklist.md`
4. Inspect `git status` and preserve user changes.
5. State the current redesign wave, planned files, screenshots, and tests before editing.

## Protect behavior, redesign presentation

- Keep backend APIs, routes, DTOs, authentication, RBAC permissions, scope checks, data fetching, realtime behavior, and business rules unchanged unless the user explicitly requests functional work.
- Treat backend authorization as the security boundary. Keep route, sidebar, and action permission checks.
- Keep Mantine and Tabler as the component system. Do not introduce a competing UI framework.
- Keep all UI strings in i18n.
- Preserve the three legacy node-type images and node-type selection flow.
- Preserve compact monitoring cards, status semantics, and desktop density.
- A visual redesign may replace or expand the current tokens, layout, primitives, and documented visual rules. Update design documents when the visual contract changes.

## Design method

Use code-first design rather than requiring Figma:

1. Turn `/admin/design-system` into a living component and state gallery.
2. Capture baseline and after screenshots with Playwright at desktop, tablet, and mobile sizes.
3. Fix shared primitives before duplicating route-specific CSS.
4. Redesign one coherent page family at a time.
5. Stop after each wave for visual review instead of changing the whole product in one uncontrolled pass.

## Quality rules

- Optimize for operational clarity, not decoration.
- Use one clear primary action per page or dialog.
- Move secondary and destructive row/card actions into a compact overflow menu.
- Never expose a red Deactivate/Delete button as the dominant card or table action.
- Show status through semantic badges, not raw enum text or color alone.
- Keep cards compact and information-led. Avoid large empty areas and oversized KPI cards.
- Keep modal and drawer footers consistent: secondary Cancel, primary Save, destructive confirmation separated.
- Design loading, empty, error, forbidden, session-expired, offline, reconnecting, and permission-limited states.
- Verify keyboard access, focus visibility, contrast, responsive overflow, and touch targets.

## Finish every task

1. Run relevant format, lint, typecheck, unit, E2E, build, and `git diff --check` commands.
2. Capture after screenshots for the changed routes and viewports.
3. Report exact files changed, visual decisions, behavior preserved, commands and results, remaining risks, and routes to inspect.
4. Do not mark a wave complete with failing required checks or unresolved destructive-action UX.
