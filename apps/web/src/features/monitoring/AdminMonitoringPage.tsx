import type {
  AdminMonitoringOptionsRecord,
  AdminMonitoringSummaryRecord,
  MonitoringBuildingOverview,
  MonitoringNodeStateEvent,
  MonitoringNodeStateRecord,
  MonitoringNodeTypeResponse,
  PaginatedSensorHistory,
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
import { Badge, Button, Card, Group, Paper, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import {
  IconBuilding,
  IconExternalLink,
  IconPlugConnected,
  IconPlugConnectedX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

import { readWebEnv } from "../../app/env";
import { t, tf } from "../../app/i18n";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { Can } from "../../shared/rbac/Can";
import { NodeDetailDrawer } from "./components/NodeDetailDrawer";
import { NodeStateCard } from "./components/NodeStateCard";
import { MonitoringViewToggle, type MonitoringView } from "./components/MonitoringViewToggle";
import {
  isCanonicalNodeType,
  nodeTypeOrder,
  nodeTypeText,
  upsertState,
} from "./CompanyMonitoringPage";

type RealtimeStatus = "connected" | "offline" | "reconnecting";
type StateRow = MonitoringNodeStateRecord & { id: string };

export function AdminMonitoringPage() {
  const { session } = useAuth();
  const [options, setOptions] = useState<AdminMonitoringOptionsRecord>();
  const [summary, setSummary] = useState<AdminMonitoringSummaryRecord>();
  const [buildingOverview, setBuildingOverview] = useState<MonitoringBuildingOverview>();
  const [nodeResponse, setNodeResponse] = useState<MonitoringNodeTypeResponse>();
  const [history, setHistory] = useState<PaginatedSensorHistory>();
  const [companyId, setCompanyId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [nodeType, setNodeType] = useState<string>();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [view, setView] = useState<MonitoringView>(() =>
    window.localStorage.getItem("gss.monitoring.admin.view") === "CARD" ? "CARD" : "TABLE",
  );
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("offline");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    void apiRequest<AdminMonitoringOptionsRecord>(session, "/admin/monitoring/options")
      .then(setOptions)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [session?.accessToken]);

  useEffect(() => {
    if (!session) return;
    const query = new URLSearchParams();
    if (companyId) query.set("companyId", companyId);
    if (areaId) query.set("areaId", areaId);
    if (buildingId) query.set("buildingId", buildingId);
    void apiRequest<AdminMonitoringSummaryRecord>(
      session,
      `/admin/monitoring/summary${query.toString() ? `?${query.toString()}` : ""}`,
    )
      .then(setSummary)
      .catch(() => setError(true));
  }, [areaId, buildingId, companyId, session?.accessToken]);

  useEffect(() => {
    if (!session || !buildingId) {
      setBuildingOverview(undefined);
      setNodeResponse(undefined);
      setNodeType(undefined);
      setSelectedNodeId(undefined);
      return;
    }
    void apiRequest<MonitoringBuildingOverview>(
      session,
      `/admin/monitoring/buildings/${buildingId}`,
    )
      .then((data) => {
        setBuildingOverview(data);
        setNodeType((current) => current ?? data.nodeTypes[0]?.nodeType.key);
      })
      .catch(() => setError(true));
  }, [buildingId, session?.accessToken]);

  useEffect(() => {
    if (!session || !buildingId || !nodeType || !isCanonicalNodeType(nodeType)) {
      setSelectedNodeId(undefined);
      return;
    }
    setSelectedNodeId(undefined);
    void apiRequest<MonitoringNodeTypeResponse>(
      session,
      `/admin/monitoring/buildings/${buildingId}/node-types/${nodeType}`,
    )
      .then(setNodeResponse)
      .catch(() => setError(true));
  }, [buildingId, nodeType, session?.accessToken]);

  useEffect(() => {
    if (!session || !buildingId || !nodeType || !selectedNodeId || !isCanonicalNodeType(nodeType)) {
      setHistory(undefined);
      return;
    }
    void apiRequest<PaginatedSensorHistory>(
      session,
      `/admin/monitoring/buildings/${buildingId}/node-types/${nodeType}/nodes/${selectedNodeId}/history?page=1&pageSize=25`,
    )
      .then(setHistory)
      .catch(() => setHistory(undefined));
  }, [buildingId, nodeType, selectedNodeId, session?.accessToken]);

  useEffect(() => {
    if (!session || !buildingId || !nodeType || !isCanonicalNodeType(nodeType)) {
      setRealtimeStatus("offline");
      return;
    }
    const socket = io(readWebEnv().apiBaseUrl, {
      auth: { token: session.accessToken },
      transports: ["websocket"],
    });
    setRealtimeStatus("reconnecting");
    socket.on("connect", () => {
      setRealtimeStatus("connected");
      socket.emit("monitoring:join", { buildingId, nodeType }, (ack: { ok: boolean }) => {
        if (!ack.ok) setRealtimeStatus("offline");
      });
    });
    socket.io.on("reconnect_attempt", () => setRealtimeStatus("reconnecting"));
    socket.on("disconnect", () => setRealtimeStatus("offline"));
    socket.on("monitoring:node-state", (event: MonitoringNodeStateEvent) => {
      if (event.buildingId !== buildingId || event.nodeType !== nodeType) return;
      setNodeResponse((current) =>
        current ? { ...current, states: upsertState(current.states, event.state) } : current,
      );
      setSummary((current) =>
        current
          ? { ...current, recentNodes: upsertState(current.recentNodes, event.state).slice(0, 8) }
          : current,
      );
    });
    return () => {
      socket.disconnect();
    };
  }, [buildingId, nodeType, session?.accessToken]);

  const areas = useMemo(
    () => (options?.areas ?? []).filter((area) => !companyId || area.companyId === companyId),
    [companyId, options?.areas],
  );
  const buildings = useMemo(
    () =>
      (options?.buildings ?? []).filter(
        (building) =>
          (!companyId || building.companyId === companyId) &&
          (!areaId || building.areaId === areaId),
      ),
    [areaId, companyId, options?.buildings],
  );
  const states = nodeResponse?.states ?? [];
  const stateRows = useMemo<StateRow[]>(
    () => states.map((state) => ({ ...state, id: state.nodeId })),
    [states],
  );
  const selectedNode = states.find((state) => state.nodeId === selectedNodeId);
  const realtimeLabel = t(`monitoring.realtime.${realtimeStatus}` as never);

  if (loading || !options || !summary) {
    if (error)
      return (
        <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />
      );
    return <LoadingState title={t("common.loading")} />;
  }
  if (error) {
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;
  }

  return (
    <Stack gap="lg">
      <PageHeader
        action={
          <Badge
            color={
              realtimeStatus === "connected"
                ? "gss"
                : realtimeStatus === "reconnecting"
                  ? "yellow"
                  : "gray"
            }
            leftSection={
              realtimeStatus === "connected" ? (
                <IconPlugConnected size={14} />
              ) : (
                <IconPlugConnectedX size={14} />
              )
            }
          >
            {realtimeLabel}
          </Badge>
        }
        subtitle={t("monitoring.adminSubtitle")}
        title={t("monitoring.adminTitle")}
      />
      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }}>
        <SummaryCard
          label={t("monitoring.adminNodes")}
          value={Object.values(summary.severityDistribution).reduce(
            (total, count) => total + count,
            0,
          )}
        />
        <SummaryCard label={t("monitoring.adminGatewaysOnline")} value={summary.gateways.online} />
        <SummaryCard label={t("monitoring.adminGatewaysStale")} value={summary.gateways.stale} />
        <SummaryCard
          label={t("monitoring.adminDangerNodes")}
          value={summary.severityDistribution.danger}
        />
      </SimpleGrid>
      <Paper withBorder p="md">
        <Stack gap="sm">
          <Group>
            <IconBuilding size={18} />
            <Text fw={600}>{t("monitoring.adminFilters")}</Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Select
              clearable
              data={options.companies.map((company) => ({
                label: company.name,
                value: company.id,
              }))}
              label={t("devices.company")}
              onChange={(value) => {
                setCompanyId(value ?? "");
                setAreaId("");
                setBuildingId("");
              }}
              value={companyId}
            />
            <Select
              clearable
              data={areas.map((area) => ({ label: area.name, value: area.id }))}
              disabled={!companyId}
              label={t("organizations.area")}
              onChange={(value) => {
                setAreaId(value ?? "");
                setBuildingId("");
              }}
              value={areaId}
            />
            <Select
              clearable
              data={buildings.map((building) => ({ label: building.title, value: building.id }))}
              disabled={!areaId}
              label={t("devices.building")}
              onChange={(value) => setBuildingId(value ?? "")}
              value={buildingId}
            />
          </SimpleGrid>
        </Stack>
      </Paper>
      <SeveritySummary distribution={summary.severityDistribution} />
      {!buildingId ? (
        <EmptyState
          description={t("monitoring.adminSelectBuilding")}
          title={t("monitoring.adminSelectBuildingTitle")}
        />
      ) : buildingOverview ? (
        <>
          <Group justify="space-between">
            <Text fw={600}>{buildingOverview.building.title}</Text>
            <Group>
              <Can permission="buildings.view">
                <Button
                  component="a"
                  href={`/admin/companies/${buildingOverview.building.companyId}/buildings`}
                  leftSection={<IconExternalLink size={15} />}
                  size="xs"
                  variant="light"
                >
                  {t("monitoring.adminOpenBuilding")}
                </Button>
              </Can>
              <Can permission="devices.view">
                <Button component="a" href="/admin/devices" size="xs" variant="subtle">
                  {t("monitoring.adminOpenDevices")}
                </Button>
              </Can>
            </Group>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            {nodeTypeOrder.map((type) => {
              const item = buildingOverview.nodeTypes.find((entry) => entry.nodeType.key === type);
              return (
                <NodeTypeSelectionCard
                  countLabel={tf("monitoring.count", { count: item?.count ?? 0 })}
                  description={t(nodeTypeText[type].description)}
                  imageAlt={t(nodeTypeText[type].title)}
                  imageSrc={nodeTypeText[type].image}
                  key={type}
                  onSelect={() => setNodeType(type)}
                  title={t(nodeTypeText[type].title)}
                  type={type}
                />
              );
            })}
          </SimpleGrid>
          {nodeType && states.length ? (
            <Card>
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={600}>
                    {t(nodeTypeText[nodeType as keyof typeof nodeTypeText].title)}
                  </Text>
                  <MonitoringViewToggle
                    onChange={(next) => {
                      setView(next);
                      window.localStorage.setItem("gss.monitoring.admin.view", next);
                    }}
                    value={view}
                  />
                </Group>
                {view === "CARD" ? (
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                    {states.map((state) => (
                      <NodeStateCard key={state.nodeId} onOpen={setSelectedNodeId} state={state} />
                    ))}
                  </SimpleGrid>
                ) : (
                  <DataTable
                    columns={[
                      {
                        key: "number",
                        label: t("monitoring.nodeNumber"),
                        render: (row) => row.node.number,
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
                      {
                        key: "gateway",
                        label: t("devices.gateway"),
                        render: (row) => row.gateway.serialNumber,
                      },
                      {
                        key: "open",
                        label: t("monitoring.history"),
                        render: (row) => (
                          <Button
                            onClick={() => setSelectedNodeId(row.nodeId)}
                            size="xs"
                            variant="light"
                          >
                            {t("monitoring.openHistory")}
                          </Button>
                        ),
                      },
                    ]}
                    rows={stateRows}
                  />
                )}
              </Stack>
            </Card>
          ) : (
            <EmptyState
              description={t("monitoring.adminEmptyNodeType")}
              title={t("common.emptyTitle")}
            />
          )}
          {selectedNode ? (
            <NodeDetailDrawer
              history={history}
              node={selectedNode}
              nodeType={nodeType as never}
              onClose={() => setSelectedNodeId(undefined)}
            />
          ) : null}
        </>
      ) : (
        <LoadingState title={t("common.loading")} />
      )}
      <RecentNodes nodes={summary.recentNodes} onOpen={setSelectedNodeId} />
    </Stack>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Paper withBorder p="md">
      <Text c="dimmed" size="sm">
        {label}
      </Text>
      <Text fw={700} size="xl">
        {value}
      </Text>
    </Paper>
  );
}

function SeveritySummary({
  distribution,
}: {
  distribution: AdminMonitoringSummaryRecord["severityDistribution"];
}) {
  return (
    <Group gap="xs">
      {Object.entries(distribution).map(([status, count]) => (
        <Badge key={status} variant="light">
          {t(`status.${status}` as never)}: {count}
        </Badge>
      ))}
    </Group>
  );
}

function RecentNodes({
  nodes,
  onOpen,
}: {
  nodes: MonitoringNodeStateRecord[];
  onOpen: (nodeId: string) => void;
}) {
  if (!nodes.length) return null;
  const rows = nodes.map((node) => ({ ...node, id: node.nodeId }));
  return (
    <Card>
      <Stack gap="sm">
        <Text fw={600}>{t("monitoring.adminRecentNodes")}</Text>
        <DataTable
          columns={[
            { key: "node", label: t("monitoring.nodeNumber"), render: (row) => row.node.number },
            {
              key: "status",
              label: t("monitoring.latestStatus"),
              render: (row) => (
                <StatusBadge label={t(`status.${row.status}` as never)} status={row.status} />
              ),
            },
            {
              key: "open",
              label: t("monitoring.history"),
              render: (row) => (
                <Button onClick={() => onOpen(row.nodeId)} size="xs" variant="subtle">
                  {t("monitoring.openHistory")}
                </Button>
              ),
            },
          ]}
          rows={rows}
        />
      </Stack>
    </Card>
  );
}
