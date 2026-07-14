import type { AuthContext, AuthSession } from "@gss-iot/contracts";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import * as authApi from "./auth-api";

type AuthStatus = "anonymous" | "authenticated" | "loading" | "session-expired";

interface AuthContextValue {
  login: (context: AuthContext, email: string, password: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
  session?: AuthSession;
  status: AuthStatus;
}

const AuthContextValue = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>();
  const [status, setStatus] = useState<AuthStatus>("anonymous");

  const value = useMemo<AuthContextValue>(
    () => ({
      login: async (context, email, password) => {
        setStatus("loading");
        try {
          const nextSession = await authApi.login(context, email, password);
          setSession(nextSession);
          setStatus("authenticated");
          return nextSession;
        } catch (error) {
          setStatus("anonymous");
          throw error;
        }
      },
      logout: async () => {
        if (session) {
          await authApi.logout(session.accessToken);
        }
        setSession(undefined);
        setStatus("anonymous");
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
