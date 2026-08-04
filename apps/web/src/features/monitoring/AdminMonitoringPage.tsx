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
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { useSearchParams } from "react-router-dom";

import { readWebEnv } from "../../app/env";
import { t, tf, tx } from "../../app/i18n";
import { useAuth } from "../../shared/auth/auth-context";
import { refreshSession } from "../../shared/auth/auth-api";
import { Can } from "../../shared/rbac/Can";
import { hasPermission } from "../../shared/rbac/has-permission";
import { REFERENCE_STALE_TIME, useApiQuery } from "../../shared/query/api-query";
import { queryKeys } from "../../shared/query/query-keys";
import { usePortalUiStore } from "../../shared/state/portal-ui-store";
import { BuildingImageViewerPanel } from "./components/BuildingImageViewer";
import { NodeDetailDrawer } from "./components/NodeDetailDrawer";
import { NodeStateCard } from "./components/NodeStateCard";
import { MonitoringViewToggle } from "./components/MonitoringViewToggle";
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

function adminMonitoringSummaryPath(filters: {
  areaId: string;
  buildingId: string;
  companyId: string;
}): string {
  const query = new URLSearchParams();
  if (filters.companyId) query.set("companyId", filters.companyId);
  if (filters.areaId) query.set("areaId", filters.areaId);
  if (filters.buildingId) query.set("buildingId", filters.buildingId);
  return `/admin/monitoring/summary${query.size ? `?${query.toString()}` : ""}`;
}

