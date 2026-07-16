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
const storageKey = "gss-iot-v3-auth-session";

interface StoredSession {
  accessToken: string;
  context: AuthContext;
}

function readStoredSession(): StoredSession | undefined {
  if (typeof window === "undefined") return undefined;

  const raw = window.sessionStorage.getItem(storageKey);
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      (parsed.context === "gss-admin" || parsed.context === "company-user") &&
      typeof parsed.accessToken === "string" &&
      parsed.accessToken.length > 0
    ) {
      return { accessToken: parsed.accessToken, context: parsed.context };
    }
  } catch {
    // Ignore malformed client-side state and force a clean login.
  }

  window.sessionStorage.removeItem(storageKey);
  return undefined;
}

function writeStoredSession(session: AuthSession): void {
  window.sessionStorage.setItem(
    storageKey,
    JSON.stringify({ accessToken: session.accessToken, context: session.context }),
  );
}

function clearStoredSession(): void {
  window.sessionStorage.removeItem(storageKey);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>();
  const [status, setStatus] = useState<AuthStatus>(() =>
    readStoredSession() ? "loading" : "anonymous",
  );

  useEffect(() => {
    const stored = readStoredSession();
    if (!stored) {
      setStatus("anonymous");
      return;
    }

    let cancelled = false;
    authApi
      .getCurrentSession(stored.context, stored.accessToken)
      .then((restoredSession) => {
        if (cancelled) return;
        setSession(restoredSession);
        writeStoredSession(restoredSession);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        clearStoredSession();
        setSession(undefined);
        setStatus("session-expired");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      login: async (context, email, password) => {
        setStatus("loading");
        try {
          const nextSession = await authApi.login(context, email, password);
          setSession(nextSession);
          writeStoredSession(nextSession);
          setStatus("authenticated");
          return nextSession;
        } catch (error) {
          clearStoredSession();
          setStatus("anonymous");
          throw error;
        }
      },
      logout: async () => {
        try {
          if (session) {
            await authApi.logout(session.accessToken);
          }
        } finally {
          clearStoredSession();
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
