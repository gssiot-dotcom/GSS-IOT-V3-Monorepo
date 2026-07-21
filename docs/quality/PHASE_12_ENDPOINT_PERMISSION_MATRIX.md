# Phase 12 endpoint permission matrix

Admin and Company paths mirror each other unless noted.

| Endpoint                                   | Permission             | Company scope rule                  |
| ------------------------------------------ | ---------------------- | ----------------------------------- |
| `GET /alarm-rules/options`                 | `alarm-rules.view`     | Scoped buildings only               |
| `GET /alarm-rules`, `GET /alarm-rules/:id` | `alarm-rules.view`     | Same company + building scope       |
| `POST/PATCH/DELETE /alarm-rules*`          | `alarm-rules.manage`   | Same company + building scope       |
| `GET /alarms`, `GET /alarms/:id`           | `alarms.view`          | Same company + building scope       |
| `GET /alarms/:id/triggers`                 | `alarms.view`          | Same company + building scope       |
| `GET /alarms/:id/notifications`            | `alarms.view`          | Same company + building scope       |
| `PATCH /alarms/:id/acknowledge`            | `alarms.acknowledge`   | Same company + building scope       |
| `PATCH /alarms/:id/resolve`                | `alarms.resolve`       | Same company + building scope       |
| `GET /notifications`                       | `notifications.view`   | Own company-user inbox only         |
| `GET /notifications/unread-count`          | `notifications.view`   | Own company-user inbox only         |
| `PATCH /notifications/:id/read`            | `notifications.view`   | Own company-user notification only  |
| `PATCH /notifications/read-all`            | `notifications.view`   | Own company-user notifications only |
| `GET /notifications/providers/status`      | `notifications.manage` | No extra scope                      |

Socket.IO `notifications:join` requires an active token plus `notifications.view`; the server derives `company-user:{id}` or `gss-admin:{id}`.
