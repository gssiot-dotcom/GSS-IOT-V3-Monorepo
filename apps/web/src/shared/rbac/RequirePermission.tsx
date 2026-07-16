import { ForbiddenState } from "@gss-iot/ui";
import type { ReactNode } from "react";

import { t } from "../../app/i18n";
import { useAuth } from "../auth/auth-context";
import { hasPermission } from "./has-permission";

export function RequirePermission({
  children,
  permission,
}: {
  children: ReactNode;
  permission: string;
}) {
  const { session } = useAuth();

  if (hasPermission(session, permission)) {
    return children;
  }

  return <ForbiddenState description={t("common.pageUnavailable")} title={t("common.forbidden")} />;
}
