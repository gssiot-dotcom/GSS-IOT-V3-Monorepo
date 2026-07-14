# Architecture and RBAC Rules

## Target stack

- NestJS + TypeScript API.
- PostgreSQL + Prisma.
- React/Vite/TypeScript web.
- Socket.IO realtime.
- MQTT client + GatewayCommand outbox.
- Redis/BullMQ for provider retry, reports, command retry, and heavy fan-out.

## Hierarchy

```txt
Company
→ Construction Site
→ Construction Building
→ Gateway
→ Node
→ Node Type
→ Realtime Monitoring
```

## RBAC

GSS:

```txt
GssAdminUser
GssRole
Permission
GssRolePermission
GssAdminUserPermission
```

Company:

```txt
CompanyUser
CompanyRole
CompanyRolePermission
CompanyUserPermission
CompanyUserSiteAccess
CompanyUserBuildingAccess
CompanyPosition
CompanyUserPositionAssignment
```

Effective permissions:

```txt
role permissions + direct allow - direct deny
```

Super admin:

```txt
role.isSuperAdmin === true → allow all permission checks
```

Company request:

```txt
authenticated active user
+ required permission
+ same company
+ required site/building scope
```

## Device rules

- Device enters GSS inventory first.
- One active building assignment per gateway.
- One active gateway assignment per node.
- Store assignment history.
- Store MQTT command lifecycle and response.
- Reconnect processes pending commands deterministically.
