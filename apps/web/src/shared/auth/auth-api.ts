import type { AuthContext, AuthSession } from "@gss-iot/contracts";

import { readWebEnv } from "../../app/env";
import { getActiveLocale, intlLocaleByLocale, t } from "../../app/i18n";

export const authSessionExpiredEvent = "gss-auth-session-expired";
export const authSessionRefreshedEvent = "gss-auth-session-refreshed";

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let bootstrapCsrfToken: string | undefined;
let refreshPromise: Promise<AuthSession> | undefined;

function csrfCookieName(): string {
  return readWebEnv().csrfCookieName ?? "gss_csrf";
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  if (!entry) return undefined;
  try {
    return decodeURIComponent(entry.slice(prefix.length));
  } catch {
    return undefined;
  }
}

export async function ensureCsrfToken(): Promise<string> {
  const existing = readCookie(csrfCookieName()) ?? bootstrapCsrfToken;
  if (existing) return existing;
  const response = await fetch(`${readWebEnv().apiBaseUrl}/auth/csrf`, {
    credentials: "include",
    headers: { "accept-language": intlLocaleByLocale[getActiveLocale()] },
  });
  if (!response.ok) throw new AuthApiError(t("apiError.generic"), response.status);
  const body = (await response.json()) as { csrfToken?: unknown };
  if (typeof body.csrfToken !== "string" || !body.csrfToken) {
    throw new AuthApiError(t("apiError.generic"), 500);
  }
  bootstrapCsrfToken = body.csrfToken;
  return body.csrfToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const unsafe = options.method && !["GET", "HEAD", "OPTIONS"].includes(options.method);
  const response = await fetch(`${readWebEnv().apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(unsafe ? { "x-csrf-token": await ensureCsrfToken() } : {}),
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
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function login(context: AuthContext, email: string, password: string): Promise<AuthSession> {
  return request<AuthSession>(context === "gss-admin" ? "/auth/gss/login" : "/auth/company/login", {
    body: JSON.stringify({ email, password }),
    method: "POST",
  });
}

export function getCurrentSession(context: AuthContext): Promise<AuthSession> {
  return request<AuthSession>(context === "gss-admin" ? "/auth/gss/me" : "/auth/company/me");
}

export function refreshSession(): Promise<AuthSession> {
  if (!refreshPromise) {
    refreshPromise = request<AuthSession>("/auth/refresh", { method: "POST" })
      .then((session) => {
        window.dispatchEvent(new CustomEvent(authSessionRefreshedEvent, { detail: session }));
        return session;
      })
      .catch((error) => {
        window.dispatchEvent(new Event(authSessionExpiredEvent));
        throw error;
      })
      .finally(() => {
        refreshPromise = undefined;
      });
  }
  return refreshPromise;
}

export async function logout(): Promise<void> {
  try {
    await request<void>("/auth/logout", { method: "POST" });
  } catch (error) {
    if (!(error instanceof AuthApiError) || error.status !== 401) throw error;
    await refreshSession();
    await request<void>("/auth/logout", { method: "POST" });
  }
}
