import { hash } from "bcrypt";
import { PermissionScopeType, PrismaClient } from "@prisma/client";
import { loadApiEnv } from "@gss-iot/config";

const prisma = new PrismaClient();

const permissionCatalog = [
  ["welcome.view", PermissionScopeType.BOTH],
  ["dashboard.view", PermissionScopeType.BOTH],
  ["companies.view", PermissionScopeType.GSS],
  ["companies.create", PermissionScopeType.GSS],
  ["companies.update", PermissionScopeType.GSS],
  ["companies.delete", PermissionScopeType.GSS],
  ["companies.manage", PermissionScopeType.GSS],
  ["areas.view", PermissionScopeType.BOTH],
  ["areas.create", PermissionScopeType.BOTH],
  ["areas.update", PermissionScopeType.BOTH],
  ["areas.delete", PermissionScopeType.BOTH],
  ["areas.manage", PermissionScopeType.BOTH],
  ["buildings.view", PermissionScopeType.BOTH],
  ["buildings.create", PermissionScopeType.BOTH],
  ["buildings.update", PermissionScopeType.BOTH],
  ["buildings.delete", PermissionScopeType.BOTH],
  ["buildings.manage", PermissionScopeType.BOTH],
  ["building-plans.view", PermissionScopeType.BOTH],
  ["building-plans.manage", PermissionScopeType.BOTH],
  ["company-users.view", PermissionScopeType.BOTH],
  ["company-users.create", PermissionScopeType.BOTH],
  ["company-users.update", PermissionScopeType.BOTH],
  ["company-users.delete", PermissionScopeType.BOTH],
  ["company-users.manage", PermissionScopeType.BOTH],
  ["company-roles.view", PermissionScopeType.BOTH],
  ["company-roles.manage", PermissionScopeType.BOTH],
  ["company-permissions.view", PermissionScopeType.BOTH],
  ["company-profile.view", PermissionScopeType.COMPANY],
  ["company-profile.update", PermissionScopeType.COMPANY],
  ["company-devices.view", PermissionScopeType.COMPANY],
  ["gateway-node-connections.view", PermissionScopeType.COMPANY],
  ["gateway-node-connections.update", PermissionScopeType.COMPANY],
  ["settings.company.view", PermissionScopeType.COMPANY],
  ["settings.company.manage", PermissionScopeType.COMPANY],
  ["admin-users.view", PermissionScopeType.GSS],
  ["admin-users.create", PermissionScopeType.GSS],
  ["admin-users.update", PermissionScopeType.GSS],
  ["admin-users.delete", PermissionScopeType.GSS],
  ["admin-users.manage", PermissionScopeType.GSS],
  ["admin-roles.view", PermissionScopeType.GSS],
  ["admin-roles.manage", PermissionScopeType.GSS],
  ["permissions.view", PermissionScopeType.GSS],
  ["permissions.manage", PermissionScopeType.GSS],
  ["devices.view", PermissionScopeType.GSS],
  ["devices.create", PermissionScopeType.GSS],
  ["devices.update", PermissionScopeType.GSS],
  ["devices.delete", PermissionScopeType.GSS],
  ["devices.manage", PermissionScopeType.GSS],
  ["devices.assign", PermissionScopeType.GSS],
  ["gateways.view", PermissionScopeType.BOTH],
  ["gateways.create", PermissionScopeType.GSS],
  ["gateways.update", PermissionScopeType.GSS],
  ["gateways.delete", PermissionScopeType.GSS],
  ["gateways.assign", PermissionScopeType.GSS],
  ["gateways.commands", PermissionScopeType.GSS],
  ["nodes.view", PermissionScopeType.BOTH],
  ["nodes.create", PermissionScopeType.GSS],
  ["nodes.update", PermissionScopeType.GSS],
  ["nodes.delete", PermissionScopeType.GSS],
  ["nodes.assign", PermissionScopeType.GSS],
  ["nodes.configure", PermissionScopeType.GSS],
  ["device-assignments.view", PermissionScopeType.GSS],
  ["device-assignments.manage", PermissionScopeType.GSS],
  ["mqtt-commands.view", PermissionScopeType.GSS],
  ["mqtt-commands.manage", PermissionScopeType.GSS],
  ["monitoring.view", PermissionScopeType.BOTH],
  ["monitoring.realtime", PermissionScopeType.BOTH],
  ["monitoring.admin-overview", PermissionScopeType.GSS],
  ["alarm-levels.view", PermissionScopeType.BOTH],
  ["alarm-levels.manage", PermissionScopeType.BOTH],
  ["alarm-rules.view", PermissionScopeType.BOTH],
  ["alarm-rules.manage", PermissionScopeType.BOTH],
  ["alarms.view", PermissionScopeType.BOTH],
  ["alarms.manage", PermissionScopeType.GSS],
  ["alarms.acknowledge", PermissionScopeType.BOTH],
  ["alarms.resolve", PermissionScopeType.BOTH],
  ["notifications.view", PermissionScopeType.BOTH],
  ["notifications.manage", PermissionScopeType.BOTH],
  ["reports.view", PermissionScopeType.BOTH],
  ["reports.export", PermissionScopeType.BOTH],
  ["reports.company", PermissionScopeType.GSS],
  ["reports.devices", PermissionScopeType.GSS],
  ["reports.monitoring", PermissionScopeType.BOTH],
  ["reports.alarms", PermissionScopeType.BOTH],
  ["reports.audit", PermissionScopeType.GSS],
  ["audit-logs.view", PermissionScopeType.GSS],
  ["audit-logs.export", PermissionScopeType.GSS],
  ["settings.system.view", PermissionScopeType.GSS],
  ["settings.system.manage", PermissionScopeType.GSS],
] as const;

