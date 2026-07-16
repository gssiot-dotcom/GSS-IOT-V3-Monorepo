# Phase 2 Prompt — Design System and Application Shells

Read all files in `docs/design/` and inspect the two legacy ZIP references only for the paths listed in `LEGACY_ASSET_MAP.md`.

Implement:

- Mantine GSS theme from normalized GSS tokens.
- Tabler icon convention.
- Shared `packages/ui` primitives listed in `DESIGN_SYSTEM.md`.
- `/admin/*` and `/company/*` shells with route/sidebar permission guards.
- Universal loading, empty, error, forbidden and session-expired states.
- Legacy node-type selection card using the exact three images and required image-first behavior.
- Component tests and visual/browser checks for the node-type cards and main shells.

Do not implement real organization/device data yet; use typed fixtures only where needed to demonstrate components.
Do not introduce Tailwind/shadcn as a second primary UI system.
