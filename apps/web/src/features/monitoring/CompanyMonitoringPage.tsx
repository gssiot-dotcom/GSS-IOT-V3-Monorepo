import type {
  BuildingRecord,
  PaginatedResponse,
  BuildingAlarmLevelsResponse,
  BuildingFaultFiltersResponse,
  CanonicalNodeType,
  CollectionPageSize,
  FaultFilterGatewayGroup,
  GatewayCommandStatus,
  MonitoringBuildingOverview,
  MonitoringNodeStateEvent,
  MonitoringNodeStateRecord,
  MonitoringNodeTypeResponse,
  PaginatedSensorHistory,
  SensorHistoryChartResponse,
  SensorValues,
} from "@gss-iot/contracts";
import {
  DataTable,
  EntityActionMenu,
  EmptyState,
  ErrorState,
  LoadingState,
  NodeTypeSelectionCard,
  OperationalSummaryCard,
  PageHeader,
  RealtimeStatusBadge,
  StatusBadge,
  TintedIconBox,
  WorkspaceTabs,
} from "@gss-iot/ui";
import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  IconActivity,
  IconAlertTriangle,
  IconArrowRight,
  IconBuildingSkyscraper,
  IconCircleCheck,
  IconRefresh,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";

import { readWebEnv } from "../../app/env";
import { t, tf } from "../../app/i18n";
import type { TranslationKey } from "../../app/i18n";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { Can } from "../../shared/rbac/Can";
import { NodeDetailDrawer } from "./components/NodeDetailDrawer";
import { NodeStateCard } from "./components/NodeStateCard";
import { MonitoringViewToggle, type MonitoringView } from "./components/MonitoringViewToggle";
import { useNodeHistoryRange } from "./components/useNodeHistoryRange";

type RealtimeStatus = "connected" | "offline" | "reconnecting";
type StateRow = MonitoringNodeStateRecord & { id: string };

export const nodeTypeOrder: CanonicalNodeType[] = ["door_node", "angle_node", "gangform_node"];

