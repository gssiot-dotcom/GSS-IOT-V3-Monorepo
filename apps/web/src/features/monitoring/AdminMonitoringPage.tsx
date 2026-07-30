import type {
  AdminMonitoringOptionsRecord,
  AdminMonitoringSummaryRecord,
  CollectionPageSize,
  MonitoringBuildingOverview,
  MonitoringNodeStateEvent,
  MonitoringNodeStateRecord,
  MonitoringNodeTypeResponse,
  PaginatedSensorHistory,
  SensorHistoryChartResponse,
} from "@gss-iot/contracts";
import {
  DataTable,
  DashboardSection,
  EntityActionMenu,
  EmptyState,
  ErrorState,
  LoadingState,
  NodeTypeSelectionCard,
  OperationalSummaryCard,
  PageHeader,
  RealtimeStatusBadge,
  StatusBadge,
  WorkspaceTabs,
} from "@gss-iot/ui";
import { Box, Button, Card, Group, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import {
  IconBuilding,
  IconCircleCheck,
  IconExternalLink,
  IconAlertTriangle,
  IconActivity,
  IconPlugConnected,
  IconPlugConnectedX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

import { readWebEnv } from "../../app/env";
import { t, tf, tx } from "../../app/i18n";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { Can } from "../../shared/rbac/Can";
import { hasPermission } from "../../shared/rbac/has-permission";
import { BuildingImageViewerPanel } from "./components/BuildingImageViewer";
import { NodeDetailDrawer } from "./components/NodeDetailDrawer";
import { NodeStateCard } from "./components/NodeStateCard";
import { MonitoringViewToggle, type MonitoringView } from "./components/MonitoringViewToggle";
import { useNodeHistoryRange } from "./components/useNodeHistoryRange";
import {
  isCanonicalNodeType,
  nodeTypeOrder,
  nodeTypeText,
  NodeStateMobileList,
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
  const [historyChart, setHistoryChart] = useState<SensorHistoryChartResponse>();
  const [workspaceTab, setWorkspaceTab] = useState<"plan-image" | "real-image" | "states">(
    "states",
  );
  const [historyError, setHistoryError] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState<CollectionPageSize>(50);
  const [companyId, setCompanyId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [nodeType, setNodeType] = useState<string>();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const historyRange = useNodeHistoryRange(selectedNodeId);
  const [view, setView] = useState<MonitoringView>(() =>
    window.localStorage.getItem("gss.monitoring.admin.view") === "CARD" ? "CARD" : "TABLE",
  );
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("offline");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyRange.range.from, historyRange.range.to, selectedNodeId]);

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
      setHistoryChart(undefined);
      return;
    }
    const query = new URLSearchParams({
      from: historyRange.range.from,
      page: String(historyPage),
      pageSize: String(historyPageSize),
      to: historyRange.range.to,
    });
    const chartQuery = new URLSearchParams({
      from: historyRange.range.from,
      to: historyRange.range.to,
    });
    setHistoryLoading(true);
    setHistoryError(false);
    void Promise.all([
      apiRequest<PaginatedSensorHistory>(
        session,
        `/admin/monitoring/buildings/${buildingId}/node-types/${nodeType}/nodes/${selectedNodeId}/history?${query.toString()}`,
      ),
      apiRequest<SensorHistoryChartResponse>(
        session,
        `/admin/monitoring/buildings/${buildingId}/node-types/${nodeType}/nodes/${selectedNodeId}/history/chart?${chartQuery.toString()}`,
      ),
    ])
      .then(([table, chart]) => {
        setHistory(table);
        setHistoryChart(chart);
      })
      .catch(() => {
        setHistory(undefined);
        setHistoryChart(undefined);
        setHistoryError(true);
      })
      .finally(() => setHistoryLoading(false));
  }, [
    buildingId,
    historyRange.range.from,
    historyRange.range.to,
    historyPage,
    historyPageSize,
    nodeType,
    selectedNodeId,
    session?.accessToken,
  ]);

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
  const canViewBuildingImages = hasPermission(session, "building-plans.view");
  const realtimeLabel = tx(`monitoring.realtime.${realtimeStatus}`, realtimeStatus);

  useEffect(() => {
    setWorkspaceTab("states");
  }, [buildingId, nodeType]);

  useEffect(() => {
    if (!canViewBuildingImages && workspaceTab !== "states") setWorkspaceTab("states");
  }, [canViewBuildingImages, workspaceTab]);

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
          <Box visibleFrom="sm">
            <RealtimeStatusBadge label={realtimeLabel} status={realtimeStatus} />
          </Box>
        }
        subtitle={t("monitoring.adminSubtitle")}
        title={t("monitoring.adminTitle")}
      />
      <Box className="gss-monitoring-summary-grid" data-testid="admin-monitoring-summary-grid">
        <OperationalSummaryCard
          accent="blue"
          icon={<IconActivity size={18} />}
          label={t("monitoring.adminNodes")}
          value={Object.values(summary.severityDistribution).reduce(
            (total, count) => total + count,
            0,
          )}
        />
        <OperationalSummaryCard
          accent="cyan"
          icon={<IconPlugConnected size={18} />}
          label={t("dashboard.gateways")}
          value={summary.gateways.total}
        />
        <OperationalSummaryCard
          accent="teal"
          helper={<span className="gss-status-online">{t("status.online")}</span>}
          icon={<IconPlugConnected size={18} />}
          label={t("monitoring.adminGatewaysOnline")}
          value={<span className="gss-status-online">{summary.gateways.online}</span>}
        />
        <OperationalSummaryCard
          accent="neutral"
          helper={<span className="gss-status-offline">{t("status.offline")}</span>}
          icon={<IconPlugConnectedX size={18} />}
          label={t("monitoring.adminGatewaysStale")}
          value={<span className="gss-status-stale">{summary.gateways.stale}</span>}
        />
        {(["safe", "caution", "warning", "danger", "offline"] as const).map((status) => (
          <OperationalSummaryCard
            accent={status === "safe" ? "teal" : status === "danger" ? "neutral" : "indigo"}
            helper={<span className={`gss-status-${status}`}>{t(`status.${status}`)}</span>}
            icon={
              status === "safe" ? <IconCircleCheck size={18} /> : <IconAlertTriangle size={18} />
            }
            key={status}
            label={t(`status.${status}`)}
            value={
              <span className={`gss-status-${status}`}>
                {summary.severityDistribution[status] ?? 0}
              </span>
            }
          />
        ))}
      </Box>
      <DashboardSection
        accent="blue"
        icon={<IconBuilding size={18} />}
        title={t("monitoring.adminFilters")}
      >
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
      </DashboardSection>
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
          {nodeType && (states.length || canViewBuildingImages) ? (
            <Card>
              <Stack gap="md">
                <Group justify="space-between">
                  <WorkspaceTabs
                    ariaLabel={t("monitoring.title")}
                    items={[
                      { label: t("monitoring.latestStates"), value: "states" },
                      ...(canViewBuildingImages
                        ? [
                            { label: t("monitoring.buildingPlanImage"), value: "plan-image" },
                            { label: t("monitoring.realImage"), value: "real-image" },
                          ]
                        : []),
                    ]}
                    onChange={(value) =>
                      setWorkspaceTab(value as "plan-image" | "real-image" | "states")
                    }
                    value={workspaceTab}
                  />
                  {workspaceTab === "states" ? (
                    <MonitoringViewToggle
                      onChange={(next) => {
                        setView(next);
                        window.localStorage.setItem("gss.monitoring.admin.view", next);
                      }}
                      value={view}
                    />
                  ) : null}
                </Group>
                {workspaceTab === "plan-image" || workspaceTab === "real-image" ? (
                  <BuildingImageViewerPanel
                    basePath="/admin"
                    buildingId={buildingId}
                    kind={workspaceTab === "plan-image" ? "PLAN" : "REAL"}
                  />
                ) : !states.length ? (
                  <EmptyState
                    description={t("monitoring.emptyNodes")}
                    title={t("common.emptyTitle")}
                  />
                ) : view === "CARD" ? (
                  <SimpleGrid
                    cols={{ base: 1, xs: 2, sm: 3, lg: 5 }}
                    data-testid="monitoring-node-grid"
                    spacing="sm"
                  >
                    {states.map((state) => (
                      <NodeStateCard key={state.nodeId} onOpen={setSelectedNodeId} state={state} />
                    ))}
                  </SimpleGrid>
                ) : (
                  <>
                    <Box hiddenFrom="sm">
                      <NodeStateMobileList onOpen={setSelectedNodeId} rows={states} />
                    </Box>
                    <Box visibleFrom="sm">
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
                                label={tx(`status.${row.status}`, row.status)}
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
                              <EntityActionMenu
                                ariaLabel={`${t("common.moreActions")}: ${row.node.number}`}
                                items={[
                                  {
                                    key: "history",
                                    label: t("monitoring.openHistory"),
                                    onClick: () => setSelectedNodeId(row.nodeId),
                                  },
                                ]}
                              />
                            ),
                          },
                        ]}
                        rows={stateRows}
                      />
                    </Box>
                  </>
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
              chart={historyChart}
              date={historyRange.date}
              history={history}
              historyError={historyError}
              hours={historyRange.hours}
              loadingHistory={historyLoading}
              maxDate={historyRange.maxDate}
              mode={historyRange.mode}
              node={selectedNode}
              nodeType={nodeType as never}
              onClose={() => setSelectedNodeId(undefined)}
              onDateChange={historyRange.setDate}
              onHoursChange={historyRange.setHours}
              onHistoryPageChange={setHistoryPage}
              onHistoryPageSizeChange={(value) => {
                setHistoryPageSize(value);
                setHistoryPage(1);
              }}
              onModeChange={historyRange.setMode}
              range={historyRange.range}
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

