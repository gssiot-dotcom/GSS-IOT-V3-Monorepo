import { Center, Stack, Text, Title } from "@mantine/core";
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

  return (
    <Center mih="60vh">
      <Stack align="center" gap="xs">
        <Title order={2}>{t("common.forbidden")}</Title>
        <Text c="dimmed">{t("common.pageUnavailable")}</Text>
      </Stack>
    </Center>
  );
}
