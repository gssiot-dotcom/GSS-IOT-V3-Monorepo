import type {
  AlarmLevelThresholds,
  CanonicalNodeType,
  PaginatedSensorHistory,
} from "@gss-iot/contracts";
import { Stack, Text } from "@mantine/core";

import { t } from "../../../app/i18n";

function points(values: number[], min: number, max: number) {
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / Math.max(max - min, 1)) * 86 - 7;
      return `${x},${y}`;
    })
    .join(" ");
}

export function NodeHistoryChart({
  history,
  nodeType,
  thresholds,
}: {
  history: PaginatedSensorHistory;
  nodeType: CanonicalNodeType;
  thresholds?: AlarmLevelThresholds;
}) {
  if (!history.items.length) return <Text c="dimmed">{t("monitoring.emptyHistory")}</Text>;
  const isDoor = nodeType === "door_node";
  const xValues = history.items.flatMap((item) =>
    "angleX" in item.values ? [item.values.angleX] : [],
  );
  const yValues = history.items.flatMap((item) =>
    "angleY" in item.values ? [item.values.angleY] : [],
  );
  const batteryValues = history.items.flatMap((item) =>
    "batteryLevel" in item.values && item.values.batteryLevel !== null
      ? [item.values.batteryLevel]
      : [],
  );
  const doorValues = history.items.map((item) =>
    "doorState" in item.values ? (item.values.doorState === "open" ? 1 : 0) : 0,
  );
  const values = isDoor
    ? batteryValues.length
      ? batteryValues
      : doorValues
    : [...xValues, ...yValues];
  const min = isDoor ? 0 : Math.min(...values, -1);
  const max = isDoor ? 100 : Math.max(...values, 1);
  const chartX = isDoor ? (batteryValues.length ? batteryValues : doorValues) : xValues;
  const chartY = isDoor ? [] : yValues;
  const label = isDoor ? t("monitoring.doorHistoryChart") : t("monitoring.angleHistoryChart");

  return (
    <Stack gap={4}>
      <svg aria-label={label} height="180" role="img" viewBox="0 0 100 100" width="100%">
        <line
          stroke="var(--mantine-color-gray-3)"
          strokeWidth="0.5"
          x1="0"
          x2="100"
          y1="93"
          y2="93"
        />
        {thresholds?.cautionThreshold ? (
          <line
            stroke="var(--mantine-color-yellow-6)"
            strokeDasharray="2 2"
            strokeWidth="0.7"
            x1="0"
            x2="100"
            y1={100 - ((thresholds.cautionThreshold - min) / Math.max(max - min, 1)) * 86 - 7}
            y2={100 - ((thresholds.cautionThreshold - min) / Math.max(max - min, 1)) * 86 - 7}
          />
        ) : null}
        <polyline
          fill="none"
          points={points(chartX, min, max)}
          stroke="var(--mantine-color-gss-6)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {chartY.length ? (
          <polyline
            fill="none"
            points={points(chartY, min, max)}
            stroke="var(--mantine-color-teal-6)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      <Text c="dimmed" size="xs">
        {isDoor && batteryValues.length ? t("monitoring.batteryTrend") : label}
      </Text>
    </Stack>
  );
}
