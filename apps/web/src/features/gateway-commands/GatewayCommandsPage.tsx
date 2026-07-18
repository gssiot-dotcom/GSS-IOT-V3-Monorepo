import type { GatewayCommandRecord, MqttStatusRecord } from "@gss-iot/contracts";
import { DataTable, EmptyState, ErrorState, LoadingState, PageHeader } from "@gss-iot/ui";
import { Badge, Button, Code, Drawer, Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";

import { t } from "../../app/i18n";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { Can } from "../../shared/rbac/Can";

function statusColor(status: GatewayCommandRecord["status"]) {
  if (status === "ACKNOWLEDGED") return "green";
  if (status === "FAILED" || status === "EXPIRED" || status === "CANCELLED") return "red";
  if (status === "SENT") return "blue";
  return "gray";
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

function jsonRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function commandRequestId(command: GatewayCommandRecord): string {
  const payloadRequestId = jsonRecord(command.payload)?.requestId;
  if (typeof payloadRequestId === "string" && payloadRequestId.trim()) {
    return payloadRequestId;
  }
  const responseRequestId = jsonRecord(command.responsePayload)?.requestId;
  if (typeof responseRequestId === "string" && responseRequestId.trim()) {
    return responseRequestId;
  }
  return command.id;
}

function isActiveCommand(command: GatewayCommandRecord): boolean {
  return command.status === "PENDING" || command.status === "SENT";
}

export function GatewayCommandsPage() {
  const { session } = useAuth();
  const [commands, setCommands] = useState<GatewayCommandRecord[]>();
  const [mqttStatus, setMqttStatus] = useState<MqttStatusRecord>();
  const [selected, setSelected] = useState<GatewayCommandRecord>();
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setError(false);
    try {
      const [loadedCommands, loadedMqttStatus] = await Promise.all([
        apiRequest<GatewayCommandRecord[]>(session, "/admin/gateway-commands"),
        apiRequest<MqttStatusRecord>(session, "/admin/gateway-commands/mqtt-status"),
      ]);
      setCommands(loadedCommands);
      setMqttStatus(loadedMqttStatus);
      setSelected((current) =>
        current
          ? (loadedCommands.find((command) => command.id === current.id) ?? current)
          : current,
      );
    } catch {
      setError(true);
    }
  }, [session]);

  const shouldPoll = useMemo(
    () => Boolean(commands?.some((command) => isActiveCommand(command))),
    [commands],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!shouldPoll) return;
    const interval = window.setInterval(() => {
      void load();
    }, 2_000);
    return () => window.clearInterval(interval);
  }, [load, shouldPoll]);

  const mutate = async (command: GatewayCommandRecord, action: "cancel" | "retry") => {
    if (!session) return;
    const updated = await apiRequest<GatewayCommandRecord>(
      session,
      `/admin/gateway-commands/${command.id}/${action}`,
      { method: "POST" },
    );
    setSelected(updated);
    await load();
  };

  if (!commands || !mqttStatus) return <LoadingState title={t("common.loading")} />;
  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;

  return (
    <Stack gap="lg">
      <PageHeader title={t("gatewayCommands.title")} subtitle={t("gatewayCommands.subtitle")} />
      <MqttStatusBlock status={mqttStatus} />
      {commands.length ? (
        <DataTable
          columns={[
            {
              key: "gateway",
              label: t("gatewayCommands.gateway"),
              render: (row) => row.gateway.serialNumber,
            },
            {
              key: "type",
              label: t("gatewayCommands.commandType"),
              render: (row) => row.commandType,
            },
            {
              key: "status",
              label: t("gatewayCommands.status"),
              render: (row) => <Badge color={statusColor(row.status)}>{row.status}</Badge>,
            },
            {
              key: "attempts",
              label: t("gatewayCommands.attempts"),
              render: (row) => `${row.attemptCount}/${row.maxAttempts}`,
            },
            {
              key: "created",
              label: t("gatewayCommands.createdAt"),
              render: (row) => formatDate(row.createdAt),
            },
            {
              key: "actions",
              label: t("organizations.actions"),
              render: (row) => (
                <Group gap="xs">
                  <Button onClick={() => setSelected(row)} size="xs" variant="light">
                    {t("organizations.open")}
                  </Button>
                  <Can permission="mqtt-commands.manage">
                    {row.status === "FAILED" ? (
                      <Button onClick={() => void mutate(row, "retry")} size="xs" variant="light">
                        {t("gatewayCommands.retry")}
                      </Button>
                    ) : null}
                    {row.status === "PENDING" || row.status === "FAILED" ? (
                      <Button
                        color="red"
                        onClick={() => void mutate(row, "cancel")}
                        size="xs"
                        variant="light"
                      >
                        {t("gatewayCommands.cancel")}
                      </Button>
                    ) : null}
                  </Can>
                </Group>
              ),
            },
          ]}
          rows={commands}
        />
      ) : (
        <EmptyState
          description={t("gatewayCommands.emptyDescription")}
          title={t("common.emptyTitle")}
        />
      )}
      <Drawer
        opened={Boolean(selected)}
        onClose={() => setSelected(undefined)}
        position="right"
        size="lg"
        title={t("gatewayCommands.detailTitle")}
      >
        {selected ? (
          <Stack>
            <Text fw={600}>{selected.gateway.serialNumber}</Text>
            <Badge color={statusColor(selected.status)}>{selected.status}</Badge>
            <Text size="sm">
              {t("gatewayCommands.requestId")}: {commandRequestId(selected)}
            </Text>
            <Text size="sm">
              {t("gatewayCommands.cmd")}: {selected.commandNumber}
            </Text>
            <Text size="sm">
              {t("gatewayCommands.topic")}: {selected.topic}
            </Text>
            <Text size="sm">
              {t("gatewayCommands.sentAt")}: {formatDate(selected.sentAt)}
            </Text>
            <Text size="sm">
              {t("gatewayCommands.acknowledgedAt")}: {formatDate(selected.acknowledgedAt)}
            </Text>
            <Text size="sm">
              {t("gatewayCommands.expiresAt")}: {formatDate(selected.expiresAt)}
            </Text>
            {selected.failureReason ? (
              <Text c="red" size="sm">
                {t("gatewayCommands.failureReason")}: {selected.failureReason}
              </Text>
            ) : null}
            <Text fw={600}>{t("gatewayCommands.payload")}</Text>
            <Code block>{JSON.stringify(selected.payload, null, 2)}</Code>
            <Text fw={600}>{t("gatewayCommands.response")}</Text>
            <Code block>{JSON.stringify(selected.responsePayload ?? {}, null, 2)}</Code>
          </Stack>
        ) : null}
      </Drawer>
    </Stack>
  );
}

