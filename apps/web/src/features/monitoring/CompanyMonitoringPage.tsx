import type {
  BuildingRecord,
  CanonicalNodeType,
  MonitoringBuildingOverview,
  MonitoringNodeStateEvent,
  MonitoringNodeStateRecord,
  MonitoringNodeTypeResponse,
  PaginatedSensorHistory,
  SensorValues,
} from "@gss-iot/contracts";
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  NodeTypeSelectionCard,
  PageHeader,
  StatusBadge,
} from "@gss-iot/ui";
import { Badge, Button, Group, SimpleGrid, Stack, Tabs, Text } from "@mantine/core";
import { IconHistory, IconPlugConnected, IconPlugConnectedX } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";

import { readWebEnv } from "../../app/env";
import { t, tf } from "../../app/i18n";
import type { TranslationKey } from "../../app/i18n";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";

type RealtimeStatus = "connected" | "offline" | "reconnecting";
type StateRow = MonitoringNodeStateRecord & { id: string };

const nodeTypeOrder: CanonicalNodeType[] = ["door_node", "angle_node", "gangform_node"];

const nodeTypeText: Record<
  CanonicalNodeType,
  { description: TranslationKey; image: string; title: TranslationKey }
> = {
  angle_node: {
    description: "monitoring.angleDescription",
    image: "/assets/legacy-node-types/angle-node.png",
    title: "monitoring.angleTitle",
  },
  door_node: {
    description: "monitoring.doorDescription",
    image: "/assets/legacy-node-types/door-node.png",
    title: "monitoring.doorTitle",
  },
  gangform_node: {
    description: "monitoring.gangformDescription",
    image: "/assets/legacy-node-types/gangform.png",
    title: "monitoring.gangformTitle",
  },
} as const;

export function CompanyMonitoringIndexPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [buildings, setBuildings] = useState<BuildingRecord[]>();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session) return;
    setError(false);
    void apiRequest<BuildingRecord[]>(session, "/company/buildings")
      .then(setBuildings)
      .catch(() => setError(true));
  }, [session]);

  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;
  if (!buildings) return <LoadingState title={t("common.loading")} />;

  return (
    <Stack gap="lg">
      <PageHeader title={t("monitoring.title")} subtitle={t("monitoring.indexSubtitle")} />
      {buildings.length ? (
        <DataTable
          columns={[
            { key: "title", label: t("organizations.building"), render: (row) => row.title },
            { key: "status", label: t("organizations.status"), render: (row) => row.status },
            {
              key: "open",
              label: t("organizations.actions"),
              render: (row) => (
                <Button
                  leftSection={<IconPlugConnected size={16} />}
                  onClick={() => navigate(`/company/buildings/${row.id}/monitoring`)}
                  size="xs"
                  variant="light"
                >
                  {t("monitoring.open")}
                </Button>
              ),
            },
          ]}
          rows={buildings}
        />
      ) : (
        <EmptyState description={t("monitoring.emptyBuildings")} title={t("common.emptyTitle")} />
      )}
    </Stack>
  );
}

