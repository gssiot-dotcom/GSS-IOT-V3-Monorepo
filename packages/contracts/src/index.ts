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
