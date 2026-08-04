import type {
  CollectionPageSize,
  GatewayCommandRecord,
  MqttStatusRecord,
  PaginatedResponse,
} from "@gss-iot/contracts";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import {
  ConfirmActionModal,
  CollectionPagination,
  DataTable,
  DataToolbar,
  EmptyState,
  EntityActionMenu,
  EntityPrimaryCell,
  EntityStatusBadge,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@gss-iot/ui";
import { Code, Drawer, Group, Paper, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconEye, IconPlayerPause, IconRefresh } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { formatDateTime, t, tf } from "../../app/i18n";
import { useAuth } from "../../shared/auth/auth-context";
import { hasPermission } from "../../shared/rbac/has-permission";
import { useApiMutation, useApiQuery } from "../../shared/query/api-query";
import { queryKeys } from "../../shared/query/query-keys";
import { useCollectionSearchParams } from "../../shared/url/collection-search-params";

function commandStatus(
  status: GatewayCommandRecord["status"],
): Parameters<typeof EntityStatusBadge>[0]["status"] {
  if (status === "ACKNOWLEDGED") return "acknowledged";
  if (status === "FAILED") return "failed";
  if (status === "EXPIRED" || status === "CANCELLED") return "cancelled";
  if (status === "SENT") return "sent";
  return "pending";
}

function commandStatusLabel(status: GatewayCommandRecord["status"]): string {
  if (status === "ACKNOWLEDGED") return t("status.acknowledged");
  if (status === "FAILED") return t("status.failed");
  if (status === "EXPIRED") return t("status.expired");
  if (status === "CANCELLED") return t("status.cancelled");
  if (status === "SENT") return t("status.sent");
  return t("status.pending");
}

function commandTypeLabel(commandType: GatewayCommandRecord["commandType"]): string {
  if (commandType === "REGISTER_NODES") return t("gatewayCommands.commandTypeLabel.REGISTER_NODES");
  if (commandType === "WAKE_SECURITY") return t("gatewayCommands.commandTypeLabel.WAKE_SECURITY");
  if (commandType === "SET_ALARM_LEVELS")
    return t("gatewayCommands.commandTypeLabel.SET_ALARM_LEVELS");
  return t("gatewayCommands.commandTypeLabel.SET_FAULT_FILTER");
}

function formatDate(value: string | null) {
  return value ? formatDateTime(value) : t("common.notAvailable");
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
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<GatewayCommandRecord>();
  const { page, pageSize, searchParams, setPage, setPageSize, update } =
    useCollectionSearchParams();
  const requestedStatus = searchParams.get("status");
  const statusFilter =
    requestedStatus &&
    ["PENDING", "SENT", "ACKNOWLEDGED", "FAILED", "EXPIRED", "CANCELLED"].includes(requestedStatus)
      ? (requestedStatus as GatewayCommandRecord["status"])
      : "ALL";
  const [pendingMutation, setPendingMutation] = useState<
    { action: "cancel" | "retry"; command: GatewayCommandRecord } | undefined
  >();
  const [isMutating, setIsMutating] = useState(false);
  const [actionError, setActionError] = useState("");
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (statusFilter !== "ALL") params.set("status", statusFilter);
  const userId = session?.user.id ?? "anonymous";
  const commandsKey = queryKeys.admin.resource(userId, "gateway-commands", "list", {
    page,
    pageSize,
    status: statusFilter,
  });
  const commandsQuery = useApiQuery<PaginatedResponse<GatewayCommandRecord>>(
    session,
    commandsKey,
    `/admin/gateway-commands?${params.toString()}`,
    {
      placeholderData: keepPreviousData,
      refetchInterval: (query) =>
        query.state.data?.items.some((command) => isActiveCommand(command)) ? 2_000 : false,
    },
  );
  const mqttStatusQuery = useApiQuery<MqttStatusRecord>(
    session,
    queryKeys.admin.resource(userId, "gateway-commands", "mqtt-status"),
    "/admin/gateway-commands/mqtt-status",
  );
  const commands = commandsQuery.data?.items;
  const total = commandsQuery.data?.total ?? 0;
  const mqttStatus = mqttStatusQuery.data;
  const mutation = useApiMutation<GatewayCommandRecord>(session);

  useEffect(() => {
    setSelected((current) =>
      current && commands
        ? (commands.find((command) => command.id === current.id) ?? current)
        : current,
    );
  }, [commands]);

  const mutate = async (command: GatewayCommandRecord, action: "cancel" | "retry") => {
    if (!session) return;
    const updated = await mutation.mutateAsync({
      path: `/admin/gateway-commands/${command.id}/${action}`,
      options: { method: "POST" },
    });
    setSelected(updated);
    queryClient.setQueryData<PaginatedResponse<GatewayCommandRecord>>(commandsKey, (current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.id === updated.id ? updated : item)),
          }
        : current,
    );
  };

  const filteredCommands = commands;

  const commandActionMenu = (row: GatewayCommandRecord) => {
    const items = [
      {
        icon: <IconEye size={16} />,
        key: "inspect",
        label: t("gatewayCommands.inspectPayload"),
        onClick: () => setSelected(row),
      },
      ...(hasPermission(session, "mqtt-commands.manage") && row.status === "FAILED"
        ? [
            {
              icon: <IconRefresh size={16} />,
              key: "retry",
              label: t("gatewayCommands.retry"),
              onClick: () => setPendingMutation({ action: "retry", command: row }),
            },
          ]
        : []),
      ...(hasPermission(session, "mqtt-commands.manage") &&
      (row.status === "PENDING" || row.status === "FAILED")
        ? [
            {
              color: "red" as const,
              destructive: true,
              icon: <IconPlayerPause size={16} />,
              key: "cancel",
              label: t("gatewayCommands.cancel"),
              onClick: () => setPendingMutation({ action: "cancel", command: row }),
            },
          ]
        : []),
    ] satisfies Parameters<typeof EntityActionMenu>[0]["items"];

    return (
      <EntityActionMenu
        ariaLabel={`${t("common.moreActions")}: ${row.gateway.serialNumber} ${row.commandNumber}`}
        items={items}
      />
    );
  };

  const confirmMutation = async () => {
    if (!pendingMutation) return;
    setIsMutating(true);
    setActionError("");
    try {
      await mutate(pendingMutation.command, pendingMutation.action);
      setPendingMutation(undefined);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("settings.actionFailed"));
    } finally {
      setIsMutating(false);
    }
  };

  if (commandsQuery.isError || mqttStatusQuery.isError)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;
  if (!commands || !mqttStatus) return <LoadingState title={t("common.loading")} />;

  return (
    <Stack gap="lg">
      <PageHeader title={t("gatewayCommands.title")} subtitle={t("gatewayCommands.subtitle")} />
      <MqttStatusBlock status={mqttStatus} />
      {actionError ? <Text c="red">{actionError}</Text> : null}
      {commands.length ? (
        <Stack gap="md">
          <CollectionPagination
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(Number(value) as CollectionPageSize);
            }}
            page={page}
            pageSize={pageSize}
            pageSizeLabel={t("table.pageSize")}
            rangeLabel={tf("table.range", {
              from: total === 0 ? 0 : (page - 1) * pageSize + 1,
              to: Math.min(page * pageSize, total),
              total,
            })}
            totalPages={Math.max(1, Math.ceil(total / pageSize))}
          />
          <DataToolbar>
            <Text c="dimmed" size="sm">
              {filteredCommands?.length ?? 0} / {total} {t("gatewayCommands.title")}
            </Text>
            <Select
              aria-label={t("gatewayCommands.status")}
              data={[
                { label: t("common.all"), value: "ALL" },
                ...(
                  ["PENDING", "SENT", "ACKNOWLEDGED", "FAILED", "EXPIRED", "CANCELLED"] as const
                ).map((status) => ({ label: commandStatusLabel(status), value: status })),
              ]}
              onChange={(value) => {
                update({ page: 1, status: value === "ALL" ? null : value });
              }}
              value={statusFilter}
            />
          </DataToolbar>
          {filteredCommands?.length ? (
            <DataTable
              ariaLabel={t("gatewayCommands.title")}
              columns={[
                {
                  key: "identity",
                  label: t("gatewayCommands.gateway"),
                  render: (row) => (
                    <EntityPrimaryCell
                      identifier={commandTypeLabel(row.commandType)}
                      title={row.gateway.serialNumber}
                    />
                  ),
                },
                {
                  key: "status",
                  label: t("gatewayCommands.status"),
                  render: (row) => (
                    <EntityStatusBadge
                      label={commandStatusLabel(row.status)}
                      status={commandStatus(row.status)}
                    />
                  ),
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
                  key: "timing",
                  label: t("gatewayCommands.timing"),
                  render: (row) => formatDate(row.acknowledgedAt ?? row.sentAt),
                },
                {
                  key: "requester",
                  label: t("gatewayCommands.requester"),
                  render: (row) => row.requesterType,
                },
                {
                  key: "actions",
                  label: t("organizations.actions"),
                  align: "right",
                  render: commandActionMenu,
                },
              ]}
              density="compact"
              rows={filteredCommands}
            />
          ) : (
            <EmptyState description={t("common.emptyDescription")} title={t("common.emptyTitle")} />
          )}
        </Stack>
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
            <EntityStatusBadge
              label={commandStatusLabel(selected.status)}
              status={commandStatus(selected.status)}
            />
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
      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={
          pendingMutation?.action === "retry"
            ? t("gatewayCommands.retry")
            : t("gatewayCommands.cancel")
        }
        description={
          pendingMutation?.action === "retry"
            ? t("gatewayCommands.retryImpact")
            : t("gatewayCommands.cancelImpact")
        }
        entityName={
          pendingMutation
            ? `${pendingMutation.command.gateway.serialNumber} · ${pendingMutation.command.commandNumber}`
            : ""
        }
        loading={isMutating}
        onClose={() => setPendingMutation(undefined)}
        onConfirm={() => void confirmMutation()}
        opened={Boolean(pendingMutation)}
        title={
          pendingMutation?.action === "retry"
            ? t("gatewayCommands.retryConfirm").replace(
                "{label}",
                pendingMutation?.command.gateway.serialNumber ?? "",
              )
            : t("gatewayCommands.cancelConfirm").replace(
                "{label}",
                pendingMutation?.command.gateway.serialNumber ?? "",
              )
        }
      />
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
            <EntityStatusBadge
              label={status.enabled ? t("gatewayCommands.enabled") : t("gatewayCommands.disabled")}
              status={status.enabled ? "active" : "inactive"}
            />
            <EntityStatusBadge
              label={
                status.connected
                  ? t("gatewayCommands.connected")
                  : t("gatewayCommands.disconnected")
              }
              status={status.connected ? "online" : "offline"}
            />
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
        {!status.connected ? (
          <Text c="dimmed" size="sm">
            {t("gatewayCommands.offlineExplanation")}
          </Text>
        ) : null}
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
