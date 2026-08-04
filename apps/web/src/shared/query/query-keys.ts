import type { AuthSession } from "@gss-iot/contracts";

export type QueryFilters = Readonly<Record<string, boolean | number | string | null | undefined>>;

export interface QueryIdentity {
  companyId?: string;
  context: AuthSession["context"];
  userId: string;
}

export function queryIdentity(session: AuthSession): QueryIdentity {
  return {
    companyId: session.context === "company-user" ? session.user.companyId : undefined,
    context: session.context,
    userId: session.user.id,
  };
}

export function queryIdentityKey(session: AuthSession): string {
  const identity = queryIdentity(session);
  return `${identity.context}:${identity.userId}:${identity.companyId ?? "global"}`;
}

function stableFilters(filters: QueryFilters = {}): QueryFilters {
  return Object.fromEntries(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined && value !== "")
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export const queryKeys = {
  admin: {
    root: (userId: string) => ["gss-admin", userId] as const,
    companiesRoot: (userId: string) => [...queryKeys.admin.root(userId), "companies"] as const,
    companies: (userId: string, filters?: QueryFilters) =>
      [...queryKeys.admin.companiesRoot(userId), stableFilters(filters)] as const,
    devicesRoot: (userId: string) => [...queryKeys.admin.root(userId), "devices"] as const,
    devices: (userId: string, resource: string, filters?: QueryFilters) =>
      [...queryKeys.admin.devicesRoot(userId), resource, stableFilters(filters)] as const,
    monitoring: (userId: string, resource: string, filters?: QueryFilters) =>
      [...queryKeys.admin.root(userId), "monitoring", resource, stableFilters(filters)] as const,
    notifications: (userId: string, resource: string, filters?: QueryFilters) =>
      [...queryKeys.admin.root(userId), "notifications", resource, stableFilters(filters)] as const,
    reports: (userId: string, resource: string, filters?: QueryFilters) =>
      [...queryKeys.admin.root(userId), "reports", resource, stableFilters(filters)] as const,
    archive: (userId: string, resource: string, filters?: QueryFilters) =>
      [...queryKeys.admin.root(userId), "archive", resource, stableFilters(filters)] as const,
    resource: (userId: string, domain: string, resource: string, filters?: QueryFilters) =>
      [...queryKeys.admin.root(userId), domain, resource, stableFilters(filters)] as const,
  },
  company: {
    root: (userId: string, companyId: string) => ["company", userId, companyId] as const,
    devicesRoot: (userId: string, companyId: string) =>
      [...queryKeys.company.root(userId, companyId), "devices"] as const,
    devices: (userId: string, companyId: string, resource: string, filters?: QueryFilters) =>
      [
        ...queryKeys.company.devicesRoot(userId, companyId),
        resource,
        stableFilters(filters),
      ] as const,
    monitoring: (userId: string, companyId: string, resource: string, filters?: QueryFilters) =>
      [
        ...queryKeys.company.root(userId, companyId),
        "monitoring",
        resource,
        stableFilters(filters),
      ] as const,
    notifications: (userId: string, companyId: string, resource: string, filters?: QueryFilters) =>
      [
        ...queryKeys.company.root(userId, companyId),
        "notifications",
        resource,
        stableFilters(filters),
      ] as const,
    reports: (userId: string, companyId: string, resource: string, filters?: QueryFilters) =>
      [
        ...queryKeys.company.root(userId, companyId),
        "reports",
        resource,
        stableFilters(filters),
      ] as const,
    resource: (
      userId: string,
      companyId: string,
      domain: string,
      resource: string,
      filters?: QueryFilters,
    ) =>
      [
        ...queryKeys.company.root(userId, companyId),
        domain,
        resource,
        stableFilters(filters),
      ] as const,
  },
} as const;

export function portalQueryKey(
  session: AuthSession,
  domain: string,
  resource: string,
  filters?: QueryFilters,
) {
  if (session.context === "gss-admin") {
    return queryKeys.admin.resource(session.user.id, domain, resource, filters);
  }
  return queryKeys.company.resource(
    session.user.id,
    session.user.companyId ?? "missing-company",
    domain,
    resource,
    filters,
  );
}

export function portalDomainKey(session: AuthSession, domain: string) {
  return session.context === "gss-admin"
    ? [...queryKeys.admin.root(session.user.id), domain]
    : [
        ...queryKeys.company.root(session.user.id, session.user.companyId ?? "missing-company"),
        domain,
      ];
}
