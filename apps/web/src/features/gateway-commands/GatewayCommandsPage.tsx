import type { GatewayCommandRecord } from "@gss-iot/contracts";
import { DataTable, EmptyState, ErrorState, LoadingState, PageHeader } from "@gss-iot/ui";
import { Badge, Button, Drawer, Group, Stack, Text, Code } from "@mantine/core";
import { useEffect, useState } from "react";

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

export function GatewayCommandsPage() {
  const { session } = useAuth();
  const [commands, setCommands] = useState<GatewayCommandRecord[]>();
  const [selected, setSelected] = useState<GatewayCommandRecord>();
  const [error, setError] = useState(false);

  const load = async () => {
    if (!session) return;
    setError(false);
    try {
      setCommands(await apiRequest<GatewayCommandRecord[]>(session, "/admin/gateway-commands"));
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    void load();
  }, [session]);

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

  if (!commands) return <LoadingState title={t("common.loading")} />;
  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;

  return (
    <Stack gap="lg">
      <PageHeader title={t("gatewayCommands.title")} subtitle={t("gatewayCommands.subtitle")} />
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
