# Action Placement Rules

## Action hierarchy

Every screen should classify actions before rendering them:

1. Primary: the main task for the current page.
2. Secondary: common but non-critical supporting task.
3. Contextual: applies to one row or card.
4. Destructive: deactivate, delete, retire, revoke, unassign.

Do not give all four categories equal visual weight.

## Page header

- Show at most one filled primary action.
- A second common action may use outline/light styling.
- Put rare settings and destructive actions in an overflow menu.
- Never place Deactivate or Delete as an always-visible red header button.

Recommended company detail header:

```txt
[Company title + status + metadata]                 [Edit] [More ...]
More menu:
  View audit history
  Duplicate/export if applicable
  ------------------------------
  Deactivate company
```

## Table rows

Recommended structure:

```txt
Entity cell | status | metadata | updated |                 [chevron] [more]
```

Rules:

- Prefer row/name navigation over repeated Open buttons.
- Keep no more than one visible action in a row.
- Put Edit, Assign, Move, Deactivate, and Delete in a compact action menu.
- Separate destructive menu items with a divider.
- Use the correct icon and wording: Deactivate is not Delete and should not use a trash icon.
- If an action is unavailable, hide it when permission is missing. If business state blocks it, disable it with a tooltip or helper reason.

## Cards

- Make the card or title the primary navigation target.
- Put the overflow menu in the top-right of the card header.
- Put one high-value contextual CTA in the footer only when needed, such as Open monitoring.
- Do not stack multiple full-width buttons in a card.
- Do not put a red Deactivate button beside the main CTA.

## Deactivate versus delete

Use distinct behavior and language:

```txt
Deactivate
- reversible business state change;
- use pause/ban/power-off semantics;
- confirmation explains what access or operations stop;
- offer Reactivate when appropriate.

Delete permanently
- irreversible and usually limited to pristine records;
- use trash semantics;
- require stronger confirmation and explain history blockers.
```

## Dialog footer

Use this order:

```txt
[Cancel]                                      [Save/Create]
```

For destructive confirmation:

```txt
[Cancel]                                      [Deactivate]
```

Do not put the only action button inline directly below the last field. Keep loading state on the submitted action and prevent duplicate submission.

## Permission behavior

- Missing permission: do not render the action.
- Read-only workflow explanation: a disabled control is acceptable only with a clear reason.
- Backend still validates every mutation.
