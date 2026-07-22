import type {
  AlarmLevelThresholds,
  CanonicalNodeType,
  MonitoringNodeStateRecord,
  PaginatedSensorHistory,
} from "@gss-iot/contracts";
import { Badge, Drawer, Group, SimpleGrid, Stack, Text } from "@mantine/core";

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

function renderHistoryValue(values: PaginatedSensorHistory["items"][number]["values"]) {
  if ("doorState" in values)
    return `${t(`monitoring.doorState.${values.doorState}` as never)} · ${values.batteryLevel ?? "-"}%`;
  return `X ${values.angleX.toFixed(1)}° · Y ${values.angleY.toFixed(1)}°`;
}