export function BuildingMonitoringPage() {
  const { buildingId } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<MonitoringBuildingOverview>();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session || !buildingId) return;
    setError(false);
    void apiRequest<MonitoringBuildingOverview>(
      session,
      `/company/buildings/${buildingId}/monitoring`,
    )
      .then(setOverview)
      .catch(() => setError(true));
  }, [buildingId, session]);

  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;
  if (!overview || !buildingId) return <LoadingState title={t("common.loading")} />;

  return (
    <Stack gap="lg">
      <PageHeader title={overview.building.title} subtitle={t("monitoring.nodeCardsSubtitle")} />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {nodeTypeOrder.map((type) => {
          const summary = overview.nodeTypes.find((item) => item.nodeType.key === type);
          return (
            <NodeTypeSelectionCard
              countLabel={tf("monitoring.count", { count: summary?.count ?? 0 })}
              description={t(nodeTypeText[type].description)}
              imageAlt={t(nodeTypeText[type].title)}
              imageSrc={nodeTypeText[type].image}
              key={type}
              onSelect={() => navigate(`/company/buildings/${buildingId}/monitoring/${type}`)}
              title={t(nodeTypeText[type].title)}
              type={type}
            />
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}

export function NodeTypeMonitoringPage() {
  const { buildingId, nodeType } = useParams();
  const canonicalNodeType = isCanonicalNodeType(nodeType) ? nodeType : undefined;
  const { session } = useAuth();
  const [response, setResponse] = useState<MonitoringNodeTypeResponse>();
  const [history, setHistory] = useState<PaginatedSensorHistory>();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("offline");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session || !buildingId || !canonicalNodeType) return;
    setError(false);
    void apiRequest<MonitoringNodeTypeResponse>(
      session,
      `/company/buildings/${buildingId}/monitoring/${canonicalNodeType}`,
    )
      .then((data) => {
        setResponse(data);
        setSelectedNodeId((current) => current ?? data.states[0]?.nodeId);
      })
      .catch(() => setError(true));
  }, [buildingId, canonicalNodeType, session]);

  useEffect(() => {
    if (!session || !buildingId || !canonicalNodeType) return;
    const socket = io(readWebEnv().apiBaseUrl, {
      auth: { token: session.accessToken },
      transports: ["websocket"],
    });
    setRealtimeStatus("reconnecting");
    socket.on("connect", () => {
      setRealtimeStatus("connected");
      socket.emit(
        "monitoring:join",
        { buildingId, nodeType: canonicalNodeType },
        (ack: { ok: boolean }) => {
          if (!ack.ok) setRealtimeStatus("offline");
        },
      );
    });
    socket.io.on("reconnect_attempt", () => setRealtimeStatus("reconnecting"));
    socket.on("disconnect", () => setRealtimeStatus("offline"));
    socket.on("monitoring:node-state", (event: MonitoringNodeStateEvent) => {
      if (event.buildingId !== buildingId || event.nodeType !== canonicalNodeType) return;
      setResponse((current) =>
        current
          ? {
              ...current,
              states: upsertState(current.states, event.state),
            }
          : current,
      );
    });
    return () => {
      socket.disconnect();
    };
  }, [buildingId, canonicalNodeType, session]);

  useEffect(() => {
    if (!session || !buildingId || !canonicalNodeType || !selectedNodeId) return;
    void apiRequest<PaginatedSensorHistory>(
      session,
      `/company/buildings/${buildingId}/monitoring/${canonicalNodeType}/nodes/${selectedNodeId}/history?page=1&pageSize=25`,
    )
      .then(setHistory)
      .catch(() => setHistory(undefined));
  }, [buildingId, canonicalNodeType, selectedNodeId, session]);

  const rows = useMemo<StateRow[]>(
    () => response?.states.map((state) => ({ ...state, id: state.nodeId })) ?? [],
    [response],
  );

  if (error || !canonicalNodeType)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;
  if (!response) return <LoadingState title={t("common.loading")} />;

  return (
    <Stack gap="lg">
      <PageHeader
        title={t(nodeTypeText[canonicalNodeType].title)}
        subtitle={tf("monitoring.nodeTypeSubtitle", { building: response.building.title })}
        action={<RealtimeBadge status={realtimeStatus} />}
      />
      {rows.length ? (
        <Tabs defaultValue="states">
          <Tabs.List>
            <Tabs.Tab value="states">{t("monitoring.latestStates")}</Tabs.Tab>
            <Tabs.Tab value="history">{t("monitoring.history")}</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel pt="md" value="states">
            <DataTable
              columns={[
                {
                  key: "number",
                  label: t("monitoring.nodeNumber"),
                  render: (row) => row.node.number,
                },
                {
                  key: "value",
                  label: t("monitoring.latestValue"),
                  render: (row) => renderValues(row.values),
                },
                {
                  key: "status",
                  label: t("monitoring.latestStatus"),
                  render: (row) => (
                    <StatusBadge label={t(statusKey(row.status))} status={row.status} />
                  ),
                },
                {
                  key: "gateway",
                  label: t("devices.gateway"),
                  render: (row) => row.gateway.serialNumber,
                },
                {
                  key: "age",
                  label: t("monitoring.valueAge"),
                  render: (row) => formatAge(row.lastSeenAt),
                },
                {
                  key: "history",
                  label: t("monitoring.history"),
                  render: (row) => (
                    <Button
                      leftSection={<IconHistory size={16} />}
                      onClick={() => setSelectedNodeId(row.nodeId)}
                      size="xs"
                      variant={row.nodeId === selectedNodeId ? "filled" : "light"}
                    >
                      {t("monitoring.openHistory")}
                    </Button>
                  ),
                },
              ]}
              rows={rows}
            />
          </Tabs.Panel>
          <Tabs.Panel pt="md" value="history">
            <HistoryTable history={history} />
          </Tabs.Panel>
        </Tabs>
      ) : (
        <EmptyState description={t("monitoring.emptyNodes")} title={t("common.emptyTitle")} />
      )}
      <Text c="dimmed" size="sm">
        {tf("monitoring.retention", { days: response.historyRetentionDays })}
      </Text>
    </Stack>
  );
}

function RealtimeBadge({ status }: { status: RealtimeStatus }) {
  const connected = status === "connected";
  return (
    <Badge
      color={connected ? "gss" : status === "reconnecting" ? "yellow" : "gray"}
      leftSection={connected ? <IconPlugConnected size={12} /> : <IconPlugConnectedX size={12} />}
      variant="light"
    >
      {t(realtimeKey(status))}
    </Badge>
  );
}

function HistoryTable({ history }: { history?: PaginatedSensorHistory }) {
  if (!history) return <LoadingState title={t("common.loading")} />;
  if (!history.items.length)
    return <EmptyState description={t("monitoring.emptyHistory")} title={t("common.emptyTitle")} />;
  return (
    <Stack>
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
            render: (row) => renderValues(row.values),
          },
          {
            key: "status",
            label: t("monitoring.latestStatus"),
            render: (row) => <StatusBadge label={t(statusKey(row.status))} status={row.status} />,
          },
        ]}
        rows={history.items}
      />
      <Group justify="space-between">
        <Text c="dimmed" size="sm">
          {tf("monitoring.historyRange", { count: history.items.length, total: history.total })}
        </Text>
      </Group>
    </Stack>
  );
}

