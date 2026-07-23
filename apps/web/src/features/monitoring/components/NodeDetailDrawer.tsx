import type {
  AlarmLevelThresholds,
  CanonicalNodeType,
  MonitoringNodeStateRecord,
  PaginatedSensorHistory,
} from "@gss-iot/contracts";
import { Badge, Drawer, Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";

import { t, tf } from "../../../app/i18n";
import { DataTable, EmptyState, LoadingState, StatusBadge } from "@gss-iot/ui";
import { NodeHistoryChart } from "./NodeHistoryChart";

export function NodeDetailDrawer({
  history,
  node,
  nodeType,
  onClose,
  thresholds,
}: {
  history?: PaginatedSensorHistory;
  node?: MonitoringNodeStateRecord;
  nodeType: CanonicalNodeType;
  onClose: () => void;
  thresholds?: AlarmLevelThresholds;
}) {
  const doorValues = node && "doorState" in node.values ? node.values : undefined;
  const angleValues = node && "angleX" in node.values ? node.values : undefined;
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
          {!history ? (
            <LoadingState title={t("common.loading")} />
          ) : (
            <>
              <NodeHistoryChart history={history} nodeType={nodeType} thresholds={thresholds} />
              {history.items.length ? (
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
              ) : (
                <EmptyState
                  description={t("monitoring.emptyHistory")}
                  title={t("common.emptyTitle")}
                />
              )}
            </>
          )}
        </Stack>
      ) : null}
    </Drawer>
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
