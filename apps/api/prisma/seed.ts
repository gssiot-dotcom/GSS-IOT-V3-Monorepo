import { hash } from "bcrypt";
import { PermissionScopeType, PrismaClient } from "@prisma/client";
import { loadApiEnv } from "@gss-iot/config";

import { ensureDefaultCompanyRoles } from "../src/modules/company-management/default-company-roles";

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
  ["archive.view", PermissionScopeType.GSS],
  ["archive.purge", PermissionScopeType.GSS],
  ["sensor-readings.purge", PermissionScopeType.GSS],
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

const permissionModuleLabels: Record<string, string> = {
  "admin-roles": "GSS Admin roles",
  "admin-users": "GSS Admin users",
  "alarm-levels": "alarm-level thresholds",
  "alarm-rules": "alarm occurrence and recipient rules",
  alarms: "alarm events",
  archive: "the GSS evidence archive",
  areas: "construction sites",
  "audit-logs": "audit logs",
  "building-plans": "building plan metadata",
  buildings: "buildings",
  "company-devices": "company device inventory",
  "company-permissions": "the company permission catalog",
  "company-profile": "the company profile",
  "company-roles": "company roles",
  "company-users": "company users and positions",
  companies: "companies",
  dashboard: "dashboard analytics",
  "device-assignments": "device assignment history",
  devices: "device inventory",
  "gateway-node-connections": "gateway-node connections",
  gateways: "gateways",
  monitoring: "monitoring data",
  "mqtt-commands": "MQTT command history",
  nodes: "nodes",
  notifications: "alarm notifications",
  permissions: "the GSS permission catalog",
  reports: "reports",
  "sensor-readings": "sensor reading history",
  settings: "portal settings",
  welcome: "the authenticated welcome workspace",
};

function permissionDescription(key: string, scopeType: PermissionScopeType): string {
  const [module, action] = key.split(".") as [string, string];
  const subject = permissionModuleLabels[module] ?? module.replaceAll("-", " ");
  const scope =
    scopeType === PermissionScopeType.GSS
      ? "across the authorized GSS Admin context"
      : scopeType === PermissionScopeType.COMPANY
        ? "within the authenticated company scope"
        : "within the authorized GSS or company scope";
  const descriptions: Record<string, string> = {
    acknowledge: `Acknowledge ${subject} ${scope} while preserving the shared event history.`,
    assign: `Assign ${subject} through audited ownership and resource-scope workflows ${scope}.`,
    commands: `Issue audited operational commands for ${subject} ${scope}.`,
    configure: `Configure ${subject} using the approved device and alarm controls ${scope}.`,
    create: `Create ${subject} ${scope} using validated domain inputs.`,
    delete: `Delete eligible ${subject} ${scope} after safety checks.`,
    export: `Export authorized ${subject} ${scope} through the protected download workflow.`,
    manage: `Manage approved ${subject} actions ${scope}.`,
    resolve: `Resolve eligible ${subject} ${scope} without bypassing active safety checks.`,
    update: `Update ${subject} ${scope} using validated and audited changes.`,
    view: `View ${subject} ${scope}.`,
  };
  return descriptions[action] ?? `Access ${subject} ${scope}.`;
}

const nodeTypeCatalog = [
  {
    displayName: "Door Node",
    imageAssetKey: "door-node.png",
    key: "door_node",
    numericCode: 0,
  },
  {
    displayName: "Angle Node",
    imageAssetKey: "angle-node.png",
    key: "angle_node",
    numericCode: 1,
  },
  {
    displayName: "Gangform Node",
    imageAssetKey: "gangform.png",
    key: "gangform_node",
    numericCode: 2,
  },
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
      const description = permissionDescription(key, scopeType);
      await prisma.permission.upsert({
        where: { key },
        create: { action, description, key, module, scopeType },
        update: { action, description, module, scopeType },
      });
    }),
  );

  await Promise.all(
    nodeTypeCatalog.map((nodeType) =>
      prisma.nodeType.upsert({
        where: { key: nodeType.key },
        create: nodeType,
        update: {
          displayName: nodeType.displayName,
          imageAssetKey: nodeType.imageAssetKey,
          numericCode: nodeType.numericCode,
        },
      }),
    ),
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
    permissionCatalog
      .map(([key]) => key)
      .filter((key) => key !== "archive.purge" && key !== "sensor-readings.purge"),
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
  await upsertCompanyTemplate("site_manager", "Site Manager", false, [
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

  const companies = await prisma.company.findMany({ select: { id: true } });
  for (const company of companies) {
    const defaultRoles = await ensureDefaultCompanyRoles(company.id, prisma);
    if (defaultRoles.missingTemplateKeys.length > 0) {
      throw new Error(
        `Default company role templates are unavailable: ${defaultRoles.missingTemplateKeys.join(", ")}.`,
      );
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    throw error;
  });