function renderValues(values: SensorValues): string {
  if ("doorState" in values) {
    const battery = values.batteryLevel === null ? "-" : `${values.batteryLevel}%`;
    return `${t(doorStateKey(values.doorState))} / ${battery}`;
  }
  return `X ${values.angleX}, Y ${values.angleY}`;
}

function formatAge(lastSeenAt: string): string {
  const timestamp = new Date(lastSeenAt).getTime();
  if (timestamp === 0) return t("status.offline");
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return tf("monitoring.ageSeconds", { count: seconds });
  return tf("monitoring.ageMinutes", { count: Math.floor(seconds / 60) });
}

function upsertState(
  states: MonitoringNodeStateRecord[],
  next: MonitoringNodeStateRecord,
): MonitoringNodeStateRecord[] {
  const index = states.findIndex((state) => state.nodeId === next.nodeId);
  if (index === -1) return [next, ...states];
  return states.map((state, currentIndex) => (currentIndex === index ? next : state));
}

function isCanonicalNodeType(value: string | undefined): value is CanonicalNodeType {
  return value === "door_node" || value === "angle_node" || value === "gangform_node";
}

function statusKey(status: string): TranslationKey {
  return `status.${status}` as TranslationKey;
}

function realtimeKey(status: RealtimeStatus): TranslationKey {
  return `monitoring.realtime.${status}` as TranslationKey;
}

function doorStateKey(status: "closed" | "open"): TranslationKey {
  return `monitoring.doorState.${status}` as TranslationKey;
}
