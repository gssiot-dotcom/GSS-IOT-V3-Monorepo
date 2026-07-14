import { Paper, Stack, Text, Title } from "@mantine/core";

import { t, type TranslationKey } from "../../app/i18n";

export function PlaceholderPage({ titleKey }: { titleKey: TranslationKey }) {
  return (
    <Paper p="lg" withBorder>
      <Stack gap="xs">
        <Title order={1}>{t(titleKey)}</Title>
        <Text c="dimmed">{t("common.pageUnavailable")}</Text>
      </Stack>
    </Paper>
  );
}
