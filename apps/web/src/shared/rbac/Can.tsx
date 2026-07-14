import type { ReactNode } from "react";

import { useAuth } from "../auth/auth-context";
import { hasPermission } from "./has-permission";

export function Can({ children, permission }: { children: ReactNode; permission: string }) {
  const { session } = useAuth();
  return hasPermission(session, permission) ? children : null;
}
