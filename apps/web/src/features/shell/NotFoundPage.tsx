import { EmptyState } from "@gss-iot/ui";
import type { ReactElement } from "react";

import { t } from "../../app/i18n";

export function NotFoundPage(): ReactElement {
  return (
    <EmptyState description={t("common.notFoundDescription")} title={t("common.notFoundTitle")} />
  );
}
