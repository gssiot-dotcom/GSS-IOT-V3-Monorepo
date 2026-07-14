# UI Design Rules

## Component system

Use Mantine and Tabler icons following Parfumbox admin patterns:

- page title/subtitle/action header;
- bordered medium-radius cards;
- permission-wrapped primary actions;
- structured modal/forms;
- server-side tables and pagination;
- consistent action icons and tooltips.

Use GSS palette:

```txt
primary: cyan-blue HSL 199 89% 40%
background: 210 20% 97%
foreground: 222 35% 12%
caution: 142 71% 42%
warning: 45 93% 42%
danger: 0 72% 51%
offline: 215 14% 55%
```

## Legacy node cards

Preserve exact images and image-first behavior:

```txt
gangform_node → gangform.png
angle_node → pikechondo/angle image
door_node → pikechondochuribmun/door image
```

Card:

- full-width button;
- image viewport around 160px;
- object-contain;
- label, description, node count;
- subtle hover lift and arrow;
- disabled lock badge;
- responsive 1-to-3 column grid.

## Access and states

- Every route and sidebar item uses view permission.
- Every mutation/export/ack/resolve uses action permission.
- Company pages also enforce backend scope.
- Provide loading, empty, error, forbidden, expired-session, and realtime reconnecting states.
