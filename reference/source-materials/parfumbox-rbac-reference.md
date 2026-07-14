# Parfumbox RBAC Architecture Reference

## Core pattern

Parfumbox admin architecture uses role-based access control with:

- AdminUser
- Role
- Permission
- RolePermission
- AdminUserPermission

Effective admin access:

role permissions + direct user permissions

Super admin access:

role.isSuperAdmin = true means full access, regardless of explicit permission rows.

## Backend pattern

Admin endpoints use:

- JwtAdminGuard
- PermissionsGuard
- RequirePermissions(permissionKey)

Example:

@UseGuards(JwtAdminGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.orders.view)

JWT admin payload includes:

- sub = admin user id
- typ = "admin"

JwtAdminStrategy loads admin user with:

- role
- role permissions
- direct permissions

If admin is inactive, request is rejected.

## Frontend pattern

Admin UI uses:

- RequireAuth
- RequirePermission
- useCurrentAdmin
- hasPermission
- Can component for action-level permissions
- Sidebar filtering based on permission keys

Super admin frontend logic:

hasPermission(key) = role.isSuperAdmin || permissionSet.has(key)

## Permission naming

Use dot-based permission keys:

- module.view
- module.manage
- module.update
- module.delete
- module.export

Examples:

- dashboard.view
- orders.view
- orders.update
- products.view
- products.manage
- users.view
- users.coins.manage
- finance.view
- finance.export
- settings.roles.view
- settings.roles.manage
- settings.users.view
- settings.users.manage
- settings.permissions.view
- settings.permissions.manage

## Default roles

### super_admin

Full access. Cannot be restricted through normal UI/API.

### operator

Typical permissions:

- dashboard.view
- orders.view
- orders.update
- product-feedback.view
- product-feedback.manage
- notifications.view

### content_manager

Typical permissions:

- dashboard.view
- products.view
- products.manage
- categories.view
- categories.manage
- brands.view
- brands.manage
- banners.view
- banners.manage
- inventory.view
- inventory.manage
- notifications.view

### marketolog

Typical permissions:

- dashboard.view
- insights.view
- users.view
- finance.view
- rewards.view
- rewards.manage
- coin-gifts.view
- coin-gifts.manage
- coin-ledger.view
- campaigns.view
- campaigns.manage
- promotions.view
- promotions.manage
- segments.view
- segments.manage
- broadcasts.view
- broadcasts.manage
- automations.view
- automations.manage
- notifications.view

## No-permission role behavior

If a non-super role has zero permissions:

- Login still works if AdminUser.isActive = true
- /admin/auth/me still works
- Admin layout/profile can show
- Sidebar should show only always-visible pages such as Welcome
- Protected pages redirect to Forbidden
- Protected backend endpoints return 403
- Notifications should be hidden unless notifications.view exists

## Important implementation rules

Backend is the real security layer.
Frontend permission checks are UX only.

Every admin endpoint must be protected with backend guards.
Every admin page must be protected with route permission.
Every sidebar item must have a permission.
Every create/update/delete/export button should be wrapped with action-level permission check.

## Recommended new project implementation

For every module define:

- module.view for opening/listing
- module.manage for create/update/delete
- module.export if CSV/Excel/PDF export exists
- module.approve or module.update when workflow transition is sensitive

For settings define:

- settings.users.view
- settings.users.manage
- settings.roles.view
- settings.roles.manage
- settings.permissions.view
- settings.permissions.manage
