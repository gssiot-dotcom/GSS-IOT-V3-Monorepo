import { SegmentedControl } from "@mantine/core";

import { t } from "../../../app/i18n";

export type MonitoringView = "TABLE" | "CARD";

export function MonitoringViewToggle({
  onChange,
  value,
}: {
  onChange: (value: MonitoringView) => void;
  value: MonitoringView;
}) {
  return (
    <SegmentedControl
      aria-label={t("monitoring.viewLabel")}
      data={[
        { label: t("monitoring.viewTable"), value: "TABLE" },
        { label: t("monitoring.viewCard"), value: "CARD" },
      ]}
      onChange={(next) => onChange(next as MonitoringView)}
      size="xs"
      value={value}
    />
  );
}
