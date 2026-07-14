import type { AuthContext, AuthSession } from "@gss-iot/contracts";

import { readWebEnv } from "../../app/env";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${readWebEnv().apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Authentication request failed with status ${response.status}.`);
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
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

export async function logout(accessToken: string): Promise<void> {
  const response = await fetch(`${readWebEnv().apiBaseUrl}/auth/logout`, {
    headers: { authorization: `Bearer ${accessToken}` },
    method: "POST",
  });

  if (!response.ok && response.status !== 401) {
    throw new Error(`Logout request failed with status ${response.status}.`);
  }
}
