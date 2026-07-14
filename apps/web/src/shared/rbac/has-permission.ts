import type { AuthSession } from "@gss-iot/contracts";

export function hasPermission(session: AuthSession | undefined, permission: string): boolean {
  return Boolean(session?.user.isSuperAdmin || session?.user.permissions.includes(permission));
}
