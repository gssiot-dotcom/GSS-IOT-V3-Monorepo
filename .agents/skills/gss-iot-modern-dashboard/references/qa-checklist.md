# UI/UX QA Checklist

## Visual consistency

- Shared tokens are used instead of local magic colors.
- Page headers, section panels, card radii, field heights, and table density are consistent.
- Dark and light surfaces have intentional hierarchy.
- GSS primary and status colors retain their roles.
- Icons come from Tabler unless an exception is documented.

## Navigation

- Global sidebar groups remain permission-filtered.
- Inner section navigation is route-backed and permission-filtered.
- Active state is clear without relying on color only.
- Mobile drawer or section switcher works with keyboard and touch.
- No visible sidebar scrollbar, but scrolling remains functional.

## Entity cards

- Site and building cards expose useful operational metrics.
- The whole primary card body is keyboard-accessible.
- Overflow actions are permission-aware.
- Empty, loading, and error grids do not jump excessively.
- Long names and identifiers wrap safely.

## Tables

- Headers and rows align at all supported widths.
- Horizontal scroll is deliberate on mobile.
- Status and actions remain understandable.
- Pagination and filters are controlled and accessible.
- Large data pages remain server-driven.

## Forms

- Labels and validation are present.
- Section navigation maps to real content.
- Save/cancel placement is consistent.
- Dirty-state behavior is clear.
- Permission, scope, and position editing remains safe.
- Destructive actions are separated and confirmed.

## Realtime and operations

- Reconnecting/offline status is visible.
- Socket joins remain permission and scope aware.
- Node state updates do not break card/table parity.
- Alarm and command status changes use text and icon, not color alone.
- Failure reason and retry state are visible where available.

## Responsive acceptance widths

- 1440 or wider desktop
- 1280 desktop
- 1024 tablet landscape
- 768 tablet
- 375 mobile

## Required states

- loading;
- empty;
- recoverable error;
- forbidden;
- inactive/session expired;
- partial provider failure;
- offline/reconnecting;
- mutation success;
- destructive confirmation.
