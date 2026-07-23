# Page Acceptance Checklist

For every changed page, record and verify:

```txt
Route:
Audience:
Primary user goal:
Required permission:
Required scope:
Primary action:
Secondary actions:
Contextual actions:
Destructive actions:
Queries and mutations preserved:
Loading state:
Empty state:
Error state:
Forbidden/session state:
Responsive behavior:
Keyboard behavior:
Screenshots captured:
Tests updated:
```

## Visual checks

- Page title and subtitle establish hierarchy without oversized empty space.
- Exactly one main action is visually dominant.
- Destructive actions are not exposed beside the primary action.
- Status values use semantic badges with text and icon.
- Metadata is grouped and scannable.
- Cards have consistent header, body, and footer behavior.
- Tables have a strong primary entity column and a narrow right-aligned action column.
- Filters are compact, resettable, and do not dominate the screen.
- Dialog actions are in a consistent footer.
- Disabled controls explain business blockers.
- No horizontal overflow hides critical actions at mobile size.
- Focus order and focus ring are visible.
- Color is not the only status signal.

## Behavior checks

- No API path changed.
- No route path changed.
- No permission key changed.
- No scope behavior changed.
- No business mutation changed.
- No i18n string is hardcoded in a component.
- No inaccessible action is rendered.
- No production-only authentication shortcut was added.
