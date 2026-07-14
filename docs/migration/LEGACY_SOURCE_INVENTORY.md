# GSS IoT V3 — Legacy Source Inventory

Created during Phase 0 repository bootstrap on 2026-07-14.

## Source archives

| Source                            | Path                                                        | SHA-256                                                            |
| --------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Old GSS source archive            | `reference/source-materials/GSS-web-dashboard-V.2.0ZIP.zip` | `85A13275B65228FDE53108D697A0C3E36177D6A9538F3FCC47E4853F2026F7E7` |
| Parfumbox source archive          | `reference/source-materials/parfumbox-main.zip`             | `2D7ECAFA6D7697AE9722B7C9E3D07DB72FD4446A28789C145B9FF64543E20169` |
| Parfumbox RBAC markdown reference | `reference/source-materials/parfumbox-rbac-reference.md`    | `C2D9F8CEEB00E8D5F3940E49874CD0CB11181793A154263459D74D53488DF7BC` |

These archives are reference material only. Do not copy the old Express/Mongoose or Parfumbox business architecture into production code.

## Old GSS MQTT reference paths

Inside `reference/source-materials/GSS-web-dashboard-V.2.0ZIP.zip`:

| Purpose                                 | Archive path                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Gateway command notes                   | `GSS-web-dashboard-V.2.0ZIP/gss-backend-new/docs/mqtt-gateway-commands.md`                          |
| MQTT client factory                     | `GSS-web-dashboard-V.2.0ZIP/gss-backend-new/src/infrastructure/mqtt/client.js`                      |
| MQTT subscription/publish orchestration | `GSS-web-dashboard-V.2.0ZIP/gss-backend-new/src/infrastructure/mqtt/index.js`                       |
| MQTT topic constants                    | `GSS-web-dashboard-V.2.0ZIP/gss-backend-new/src/infrastructure/mqtt/topics.js`                      |
| Legacy gateway alarm command helper     | `GSS-web-dashboard-V.2.0ZIP/gss-backend-new/src/modules/building/alarm-level-mqtt.helper.js`        |
| Angle node MQTT behavior                | `GSS-web-dashboard-V.2.0ZIP/gss-backend-new/src/modules/nodes/angle-node/angleNode.mqtt.service.js` |
| Door node MQTT behavior                 | `GSS-web-dashboard-V.2.0ZIP/gss-backend-new/src/modules/nodes/door-node/node.mqtt.service.js`       |
| Additional legacy MQTT service          | `GSS-web-dashboard-V.2.0ZIP/gss-backend-new/src/services/Mqtt.service.js`                           |

## RBAC reference paths

| Source                                  | Reference path                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| GSS legacy role middleware anti-pattern | `GSS-web-dashboard-V.2.0ZIP/gss-backend-new/src/middlewares/role.middleware.js`   |
| GSS empty legacy permission constants   | `GSS-web-dashboard-V.2.0ZIP/gss-backend-new/src/shared/constants/permissions.js`  |
| GSS empty legacy role constants         | `GSS-web-dashboard-V.2.0ZIP/gss-backend-new/src/shared/constants/roles.js`        |
| Parfumbox RBAC summary                  | `reference/source-materials/parfumbox-rbac-reference.md`                          |
| Parfumbox RBAC Prisma migration         | `parfumbox-main/apps/api/prisma/migrations/20260516120000_add_rbac/migration.sql` |
| Parfumbox RBAC seed                     | `parfumbox-main/apps/api/prisma/seed-rbac.ts`                                     |
| Parfumbox permission constants          | `parfumbox-main/apps/api/src/common/rbac/permissions.constants.ts`                |
| Parfumbox permissions guard             | `parfumbox-main/apps/api/src/common/rbac/permissions.guard.ts`                    |
| Parfumbox permissions decorator         | `parfumbox-main/apps/api/src/common/rbac/require-permissions.decorator.ts`        |
| Parfumbox frontend permission helper    | `parfumbox-main/apps/admin/src/features/auth/permissions.ts`                      |
| Parfumbox frontend RequirePermission    | `parfumbox-main/apps/admin/src/features/auth/RequirePermission.tsx`               |
| Parfumbox admin navigation filtering    | `parfumbox-main/apps/admin/src/features/navigation/adminNavSections.ts`           |
| Parfumbox admin layout                  | `parfumbox-main/apps/admin/src/layouts/AdminLayout.tsx`                           |

## Node type card and image reference paths

Inside `reference/source-materials/GSS-web-dashboard-V.2.0ZIP.zip`:

| Purpose                            | Archive path                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| Node type selection card           | `GSS-web-dashboard-V.2.0ZIP/GSS-new-design/src/components/NodeTypeCard.tsx`     |
| Gangform monitoring card           | `GSS-web-dashboard-V.2.0ZIP/GSS-new-design/src/components/GangformNodeCard.tsx` |
| Angle node monitoring card         | `GSS-web-dashboard-V.2.0ZIP/GSS-new-design/src/components/AngleNodeCard.tsx`    |
| Scaffold/door node monitoring card | `GSS-web-dashboard-V.2.0ZIP/GSS-new-design/src/components/ScaffoldNodeCard.tsx` |
| Legacy gangform source image       | `GSS-web-dashboard-V.2.0ZIP/GSS-new-design/src/public/gangform.png`             |
| Legacy angle source image          | `GSS-web-dashboard-V.2.0ZIP/GSS-new-design/src/public/pikechondo.png`           |
| Legacy door source image           | `GSS-web-dashboard-V.2.0ZIP/GSS-new-design/src/public/pikechondochuribmun.png`  |

## Design token reference paths

| Source                                      | Reference path                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| Old GSS Tailwind token source               | `GSS-web-dashboard-V.2.0ZIP/GSS-new-design/tailwind.config.js`           |
| Old GSS theme context                       | `GSS-web-dashboard-V.2.0ZIP/GSS-new-design/src/context/ThemeContext.tsx` |
| Old GSS theme hook                          | `GSS-web-dashboard-V.2.0ZIP/GSS-new-design/src/hooks/useTheme.ts`        |
| Parfumbox Mantine theme pattern             | `parfumbox-main/apps/admin/src/app/theme.ts`                             |
| Parfumbox shared table pagination component | `parfumbox-main/apps/admin/src/shared/ui/TablePaginationFooter.tsx`      |

## Preserved web assets

The three normalized node-type images were copied without byte changes into the final web public asset structure.

| Node type       | Source path                               | Destination path                                          | SHA-256                                                            |
| --------------- | ----------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| `gangform_node` | `assets/legacy-node-types/gangform.png`   | `apps/web/public/assets/legacy-node-types/gangform.png`   | `7211CBF0AA59127BBCA678EAF5F3E7555E6024D07B79DE525F6BE002A9751053` |
| `angle_node`    | `assets/legacy-node-types/angle-node.png` | `apps/web/public/assets/legacy-node-types/angle-node.png` | `384E94FA08CB55E448D46BCC1F1610662217E69DC6A3A2F5B0A65DAAC7D36D91` |
| `door_node`     | `assets/legacy-node-types/door-node.png`  | `apps/web/public/assets/legacy-node-types/door-node.png`  | `997E51E9D57000DE272D1C135657B258179C02973F34978410B0B943A43A891D` |
