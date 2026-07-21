# Phase 12 UI page-permission matrix

| Route                      | Permission           | Notes                                                                         |
| -------------------------- | -------------------- | ----------------------------------------------------------------------------- |
| `/admin/alarms`            | `alarms.view`        | Global alarm list                                                             |
| `/admin/alarms/:alarmId`   | `alarms.view`        | Ack/resolve buttons additionally require action permissions                   |
| `/admin/alarm-rules`       | `alarm-rules.view`   | Create/add policy controls require `alarm-rules.manage`                       |
| `/admin/notifications`     | `notifications.view` | Current GSS own-inbox is empty until GSS notification recipients are approved |
| `/company/alarms`          | `alarms.view`        | Backend filters by company/building scope                                     |
| `/company/alarms/:alarmId` | `alarms.view`        | Ack/resolve buttons additionally require action permissions                   |
| `/company/alarm-rules`     | `alarm-rules.view`   | Server-provided selectors avoid raw UUID entry                                |
| `/company/notifications`   | `notifications.view` | Own inbox only                                                                |
| Shell notification bell    | `notifications.view` | Does not call notification APIs without permission                            |

All page text uses i18n keys in `apps/web/src/app/i18n.ts`.