function keys(...permissions: string[]): string[] {
  return permissions;
}

async function assignGssPermissions(roleId: string, permissionKeys: string[]): Promise<void> {
  const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
  await prisma.gssRolePermission.deleteMany({ where: { roleId } });
  await prisma.gssRolePermission.createMany({
    data: permissions.map((permission) => ({ permissionId: permission.id, roleId })),
  });
}

async function assignCompanyPermissions(roleId: string, permissionKeys: string[]): Promise<void> {
  const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
  await prisma.companyRolePermission.deleteMany({ where: { roleId } });
  await prisma.companyRolePermission.createMany({
    data: permissions.map((permission) => ({ permissionId: permission.id, roleId })),
  });
}

async function upsertCompanyTemplate(
  key: string,
  name: string,
  isCompanyOwnerRole: boolean,
  permissionKeys: string[],
): Promise<void> {
  const existing = await prisma.companyRole.findFirst({ where: { companyId: null, key } });
  const role = existing
    ? await prisma.companyRole.update({
        where: { id: existing.id },
        data: { isCompanyOwnerRole, isSystem: true, name },
      })
    : await prisma.companyRole.create({
        data: { isCompanyOwnerRole, isSystem: true, key, name },
      });

  await assignCompanyPermissions(role.id, permissionKeys);
}