export const nodeTypeText: Record<
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
    void apiRequest<PaginatedResponse<BuildingRecord>>(session, "/company/buildings?pageSize=100")
      .then((response) => setBuildings(response.items))
      .catch(() => setError(true));
  }, [session]);

  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;
  if (!buildings) return <LoadingState title={t("common.loading")} />;

  return (
    <Stack gap="lg">
      <PageHeader title={t("monitoring.title")} subtitle={t("monitoring.indexSubtitle")} />
      {buildings.length ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {buildings.map((building) => (
            <UnstyledButton
              aria-label={tf("monitoring.openBuilding", { building: building.title })}
              className="gss-monitoring-building-link"
              key={building.id}
              onClick={() => navigate(`/company/buildings/${building.id}/monitoring`)}
            >
              <Card className="gss-monitoring-building-card" h="100%" p="md" shadow="sm">
                <Group align="flex-start" justify="space-between" wrap="nowrap">
                  <Group align="flex-start" gap="sm" wrap="nowrap">
                    <TintedIconBox accent="blue" size="md">
                      <IconBuildingSkyscraper size={18} />
                    </TintedIconBox>
                    <Stack gap={3} style={{ minWidth: 0 }}>
                      <Text fw={700} lineClamp={1}>
                        {building.title}
                      </Text>
                      <Text c="dimmed" lineClamp={1} size="sm">
                        {building.address ?? building.buildingType ?? t("common.notAvailable")}
                      </Text>
                    </Stack>
                  </Group>
                  <StatusBadge
                    label={t(
                      building.status === "ACTIVE" ? "management.active" : "management.inactive",
                    )}
                    status={building.status === "ACTIVE" ? "active" : "inactive"}
                  />
                </Group>
                <Group className="gss-monitoring-building-footer" justify="space-between" mt="md">
                  <Text c="dimmed" size="xs">
                    {tf("monitoring.buildingCode", { code: building.number ?? "-" })}
                  </Text>
                  <Group gap={5}>
                    <Text c="gss" fw={650} size="sm">
                      {t("monitoring.open")}
                    </Text>
                    <IconArrowRight aria-hidden="true" size={16} />
                  </Group>
                </Group>
              </Card>
            </UnstyledButton>
          ))}
        </SimpleGrid>
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
  const [historyChart, setHistoryChart] = useState<SensorHistoryChartResponse>();
  const [historyError, setHistoryError] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [alarmLevels, setAlarmLevels] = useState<BuildingAlarmLevelsResponse>();
  const [faultFilters, setFaultFilters] = useState<BuildingFaultFiltersResponse>();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const historyRange = useNodeHistoryRange(selectedNodeId);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState<CollectionPageSize>(50);
  const [view, setView] = useState<MonitoringView>(() => {
    const stored = window.localStorage.getItem("gss.monitoring.view");
    return stored === "CARD" ? "CARD" : "TABLE";
  });
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("offline");
  const [error, setError] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<
    "alarm-levels" | "fault-filters" | "history" | "states"
  >("states");

  useEffect(() => {
    setHistoryPage(1);
  }, [historyRange.range.from, historyRange.range.to, selectedNodeId]);

  useEffect(() => {
    if (!session || !buildingId || !canonicalNodeType) return;
    setError(false);
    void apiRequest<MonitoringNodeTypeResponse>(
      session,
      `/company/buildings/${buildingId}/monitoring/${canonicalNodeType}`,
    )
      .then((data) => {
        setResponse(data);
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
    if (!session || !buildingId || !canonicalNodeType || !selectedNodeId) {
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
        `/company/buildings/${buildingId}/monitoring/${canonicalNodeType}/nodes/${selectedNodeId}/history?${query.toString()}`,
      ),
      apiRequest<SensorHistoryChartResponse>(
        session,
        `/company/buildings/${buildingId}/monitoring/${canonicalNodeType}/nodes/${selectedNodeId}/history/chart?${chartQuery.toString()}`,
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
    canonicalNodeType,
    historyRange.range.from,
    historyRange.range.to,
    historyPage,
    historyPageSize,
    selectedNodeId,
    session,
  ]);

  useEffect(() => {
    if (!session || !buildingId || !canonicalNodeType) return;
    void Promise.all([
      apiRequest<BuildingAlarmLevelsResponse>(
        session,
        `/company/buildings/${buildingId}/alarm-levels`,
      ),
      apiRequest<BuildingFaultFiltersResponse>(
        session,
        `/company/buildings/${buildingId}/alarm-levels/fault-filters`,
      ),
    ])
      .then(([levels, filters]) => {
        setAlarmLevels(levels);
        setFaultFilters(filters);
      })
      .catch(() => {
        setAlarmLevels(undefined);
        setFaultFilters(undefined);
      });
  }, [buildingId, canonicalNodeType, session]);

  const rows = useMemo<StateRow[]>(
    () => response?.states.map((state) => ({ ...state, id: state.nodeId })) ?? [],
    [response],
  );
  const statusCounts = rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }, {});

  if (error || !canonicalNodeType)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;
  if (!response) return <LoadingState title={t("common.loading")} />;

  return (
    <Stack gap="lg">
      <PageHeader
        title={t(nodeTypeText[canonicalNodeType].title)}
        subtitle={tf("monitoring.nodeTypeSubtitle", { building: response.building.title })}
        action={
          <Box visibleFrom="sm">
            <RealtimeBadge status={realtimeStatus} />
          </Box>
        }
      />
      <Box className="gss-monitoring-summary-grid" data-testid="monitoring-summary-grid">
        <OperationalSummaryCard
          accent="blue"
          icon={<IconActivity size={18} />}
          label={t("monitoring.totalNodes")}
          value={rows.length}
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
            value={<span className={`gss-status-${status}`}>{statusCounts[status] ?? 0}</span>}
          />
        ))}
      </Box>
      {rows.length ? (
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <WorkspaceTabs
              ariaLabel={t("monitoring.title")}
              items={[
                { label: t("monitoring.latestStates"), value: "states" },
                { label: t("monitoring.history"), value: "history" },
                { label: t("alarmLevels.title"), value: "alarm-levels" },
                { label: t("alarmLevels.faultFilters"), value: "fault-filters" },
              ]}
              onChange={(value) =>
                setWorkspaceTab(value as "alarm-levels" | "fault-filters" | "history" | "states")
              }
              value={workspaceTab}
            />
            <MonitoringViewToggle
              onChange={(next) => {
                setView(next);
                window.localStorage.setItem("gss.monitoring.view", next);
              }}
              value={view}
            />
          </Group>
          {workspaceTab === "states" ? (
            view === "CARD" ? (
              <SimpleGrid
                cols={{ base: 1, xs: 2, sm: 3, lg: 5 }}
                data-testid="monitoring-node-grid"
                spacing="sm"
              >
                {rows.map((row) => (
                  <NodeStateCard key={row.nodeId} onOpen={setSelectedNodeId} state={row} />
                ))}
              </SimpleGrid>
            ) : (
              <>
                <Box hiddenFrom="sm">
                  <NodeStateMobileList onOpen={setSelectedNodeId} rows={rows} />
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
                    rows={rows}
                  />
                </Box>
              </>
            )
          ) : workspaceTab === "history" ? (
            <HistoryTable history={history} />
          ) : workspaceTab === "alarm-levels" ? (
            <AlarmLevelPanel
              buildingId={buildingId!}
              data={alarmLevels}
              nodeType={canonicalNodeType}
              onRefresh={setAlarmLevels}
            />
          ) : (
            <FaultFilterPanel
              buildingId={buildingId!}
              data={faultFilters}
              nodeType={canonicalNodeType}
              onRefresh={setFaultFilters}
            />
          )}
        </Stack>
      ) : (
        <EmptyState description={t("monitoring.emptyNodes")} title={t("common.emptyTitle")} />
      )}
      <Text c="dimmed" size="sm">
        {tf("monitoring.retention", { days: response.historyRetentionDays })}
      </Text>
      <NodeDetailDrawer
        chart={historyChart}
        date={historyRange.date}
        history={history}
        historyError={historyError}
        hours={historyRange.hours}
        loadingHistory={historyLoading}
        maxDate={historyRange.maxDate}
        mode={historyRange.mode}
        node={rows.find((row) => row.nodeId === selectedNodeId)}
        nodeType={canonicalNodeType}
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
        thresholds={alarmLevels?.configurations.find(
          (item) => item.nodeType.key === canonicalNodeType,
        )}
      />
    </Stack>
  );
}

