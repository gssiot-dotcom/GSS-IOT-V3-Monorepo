export const HEALTH_STATUS = {
  ok: "ok",
} as const;

export type HealthStatus = (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS];

export interface HealthResponse {
  service: "api";
  status: HealthStatus;
}

export const AUTH_CONTEXT = {
  gssAdmin: "gss-admin",
  companyUser: "company-user",
} as const;

export type AuthContext = (typeof AUTH_CONTEXT)[keyof typeof AUTH_CONTEXT];

export interface AuthenticatedUser {
  companyId?: string;
  email: string;
  id: string;
  isSuperAdmin: boolean;
  name: string;
  permissions: string[];
}

export interface AuthSession {
  accessToken: string;
  context: AuthContext;
  user: AuthenticatedUser;
}

export type CompanyStatus = "ACTIVE" | "INACTIVE";
export type AccessLevel = "VIEW" | "MANAGE";
export type PermissionEffect = "ALLOW" | "DENY";

export interface CompanyRecord {
  id: string;
  name: string;
  code: string | null;
  status: CompanyStatus;
  address: string | null;
  email: string | null;
  phone: string | null;
}

export interface AreaRecord {
  id: string;
  companyId: string;
  name: string;
  address: string | null;
  description: string | null;
  status: CompanyStatus;
}

export interface BuildingRecord {
  id: string;
  companyId: string;
  areaId: string;
  title: string;
  number: string | null;
  address: string | null;
  buildingType: string | null;
  status: CompanyStatus;
}

export interface CompanyRoleRecord {
  id: string;
  companyId: string | null;
  key: string;
  name: string;
  isCompanyOwnerRole: boolean;
  permissions: { permissionId: string }[];
}

export interface CompanyUserRecord {
  id: string;
  companyId: string;
  roleId: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  role: Pick<CompanyRoleRecord, "id" | "key" | "name" | "isCompanyOwnerRole">;
}

export interface CompanyPositionRecord {
  id: string;
  companyId: string;
  key: string;
  name: string;
  isActive: boolean;
}

export interface CompanyPermissionRecord {
  id: string;
  key: string;
  module: string;
  action: string;
}
