import type { CollectionPageSize, ReportFileFormat, ReportJobRecord } from "@gss-iot/contracts";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Code,
  Drawer,
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
import {
  IconAlertTriangle,
  IconArchive,
  IconDownload,
  IconEye,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  CollectionPagination,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@gss-iot/ui";

import { formatDateTime, t, tf, tx } from "../../app/i18n";
import { ApiError, apiDownload } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { LocalDateTimeInput } from "../../shared/date-time/LocalDateTimeInput";
import { normalizeOptionalDateTimeRange } from "../../shared/date-time/local-date-time-range";
import { hasPermission } from "../../shared/rbac/has-permission";
import { apiQueryOptions, useApiMutation, useApiQuery } from "../../shared/query/api-query";
import { queryKeys } from "../../shared/query/query-keys";
import { useCollectionSearchParams } from "../../shared/url/collection-search-params";

const entityTypes = [
  "COMPANY",
  "CONSTRUCTION_AREA",
  "CONSTRUCTION_BUILDING",
  "COMPANY_USER",
  "COMPANY_POSITION",
  "COMPANY_ROLE",
  "ALARM_RULE",
  "ALARM_RECIPIENT_POLICY",
  "ALARM_EVENT",
  "ALARM_NOTIFICATION",
  "GATEWAY_COMMAND",
] as const;

type ArchiveType = (typeof entityTypes)[number];
type ArchiveRow = {
  commandType?: string;
  deleteReason: string | null;
  deletedAt: string;
  deletedById: string | null;
  deletedByType: string | null;
  id: string;
  name?: string | null;
  title?: string | null;
  parentDerived?: boolean;
};
type ArchiveResponse = { items: ArchiveRow[]; page: number; pageSize: number; total: number };
type PurgePreview = {
  counts: Record<string, number>;
  estimatedDeletionRows: number;
  globalDevicesPreserved: { gateways: number; nodes: number };
  previewHash: string;
  rootId: string;
  rootName: string;
  rootType: ArchiveType;
};

type ArchiveDetail = {
  counts: Record<string, number>;
  root: Record<string, unknown>;
  rootType: ArchiveType;
  subtree?: Record<string, unknown>;
};

type DeletionJob = {
  currentPhase: string;
  deletedCounts: Record<string, number>;
  id: string;
  safeErrorSummary: string | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
};

const domainPermission: Record<ArchiveType, string> = {
  ALARM_EVENT: "alarms.manage",
  ALARM_NOTIFICATION: "notifications.manage",
  ALARM_RECIPIENT_POLICY: "alarm-rules.manage",
  ALARM_RULE: "alarm-rules.manage",
  COMPANY: "companies.delete",
  COMPANY_POSITION: "company-users.manage",
  COMPANY_ROLE: "company-roles.manage",
  COMPANY_USER: "company-users.delete",
  CONSTRUCTION_AREA: "areas.delete",
  CONSTRUCTION_BUILDING: "buildings.delete",
  GATEWAY_COMMAND: "mqtt-commands.manage",
};

export function ArchivePage(): ReactElement {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { page, pageSize, search, setPage, setPageSize, setSearch, searchParams, update } =
    useCollectionSearchParams();
  const requestedType = searchParams.get("entityType");
  const type: ArchiveType = entityTypes.includes(requestedType as ArchiveType)
    ? (requestedType as ArchiveType)
    : "COMPANY";
  const companyId = searchParams.get("companyId") ?? "";
  const areaId = searchParams.get("areaId") ?? "";
  const buildingId = searchParams.get("buildingId") ?? "";
  const archivedBy = searchParams.get("archivedBy") ?? "";
  const archivedRange = {
    from: {
      date: searchParams.get("archivedFromDate"),
      time: searchParams.get("archivedFromTime") ?? "",
    },
    to: {
      date: searchParams.get("archivedToDate"),
      time: searchParams.get("archivedToTime") ?? "",
    },
  };
  const [preview, setPreview] = useState<PurgePreview>();
  const [detail, setDetail] = useState<ArchiveDetail>();
  const [confirmation, setConfirmation] = useState("");
  const [purging, setPurging] = useState(false);
  const [purgeError, setPurgeError] = useState("");
  const [jobId, setJobId] = useState<string>();
  const [exportFormat, setExportFormat] = useState<ReportFileFormat>("CSV");
  const [exportJobId, setExportJobId] = useState<string>();
  const [exportError, setExportError] = useState("");
  const canPurge = Boolean(
    session &&
    hasPermission(session, "archive.purge") &&
    hasPermission(session, domainPermission[type]),
  );
  const canExport = Boolean(session && hasPermission(session, "reports.export"));
  const normalizedRange = useMemo(
    () =>
      normalizeOptionalDateTimeRange(archivedRange.from, archivedRange.to, {
        toBoundary: "inclusive",
      }),
    [archivedRange],
  );
  const rangeError = normalizedRange.error
    ? t(
        normalizedRange.error === "reversed"
          ? "common.timeRangeReversed"
          : "common.timeRangeInvalid",
      )
    : undefined;
  const normalizedRangeValue = normalizedRange.value ?? {};

  const archivePath = useMemo(() => {
    const query = new URLSearchParams({
      entityType: type,
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search.trim()) query.set("search", search.trim());
    if (companyId.trim()) query.set("companyId", companyId.trim());
    if (areaId.trim()) query.set("areaId", areaId.trim());
    if (buildingId.trim()) query.set("buildingId", buildingId.trim());
    if (archivedBy.trim()) query.set("archivedBy", archivedBy.trim());
    if (normalizedRangeValue.from) query.set("archivedFrom", normalizedRangeValue.from);
    if (normalizedRangeValue.to) query.set("archivedTo", normalizedRangeValue.to);
    return `/admin/archive?${query}`;
  }, [archivedBy, normalizedRange, areaId, buildingId, companyId, page, pageSize, search, type]);
  const userId = session?.user.id ?? "anonymous";
  const archiveQuery = useApiQuery<ArchiveResponse>(
    session,
    queryKeys.admin.archive(userId, "list", {
      archivedBy,
      archivedFrom: normalizedRangeValue.from,
      archivedTo: normalizedRangeValue.to,
      areaId,
      buildingId,
      companyId,
      page,
      pageSize,
      search,
      type,
    }),
    archivePath,
    { enabled: !normalizedRange.error, placeholderData: keepPreviousData },
  );
  const data = archiveQuery.data;
  const purgeJobKey = queryKeys.admin.archive(userId, "purge-job", { jobId });
  const purgeJobQuery = useApiQuery<DeletionJob>(
    session,
    purgeJobKey,
    `/admin/archive/purge/jobs/${jobId ?? "missing-job"}`,
    {
      enabled: Boolean(jobId),
      refetchInterval: (query) =>
        query.state.data?.status === "PENDING" || query.state.data?.status === "RUNNING"
          ? 1_000
          : false,
    },
  );
  const job = purgeJobQuery.data;
  const exportJobKey = queryKeys.admin.archive(userId, "export-job", { jobId: exportJobId });
  const exportJobQuery = useApiQuery<ReportJobRecord>(
    session,
    exportJobKey,
    `/admin/reports/${exportJobId ?? "missing-job"}`,
    {
      enabled: Boolean(exportJobId),
      refetchInterval: (query) =>
        query.state.data?.status === "PENDING" || query.state.data?.status === "PROCESSING"
          ? 1_000
          : false,
    },
  );
  const exportJob = exportJobQuery.data;
  const previewMutation = useApiMutation<PurgePreview>(session);
  const deletionMutation = useApiMutation<DeletionJob>(session);
  const exportMutation = useApiMutation<ReportJobRecord>(session);

  useEffect(() => {
    if (purgeJobQuery.isError) setPurgeError(t("archive.jobFailed"));
  }, [purgeJobQuery.isError]);
  useEffect(() => {
    if (exportJobQuery.isError) setExportError(t("archive.exportFailed"));
  }, [exportJobQuery.isError]);
  useEffect(() => {
    if (job?.status === "COMPLETED") {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.archive(userId, "list").slice(0, -1),
      });
    }
  }, [job?.status, queryClient, userId]);

  const archiveFilters = () =>
    normalizedRange.error
      ? null
      : {
          ...(companyId.trim() ? { companyId: companyId.trim() } : {}),
          ...(areaId.trim() ? { areaId: areaId.trim() } : {}),
          ...(buildingId.trim() ? { buildingId: buildingId.trim() } : {}),
          ...(archivedBy.trim() ? { archivedBy: archivedBy.trim() } : {}),
          ...(normalizedRange.value.from ? { archivedFrom: normalizedRange.value.from } : {}),
          ...(normalizedRange.value.to ? { archivedTo: normalizedRange.value.to } : {}),
          ...(search.trim() ? { search: search.trim() } : {}),
          archiveEntityType: type,
        };

  const openDetail = async (row: ArchiveRow) => {
    if (!session) return;
    setDetail(
      await queryClient.fetchQuery(
        apiQueryOptions<ArchiveDetail>(
          session,
          queryKeys.admin.archive(userId, "detail", { id: row.id, type }),
          `/admin/archive/${type}/${row.id}`,
        ),
      ),
    );
  };

  const openPreview = async (row: ArchiveRow) => {
    if (!session) return;
    setConfirmation("");
    setPurgeError("");
    setJobId(undefined);
    setPreview(
      await previewMutation.mutateAsync({
        path: "/admin/archive/purge/preview",
        options: { body: JSON.stringify({ rootId: row.id, rootType: type }), method: "POST" },
      }),
    );
  };

  const purge = async () => {
    if (!session || !preview || purging) return;
    setPurging(true);
    setPurgeError("");
    try {
      const created = await deletionMutation.mutateAsync({
        path: "/admin/archive/purge/jobs",
        options: {
          body: JSON.stringify({
            confirmation,
            idempotencyKey: crypto.randomUUID(),
            previewHash: preview.previewHash,
            rootId: preview.rootId,
            rootType: preview.rootType,
          }),
          method: "POST",
        },
      });
      const key = queryKeys.admin.archive(userId, "purge-job", { jobId: created.id });
      queryClient.setQueryData(key, created);
      setJobId(created.id);
    } catch (requestError) {
      const message =
        requestError instanceof ApiError ? requestError.message : t("archive.jobFailed");
      setPurgeError(message);
      if (requestError instanceof ApiError && requestError.status === 409) {
        setConfirmation("");
      }
    } finally {
      setPurging(false);
    }
  };

  const retryJob = async () => {
    if (!session || !job) return;
    setPurgeError("");
    try {
      const retried = await deletionMutation.mutateAsync({
        path: `/admin/archive/purge/jobs/${job.id}/retry`,
        options: {
          body: JSON.stringify({ acknowledgeFailure: true }),
          method: "POST",
        },
      });
      queryClient.setQueryData(purgeJobKey, retried);
    } catch (requestError) {
      setPurgeError(
        requestError instanceof ApiError ? requestError.message : t("archive.jobFailed"),
      );
    }
  };

  const requestExport = async () => {
    if (!session || !canExport) return;
    const filters = archiveFilters();
    if (!filters) return;
    setExportError("");
    try {
      const created = await exportMutation.mutateAsync({
        path: "/admin/reports/export",
        options: {
          body: JSON.stringify({
            filters,
            format: exportFormat,
            reportType: "ARCHIVE_EVIDENCE",
          }),
          method: "POST",
        },
      });
      const key = queryKeys.admin.archive(userId, "export-job", { jobId: created.id });
      queryClient.setQueryData(key, created);
      setExportJobId(created.id);
    } catch (requestError) {
      setExportError(
        requestError instanceof ApiError ? requestError.message : t("archive.exportFailed"),
      );
    }
  };

  const downloadExport = async () => {
    if (!session || !exportJob?.exports[0]) return;
    const result = await apiDownload(
      session,
      `/admin/reports/exports/${exportJob.exports[0].id}/download`,
    );
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack gap="lg">
      <PageHeader
        action={
          <Group>
            {canExport ? (
              <>
                <NativeSelect
                  aria-label={t("archive.exportFormat")}
                  data={["CSV", "XLSX"]}
                  value={exportFormat}
                  onChange={(event) =>
                    setExportFormat(event.currentTarget.value as ReportFileFormat)
                  }
                />
                <Button
                  leftSection={<IconDownload size={16} />}
                  variant="light"
                  onClick={() => void requestExport()}
                >
                  {t("archive.export")}
                </Button>
              </>
            ) : null}
            <Button
              leftSection={<IconRefresh size={16} />}
              loading={archiveQuery.isFetching}
              onClick={() => void archiveQuery.refetch()}
            >
              {t("archive.refresh")}
            </Button>
          </Group>
        }
        subtitle={t("archive.description")}
        title={t("archive.title")}
      />
      <Paper p="md" withBorder>
        <Group align="end" grow>
          <NativeSelect
            data={entityTypes.map((value) => ({
              label: tx(`archive.type.${value}`, value),
              value,
            }))}
            label={t("archive.entityType")}
            onChange={(event) => {
              update({ entityType: event.currentTarget.value, page: 1 });
            }}
            value={type}
          />
          <TextInput
            label={t("archive.search")}
            onChange={(event) => {
              setPage(1);
              setSearch(event.currentTarget.value);
            }}
            value={search}
          />
        </Group>
        <Group align="end" grow mt="sm">
          <TextInput
            label={t("archive.companyFilter")}
            value={companyId}
            onChange={(event) => {
              update({ companyId: event.currentTarget.value, page: 1 });
            }}
          />
          <TextInput
            label={t("archive.siteFilter")}
            value={areaId}
            onChange={(event) => {
              update({ areaId: event.currentTarget.value, page: 1 });
            }}
          />
          <TextInput
            label={t("archive.buildingFilter")}
            value={buildingId}
            onChange={(event) => {
              update({ buildingId: event.currentTarget.value, page: 1 });
            }}
          />
          <TextInput
            label={t("archive.actorFilter")}
            value={archivedBy}
            onChange={(event) => {
              update({ archivedBy: event.currentTarget.value, page: 1 });
            }}
          />
        </Group>
        <Group align="end" grow mt="sm">
          <LocalDateTimeInput
            label={t("archive.archivedFrom")}
            value={archivedRange.from}
            onChange={(value) => {
              update({ archivedFromDate: value.date, archivedFromTime: value.time, page: 1 });
            }}
          />
          <LocalDateTimeInput
            label={t("archive.archivedTo")}
            value={archivedRange.to}
            onChange={(value) => {
              update({ archivedToDate: value.date, archivedToTime: value.time, page: 1 });
            }}
          />
        </Group>
        {rangeError ? (
          <Alert color="red" mt="sm">
            {rangeError}
          </Alert>
        ) : null}
      </Paper>
      {exportError ? <Alert color="red">{exportError}</Alert> : null}
      {exportJob ? (
        <Alert
          color={exportJob.status === "FAILED" ? "red" : "blue"}
          title={t("archive.exportStatus")}
        >
          <Group justify="space-between">
            <Text>
              {exportJob.status} · {exportJob.progress}%
            </Text>
            {exportJob.status === "COMPLETED" && exportJob.exports[0] ? (
              <Button size="xs" onClick={() => void downloadExport()}>
                {t("archive.downloadEvidence")}
              </Button>
            ) : null}
          </Group>
        </Alert>
      ) : null}
      {archiveQuery.isPending ? (
        <LoadingState title={t("common.loading")} />
      ) : archiveQuery.isError ? (
        <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />
      ) : !data?.items.length ? (
        <EmptyState description={t("archive.emptyDescription")} title={t("archive.emptyTitle")} />
      ) : (
        <Paper withBorder>
          <Table.ScrollContainer minWidth={780}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("archive.record")}</Table.Th>
                  <Table.Th>{t("archive.archivedAt")}</Table.Th>
                  <Table.Th>{t("archive.actor")}</Table.Th>
                  <Table.Th>{t("archive.reason")}</Table.Th>
                  <Table.Th>{t("common.actions")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.items.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconArchive size={16} />
                        <Text>{row.name ?? row.title ?? row.commandType ?? row.id}</Text>
                        {row.parentDerived ? (
                          <Badge variant="outline">{t("archive.parentDerived")}</Badge>
                        ) : null}
                      </Group>
                    </Table.Td>
                    <Table.Td>{formatDateTime(row.deletedAt)}</Table.Td>
                    <Table.Td>
                      <Badge variant="light">
                        {row.deletedByType ?? t("archive.unknownActor")}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{row.deleteReason ?? t("archive.noReason")}</Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Button
                          leftSection={<IconEye size={16} />}
                          size="xs"
                          variant="subtle"
                          onClick={() => void openDetail(row)}
                        >
                          {t("archive.viewDetail")}
                        </Button>
                        {canPurge ? (
                          <Button
                            color="red"
                            leftSection={<IconTrash size={16} />}
                            size="xs"
                            variant="subtle"
                            onClick={() => void openPreview(row)}
                          >
                            {t("archive.permanentDelete")}
                          </Button>
                        ) : null}
                      </Group>
                    </Table.Td>
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
        opened={Boolean(preview)}
        onClose={() => setPreview(undefined)}
        title={t("archive.confirmTitle")}
      >
        {preview ? (
          <Stack>
            <Alert
              color="red"
              icon={<IconAlertTriangle size={18} />}
              title={t("archive.irreversibleTitle")}
            >
              {t("archive.irreversibleDescription")}
            </Alert>
            <Text>
              {t("archive.estimatedRows")}: {preview.estimatedDeletionRows}
            </Text>
            <Text>
              {t("archive.devicesPreserved")}: {preview.globalDevicesPreserved.gateways} /{" "}
              {preview.globalDevicesPreserved.nodes}
            </Text>
            <TextInput
              label={t("archive.typeToConfirm")}
              value={confirmation}
              onChange={(event) => setConfirmation(event.currentTarget.value)}
            />
            <Button
              color="red"
              disabled={confirmation !== preview.rootName}
              loading={purging}
              onClick={() => void purge()}
            >
              {t("archive.enqueuePurge")}
            </Button>
            {purgeError ? <Alert color="red">{purgeError}</Alert> : null}
            {job ? (
              <Stack gap="xs">
                <Text fw={600}>
                  {job.status} · {job.currentPhase}
                </Text>
                <Progress
                  value={
                    job.status === "COMPLETED"
                      ? 100
                      : job.status === "RUNNING"
                        ? 60
                        : job.status === "PENDING"
                          ? 10
                          : 0
                  }
                />
                <Code block>{JSON.stringify(job.deletedCounts, null, 2)}</Code>
                {job.safeErrorSummary ? <Alert color="red">{job.safeErrorSummary}</Alert> : null}
                {job.status === "FAILED" ? (
                  <Button variant="light" onClick={() => void retryJob()}>
                    {t("archive.retry")}
                  </Button>
                ) : null}
                {job.status === "COMPLETED" ? (
                  <Button
                    onClick={() => {
                      setPreview(undefined);
                      setJobId(undefined);
                      void archiveQuery.refetch();
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
      <Drawer
        opened={Boolean(detail)}
        onClose={() => setDetail(undefined)}
        position="right"
        size="lg"
        title={t("archive.detailTitle")}
      >
        {detail ? (
          <Stack>
            <Text fw={600}>{detail.rootType}</Text>
            <Text>{t("archive.dependencyCounts")}</Text>
            <Code block>{JSON.stringify(detail.counts, null, 2)}</Code>
            <Text>{t("archive.evidence")}</Text>
            <Code block>{JSON.stringify(detail.root, null, 2)}</Code>
            {detail.subtree ? <Code block>{JSON.stringify(detail.subtree, null, 2)}</Code> : null}
          </Stack>
        ) : null}
      </Drawer>
    </Stack>
  );
}