function AlarmLevelPanel({
  buildingId,
  data,
  nodeType,
  onRefresh,
}: {
  buildingId: string;
  data?: BuildingAlarmLevelsResponse;
  nodeType: CanonicalNodeType;
  onRefresh: (data: BuildingAlarmLevelsResponse) => void;
}) {
  const { session } = useAuth();
  const nodeTypeRecord = data?.nodeTypes.find((item) => item.key === nodeType);
  const configuration = data?.configurations.find((item) => item.nodeType.key === nodeType);
  const [enabled, setEnabled] = useState(true);
  const [cautionThreshold, setCautionThreshold] = useState<number | "">(1);
  const [warningThreshold, setWarningThreshold] = useState<number | "">(2);
  const [dangerThreshold, setDangerThreshold] = useState<number | "">(4);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<TranslationKey | null>(null);

  useEffect(() => {
    if (!configuration) return;
    setEnabled(configuration.enabled);
    setCautionThreshold(configuration.cautionThreshold ?? 1);
    setWarningThreshold(configuration.warningThreshold ?? 2);
    setDangerThreshold(configuration.dangerThreshold ?? 4);
  }, [configuration]);

  if (!data || !nodeTypeRecord) return <LoadingState title={t("common.loading")} />;
  const isDoor = nodeType === "door_node";
  const applications = data.gatewayApplications.filter(
    (item) => item.nodeTypeId === nodeTypeRecord.id,
  );
  const invalid =
    !isDoor &&
    enabled &&
    !(
      typeof cautionThreshold === "number" &&
      typeof warningThreshold === "number" &&
      typeof dangerThreshold === "number" &&
      0 < cautionThreshold &&
      cautionThreshold < warningThreshold &&
      warningThreshold < dangerThreshold &&
      dangerThreshold <= 12
    );

  const save = async () => {
    if (!session || invalid) return;
    setSaving(true);
    setMessage(null);
    try {
      const next = await apiRequest<BuildingAlarmLevelsResponse>(
        session,
        `/company/buildings/${buildingId}/alarm-levels/node-types/${nodeTypeRecord.id}`,
        {
          body: JSON.stringify({
            cautionThreshold: isDoor ? undefined : cautionThreshold,
            dangerThreshold: isDoor ? undefined : dangerThreshold,
            enabled,
            warningThreshold: isDoor ? undefined : warningThreshold,
          }),
          method: "PATCH",
        },
      );
      onRefresh(next);
      setMessage("alarmLevels.saved");
    } catch {
      setMessage("alarmLevels.saveFailed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={600}>{t("alarmLevels.configuration")}</Text>
            <Can permission="alarm-levels.manage">
              <Switch
                checked={enabled}
                label={enabled ? t("gatewayCommands.enabled") : t("gatewayCommands.disabled")}
                onChange={(event) => setEnabled(event.currentTarget.checked)}
              />
            </Can>
          </Group>
          {!isDoor ? (
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <NumberInput
                label={t("alarmLevels.caution")}
                max={12}
                min={0}
                onChange={(value) => setCautionThreshold(value === "" ? "" : Number(value))}
                value={cautionThreshold}
              />
              <NumberInput
                label={t("alarmLevels.warning")}
                max={12}
                min={0}
                onChange={(value) => setWarningThreshold(value === "" ? "" : Number(value))}
                value={warningThreshold}
              />
              <NumberInput
                label={t("alarmLevels.danger")}
                max={12}
                min={0}
                onChange={(value) => setDangerThreshold(value === "" ? "" : Number(value))}
                value={dangerThreshold}
              />
            </SimpleGrid>
          ) : (
            <Text c="dimmed" size="sm">
              {t("alarmLevels.doorHint")}
            </Text>
          )}
          {invalid ? (
            <Text c="red" size="sm">
              {t("alarmLevels.thresholdValidation")}
            </Text>
          ) : null}
          <Group justify="space-between">
            <Text c={message === "alarmLevels.saveFailed" ? "red" : "dimmed"} size="sm">
              {message ? t(message) : t("alarmLevels.requestIdHint")}
            </Text>
            <Can permission="alarm-levels.manage">
              <Button disabled={invalid} loading={saving} onClick={save}>
                {t("organizations.save")}
              </Button>
            </Can>
          </Group>
        </Stack>
      </Paper>
      <GatewayApplicationTable
        applications={applications}
        buildingId={buildingId}
        nodeType={nodeType}
        onRefresh={async (next) => {
          if (next) {
            onRefresh(next);
            return;
          }
          if (!session) return;
          onRefresh(
            await apiRequest<BuildingAlarmLevelsResponse>(
              session,
              `/company/buildings/${buildingId}/alarm-levels`,
            ),
          );
        }}
      />
    </Stack>
  );
}

function GatewayApplicationTable({
  applications,
  buildingId,
  nodeType,
  onRefresh,
}: {
  applications: BuildingAlarmLevelsResponse["gatewayApplications"];
  buildingId: string;
  nodeType: CanonicalNodeType;
  onRefresh: (data?: BuildingAlarmLevelsResponse) => Promise<void>;
}) {
  const { session } = useAuth();
  const [updatingGatewayId, setUpdatingGatewayId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  async function retry(commandId: string | null) {
    if (!session || !commandId) return;
    await apiRequest(
      session,
      `/company/buildings/${buildingId}/alarm-levels/commands/${commandId}/retry`,
      {
        method: "POST",
      },
    );
    await onRefresh();
  }

  async function toggleGateway(gatewayId: string, enabled: boolean) {
    if (!session) return;
    setUpdatingGatewayId(gatewayId);
    setError(false);
    try {
      const next = await apiRequest<BuildingAlarmLevelsResponse>(
        session,
        `/company/buildings/${buildingId}/alarm-levels/gateways/${gatewayId}`,
        {
          body: JSON.stringify({ enabled, nodeType }),
          method: "PATCH",
        },
      );
      await onRefresh(next);
    } catch {
      setError(true);
    } finally {
      setUpdatingGatewayId(null);
    }
  }

  if (!applications.length) {
    return <EmptyState description={t("alarmLevels.noGateways")} title={t("common.emptyTitle")} />;
  }
  return (
    <Stack gap="xs">
      {error ? (
        <Text c="red" size="sm">
          {t("alarmLevels.gatewayToggleFailed")}
        </Text>
      ) : null}
      <DataTable
        columns={[
          {
            key: "gateway",
            label: t("devices.gateway"),
            render: (row) => row.gateway.serialNumber,
          },
          {
            key: "desired",
            label: t("alarmLevels.desired"),
            render: (row) => (
              <Group gap="xs">
                <Badge color={row.desiredEnabled ? "green" : "gray"} variant="light">
                  {row.desiredEnabled
                    ? t("gatewayCommands.enabled")
                    : t("gatewayCommands.disabled")}
                </Badge>
                <Can permission="alarm-levels.manage">
                  <Switch
                    aria-label={tf("alarmLevels.gatewayToggle", {
                      gateway: row.gateway.serialNumber,
                    })}
                    checked={row.desiredEnabled}
                    disabled={updatingGatewayId === row.gatewayId}
                    onChange={(event) =>
                      void toggleGateway(row.gatewayId, event.currentTarget.checked)
                    }
                    size="sm"
                  />
                </Can>
              </Group>
            ),
          },
          {
            key: "applied",
            label: t("alarmLevels.applied"),
            render: (row) =>
              row.appliedEnabled === null ? (
                t("alarmLevels.notApplied")
              ) : (
                <Badge color={row.appliedEnabled ? "green" : "gray"} variant="light">
                  {row.appliedEnabled
                    ? t("gatewayCommands.enabled")
                    : t("gatewayCommands.disabled")}
                </Badge>
              ),
          },
          {
            key: "status",
            label: t("gatewayCommands.status"),
            render: (row) => commandStatusBadge(row.desiredStatus),
          },
          {
            key: "requestId",
            label: t("gatewayCommands.requestId"),
            render: (row) => row.desiredCommandId ?? "-",
          },
          {
            key: "appliedAt",
            label: t("gatewayCommands.acknowledgedAt"),
            render: (row) => formatDate(row.appliedAt),
          },
          {
            key: "retry",
            label: t("common.retry"),
            render: (row) =>
              row.desiredStatus === "FAILED" && row.desiredCommandId ? (
                <Can permission="alarm-levels.manage">
                  <Button
                    leftSection={<IconRefresh size={14} />}
                    onClick={() => retry(row.desiredCommandId)}
                    size="xs"
                    variant="light"
                  >
                    {t("common.retry")}
                  </Button>
                </Can>
              ) : null,
          },
        ]}
        rows={applications}
      />
    </Stack>
  );
}

function FaultFilterPanel({
  buildingId,
  data,
  nodeType,
  onRefresh,
}: {
  buildingId: string;
  data?: BuildingFaultFiltersResponse;
  nodeType: CanonicalNodeType;
  onRefresh: (data: BuildingFaultFiltersResponse) => void;
}) {
  const { session } = useAuth();
  if (!data) return <LoadingState title={t("common.loading")} />;
  const groups = data.gateways.map((gateway) => ({
    gateway: gateway.gateway,
    nodeTypes: gateway.nodeTypes.filter((item) => item.nodeType.key === nodeType),
  }));

  async function saveGroup(group: FaultFilterGatewayGroup, selectedNodeIds: string[]) {
    const nodeTypeRecord = group.nodeTypes[0]?.nodeType;
    if (!session || !nodeTypeRecord) return;
    const next = await apiRequest<BuildingFaultFiltersResponse>(
      session,
      `/company/buildings/${buildingId}/alarm-levels/fault-filters`,
      {
        body: JSON.stringify({
          gatewayId: group.gateway.id,
          nodeIds: selectedNodeIds,
          nodeTypeId: nodeTypeRecord.id,
        }),
        method: "PATCH",
      },
    );
    onRefresh(next);
  }

  return (
    <Stack gap="md">
      {groups.map((group) => (
        <FaultFilterGatewayEditor group={group} key={group.gateway.id} onSave={saveGroup} />
      ))}
      {!groups.length ? (
        <EmptyState description={t("alarmLevels.noGateways")} title={t("common.emptyTitle")} />
      ) : null}
    </Stack>
  );
}

function FaultFilterGatewayEditor({
  group,
  onSave,
}: {
  group: FaultFilterGatewayGroup;
  onSave: (group: FaultFilterGatewayGroup, selectedNodeIds: string[]) => Promise<void>;
}) {
  const nodes = group.nodeTypes[0]?.nodes ?? [];
  const [selected, setSelected] = useState<string[]>(() =>
    nodes.filter((node) => node.desiredEnabled).map((node) => node.nodeId),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected(nodes.filter((node) => node.desiredEnabled).map((node) => node.nodeId));
  }, [nodes]);

  return (
    <Paper withBorder p="md">
      <Stack>
        <Group justify="space-between">
          <Text fw={600}>{group.gateway.serialNumber}</Text>
          <Can permission="alarm-levels.manage">
            <Button
              loading={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSave(group, selected);
                } finally {
                  setSaving(false);
                }
              }}
              size="xs"
            >
              {t("organizations.save")}
            </Button>
          </Can>
        </Group>
        {nodes.length ? (
          <Checkbox.Group onChange={setSelected} value={selected}>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              {nodes.map((node) => (
                <Checkbox
                  key={node.nodeId}
                  label={`${node.node.number} (${node.applied ? t("alarmLevels.applied") : t("alarmLevels.notApplied")})`}
                  value={node.nodeId}
                />
              ))}
            </SimpleGrid>
          </Checkbox.Group>
        ) : (
          <EmptyState description={t("monitoring.emptyNodes")} title={t("common.emptyTitle")} />
        )}
      </Stack>
    </Paper>
  );
}

