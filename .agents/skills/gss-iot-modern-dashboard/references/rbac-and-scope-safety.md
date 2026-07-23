# RBAC and Scope Safety

## Frontend responsibilities

- Render a route only when its view permission is present.
- Render a sidebar item only when its route permission is present.
- Render create, update, delete, assign, export, acknowledge, resolve, retry, and cancel controls only when the matching action permission is present.
- Do not call protected notification APIs or join notification rooms without `notifications.view`.
- Do not join monitoring rooms without realtime permission and a valid scoped route.
- Preserve no-permission behavior: login and profile/welcome may work, protected pages remain forbidden.
- Preserve super-admin frontend bypass through the current permission helper.

## Backend remains authoritative

A card, table, filter, hidden control, route parameter, or client-side context selector never proves authorization. Company endpoints still require permission plus company/site/building scope.

## Nested navigation

When replacing tabs with inner navigation:

- keep route paths and permissions stable where possible;
- filter section items before rendering;
- do not show empty parent sections;
- prevent direct navigation only through the existing route guard, not by visual hiding alone;
- keep 403 and inactive-session behavior unchanged.

## Forms

For role, permission, scope, and position forms:

- keep direct allow and direct deny mutually exclusive;
- preserve self-lockout and last-safe-admin safeguards;
- show effective-access preview without implying it replaces backend validation;
- do not submit fields the active user cannot manage;
- keep destructive changes explicit and confirmed.
