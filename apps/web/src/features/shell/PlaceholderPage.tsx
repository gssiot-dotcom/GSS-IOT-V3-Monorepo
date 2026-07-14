import { EmptyState, PageHeader } from "@gss-iot/ui";
import { Paper, Stack } from "@mantine/core";

import { t, type TranslationKey } from "../../app/i18n";

export function PlaceholderPage({ titleKey }: { titleKey: TranslationKey }) {
  return (
    <Paper p="lg" withBorder>
      <Stack gap="lg">
        <PageHeader subtitle={t("common.pageUnavailable")} title={t(titleKey)} />
        <EmptyState description={t("common.emptyDescription")} title={t("common.emptyTitle")} />
      </Stack>
    </Paper>
  );
}
