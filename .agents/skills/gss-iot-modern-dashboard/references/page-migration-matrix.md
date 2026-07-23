# Recommended Page Migration Matrix

| Current page or area | Target pattern | Main change |
| --- | --- | --- |
| Admin companies | Entity card grid with optional table toggle | Cards show company status, site/building/device/user counts, active alarms, last activity |
| Company construction sites | Entity card grid | Emphasize location, building count, gateway/node totals, alarm state |
| Company buildings | Entity card grid | Emphasize site context, gateway/node counts, monitoring entry, status |
| Admin company detail | Context section layout | Replace top overview/sites/buildings/users/devices tabs with route-backed inner sidebar |
| Company area detail | Context section layout when sections grow | Overview, buildings, users/scopes, reports or alarms as allowed |
| Company building detail | Context section layout | Overview, monitoring, devices, plan, alarms, settings |
| Company user create/edit | Full-page or large-drawer form workspace | Replace long multi-purpose modal with section navigation and effective access preview |
| GSS admin user create/edit | Form workspace | Identity, role, direct permissions, status, review |
| Company role management | Table/list plus routed role editor | Role editor uses inner sidebar or section list for permissions and safeguards |
| Admin devices | Keep dense management workspace | Consider gateway/node routes or inner sidebar instead of one large top-tab page |
| Company devices | Use compact cards for small scope, table for larger scope | Do not force one mode for all companies |
| Gateway commands | Dense table workspace | Add status timeline/detail drawer, strong retry/cancel states |
| Admin monitoring | Dashboard plus drilldown | KPI/status blocks, selectors, building/node drilldown |
| Company realtime monitoring | Keep tabs | Preserve live context, card/table toggle, node detail drawer |
| Alarm rules | Context section or routed editor | Separate rule scope, thresholds, recipients, occurrence count, interval, channels |
| Alarm detail | Detail workspace | Timeline, evidence, notifications, acknowledge/resolve actions |
| Reports | Dense table workspace plus create-report drawer | Separate filters, jobs, exports, failures |
| Settings | Context section layout | Replace multiple top tabs with stable inner navigation |
