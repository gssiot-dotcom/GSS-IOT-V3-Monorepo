# Visual Direction Derived from the Supplied References

## SnowUI references

The SnowUI examples provide:

- clean white and charcoal theme parity;
- compact 150-180px sidebar;
- slim top context bar;
- rounded KPI cards with strong numeric hierarchy;
- large chart blocks with minimal chrome;
- quiet grid structure;
- compact right-side activity/notification rail in the wider layout;
- mobile layouts that preserve KPI and chart order.

Use these ideas for the shell, KPI hierarchy, chart surfaces, and responsive reflow. Do not copy the SnowUI brand, logo, or exact analytics domain.

## Dashboard X references

The dark Dashboard X examples are the strongest target for GSS:

- deep navy base with slightly lighter nested surfaces;
- compact global sidebar and clear active item;
- bright cyan/blue primary with restrained magenta analytical accent;
- dense management tables;
- strong status badges;
- full-page user forms;
- a secondary inner navigation column for long settings or credential workflows;
- clean card collections and Kanban-like spatial grouping;
- consistent dark inputs with visible boundaries.

## GSS adaptation

Translate the visual language into an industrial safety and IoT operations product:

- blue/cyan remains the primary brand/action color;
- purple or magenta may be used for analytics series or focus accents, never for danger;
- safe/caution/warning/danger/offline colors keep semantic meaning;
- cards show operational context, not marketing vanity metrics;
- charts prioritize gateway health, node state, alarms, command status, and sensor trends;
- right-side rails are optional and should be used only when notifications or activity are central;
- avoid copying e-commerce, social, pricing, or marketing information architecture.

## Surface hierarchy

Recommended dark hierarchy:

```txt
app background       deepest navy
primary sidebar      slightly lighter or same as background
main panel           one elevation above background
content card         another subtle elevation
hover/selected       modest contrast increase
border               low-contrast cool gray/blue
```

Recommended light hierarchy:

```txt
app background       cool light gray
primary sidebar      white or near-white
main panel           transparent/background
content card         white
hover/selected       pale GSS blue
border               cool neutral gray
```

## Typography

- Page title: 28-32px, semibold.
- Section title: 18-20px, semibold.
- Card title: 15-17px, semibold.
- Body: 14px.
- Metadata: 12-13px.
- KPI values: 24-32px depending on density.

Use Inter and Noto Sans KR. Avoid ultra-thin text in dark mode.

## Motion

Use 120-220ms transitions for:

- sidebar collapse or drawer;
- active navigation state;
- card hover lift;
- disclosure and section switches;
- skeleton to content;
- chart highlight;
- status badge changes.

Avoid constant animated gradients, glow pulses, or motion that competes with alarms.
