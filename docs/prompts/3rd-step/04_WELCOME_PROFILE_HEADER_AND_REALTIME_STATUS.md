# CODEX TASK 04 — Welcome pages, account profile UX and truthful header realtime status

Complete Tasks 02–03 first.

Read the Parfumbox Welcome/Profile references from the source map and inspect current auth/session, shell, router, notification realtime and i18n code.

## Goal

Implement user Requirements 1, 3 and 4 for both GSS Admin and Company portals.

## Verified current problems to re-check

- `/admin/welcome` and `/company/welcome` render placeholders.
- The header always shows a yellow reconnecting badge.
- The account area is not interactive and sign out is a separate button.
- There are no dedicated profile routes.
- Current `AuthSession` exposes limited role/company metadata.

## Required implementation

### 1. Rich, permission-aware Welcome pages

Create dedicated pages for both contexts:

```txt
/admin/welcome
/company/welcome
```

Each page must include:

- personalized greeting;
- profile summary;
- account/context metadata;
- permission-filtered quick links generated from the same navigation source used by the sidebar;
- a useful no-modules state for a no-permission role;
- portal-specific copy and links;
- loading/error/inactive-session behavior.

Company Welcome must show authenticated company context and must not accept a client-provided company ID.

### 2. Extend session/profile contract safely

Extend `/auth/gss/me`, `/auth/company/me` and shared contracts only with safe fields needed for account presentation, such as:

- active state;
- role id/key/name and super-admin flag;
- phone/last login when appropriate;
- company id/name for Company users.

Never expose password hashes, token version, direct-permission internals or secrets.

Keep login/session restore compatibility and update tests.

### 3. Dedicated view-only profile pages

Add authenticated routes:

```txt
/admin/profile
/company/profile
```

Use current session/profile data to show account, role, company context, effective permission count and relevant scope summary.

Do not invent self-service password/email/role mutation. Profile editing is out of scope unless an already-approved endpoint and policy exist.

### 4. Header account menu

Replace the plain user block plus separate sign-out button with a compact account trigger and Mantine dropdown inspired by Parfumbox:

- avatar/initials;
- name and email;
- role and active/super-admin badges;
- company name for Company users;
- effective permission count;
- link to the correct profile route;
- sign out action;
- responsive behavior on narrow screens;
- accessible menu labels and keyboard interaction.

The notification bell remains next to the account menu.

### 5. Truthful realtime status

Remove the unconditional yellow badge.

Use the actual notification realtime socket state or a shared shell realtime hook/provider:

```txt
idle | connecting | connected | reconnecting | offline
```

Presentation rules:

- hide the badge when idle or connected unless a subtle connected indicator is explicitly justified;
- show reconnecting only during a real reconnect attempt;
- show offline/disconnected only after a failed or lost attempted connection;
- do not open a notification socket when `notifications.view` is missing;
- keep unread count updates working;
- avoid duplicate shell socket connections after rerenders;
- clean up listeners on logout/unmount;
- do not confuse the shell notification connection with a building monitoring room connection.

### 6. Routing/RBAC

- Welcome keeps the approved always-available/authenticated behavior for active users.
- Profile routes require authentication but should not require a feature permission that would lock out `no_permission` users.
- Quick links, notification controls and sidebar items remain permission-filtered.
- Backend remains authoritative.

## Likely files

```txt
packages/contracts/src/index.ts
apps/api/src/modules/auth/auth.service.ts
apps/api/src/modules/auth/auth.controller.ts
apps/web/src/features/shell/PortalLayout.tsx
apps/web/src/features/shell/navigation.ts
apps/web/src/app/router.tsx
apps/web/src/features/welcome/*
apps/web/src/features/profile/*
apps/web/src/shared/auth/*
apps/web/src/app/i18n.ts
packages/ui/src/*
```

Use repository naming conventions; do not force these exact new folders when a cleaner structure already exists.

## Tests

Cover at least:

- Admin and Company Welcome render real content;
- quick links omit unauthorized modules;
- no-permission user still gets Welcome/Profile/Sign out;
- session restore includes new safe metadata;
- account menu opens, navigates to profile and signs out;
- notification socket is not created without permission;
- reconnecting badge appears only on real state transition;
- connected/idle state does not show a false reconnecting badge;
- unread count remains functional.

Run focused API auth tests, web auth/routing/shell tests, typecheck, lint, format and diff check.

## Manual acceptance

Record screenshots or notes for:

- GSS Welcome;
- Company Welcome;
- desktop/mobile account menu;
- profile pages;
- connected, reconnecting and offline status behavior;
- no-permission user behavior.

## Out of scope

- editable profile credentials;
- dashboard analytics;
- production websocket infrastructure.

## Definition of Done

- Both Welcome pages are useful and no longer placeholders.
- Header account UX matches the approved interaction pattern.
- The permanent false reconnecting badge is gone.
- Existing notification behavior and authorization are preserved.
- Tests pass and state/docs are updated.
