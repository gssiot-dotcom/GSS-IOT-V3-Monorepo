import type { AuthContext, AuthSession } from "@gss-iot/contracts";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import * as authApi from "./auth-api";

type AuthStatus = "anonymous" | "authenticated" | "loading" | "session-expired";

interface AuthContextValue {
  login: (context: AuthContext, email: string, password: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
  session?: AuthSession;
  status: AuthStatus;
}

const AuthContextValue = createContext<AuthContextValue | undefined>(undefined);
const storageKey = "gss-iot-v3-auth-context";

function readStoredContext(): AuthContext | undefined {
  if (typeof window === "undefined") return undefined;

  if (window.location.pathname.startsWith("/admin")) return "gss-admin";
  if (window.location.pathname.startsWith("/company")) return "company-user";

  const raw = window.sessionStorage.getItem(storageKey);
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as { context?: unknown };
    if (parsed.context === "gss-admin" || parsed.context === "company-user") return parsed.context;
  } catch {
    // Ignore malformed client-side state and force a clean login.
  }

  window.sessionStorage.removeItem(storageKey);
  return undefined;
}

function writeStoredContext(context: AuthContext): void {
  window.sessionStorage.setItem(storageKey, JSON.stringify({ context }));
}

function clearStoredContext(): void {
  window.sessionStorage.removeItem(storageKey);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>();
  const [status, setStatus] = useState<AuthStatus>(() =>
    readStoredContext() ? "loading" : "anonymous",
  );

  useEffect(() => {
    const context = readStoredContext();
    if (!context) {
      setStatus("anonymous");
      return;
    }

    let cancelled = false;
    authApi
      .getCurrentSession(context)
      .then((restoredSession) => {
        if (cancelled) return;
        setSession(restoredSession);
        writeStoredContext(restoredSession.context);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        clearStoredContext();
        setSession(undefined);
        setStatus("session-expired");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const refreshed = (event: Event) => {
      const nextSession = (event as CustomEvent<AuthSession>).detail;
      if (!nextSession) return;
      setSession(nextSession);
      writeStoredContext(nextSession.context);
      setStatus("authenticated");
    };
    const expired = () => {
      clearStoredContext();
      setSession(undefined);
      setStatus("session-expired");
    };
    window.addEventListener(authApi.authSessionRefreshedEvent, refreshed);
    window.addEventListener(authApi.authSessionExpiredEvent, expired);
    return () => {
      window.removeEventListener(authApi.authSessionRefreshedEvent, refreshed);
      window.removeEventListener(authApi.authSessionExpiredEvent, expired);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      login: async (context, email, password) => {
        setStatus("loading");
        try {
          const nextSession = await authApi.login(context, email, password);
          setSession(nextSession);
          writeStoredContext(nextSession.context);
          setStatus("authenticated");
          return nextSession;
        } catch (error) {
          clearStoredContext();
          setStatus("anonymous");
          throw error;
        }
      },
      logout: async () => {
        try {
          if (session) {
            await authApi.logout();
          }
        } finally {
          clearStoredContext();
          setSession(undefined);
          setStatus("anonymous");
        }
      },
      session,
      status,
    }),
    [session, status],
  );

  return <AuthContextValue.Provider value={value}>{children}</AuthContextValue.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContextValue);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return value;
}