function MqttStatusBlock({ status }: { status: MqttStatusRecord }) {
  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600}>{t("gatewayCommands.mqttStatusTitle")}</Text>
          <Group gap="xs">
            <Badge color={status.enabled ? "green" : "gray"} variant="light">
              {status.enabled ? t("gatewayCommands.enabled") : t("gatewayCommands.disabled")}
            </Badge>
            <Badge color={status.connected ? "green" : "gray"} variant="light">
              {status.connected
                ? t("gatewayCommands.connected")
                : t("gatewayCommands.disconnected")}
            </Badge>
          </Group>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <StatusField label={t("gatewayCommands.brokerHost")} value={status.brokerHost} />
          <StatusField label={t("gatewayCommands.clientId")} value={status.clientId} />
          <StatusField
            label={t("gatewayCommands.lastConnectedAt")}
            value={formatDate(status.lastConnectedAt)}
          />
          <StatusField
            label={t("gatewayCommands.lastMessageAt")}
            value={formatDate(status.lastMessageAt)}
          />
          <StatusField
            label={t("gatewayCommands.lastPublishAt")}
            value={formatDate(status.lastPublishAt)}
          />
          <StatusField label={t("gatewayCommands.lastError")} value={status.lastError ?? "-"} />
        </SimpleGrid>
        <Stack gap={4}>
          <Text c="dimmed" size="xs">
            {t("gatewayCommands.subscribedFilters")}
          </Text>
          {status.subscribedTopicFilters.length ? (
            status.subscribedTopicFilters.map((filter) => (
              <Code key={filter} block>
                {filter}
              </Code>
            ))
          ) : (
            <Text c="dimmed" size="sm">
              {t("gatewayCommands.noSubscribedFilters")}
            </Text>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

function StatusField({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text fw={500} size="sm">
        {value}
      </Text>
    </Stack>
  );
}
