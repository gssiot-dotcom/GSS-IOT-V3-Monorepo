import type { GssAdminUser, CompanyUser } from "@prisma/client";

export const AUTH_CONTEXT = {
  gssAdmin: "gss-admin",
  companyUser: "company-user",
} as const;

export type AuthContext = (typeof AUTH_CONTEXT)[keyof typeof AUTH_CONTEXT];

export interface AuthTokenPayload {
  aud?: AuthContext;
  context: AuthContext;
  sub: string;
  tokenVersion: number;
  typ?: "access";
}

export interface RefreshTokenPayload {
  aud?: string;
  context: AuthContext;
  familyId: string;
  jti: string;
  sessionId: string;
  sub: string;
  tokenVersion: number;
  typ: "refresh";
}

export type ActiveUser = GssAdminUser | CompanyUser;

export interface AuthenticatedRequest {
  headers: {
    cookie?: string;
  };
  params: Record<string, string | undefined>;
  auth?: {
    principal: AuthTokenPayload;
    user?: ActiveUser;
  };
}
