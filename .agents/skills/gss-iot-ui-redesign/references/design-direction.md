# Visual Direction

## Product character

Create a modern enterprise IoT operations product for construction safety. It should feel calm, reliable, technically advanced, and pleasant to use for long sessions.

Target qualities:

```txt
clear
compact
premium
operational
trustworthy
responsive
accessible
```

Avoid:

```txt
empty template-like screens
oversized cards and titles
rainbow status colors
heavy glassmorphism
neon gradients on every surface
large decorative illustrations inside data pages
multiple competing card styles
floating destructive buttons
```

## Suggested light-theme palette

Keep GSS cyan-blue identity, but give it a stronger product system:

```txt
canvas             #F4F7FB
surface            #FFFFFF
surface-subtle     #F8FAFC
surface-raised     #FFFFFF
text-primary       #172033
text-secondary     #667085
text-tertiary      #98A2B3
border             #DCE4EE
border-strong      #C9D4E2
primary            #0B80B7
primary-hover      #08648F
primary-soft       #E8F7FD
accent             #2563EB
sidebar            #0E1B2B
sidebar-muted      #9FB0C3
sidebar-active     rgba(21, 159, 222, 0.16)
focus              #159FDE
```

Status colors remain semantic and must not be reused randomly:

```txt
safe               #0B80B7
caution            #16A34A
warning            #D18A00
danger             #DC2626
offline             #7C8797
unconfigured        #64748B
```

## Typography and density

```txt
Page title          28px / 650
Section title       18px / 650
Card title          15-16px / 650
Body                14px / 400-500
Caption             12-13px / 500
Technical values    tabular numerals where appropriate
```

Keep content dense enough for operations work:

```txt
Header height       64px
Sidebar width       264-280px
Desktop padding     24-32px
Section gap         20-24px
Card radius         14-16px
Control height      38-42px
Table row height    48-54px
Transition          120-180ms
```

Use restrained shadows. Borders and spacing should do most of the grouping.

## Shell

- Use a dark navy sidebar with a clear GSS product mark and portal label.
- Keep permission-filtered grouped navigation.
- Make active navigation a soft cyan surface with a visible left marker or icon treatment.
- Keep the header light and quiet. Show page context, realtime state, notification, and account controls without crowding.
- Use a subtle canvas background; do not put every section inside a large card.
- Keep form/detail pages within a comfortable max width, while monitoring and data workspaces may use full width.

### Theme-aware platform identity

- Use the approved blue GSS SVG on a light header and the approved white GSS SVG on a dark header.
- Place the visible `Global Smart Solutions` wordmark immediately after the mark, followed by the
  existing divider and route/portal context.
- Keep mark, wordmark, divider, and context as one non-wrapping responsive identity group. Hide or
  shorten lower-priority context before hiding the mark or critical header actions.
- Do not recolor the SVG with CSS filters, redraw it, or substitute a generated icon when exact
  light/dark assets exist.

## Cards

Use card variants rather than one universal card:

```txt
MetricCard          compact KPI with icon, value, trend or hint
EntityCard          title, status, metadata, counts, whole-card navigation
WorkspaceCard       filter/table/chart container
StatusCard          compact sensor or device state
CalloutCard         only for exceptions and guidance
```

A card should have a clear header, body, and optional footer. Put a compact overflow menu in the top-right when contextual actions are needed.

## Tables and lists

- Make the primary entity cell visually rich: icon/avatar, title, secondary identifier.
- Use status badges, role badges, and scope chips.
- Make the row or entity name the navigation target.
- Keep at most one visible row action; use a kebab menu for the rest.
- Right-align the actions column and give it a fixed narrow width.
- Add clear filter/search/reset and result-count behavior.
- Use skeleton rows rather than a generic centered loader for table loading.
- Provide mobile cards or a detail drawer where horizontal scrolling would make actions unusable.

## Resource detail and relationship pages

- Start with identity, status, location/parent context, and a compact row of real backend-derived
  totals such as Buildings, Gateways, Nodes, and Assigned users.
- Prefer a 3/2/1 responsive entity-card grid when each child needs several relationship counts.
- Put substantial relationship collections in full-width sections stacked vertically. Two dense
  operational tables must not share one desktop row unless both remain comfortably readable at the
  approved 1280px viewport.
- A child Building card may show its gateway, node, and assigned-user counts, status, address, and
  one high-value entry action. Counts must come from a scoped backend aggregate, not first-page
  browser filtering.
- Optional sections remain permission-aware and fail locally without replacing an authorized base
  detail page.

## Forms and dialogs

- Use sectioned forms with concise helper text.
- Use large drawers for complex assignments, roles, alarm policies, and device configuration.
- Use modals for short create/edit forms only.
- Put dialog actions in a footer: Cancel then primary Save/Create.
- Confirm destructive actions with entity name, impact, and irreversible/reversible wording.

## Date and time filters

- Use Mantine Dates components and the same calendar styling, portal behavior, focus states, and
  localization already established by the Node detail Drawer.
- Date selection must be available by clicking the whole input. Time may be an optional secondary
  control; leaving it empty follows a documented local-boundary normalization and never produces an
  invalid date.
- Preserve existing default ranges and optional/unbounded filters. Convert local selections to UTC
  only at the API boundary and test DST/local-midnight behavior.
- Do not use native `date` or `datetime-local` inputs as application primitives.

## Motion

Use motion only for orientation and feedback:

- card hover lift of 1-2px;
- navigation and drawer transitions;
- subtle realtime pulse only while connecting/reconnecting;
- no continuous animation for normal connected state;
- respect reduced-motion preferences.