function commandStatusBadge(status: GatewayCommandStatus) {
  const statusKey = status.toLowerCase() as Parameters<typeof StatusBadge>[0]["status"];
  return <StatusBadge label={t(`status.${statusKey}` as never)} status={statusKey} />;
}

export function NodeStateMobileList({
  onOpen,
  rows,
}: {
  onOpen: (nodeId: string) => void;
  rows: MonitoringNodeStateRecord[];
}) {
  return (
    <Stack gap="sm">
      {rows.map((row) => (
        <Paper key={row.nodeId} p="sm" withBorder>
          <Group align="flex-start" justify="space-between" wrap="nowrap">
            <Stack gap={4} style={{ minWidth: 0 }}>
              <Text fw={700}>{row.node.number}</Text>
              <Text c="dimmed" size="xs">
                {row.gateway.serialNumber} · {formatAge(row.lastSeenAt)}
              </Text>
              <Text size="sm">{renderValues(row.values)}</Text>
              <StatusBadge label={t(statusKey(row.status))} status={row.status} />
            </Stack>
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
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}

function RealtimeBadge({ status }: { status: RealtimeStatus }) {
  return <RealtimeStatusBadge label={t(realtimeKey(status))} status={status} />;
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

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}

export function upsertState(
  states: MonitoringNodeStateRecord[],
  next: MonitoringNodeStateRecord,
): MonitoringNodeStateRecord[] {
  const index = states.findIndex((state) => state.nodeId === next.nodeId);
  if (index === -1) return [next, ...states];
  return states.map((state, currentIndex) => (currentIndex === index ? next : state));
}

export function isCanonicalNodeType(value: string | undefined): value is CanonicalNodeType {
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
