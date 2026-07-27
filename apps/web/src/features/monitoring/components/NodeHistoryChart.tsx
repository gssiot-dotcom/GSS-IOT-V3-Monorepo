import type {
  AlarmLevelThresholds,
  CanonicalNodeType,
  PaginatedSensorHistory,
} from "@gss-iot/contracts";
import { Group, Stack, Text } from "@mantine/core";
import { useState } from "react";

import { t, tf } from "../../../app/i18n";
import {
  ChartTooltip,
  chartTooltipPosition,
  type ChartTooltipState,
} from "../../../shared/ui/ChartTooltip";

const tooltipId = "node-history-chart-tooltip";

function toChartY(value: number, min: number, max: number, top = 30, bottom = 204) {
  return bottom - ((value - min) / Math.max(max - min, 1)) * (bottom - top);
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
  const [tooltip, setTooltip] = useState<ChartTooltipState>();
  if (!history.items.length) return <Text c="dimmed">{t("monitoring.emptyHistory")}</Text>;

  const isDoor = nodeType === "door_node";
  const chartWidth = 520;
  const left = 52;
  const right = 16;
  const plotWidth = chartWidth - left - right;
  const xPosition = (index: number) =>
    left + (index / Math.max(history.items.length - 1, 1)) * plotWidth;
  const label = isDoor ? t("monitoring.doorHistoryChart") : t("monitoring.angleHistoryChart");
  const showTooltip = (target: SVGElement, item: PaginatedSensorHistory["items"][number]) => {
    const receivedAt = new Date(item.receivedAt).toLocaleString();
    const content =
      "angleX" in item.values ? (
        <Stack gap={2}>
          <Text fw={650} size="sm">
            {receivedAt}
          </Text>
          <Text size="sm">
            {tf("monitoring.historyTooltipAngleX", { value: item.values.angleX.toFixed(1) })}
          </Text>
          <Text size="sm">
            {tf("monitoring.historyTooltipAngleY", { value: item.values.angleY.toFixed(1) })}
          </Text>
          <Text c="dimmed" size="xs">
            {tf("monitoring.historyTooltipStatus", { status: t(`status.${item.status}` as never) })}
          </Text>
        </Stack>
      ) : (
        <Stack gap={2}>
          <Text fw={650} size="sm">
            {receivedAt}
          </Text>
          <Text size="sm">
            {tf("monitoring.historyTooltipDoor", {
              state: t(`monitoring.doorState.${item.values.doorState}` as never),
            })}
          </Text>
          {item.values.batteryLevel !== null ? (
            <Text size="sm">
              {tf("monitoring.historyTooltipBattery", { value: item.values.batteryLevel })}
            </Text>
          ) : null}
          <Text c="dimmed" size="xs">
            {tf("monitoring.historyTooltipStatus", { status: t(`status.${item.status}` as never) })}
          </Text>
        </Stack>
      );
    setTooltip({ content, ...chartTooltipPosition(target) });
  };

  if (!isDoor) {
    const xValues = history.items.map((item) => ("angleX" in item.values ? item.values.angleX : 0));
    const yValues = history.items.map((item) => ("angleY" in item.values ? item.values.angleY : 0));
    const values = [...xValues, ...yValues];
    const min = Math.min(...values, -1);
    const max = Math.max(...values, 1);
    const zeroY = toChartY(0, min, max);
    const ticks = [...new Set([min, 0, max])];

    return (
      <Stack gap="xs">
        <svg
          aria-label={label}
          height="250"
          onMouseLeave={() => setTooltip(undefined)}
          role="img"
          viewBox="0 0 520 250"
          width="100%"
        >
          <desc>{t("monitoring.historyYAxis")}</desc>
          <line
            stroke="var(--mantine-color-gray-5)"
            strokeWidth="1"
            x1={left}
            x2={left}
            y1="30"
            y2="204"
          />
          <line
            stroke="var(--mantine-color-gray-5)"
            strokeWidth="1"
            x1={left}
            x2={chartWidth - right}
            y1="204"
            y2="204"
          />
          <line
            stroke="var(--mantine-color-gray-4)"
            strokeDasharray="4 3"
            strokeWidth="1"
            x1={left}
            x2={chartWidth - right}
            y1={zeroY}
            y2={zeroY}
          />
          {ticks.map((tick) => {
            const y = toChartY(tick, min, max);
            return (
              <g key={tick}>
                <line
                  stroke="var(--mantine-color-gray-3)"
                  strokeWidth="0.5"
                  x1={left}
                  x2={chartWidth - right}
                  y1={y}
                  y2={y}
                />
                <text
                  fill="var(--mantine-color-dimmed)"
                  fontSize="11"
                  textAnchor="end"
                  x={left - 8}
                  y={y + 4}
                >
                  {tick.toFixed(1)}°
                </text>
              </g>
            );
          })}
          <text
            fill="var(--mantine-color-dimmed)"
            fontSize="11"
            textAnchor="middle"
            x="260"
            y="244"
          >
            {t("monitoring.historyXAxis")}
          </text>
          <text
            fill="var(--mantine-color-dimmed)"
            fontSize="11"
            textAnchor="middle"
            transform="rotate(-90 14 117)"
            x="14"
            y="117"
          >
            {t("monitoring.historyYAxis")}
          </text>
          <polyline
            fill="none"
            points={xValues
              .map((value, index) => `${xPosition(index)},${toChartY(value, min, max)}`)
              .join(" ")}
            stroke="var(--mantine-color-gss-6)"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            fill="none"
            points={yValues
              .map((value, index) => `${xPosition(index)},${toChartY(value, min, max)}`)
              .join(" ")}
            stroke="var(--mantine-color-teal-6)"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
          {history.items.map((item, index) => {
            if (!("angleX" in item.values)) return null;
            const pointLabel = tf("monitoring.historyPointLabel", {
              date: new Date(item.receivedAt).toLocaleString(),
              status: t(`status.${item.status}` as never),
            });
            return (
              <g key={item.id}>
                {(
                  [
                    ["x", item.values.angleX, "var(--mantine-color-gss-6)"],
                    ["y", item.values.angleY, "var(--mantine-color-teal-6)"],
                  ] as const
                ).map(([series, value, color]) => (
                  <circle
                    aria-describedby={tooltip ? tooltipId : undefined}
                    aria-label={`${pointLabel} · ${series.toUpperCase()}`}
                    cx={xPosition(index)}
                    cy={toChartY(value, min, max)}
                    fill={color}
                    key={series}
                    onBlur={() => setTooltip(undefined)}
                    onFocus={(event) => showTooltip(event.currentTarget, item)}
                    onMouseEnter={(event) => showTooltip(event.currentTarget, item)}
                    r="4"
                    role="button"
                    stroke="var(--gss-surface)"
                    strokeWidth="1.5"
                    tabIndex={0}
                  />
                ))}
              </g>
            );
          })}
        </svg>
        <Group gap="md">
          <Text size="xs">
            <span aria-hidden="true" style={{ color: "var(--mantine-color-gss-6)" }}>
              ●
            </span>{" "}
            {t("monitoring.historyXLegend")}
          </Text>
          <Text size="xs">
            <span aria-hidden="true" style={{ color: "var(--mantine-color-teal-6)" }}>
              ●
            </span>{" "}
            {t("monitoring.historyYLegend")}
          </Text>
          <Text c="dimmed" size="xs">
            {t("monitoring.tiltReference")}: 0°
          </Text>
        </Group>
        <ChartTooltip id={tooltipId} state={tooltip} />
      </Stack>
    );
  }

  const batteryValues = history.items.flatMap((item) =>
    "batteryLevel" in item.values && item.values.batteryLevel !== null
      ? [item.values.batteryLevel]
      : [],
  );
  const showBattery = batteryValues.length > 0;
  const chartValues = history.items.map((item) => {
    if (!("doorState" in item.values)) return 0;
    if (showBattery && item.values.batteryLevel !== null) return item.values.batteryLevel;
    return item.values.doorState === "open" ? 100 : 0;
  });
  const min = 0;
  const max = 100;

  return (
    <Stack gap={4}>
      <svg
        aria-label={label}
        height="180"
        onMouseLeave={() => setTooltip(undefined)}
        role="img"
        viewBox="0 0 520 180"
        width="100%"
      >
        {[0, 50, 100].map((tick) => {
          const y = toChartY(tick, min, max, 18, 142);
          return (
            <g key={tick}>
              <line
                stroke="var(--mantine-color-gray-3)"
                strokeDasharray={tick === 0 ? undefined : "4 4"}
                strokeWidth="0.8"
                x1={left}
                x2={chartWidth - right}
                y1={y}
                y2={y}
              />
              <text
                fill="var(--mantine-color-dimmed)"
                fontSize="10"
                textAnchor="end"
                x={left - 8}
                y={y + 4}
              >
                {tick}
              </text>
            </g>
          );
        })}
        {thresholds?.cautionThreshold ? (
          <line
            stroke="var(--mantine-color-yellow-6)"
            strokeDasharray="4 3"
            strokeWidth="1"
            x1={left}
            x2={chartWidth - right}
            y1={toChartY(thresholds.cautionThreshold, min, max, 18, 142)}
            y2={toChartY(thresholds.cautionThreshold, min, max, 18, 142)}
          />
        ) : null}
        <polyline
          fill="none"
          points={chartValues
            .map((value, index) => `${xPosition(index)},${toChartY(value, min, max, 18, 142)}`)
            .join(" ")}
          stroke="var(--mantine-color-gss-6)"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
        {history.items.map((item, index) => {
          const pointLabel = tf("monitoring.historyPointLabel", {
            date: new Date(item.receivedAt).toLocaleString(),
            status: t(`status.${item.status}` as never),
          });
          return (
            <circle
              aria-describedby={tooltip ? tooltipId : undefined}
              aria-label={pointLabel}
              cx={xPosition(index)}
              cy={toChartY(chartValues[index] ?? 0, min, max, 18, 142)}
              fill="var(--gss-surface)"
              key={item.id}
              onBlur={() => setTooltip(undefined)}
              onFocus={(event) => showTooltip(event.currentTarget, item)}
              onMouseEnter={(event) => showTooltip(event.currentTarget, item)}
              r="4"
              role="button"
              stroke="var(--mantine-color-gss-6)"
              strokeWidth="2"
              tabIndex={0}
            />
          );
        })}
      </svg>
      <Text c="dimmed" size="xs">
        {showBattery ? t("monitoring.batteryTrend") : label}
      </Text>
      <ChartTooltip id={tooltipId} state={tooltip} />
    </Stack>
  );
}