async function main(): Promise<void> {
  const env = loadApiEnv();

  await Promise.all(
    permissionCatalog.map(async ([key, scopeType]) => {
      const [module, action] = key.split(".");
      await prisma.permission.upsert({
        where: { key },
        create: { action, key, module, scopeType },
        update: { action, module, scopeType },
      });
    }),
  );

  const superAdminRole = await prisma.gssRole.upsert({
    where: { key: "gss_super_admin" },
    create: { isSuperAdmin: true, isSystem: true, key: "gss_super_admin", name: "GSS Super Admin" },
    update: { isSuperAdmin: true, isSystem: true, name: "GSS Super Admin" },
  });
  const gssAdminRole = await prisma.gssRole.upsert({
    where: { key: "gss_admin" },
    create: { key: "gss_admin", name: "GSS Admin" },
    update: { name: "GSS Admin" },
  });
  const deviceManagerRole = await prisma.gssRole.upsert({
    where: { key: "gss_device_manager" },
    create: { key: "gss_device_manager", name: "GSS Device Manager" },
    update: { name: "GSS Device Manager" },
  });
  const supportRole = await prisma.gssRole.upsert({
    where: { key: "gss_support" },
    create: { key: "gss_support", name: "GSS Support" },
    update: { name: "GSS Support" },
  });
  const reportManagerRole = await prisma.gssRole.upsert({
    where: { key: "gss_report_manager" },
    create: { key: "gss_report_manager", name: "GSS Report Manager" },
    update: { name: "GSS Report Manager" },
  });

  await assignGssPermissions(
    gssAdminRole.id,
    permissionCatalog.map(([key]) => key),
  );
  await assignGssPermissions(
    deviceManagerRole.id,
    keys(
      "dashboard.view",
      "devices.view",
      "devices.manage",
      "devices.assign",
      "gateways.view",
      "gateways.create",
      "gateways.update",
      "gateways.assign",
      "gateways.commands",
      "nodes.view",
      "nodes.create",
      "nodes.update",
      "nodes.assign",
      "nodes.configure",
      "device-assignments.view",
      "device-assignments.manage",
      "mqtt-commands.view",
      "mqtt-commands.manage",
      "monitoring.view",
      "monitoring.realtime",
    ),
  );
  await assignGssPermissions(
    supportRole.id,
    keys(
      "dashboard.view",
      "companies.view",
      "areas.view",
      "buildings.view",
      "company-users.view",
      "devices.view",
      "gateways.view",
      "nodes.view",
      "monitoring.view",
      "alarm-levels.view",
      "alarm-rules.view",
      "alarms.view",
      "notifications.view",
      "reports.view",
      "audit-logs.view",
    ),
  );
  await assignGssPermissions(
    reportManagerRole.id,
    keys(
      "dashboard.view",
      "companies.view",
      "areas.view",
      "buildings.view",
      "devices.view",
      "gateways.view",
      "nodes.view",
      "monitoring.view",
      "alarm-levels.view",
      "alarm-rules.view",
      "alarms.view",
      "reports.view",
      "reports.export",
      "reports.company",
      "reports.devices",
      "reports.monitoring",
      "reports.alarms",
      "reports.audit",
      "audit-logs.view",
      "audit-logs.export",
    ),
  );

  const superAdminPasswordHash = await hash(env.GSS_SUPER_ADMIN_PASSWORD, 12);
  await prisma.gssAdminUser.upsert({
    where: { email: env.GSS_SUPER_ADMIN_EMAIL.toLowerCase() },
    create: {
      email: env.GSS_SUPER_ADMIN_EMAIL.toLowerCase(),
      name: "GSS Super Admin",
      passwordHash: superAdminPasswordHash,
      roleId: superAdminRole.id,
    },
    update: { isActive: true, passwordHash: superAdminPasswordHash, roleId: superAdminRole.id },
  });

  const companyReadOnly = keys(
    "welcome.view",
    "areas.view",
    "buildings.view",
    "building-plans.view",
    "company-devices.view",
    "gateways.view",
    "nodes.view",
    "monitoring.view",
    "alarm-levels.view",
    "alarm-rules.view",
    "alarms.view",
    "reports.view",
  );
  const companyPermissionKeys = permissionCatalog
    .filter(([, scopeType]) => scopeType !== PermissionScopeType.GSS)
    .map(([key]) => key);
  await upsertCompanyTemplate("platform_manager", "Platform Manager", true, companyPermissionKeys);
  await upsertCompanyTemplate("area_manager", "Area Manager", false, [
    ...companyReadOnly,
    "dashboard.view",
    "areas.create",
    "areas.update",
    "areas.delete",
    "areas.manage",
    "buildings.create",
    "buildings.update",
    "buildings.delete",
    "buildings.manage",
    "building-plans.manage",
    "alarm-levels.manage",
    "alarm-rules.manage",
    "alarms.acknowledge",
    "alarms.resolve",
    "reports.export",
    "company-users.view",
  ]);
  await upsertCompanyTemplate("building_manager", "Building Manager", false, [
    ...companyReadOnly,
    "dashboard.view",
    "alarm-levels.manage",
    "alarms.acknowledge",
  ]);
  await upsertCompanyTemplate("viewer", "Viewer", false, companyReadOnly);
  await upsertCompanyTemplate("no_permission", "No Permission", false, ["welcome.view"]);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    throw error;
  });
