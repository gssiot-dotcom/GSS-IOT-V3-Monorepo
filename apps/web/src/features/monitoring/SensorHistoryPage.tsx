import type { CollectionPageSize, SensorReadingRecord } from "@gss-iot/contracts";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Code,
  Group,
  Modal,
  NativeSelect,
  Paper,
  Progress,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { IconDownload, IconRefresh, IconTrash } from "@tabler/icons-react";
import { useMemo, useState, type ReactElement } from "react";
import {
  CollectionPagination,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@gss-iot/ui";

import { formatDateTime, nodeTypeLabel, t, tf, tx } from "../../app/i18n";
import { ApiError } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { LocalDateTimeInput } from "../../shared/date-time/LocalDateTimeInput";
import {
  localDateTimeValue,
  normalizeRequiredDateTimeRange,
} from "../../shared/date-time/local-date-time-range";
import { hasPermission } from "../../shared/rbac/has-permission";
import { REFERENCE_STALE_TIME, useApiMutation, useApiQuery } from "../../shared/query/api-query";
import { portalQueryKey } from "../../shared/query/query-keys";
import { useCollectionSearchParams } from "../../shared/url/collection-search-params";
import { NodeHistoryChart } from "./components/NodeHistoryChart";

type HistoryResponse = {
  items: SensorReadingRecord[];
  page: number;
  pageSize: number;
  total: number;
};

type HistoryChartResponse = {
  items: SensorReadingRecord[];
  returnedPointCount: number;
  sampleLimit: number;
  sampled: boolean;
  totalRawPointCount: number;
};

type HistoryOptions = {
  areas: Array<{ companyId: string; id: string; name: string }>;
  buildings: Array<{ areaId: string; companyId: string; id: string; title: string }>;
  companies: Array<{ id: string; name: string }>;
  nodeTypes: Array<{ buildingId: string; displayName: string; id: string; key: string }>;
  nodes: Array<{ buildingId: string; id: string; nodeTypeId: string; number: string }>;
};

type PurgePreview = {
  confirmation: string;
  eligible: number;
  estimatedSizeBytes: number;
  matched: number;
  preservedReferenced: number;
  previewHash: string;
};

type DeletionJob = {
  currentPhase: string;
  deletedCounts: Record<string, number>;
  id: string;
  safeErrorSummary: string | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
};

export function SensorHistoryPage({ context }: { context: "admin" | "company" }): ReactElement {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { page, pageSize, setPage, setPageSize, searchParams, update } =
    useCollectionSearchParams();
  const [defaultDateRange] = useState(() => {
    const to = new Date();
    return {
      from: localDateTimeValue(new Date(to.getTime() - 24 * 60 * 60 * 1000)),
      to: localDateTimeValue(to),
    };
  });
  const rawStatus = searchParams.get("status") ?? "";
  const status = ["SAFE", "CAUTION", "WARNING", "DANGER", "OFFLINE"].includes(rawStatus)
    ? rawStatus
    : "";
  const companyId = searchParams.get("companyId") ?? "";
  const areaId = searchParams.get("areaId") ?? "";
  const buildingId = searchParams.get("buildingId") ?? "";
  const nodeTypeId = searchParams.get("nodeTypeId") ?? "";
  const nodeId = searchParams.get("nodeId") ?? "";
  const rawFaultFiltered = searchParams.get("faultFiltered") ?? "";
  const faultFiltered =
    rawFaultFiltered === "true" || rawFaultFiltered === "false" ? rawFaultFiltered : "";
  const dateRange = {
    from: {
      date: searchParams.get("fromDate") ?? defaultDateRange.from.date,
      time: searchParams.get("fromTime") ?? defaultDateRange.from.time,
    },
    to: {
      date: searchParams.get("toDate") ?? defaultDateRange.to.date,
      time: searchParams.get("toTime") ?? defaultDateRange.to.time,
    },
  };
  const [purgePreview, setPurgePreview] = useState<PurgePreview>();
  const [purgeConfirmation, setPurgeConfirmation] = useState("");
  const [purgeJobId, setPurgeJobId] = useState<string>();
  const [purgeError, setPurgeError] = useState("");
  const base = context === "admin" ? "/admin" : "/company";
  const normalizedRange = useMemo(
    () =>
      normalizeRequiredDateTimeRange(dateRange.from, dateRange.to, {
        maxRangeMs: 31 * 24 * 60 * 60 * 1000,
        toBoundary: "exclusive",
      }),
    [dateRange],
  );
  const rangeError = normalizedRange.error
    ? t(
        normalizedRange.error === "required"
          ? "common.timeRangeRequired"
          : normalizedRange.error === "reversed"
            ? "common.timeRangeReversed"
            : normalizedRange.error === "max-range"
              ? "common.timeRangeMax31Days"
              : "common.timeRangeInvalid",
      )
    : undefined;

  const filters = useMemo(() => {
    if (!normalizedRange.value) return null;
    const query = new URLSearchParams({
      from: normalizedRange.value.from,
      page: String(page),
      pageSize: String(pageSize),
      to: normalizedRange.value.to,
    });
    if (status) query.set("status", status);
    if (companyId) query.set("companyId", companyId);
    if (areaId) query.set("areaId", areaId);
    if (buildingId) query.set("buildingId", buildingId);
    if (nodeTypeId) query.set("nodeTypeId", nodeTypeId);
    if (nodeId) query.set("nodeId", nodeId);
    if (faultFiltered) query.set("faultFiltered", faultFiltered);
    return query;
  }, [
    areaId,
    buildingId,
    companyId,
    faultFiltered,
    nodeId,
    nodeTypeId,
    normalizedRange,
    page,
    pageSize,
    status,
  ]);
  const chartFilters = filters ? new URLSearchParams(filters) : null;
  chartFilters?.delete("page");
  chartFilters?.delete("pageSize");
  const historyKey = session
    ? portalQueryKey(session, "monitoring", "sensor-history", {
        areaId,
        buildingId,
        companyId,
        faultFiltered,
        from: normalizedRange.value?.from,
        nodeId,
        nodeTypeId,
        page,
        pageSize,
        status,
        to: normalizedRange.value?.to,
      })
    : [context, "anonymous", "sensor-history"];
  const dataQuery = useApiQuery<HistoryResponse>(
    session,
    historyKey,
    `${base}/monitoring/history?${filters?.toString() ?? ""}`,
    { enabled: Boolean(filters), placeholderData: keepPreviousData },
  );
  const chartQuery = useApiQuery<HistoryChartResponse>(
    session,
    session
      ? portalQueryKey(session, "monitoring", "sensor-history-chart", {
          areaId,
          buildingId,
          companyId,
          faultFiltered,
          from: normalizedRange.value?.from,
          nodeId,
          nodeTypeId,
          status,
          to: normalizedRange.value?.to,
        })
      : [context, "anonymous", "sensor-history-chart"],
    `${base}/monitoring/history/chart?${chartFilters?.toString() ?? ""}`,
    { enabled: Boolean(chartFilters) },
  );
  const optionsQuery = useApiQuery<HistoryOptions>(
    session,
    session
      ? portalQueryKey(session, "monitoring", "sensor-history-options")
      : [context, "anonymous", "sensor-history-options"],
    `${base}/monitoring/history/options`,
    { staleTime: REFERENCE_STALE_TIME },
  );
  const purgeJobKey = session
    ? portalQueryKey(session, "archive", "sensor-purge-job", { jobId: purgeJobId })
    : [context, "anonymous", "sensor-purge-job"];
  const purgeJobQuery = useApiQuery<DeletionJob>(
    session,
    purgeJobKey,
    `/admin/archive/purge/jobs/${purgeJobId ?? "missing-job"}`,
    {
      enabled: context === "admin" && Boolean(purgeJobId),
      refetchInterval: (query) =>
        query.state.data?.status === "PENDING" || query.state.data?.status === "RUNNING"
          ? 1_000
          : false,
    },
  );
  const data = dataQuery.data;
  const chart = chartQuery.data;
  const options = optionsQuery.data;
  const purgeJob = purgeJobQuery.data;
  const loading = dataQuery.isPending || chartQuery.isPending || optionsQuery.isPending;
  const error = dataQuery.isError || chartQuery.isError || optionsQuery.isError;
  const actionMutation = useApiMutation(session);
  const previewMutation = useApiMutation<PurgePreview>(session);
  const deletionMutation = useApiMutation<DeletionJob>(session);

  const filteredAreas = useMemo(
    () => (options?.areas ?? []).filter((area) => !companyId || area.companyId === companyId),
    [companyId, options?.areas],
  );
  const filteredBuildings = useMemo(
    () =>
      (options?.buildings ?? []).filter(
        (building) =>
          (!companyId || building.companyId === companyId) &&
          (!areaId || building.areaId === areaId),
      ),
    [areaId, companyId, options?.buildings],
  );
  const filteredNodeTypes = useMemo(() => {
    const records = (options?.nodeTypes ?? []).filter(
      (nodeType) => !buildingId || nodeType.buildingId === buildingId,
    );
    return [...new Map(records.map((record) => [record.id, record])).values()];
  }, [buildingId, options?.nodeTypes]);
  const filteredNodes = useMemo(
    () =>
      (options?.nodes ?? []).filter(
        (node) =>
          (!buildingId || node.buildingId === buildingId) &&
          (!nodeTypeId || node.nodeTypeId === nodeTypeId),
      ),
    [buildingId, nodeTypeId, options?.nodes],
  );

  const filterBody = () =>
    normalizedRange.value
      ? {
          ...(context === "admin" && companyId ? { companyId } : {}),
          ...(areaId ? { areaId } : {}),
          ...(buildingId ? { buildingId } : {}),
          ...(nodeTypeId ? { nodeTypeId } : {}),
          ...(nodeId ? { nodeId } : {}),
          ...(status ? { status } : {}),
          ...(faultFiltered ? { faultFiltered: faultFiltered === "true" } : {}),
          from: normalizedRange.value.from,
          to: normalizedRange.value.to,
        }
      : null;

  const exportData = async () => {
    if (!session) return;
    const bodyFilters = filterBody();
    if (!bodyFilters) return;
    await actionMutation.mutateAsync({
      path: `${base}/reports/export`,
      options: {
        body: JSON.stringify({
          format: "CSV",
          reportType: "SENSOR_HISTORY",
          filters: bodyFilters,
        }),
        method: "POST",
      },
    });
  };

  const previewPurge = async () => {
    if (!session || context !== "admin") return;
    const bodyFilters = filterBody();
    if (!bodyFilters) return;
    setPurgeError("");
    try {
      setPurgePreview(
        await previewMutation.mutateAsync({
          path: "/admin/archive/sensor-readings/preview",
          options: { body: JSON.stringify(bodyFilters), method: "POST" },
        }),
      );
      setPurgeConfirmation("");
      setPurgeJobId(undefined);
    } catch (requestError) {
      setPurgeError(
        requestError instanceof ApiError ? requestError.message : t("history.purgeFailed"),
      );
    }
  };

  const enqueuePurge = async () => {
    if (!session || !purgePreview) return;
    const bodyFilters = filterBody();
    if (!bodyFilters) return;
    setPurgeError("");
    try {
      const created = await deletionMutation.mutateAsync({
        path: "/admin/archive/sensor-readings/jobs",
        options: {
          body: JSON.stringify({
            ...bodyFilters,
            confirmation: purgeConfirmation,
            idempotencyKey: crypto.randomUUID(),
            previewHash: purgePreview.previewHash,
          }),
          method: "POST",
        },
      });
      const key = portalQueryKey(session, "archive", "sensor-purge-job", { jobId: created.id });
      queryClient.setQueryData(key, created);
      setPurgeJobId(created.id);
    } catch (requestError) {
      setPurgeError(
        requestError instanceof ApiError ? requestError.message : t("history.purgeFailed"),
      );
      if (requestError instanceof ApiError && requestError.status === 409) setPurgeConfirmation("");
    }
  };

  const retryPurge = async () => {
    if (!session || !purgeJob) return;
    const retried = await deletionMutation.mutateAsync({
      path: `/admin/archive/purge/jobs/${purgeJob.id}/retry`,
      options: {
        body: JSON.stringify({ acknowledgeFailure: true }),
        method: "POST",
      },
    });
    queryClient.setQueryData(purgeJobKey, retried);
  };

  return (
    <Stack gap="lg">
      <PageHeader
        title={t("history.title")}
        subtitle={t("history.description")}
        action={
          <Group>
            <Button
              leftSection={<IconRefresh size={16} />}
              loading={dataQuery.isFetching || chartQuery.isFetching}
              onClick={() => {
                void dataQuery.refetch();
                void chartQuery.refetch();
              }}
            >
              {t("history.refresh")}
            </Button>
            {session && hasPermission(session, "reports.export") ? (
              <Button
                leftSection={<IconDownload size={16} />}
                onClick={() => void exportData()}
                variant="light"
              >
                {t("history.download")}
              </Button>
            ) : null}
            {context === "admin" &&
            session &&
            hasPermission(session, "archive.purge") &&
            hasPermission(session, "sensor-readings.purge") ? (
              <Button
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={() => void previewPurge()}
                variant="light"
              >
                {t("history.purgeFiltered")}
              </Button>
            ) : null}
          </Group>
        }
      />
      <Paper p="md" withBorder>
        <Group align="end" grow>
          <LocalDateTimeInput
            label={t("history.from")}
            onChange={(value) => {
              update({ fromDate: value.date, fromTime: value.time, page: 1 });
            }}
            value={dateRange.from}
          />
          <LocalDateTimeInput
            label={t("history.to")}
            onChange={(value) => {
              update({ page: 1, toDate: value.date, toTime: value.time });
            }}
            value={dateRange.to}
          />
          <NativeSelect
            label={t("history.status")}
            value={status}
            onChange={(event) => update({ page: 1, status: event.currentTarget.value })}
            data={[
              { label: t("history.allStatuses"), value: "" },
              ...["SAFE", "CAUTION", "WARNING", "DANGER", "OFFLINE"].map((value) => ({
                label: value,
                value,
              })),
            ]}
          />
        </Group>
        {rangeError ? (
          <Alert color="red" mt="sm">
            {rangeError}
          </Alert>
        ) : null}
        <Group align="end" grow mt="sm">
          {context === "admin" ? (
            <NativeSelect
              label={t("history.company")}
              value={companyId}
              onChange={(event) => {
                update({
                  areaId: null,
                  buildingId: null,
                  companyId: event.currentTarget.value,
                  nodeId: null,
                  nodeTypeId: null,
                  page: 1,
                });
              }}
              data={[
                { label: t("history.allCompanies"), value: "" },
                ...(options?.companies ?? []).map((item) => ({ label: item.name, value: item.id })),
              ]}
            />
          ) : null}
          <NativeSelect
            label={t("history.site")}
            value={areaId}
            onChange={(event) => {
              update({
                areaId: event.currentTarget.value,
                buildingId: null,
                nodeId: null,
                nodeTypeId: null,
                page: 1,
              });
            }}
            data={[
              { label: t("history.allSites"), value: "" },
              ...filteredAreas.map((item) => ({ label: item.name, value: item.id })),
            ]}
          />
          <NativeSelect
            label={t("history.building")}
            value={buildingId}
            onChange={(event) => {
              update({
                buildingId: event.currentTarget.value,
                nodeId: null,
                nodeTypeId: null,
                page: 1,
              });
            }}
            data={[
              { label: t("history.allBuildings"), value: "" },
              ...filteredBuildings.map((item) => ({ label: item.title, value: item.id })),
            ]}
          />
          <NativeSelect
            label={t("history.nodeType")}
            value={nodeTypeId}
            onChange={(event) => {
              update({ nodeId: null, nodeTypeId: event.currentTarget.value, page: 1 });
            }}
            data={[
              { label: t("history.allNodeTypes"), value: "" },
              ...filteredNodeTypes.map((item) => ({
                label: nodeTypeLabel(item.key, item.displayName),
                value: item.id,
              })),
            ]}
          />
          <NativeSelect
            label={t("history.node")}
            value={nodeId}
            onChange={(event) => {
              update({ nodeId: event.currentTarget.value, page: 1 });
            }}
            data={[
              { label: t("history.allNodes"), value: "" },
              ...filteredNodes.map((item) => ({ label: item.number, value: item.id })),
            ]}
          />
          <NativeSelect
            label={t("history.faultFiltered")}
            value={faultFiltered}
            onChange={(event) => {
              update({ faultFiltered: event.currentTarget.value, page: 1 });
            }}
            data={[
              { label: t("history.allFaultStates"), value: "" },
              { label: t("common.yes"), value: "true" },
              { label: t("common.no"), value: "false" },
            ]}
          />
        </Group>
      </Paper>
      {chart?.items.length ? (
        <Paper p="md" withBorder>
          <Text fw={600} mb="sm">
            {t("history.chart")}
          </Text>
          <NodeHistoryChart
            history={{
              items: chart.items,
              page: 1,
              pageSize: 100,
              total: chart.totalRawPointCount,
            }}
            nodeType={
              (chart.items[0]?.nodeType.key ?? "door_node") as
                "door_node" | "angle_node" | "gangform_node"
            }
          />
          {chart.sampled ? (
            <Text c="dimmed" size="xs">
              {tf("history.sampled", {
                returned: chart.returnedPointCount,
                total: chart.totalRawPointCount,
              })}
            </Text>
          ) : null}
        </Paper>
      ) : null}
      {purgeError ? <Alert color="red">{purgeError}</Alert> : null}
      {loading ? (
        <LoadingState title={t("common.loading")} />
      ) : error ? (
        <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />
      ) : !data?.items.length ? (
        <EmptyState title={t("history.emptyTitle")} description={t("history.emptyDescription")} />
      ) : (
        <Paper withBorder>
          <Table.ScrollContainer minWidth={760}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("history.receivedAt")}</Table.Th>
                  <Table.Th>{t("history.node")}</Table.Th>
                  <Table.Th>{t("history.nodeType")}</Table.Th>
                  <Table.Th>{t("history.status")}</Table.Th>
                  <Table.Th>{t("history.faultFiltered")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.items.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>{formatDateTime(item.receivedAt)}</Table.Td>
                    <Table.Td>{item.node.number}</Table.Td>
                    <Table.Td>
                      {nodeTypeLabel(item.nodeType.key, item.nodeType.displayName)}
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge
                        label={tx(`status.${item.status}`, item.status)}
                        status={item.status}
                      />
                    </Table.Td>
                    <Table.Td>{item.faultFiltered ? t("common.yes") : t("common.no")}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          <CollectionPagination
            page={data.page}
            pageSize={data.pageSize as CollectionPageSize}
            pageSizeLabel={t("table.pageSize")}
            rangeLabel={tf("table.range", {
              from: data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1,
              to: Math.min(data.page * data.pageSize, data.total),
              total: data.total,
            })}
            totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(Number(value) as CollectionPageSize);
            }}
          />
        </Paper>
      )}
      <Modal
        opened={Boolean(purgePreview)}
        onClose={() => setPurgePreview(undefined)}
        title={t("history.purgeTitle")}
      >
        {purgePreview ? (
          <Stack>
            <Alert color="red">{t("history.purgeImpact")}</Alert>
            <Text>
              {tf("history.purgeCounts", {
                eligible: purgePreview.eligible,
                matched: purgePreview.matched,
                preserved: purgePreview.preservedReferenced,
              })}
            </Text>
            <Text>{tf("history.purgeSize", { bytes: purgePreview.estimatedSizeBytes })}</Text>
            <TextInput
              label={tf("history.typeConfirmation", { value: purgePreview.confirmation })}
              value={purgeConfirmation}
              onChange={(event) => setPurgeConfirmation(event.currentTarget.value)}
            />
            {!purgeJob ? (
              <Button
                color="red"
                disabled={purgeConfirmation !== purgePreview.confirmation}
                onClick={() => void enqueuePurge()}
              >
                {t("history.startPurge")}
              </Button>
            ) : null}
            {purgeJob ? (
              <Stack gap="xs">
                <Text fw={600}>
                  {purgeJob.status} · {purgeJob.currentPhase}
                </Text>
                <Progress
                  value={
                    purgeJob.status === "COMPLETED" ? 100 : purgeJob.status === "RUNNING" ? 60 : 10
                  }
                />
                <Code block>{JSON.stringify(purgeJob.deletedCounts, null, 2)}</Code>
                {purgeJob.safeErrorSummary ? (
                  <Alert color="red">{purgeJob.safeErrorSummary}</Alert>
                ) : null}
                {purgeJob.status === "FAILED" ? (
                  <Button onClick={() => void retryPurge()}>{t("history.retry")}</Button>
                ) : null}
                {purgeJob.status === "COMPLETED" ? (
                  <Button
                    onClick={() => {
                      setPurgePreview(undefined);
                      setPurgeJobId(undefined);
                      void dataQuery.refetch();
                    }}
                  >
                    {t("common.close")}
                  </Button>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  );
}
