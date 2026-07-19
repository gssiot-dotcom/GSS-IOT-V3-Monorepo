import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaExecutor = Prisma.TransactionClient | PrismaClient;

export const DEFAULT_COMPANY_ROLE_KEYS = [
  "platform_manager",
  "site_manager",
  "building_manager",
  "viewer",
  "no_permission",
] as const;

export type DefaultCompanyRoleKey = (typeof DEFAULT_COMPANY_ROLE_KEYS)[number];

interface DefaultCompanyRoleTemplate {
  id: string;
  key: string;
  name: string;
  isCompanyOwnerRole: boolean;
  permissions: Array<{ permissionId: string }>;
}

export interface DefaultCompanyRoleProvisionResult {
  missingTemplateKeys: DefaultCompanyRoleKey[];
  roleIdsByKey: Map<DefaultCompanyRoleKey, string>;
}

export async function ensureDefaultCompanyRoles(
  companyId: string,
  executor: PrismaExecutor,
): Promise<DefaultCompanyRoleProvisionResult> {
  const templates = await executor.companyRole.findMany({
    where: { companyId: null, isSystem: true, key: { in: [...DEFAULT_COMPANY_ROLE_KEYS] } },
    include: { permissions: { select: { permissionId: true } } },
  });
  const templateByKey = new Map(
    templates.map((template) => [template.key as DefaultCompanyRoleKey, template]),
  );
  const missingTemplateKeys = DEFAULT_COMPANY_ROLE_KEYS.filter((key) => !templateByKey.has(key));
  const existingRoles = await executor.companyRole.findMany({
    where: { companyId, key: { in: [...DEFAULT_COMPANY_ROLE_KEYS] } },
    select: { id: true, key: true },
  });
  const existingRoleIdByKey = new Map(
    existingRoles.map((role) => [role.key as DefaultCompanyRoleKey, role.id]),
  );
  const roleIdsByKey = new Map<DefaultCompanyRoleKey, string>();

  if (missingTemplateKeys.length > 0) {
    for (const [key, roleId] of existingRoleIdByKey) {
      roleIdsByKey.set(key, roleId);
    }
    return { missingTemplateKeys, roleIdsByKey };
  }

  for (const key of DEFAULT_COMPANY_ROLE_KEYS) {
    const template = templateByKey.get(key)!;
    const existingRoleId = existingRoleIdByKey.get(key);
    const role = existingRoleId
      ? await updateDefaultCompanyRole(existingRoleId, template, executor)
      : await createDefaultCompanyRole(companyId, template, executor);
    roleIdsByKey.set(key, role.id);
  }

  return { missingTemplateKeys, roleIdsByKey };
}

async function createDefaultCompanyRole(
  companyId: string,
  template: DefaultCompanyRoleTemplate,
  executor: PrismaExecutor,
) {
  return executor.companyRole.create({
    data: {
      companyId,
      isCompanyOwnerRole: template.isCompanyOwnerRole,
      isSystem: true,
      key: template.key,
      name: template.name,
      permissions: {
        createMany: {
          data: template.permissions.map(({ permissionId }) => ({ permissionId })),
        },
      },
    },
    select: { id: true },
  });
}

async function updateDefaultCompanyRole(
  roleId: string,
  template: DefaultCompanyRoleTemplate,
  executor: PrismaExecutor,
) {
  return executor.companyRole.update({
    where: { id: roleId },
    data: {
      isCompanyOwnerRole: template.isCompanyOwnerRole,
      isSystem: true,
      name: template.name,
      permissions: {
        deleteMany: {},
        createMany: {
          data: template.permissions.map(({ permissionId }) => ({ permissionId })),
        },
      },
    },
    select: { id: true },
  });
}