export function AdminMonitoringPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workspaceTab, setWorkspaceTab] = useState<"plan-image" | "real-image" | "states">(
    "states",
  );
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState<CollectionPageSize>(50);
  const companyId = searchParams.get("companyId") ?? "";
  const areaId = searchParams.get("areaId") ?? "";
  const buildingId = searchParams.get("buildingId") ?? "";
  const nodeType = searchParams.get("nodeType") ?? undefined;
  const updateFilters = useCallback(
    (values: Record<string, string | undefined>) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        Object.entries(values).forEach(([key, value]) =>
          value ? next.set(key, value) : next.delete(key),
        );
        return next;
      });
    },
    [setSearchParams],
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const historyRange = useNodeHistoryRange(selectedNodeId);
  const view = usePortalUiStore((state) => state.adminMonitoringView);
  const setView = usePortalUiStore((state) => state.setAdminMonitoringView);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("offline");
  const userId = session?.user.id ?? "anonymous";

  useEffect(() => {
    setHistoryPage(1);
  }, [historyRange.range.from, historyRange.range.to, selectedNodeId]);

  const optionsQuery = useApiQuery<AdminMonitoringOptionsRecord>(
    session,
    queryKeys.admin.monitoring(userId, "options"),
    "/admin/monitoring/options",
    { staleTime: REFERENCE_STALE_TIME },
  );
  const summaryPath = adminMonitoringSummaryPath({ areaId, buildingId, companyId });
  const summaryKey = useMemo(
    () =>
      queryKeys.admin.monitoring(userId, "summary", {
        areaId,
        buildingId,
        companyId,
      }),
    [areaId, buildingId, companyId, userId],
  );
  const summaryQuery = useApiQuery<AdminMonitoringSummaryRecord>(session, summaryKey, summaryPath, {
    placeholderData: keepPreviousData,
  });
  const buildingQuery = useApiQuery<MonitoringBuildingOverview>(
    session,
    queryKeys.admin.monitoring(userId, "building-overview", { buildingId }),
    `/admin/monitoring/buildings/${buildingId || "missing-building"}`,
    { enabled: Boolean(buildingId) },
  );
  const nodeResponseKey = useMemo(
    () => queryKeys.admin.monitoring(userId, "node-states", { buildingId, nodeType }),
    [buildingId, nodeType, userId],
  );
  const nodeQuery = useApiQuery<MonitoringNodeTypeResponse>(
    session,
    nodeResponseKey,
    `/admin/monitoring/buildings/${buildingId || "missing-building"}/node-types/${nodeType ?? "missing-type"}`,
    { enabled: Boolean(buildingId && nodeType && isCanonicalNodeType(nodeType)) },
  );
  const historyParams = new URLSearchParams({
    from: historyRange.range.from,
    page: String(historyPage),
    pageSize: String(historyPageSize),
    to: historyRange.range.to,
  });
  const chartParams = new URLSearchParams({
    from: historyRange.range.from,
    to: historyRange.range.to,
  });
  const historyEnabled = Boolean(
    buildingId && nodeType && selectedNodeId && isCanonicalNodeType(nodeType),
  );
  const historyQuery = useApiQuery<PaginatedSensorHistory>(
    session,
    queryKeys.admin.monitoring(userId, "node-history", {
      buildingId,
      from: historyRange.range.from,
      nodeId: selectedNodeId,
      nodeType,
      page: historyPage,
      pageSize: historyPageSize,
      to: historyRange.range.to,
    }),
    `/admin/monitoring/buildings/${buildingId}/node-types/${nodeType}/nodes/${selectedNodeId}/history?${historyParams.toString()}`,
    { enabled: historyEnabled, placeholderData: keepPreviousData },
  );
  const historyChartQuery = useApiQuery<SensorHistoryChartResponse>(
    session,
    queryKeys.admin.monitoring(userId, "node-history-chart", {
      buildingId,
      from: historyRange.range.from,
      nodeId: selectedNodeId,
      nodeType,
      to: historyRange.range.to,
    }),
    `/admin/monitoring/buildings/${buildingId}/node-types/${nodeType}/nodes/${selectedNodeId}/history/chart?${chartParams.toString()}`,
    { enabled: historyEnabled },
  );
  const options = optionsQuery.data;
  const summary = summaryQuery.data;
  const buildingOverview = buildingQuery.data;
  const nodeResponse = nodeQuery.data;
  const history = historyQuery.data;
  const historyChart = historyChartQuery.data;
  const historyLoading = historyQuery.isPending || historyChartQuery.isPending;
  const historyError = historyQuery.isError || historyChartQuery.isError;
  const error =
    optionsQuery.isError || summaryQuery.isError || buildingQuery.isError || nodeQuery.isError;
  const loading = !options && optionsQuery.isPending;

  useEffect(() => {
    if (!buildingId) {
      if (nodeType) updateFilters({ nodeType: undefined });
      setSelectedNodeId(undefined);
      return;
    }
    if (buildingOverview) {
      const defaultNodeType = buildingOverview.nodeTypes[0]?.nodeType.key;
      if (!nodeType && defaultNodeType) updateFilters({ nodeType: defaultNodeType });
    }
  }, [buildingId, buildingOverview, nodeType, updateFilters]);

  useEffect(() => setSelectedNodeId(undefined), [buildingId, nodeType]);

  useEffect(() => {
    if (!session || !buildingId || !nodeType || !isCanonicalNodeType(nodeType)) {
      setRealtimeStatus("offline");
      return;
    }
    const socket = io(readWebEnv().apiBaseUrl, {
      transports: ["websocket"],
      withCredentials: true,
    });
    let refreshAttempted = false;
    setRealtimeStatus("reconnecting");
    socket.on("connect", () => {
      setRealtimeStatus("connected");
      socket.emit("monitoring:join", { buildingId, nodeType }, (ack: { ok: boolean }) => {
        if (!ack.ok) {
          setRealtimeStatus("offline");
          return;
        }
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: nodeResponseKey, exact: true }),
          queryClient.invalidateQueries({ queryKey: summaryKey, exact: true }),
        ]);
      });
    });
    socket.io.on("reconnect_attempt", () => setRealtimeStatus("reconnecting"));
    socket.on("connect_error", () => {
      setRealtimeStatus("offline");
      if (refreshAttempted) return;
      refreshAttempted = true;
      void refreshSession()
        .then(() => socket.connect())
        .catch(() => undefined);
    });
    socket.on("disconnect", () => setRealtimeStatus("offline"));
    socket.on("monitoring:node-state", (event: MonitoringNodeStateEvent) => {
      if (event.buildingId !== buildingId || event.nodeType !== nodeType) return;
      let previous: MonitoringNodeStateRecord | undefined;
      queryClient.setQueryData<MonitoringNodeTypeResponse>(nodeResponseKey, (current) => {
        if (!current) return current;
        previous = current.states.find((state) => state.nodeId === event.state.nodeId);
        const states = upsertState(current.states, event.state);
        return states === current.states ? current : { ...current, states };
      });
      if (previous) {
        queryClient.setQueryData<AdminMonitoringSummaryRecord>(summaryKey, (current) =>
          current ? applyAdminMonitoringState(current, previous, event.state) : current,
        );
      } else {
        void queryClient.invalidateQueries({ queryKey: summaryKey, exact: true });
      }
    });
    return () => {
      socket.removeAllListeners?.();
      socket.disconnect();
    };
  }, [buildingId, nodeResponseKey, nodeType, queryClient, session, summaryKey]);

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
              updateFilters({
                areaId: undefined,
                buildingId: undefined,
                companyId: value ?? undefined,
                nodeType: undefined,
              });
            }}
            value={companyId}
          />
          <Select
            clearable
            data={areas.map((area) => ({ label: area.name, value: area.id }))}
            disabled={!companyId}
            label={t("organizations.area")}
            onChange={(value) => {
              updateFilters({
                areaId: value ?? undefined,
                buildingId: undefined,
                nodeType: undefined,
              });
            }}
            value={areaId}
          />
          <Select
            clearable
            data={buildings.map((building) => ({ label: building.title, value: building.id }))}
            disabled={!areaId}
            label={t("devices.building")}
            onChange={(value) =>
              updateFilters({ buildingId: value ?? undefined, nodeType: undefined })
            }
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
                  onSelect={() => updateFilters({ nodeType: type })}
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
                    <MonitoringViewToggle onChange={setView} value={view} />
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

export function applyAdminMonitoringState(
  summary: AdminMonitoringSummaryRecord,
  previous: MonitoringNodeStateRecord | undefined,
  next: MonitoringNodeStateRecord,
): AdminMonitoringSummaryRecord {
  const previousPersisted = Boolean(previous && new Date(previous.lastSeenAt).getTime() > 0);
  const previousStatus = previousPersisted ? previous?.status : undefined;
  const distribution = { ...summary.severityDistribution };
  if (previousStatus !== next.status) {
    if (previousStatus)
      distribution[previousStatus] = Math.max(0, distribution[previousStatus] - 1);
    distribution[next.status] += 1;
  }

  const buildings = summary.buildings.map((entry) => {
    if (entry.building.id !== next.buildingId) return entry;
    const updated = { ...entry };
    if (!previousPersisted) updated.total += 1;
    for (const status of ["danger", "offline", "warning"] as const) {
      if (previousStatus === status && previousStatus !== next.status) {
        updated[status] = Math.max(0, updated[status] - 1);
      }
      if (next.status === status && previousStatus !== next.status) updated[status] += 1;
    }
    return updated;
  });

  return {
    ...summary,
    buildings,
    recentNodes: upsertState(summary.recentNodes, next).slice(0, 8),
    severityDistribution: distribution,
  };
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
