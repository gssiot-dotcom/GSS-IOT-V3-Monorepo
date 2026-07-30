import type { AuthContext, AuthSession } from "@gss-iot/contracts";

import { readWebEnv } from "../../app/env";
import { getActiveLocale, intlLocaleByLocale, t } from "../../app/i18n";

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${readWebEnv().apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "accept-language": intlLocaleByLocale[getActiveLocale()],
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new AuthApiError(
      t(response.status === 401 ? "apiError.authenticationRequired" : "apiError.generic"),
      response.status,
    );
  }

  return (await response.json()) as T;
}

export function login(context: AuthContext, email: string, password: string): Promise<AuthSession> {
  const endpoint = context === "gss-admin" ? "/auth/gss/login" : "/auth/company/login";
  return request<AuthSession>(endpoint, {
    body: JSON.stringify({ email, password }),
    method: "POST",
  });
}

export function getCurrentSession(context: AuthContext, accessToken: string): Promise<AuthSession> {
  const endpoint = context === "gss-admin" ? "/auth/gss/me" : "/auth/company/me";
  return request<AuthSession>(endpoint, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      "accept-language": intlLocaleByLocale[getActiveLocale()],
    },
  });
}

export async function logout(accessToken: string): Promise<void> {
  const response = await fetch(`${readWebEnv().apiBaseUrl}/auth/logout`, {
    headers: { authorization: `Bearer ${accessToken}` },
    method: "POST",
  });

  if (!response.ok && response.status !== 401) {
    throw new Error(t("apiError.generic"));
  }
}