function SeveritySummary({
  distribution,
}: {
  distribution: AdminMonitoringSummaryRecord["severityDistribution"];
}) {
  return (
    <Group gap="xs">
      {Object.entries(distribution).map(([status, count]) => (
        <StatusBadge
          key={status}
          label={`${tx(`status.${status}`, status)}: ${count}`}
          status={status as never}
        />
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
    <DashboardSection
      accent="teal"
      icon={<IconActivity size={18} />}
      title={t("monitoring.adminRecentNodes")}
    >
      <DataTable
        columns={[
          { key: "node", label: t("monitoring.nodeNumber"), render: (row) => row.node.number },
          {
            key: "status",
            label: t("monitoring.latestStatus"),
            render: (row) => (
              <StatusBadge label={tx(`status.${row.status}`, row.status)} status={row.status} />
            ),
          },
          {
            key: "open",
            label: t("monitoring.history"),
            render: (row) => (
              <EntityActionMenu
                ariaLabel={`${t("common.moreActions")}: ${row.node.number}`}
                items={[
                  {
                    key: "history",
                    label: t("monitoring.openHistory"),
                    onClick: () => onOpen(row.nodeId),
                  },
                ]}
              />
            ),
          },
        ]}
        rows={rows}
      />
    </DashboardSection>
  );
}
