import type {
  AlarmLevelThresholds,
  CanonicalNodeType,
  MonitoringNodeStateRecord,
  PaginatedSensorHistory,
  SensorHistoryChartResponse,
  SensorReadingRecord,
} from "@gss-iot/contracts";
import {
  Alert,
  Badge,
  Drawer,
  Group,
  NativeSelect,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";

import { t, tf } from "../../../app/i18n";
import {
  CollectionPagination,
  DataTable,
  EmptyState,
  LoadingState,
  StatusBadge,
} from "@gss-iot/ui";
import { NodeHistoryChart } from "./NodeHistoryChart";
import type { NodeHistoryHours, NodeHistoryMode, NodeHistoryRange } from "./useNodeHistoryRange";

export function NodeDetailDrawer({
  chart,
  date,
  history,
  historyError,
  hours,
  loadingHistory,
  maxDate,
  mode,
  node,
  nodeType,
  onClose,
  onDateChange,
  onHoursChange,
  onHistoryPageChange,
  onHistoryPageSizeChange,
  onModeChange,
  range,
  thresholds,
}: {
  chart?: SensorHistoryChartResponse;
  date: string;
  history?: PaginatedSensorHistory;
  historyError?: boolean;
  hours: NodeHistoryHours;
  loadingHistory: boolean;
  maxDate: string;
  mode: NodeHistoryMode;
  node?: MonitoringNodeStateRecord;
  nodeType: CanonicalNodeType;
  onClose: () => void;
  onDateChange: (value: string) => void;
  onHoursChange: (value: NodeHistoryHours) => void;
  onHistoryPageChange?: (value: number) => void;
  onHistoryPageSizeChange?: (value: 50 | 100) => void;
  onModeChange: (value: NodeHistoryMode) => void;
  range: NodeHistoryRange;
  thresholds?: AlarmLevelThresholds;
}) {
  const doorValues = node && "doorState" in node.values ? node.values : undefined;
  const angleValues = node && "angleX" in node.values ? node.values : undefined;
  const chartItems = mergeRealtimePoint(chart?.items ?? [], node, range);
  const chartHistory: PaginatedSensorHistory = {
    items: chartItems,
    page: 1,
    pageSize: chartItems.length,
    total: chart?.totalRawPointCount ?? chartItems.length,
  };
  return (
    <Drawer
      onClose={onClose}
      opened={Boolean(node)}
      position="right"
      size="min(720px, 100%)"
      title={node ? tf("monitoring.nodeDetailTitle", { number: node.node.number }) : ""}
    >
      {node ? (
        <Stack gap="lg">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text c="dimmed" size="sm">
                {node.gateway.serialNumber}
              </Text>
              <Text fw={600}>
                {node.node.installedLocation ?? t("monitoring.locationUnavailable")}
              </Text>
            </Stack>
            <StatusBadge label={t(`status.${node.status}` as never)} status={node.status} />
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Text size="sm">
              {doorValues
                ? `${t(`monitoring.doorState.${doorValues.doorState}` as never)} · ${doorValues.batteryLevel ?? "-"}%`
                : `X ${angleValues?.angleX.toFixed(1)}° · Y ${angleValues?.angleY.toFixed(1)}°`}
            </Text>
            <Text c="dimmed" size="sm">
              {tf("monitoring.valueAgeLabel", { age: new Date(node.lastSeenAt).toLocaleString() })}
            </Text>
            {node.faultFiltered ? (
              <Badge color="yellow">{t("monitoring.faultFiltered")}</Badge>
            ) : null}
          </SimpleGrid>
          {angleValues ? (
            <TiltDirectionGraphic angleX={angleValues.angleX} angleY={angleValues.angleY} />
          ) : null}
          <Paper p="md" withBorder>
            <Stack gap="sm">
              <SegmentedControl
                aria-label={t("monitoring.historyMode")}
                data={[
                  { label: t("monitoring.historyModeHour"), value: "HOUR" },
                  { label: t("monitoring.historyModeDay"), value: "DAY" },
                ]}
                onChange={(value) => onModeChange(value as NodeHistoryMode)}
                value={mode}
              />
              {mode === "HOUR" ? (
                <NativeSelect
                  aria-label={t("monitoring.historyHourRange")}
                  data={[
                    { label: t("monitoring.historyHour1"), value: "1" },
                    { label: t("monitoring.historyHour12"), value: "12" },
                    { label: t("monitoring.historyHour24"), value: "24" },
                  ]}
                  onChange={(event) =>
                    onHoursChange(Number(event.currentTarget.value) as NodeHistoryHours)
                  }
                  value={String(hours)}
                />
              ) : (
                <TextInput
                  aria-label={t("monitoring.historyDate")}
                  max={maxDate}
                  onChange={(event) => onDateChange(event.currentTarget.value)}
                  type="date"
                  value={date}
                />
              )}
            </Stack>
          </Paper>
          {historyError ? (
            <Alert color="red" title={t("common.errorTitle")}>
              {t("monitoring.historyLoadError")}
            </Alert>
          ) : loadingHistory ? (
            <LoadingState title={t("common.loading")} />
          ) : history && chart ? (
            <>
              {chart.sampled ? (
                <Alert color="blue" title={t("monitoring.historySampledTitle")}>
                  {tf("monitoring.historySampledDescription", {
                    returned: chart.returnedPointCount,
                    total: chart.totalRawPointCount,
                  })}
                </Alert>
              ) : null}
              <NodeHistoryChart
                history={chartHistory}
                nodeType={nodeType}
                thresholds={thresholds}
              />
              {history.items.length ? (
                <>
                  <CollectionPagination
                    onPageChange={onHistoryPageChange}
                    onPageSizeChange={(value) =>
                      onHistoryPageSizeChange?.(Number(value) as 50 | 100)
                    }
                    page={history.page}
                    pageSize={history.pageSize as 50 | 100}
                    pageSizeLabel={t("table.pageSize")}
                    rangeLabel={tf("table.range", {
                      from: history.total === 0 ? 0 : (history.page - 1) * history.pageSize + 1,
                      to: Math.min(history.page * history.pageSize, history.total),
                      total: history.total,
                    })}
                    totalPages={Math.max(1, Math.ceil(history.total / history.pageSize))}
                  />
                  <DataTable
                    columns={[
                      {
                        key: "receivedAt",
                        label: t("monitoring.receivedAt"),
                        render: (row) => new Date(row.receivedAt).toLocaleString(),
                      },
                      {
                        key: "value",
                        label: t("monitoring.latestValue"),
                        render: (row) => renderHistoryValue(row.values),
                      },
                      {
                        key: "status",
                        label: t("monitoring.latestStatus"),
                        render: (row) => (
                          <StatusBadge
                            label={t(`status.${row.status}` as never)}
                            status={row.status}
                          />
                        ),
                      },
                    ]}
                    rows={history.items}
                  />
                </>
              ) : (
                <EmptyState
                  description={t("monitoring.emptyHistory")}
                  title={t("common.emptyTitle")}
                />
              )}
            </>
          ) : null}
        </Stack>
      ) : null}
    </Drawer>
  );
}

export function mergeRealtimePoint(
  points: SensorReadingRecord[],
  node: MonitoringNodeStateRecord | undefined,
  range: NodeHistoryRange,
): SensorReadingRecord[] {
  if (!node) return points;
  const timestamp = new Date(node.lastSeenAt).getTime();
  if (timestamp < new Date(range.from).getTime() || timestamp >= new Date(range.to).getTime()) {
    return points;
  }
  const valueKey = JSON.stringify(node.values);
  if (
    points.some(
      (point) => point.receivedAt === node.lastSeenAt && JSON.stringify(point.values) === valueKey,
    )
  ) {
    return points;
  }
  const realtime: SensorReadingRecord = {
    buildingId: node.buildingId,
    classificationEvidence: node.classificationEvidence,
    faultFiltered: node.faultFiltered,
    gateway: node.gateway,
    gatewayId: node.gatewayId,
    id: `realtime:${node.nodeId}:${node.lastSeenAt}`,
    measuredAt: null,
    node: node.node,
    nodeId: node.nodeId,
    nodeType: node.nodeType,
    nodeTypeId: node.nodeTypeId,
    receivedAt: node.lastSeenAt,
    status: node.status,
    values: node.values,
  };
  return [...points, realtime].sort(
    (left, right) =>
      new Date(left.receivedAt).getTime() - new Date(right.receivedAt).getTime() ||
      left.id.localeCompare(right.id),
  );
}

function TiltDirectionGraphic({ angleX, angleY }: { angleX: number; angleY: number }) {
  const totalDeviation = Math.hypot(angleX, angleY);
  const x = 120 + Math.max(-1, Math.min(1, angleX / 12)) * 82;
  const y = 78 - Math.max(-1, Math.min(1, angleY / 12)) * 52;

  return (
    <Paper aria-label={t("monitoring.tiltGraphicLabel")} p="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600}>{t("monitoring.tiltCurrentDirection")}</Text>
          <Text c="dimmed" size="sm">
            {tf("monitoring.tiltDeviation", { value: totalDeviation.toFixed(1) })}
          </Text>
        </Group>
        <svg
          aria-label={t("monitoring.tiltGraphicLabel")}
          height="180"
          role="img"
          viewBox="0 0 240 150"
          width="100%"
        >
          <title>{t("monitoring.tiltGraphicLabel")}</title>
          <line
            stroke="var(--mantine-color-gray-4)"
            strokeDasharray="4 3"
            strokeWidth="1"
            x1="120"
            x2="120"
            y1="16"
            y2="136"
          />
          <line
            stroke="var(--mantine-color-gray-4)"
            strokeDasharray="4 3"
            strokeWidth="1"
            x1="28"
            x2="212"
            y1="78"
            y2="78"
          />
          <line
            stroke="var(--mantine-color-gss-7)"
            strokeLinecap="round"
            strokeWidth="4"
            x1="120"
            x2={x}
            y1="78"
            y2={y}
          />
          <circle cx={x} cy={y} fill="var(--mantine-color-gss-7)" r="7" />
          <circle
            cx="120"
            cy="78"
            fill="var(--mantine-color-body)"
            r="4"
            stroke="var(--mantine-color-gray-6)"
            strokeWidth="2"
          />
          <text fill="var(--mantine-color-dimmed)" fontSize="10" textAnchor="middle" x="120" y="12">
            {t("monitoring.tiltReference")}
          </text>
          <text fill="var(--mantine-color-dimmed)" fontSize="10" textAnchor="end" x="208" y="94">
            {t("monitoring.tiltAxisX")}
          </text>
          <text fill="var(--mantine-color-dimmed)" fontSize="10" x="126" y="28">
            {t("monitoring.tiltAxisY")}
          </text>
          <text
            fill="var(--mantine-color-dimmed)"
            fontSize="10"
            textAnchor="middle"
            x="120"
            y="146"
          >
            0°
          </text>
        </svg>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Text fw={600}>{tf("monitoring.tiltXDeviation", { value: angleX.toFixed(1) })}</Text>
          <Text fw={600}>{tf("monitoring.tiltYDeviation", { value: angleY.toFixed(1) })}</Text>
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}

function renderHistoryValue(values: PaginatedSensorHistory["items"][number]["values"]) {
  if ("doorState" in values)
    return `${t(`monitoring.doorState.${values.doorState}` as never)} · ${values.batteryLevel ?? "-"}%`;
  return `X ${values.angleX.toFixed(1)}° · Y ${values.angleY.toFixed(1)}°`;
}
