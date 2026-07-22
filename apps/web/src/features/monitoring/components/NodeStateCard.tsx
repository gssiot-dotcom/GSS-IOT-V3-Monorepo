import type { MonitoringNodeStateRecord } from "@gss-iot/contracts";
import { Badge, Card, Group, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core";
import {
  IconBattery,
  IconBatteryOff,
  IconDoor,
  IconDoorExit,
  IconWifi,
  IconWifiOff,
} from "@tabler/icons-react";

import { t, tf } from "../../../app/i18n";
import { StatusBadge } from "@gss-iot/ui";
import { gssStatusColors } from "@gss-iot/ui";
import { TShapeStatusIndicator, type LedPosition } from "./TShapeStatusIndicator";

function statusColor(status: MonitoringNodeStateRecord["status"]) {
  return gssStatusColors[status];
}

function formatAge(lastSeenAt: string) {
  const timestamp = new Date(lastSeenAt).getTime();
  if (timestamp === 0) return t("status.offline");
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  return seconds < 60
    ? tf("monitoring.ageSeconds", { count: seconds })
    : tf("monitoring.ageMinutes", { count: Math.floor(seconds / 60) });
}

function getLedPosition(state: MonitoringNodeStateRecord): LedPosition {
  if (state.status === "offline" || state.status === "unconfigured") return "none";
  if (!("angleX" in state.values)) return "center";
  if (Math.abs(state.values.angleX) >= Math.abs(state.values.angleY)) {
    return state.values.angleX > 0 ? "right" : state.values.angleX < 0 ? "left" : "center";
  }
  return state.values.angleY > 0 ? "up" : state.values.angleY < 0 ? "down" : "center";
}

function valueSummary(state: MonitoringNodeStateRecord) {
  if ("doorState" in state.values) {
    return `${t(`monitoring.doorState.${state.values.doorState}` as never)} · ${
      state.values.batteryLevel === null ? "-" : `${state.values.batteryLevel}%`
    }`;
  }
  return `X ${state.values.angleX.toFixed(1)}° · Y ${state.values.angleY.toFixed(1)}°`;
}

export function NodeStateCard({
  onOpen,
  state,
}: {
  onOpen: (nodeId: string) => void;
  state: MonitoringNodeStateRecord;
}) {
  const doorValues = "doorState" in state.values ? state.values : undefined;
  const angleValues = "angleX" in state.values ? state.values : undefined;
  const doorOpen = doorValues?.doorState === "open";
  const statusLabel = t(`status.${state.status}` as never);
  const label = tf("monitoring.nodeCardLabel", {
    node: state.node.number,
    status: statusLabel,
  });

  return (
    <Card
      aria-label={label}
      component="button"
      onClick={() => onOpen(state.nodeId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen(state.nodeId);
      }}
      p="md"
      style={{ borderColor: `${statusColor(state.status)}66`, textAlign: "left" }}
      type="button"
    >
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Text fw={600}>{tf("monitoring.nodeLabel", { number: state.node.number })}</Text>
            <Text c="dimmed" size="xs">
              {state.gateway.serialNumber}
            </Text>
          </Stack>
          <StatusBadge label={statusLabel} status={state.status} />
        </Group>
        <Group align="center" justify="space-between" wrap="nowrap">
          {doorValues ? (
            <ThemeIcon color={doorOpen ? "red" : "gss"} size="xl" variant="light">
              {doorOpen ? <IconDoorExit size={26} /> : <IconDoor size={26} />}
            </ThemeIcon>
          ) : (
            <TShapeStatusIndicator
              activePosition={getLedPosition(state)}
              color={statusColor(state.status)}
              label={tf("monitoring.tShapeLabel", { status: statusLabel })}
            />
          )}
          <Stack align="flex-end" gap={4}>
            <Text fw={600} size="sm">
              {doorValues
                ? t(`monitoring.doorState.${doorValues.doorState}` as never)
                : `X ${angleValues?.angleX.toFixed(1)}° · Y ${angleValues?.angleY.toFixed(1)}°`}
            </Text>
            {doorValues ? (
              <Group gap={4}>
                {doorValues.batteryLevel === null ? (
                  <IconBatteryOff aria-label={t("monitoring.batteryUnavailable")} size={16} />
                ) : (
                  <IconBattery aria-label={t("monitoring.battery")} size={16} />
                )}
                <Text size="xs">
                  {doorValues.batteryLevel === null ? "-" : `${doorValues.batteryLevel}%`}
                </Text>
              </Group>
            ) : null}
          </Stack>
        </Group>
        <SimpleGrid cols={2} spacing="xs">
          <Text c="dimmed" size="xs">
            {valueSummary(state)}
          </Text>
          <Group gap={4} justify="flex-end">
            {state.faultFiltered ? (
              <Badge color="yellow">{t("monitoring.faultFiltered")}</Badge>
            ) : null}
            {state.lastSeenAt ? (
              <Group gap={4}>
                {state.lastSeenAt === new Date(0).toISOString() ? (
                  <IconWifiOff size={14} />
                ) : (
                  <IconWifi size={14} />
                )}
                <Text c="dimmed" size="xs">
                  {formatAge(state.lastSeenAt)}
                </Text>
              </Group>
            ) : null}
          </Group>
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
