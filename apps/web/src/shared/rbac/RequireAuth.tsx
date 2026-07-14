import type { AuthContext } from "@gss-iot/contracts";
import { Center, Loader } from "@mantine/core";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { t } from "../../app/i18n";
import { useAuth } from "../auth/auth-context";

export function RequireAuth({ children, context }: { children: ReactNode; context: AuthContext }) {
  const { session, status } = useAuth();

  if (status === "loading") {
    return (
      <Center mih="100vh" aria-label={t("common.loading")}>
        <Loader />
      </Center>
    );
  }

  if (!session || session.context !== context) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
