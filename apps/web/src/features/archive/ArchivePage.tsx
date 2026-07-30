import type { CollectionPageSize, ReportFileFormat, ReportJobRecord } from "@gss-iot/contracts";
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
import { useCallback, useEffect, useState, type ReactElement } from "react";
import {
  CollectionPagination,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@gss-iot/ui";

import { formatDateTime, t, tf, tx } from "../../app/i18n";
import { ApiError, apiDownload, apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { hasPermission } from "../../shared/rbac/has-permission";

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
  const [type, setType] = useState<ArchiveType>("COMPANY");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<CollectionPageSize>(50);
  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [archivedBy, setArchivedBy] = useState("");
  const [archivedFrom, setArchivedFrom] = useState("");
  const [archivedTo, setArchivedTo] = useState("");
  const [data, setData] = useState<ArchiveResponse>();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PurgePreview>();
  const [detail, setDetail] = useState<ArchiveDetail>();
  const [confirmation, setConfirmation] = useState("");
  const [purging, setPurging] = useState(false);
  const [purgeError, setPurgeError] = useState("");
  const [job, setJob] = useState<DeletionJob>();
  const [exportFormat, setExportFormat] = useState<ReportFileFormat>("CSV");
  const [exportJob, setExportJob] = useState<ReportJobRecord>();
  const [exportError, setExportError] = useState("");
  const canPurge = Boolean(
    session &&
    hasPermission(session, "archive.purge") &&
    hasPermission(session, domainPermission[type]),
  );
  const canExport = Boolean(session && hasPermission(session, "reports.export"));

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(false);
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
    if (archivedFrom) query.set("archivedFrom", new Date(archivedFrom).toISOString());
    if (archivedTo) query.set("archivedTo", new Date(archivedTo).toISOString());
    try {
      setData(await apiRequest<ArchiveResponse>(session, `/admin/archive?${query}`));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [
    archivedBy,
    archivedFrom,
    archivedTo,
    areaId,
    buildingId,
    companyId,
    page,
    pageSize,
    search,
    session,
    type,
  ]);

  useEffect(() => void load(), [load]);

  useEffect(() => {
    if (!session || !job || (job.status !== "PENDING" && job.status !== "RUNNING")) return;
    const timer = window.setInterval(async () => {
      try {
        setJob(await apiRequest<DeletionJob>(session, `/admin/archive/purge/jobs/${job.id}`));
      } catch (requestError) {
        setPurgeError(
          requestError instanceof ApiError ? requestError.message : t("archive.jobFailed"),
        );
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [job, session]);

  useEffect(() => {
    if (
      !session ||
      !exportJob ||
      (exportJob.status !== "PENDING" && exportJob.status !== "PROCESSING")
    )
      return;
    const timer = window.setInterval(async () => {
      try {
        setExportJob(await apiRequest<ReportJobRecord>(session, `/admin/reports/${exportJob.id}`));
      } catch (requestError) {
        setExportError(
          requestError instanceof ApiError ? requestError.message : t("archive.exportFailed"),
        );
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [exportJob, session]);

  const archiveFilters = () => ({
    ...(companyId.trim() ? { companyId: companyId.trim() } : {}),
    ...(areaId.trim() ? { areaId: areaId.trim() } : {}),
    ...(buildingId.trim() ? { buildingId: buildingId.trim() } : {}),
    ...(archivedBy.trim() ? { archivedBy: archivedBy.trim() } : {}),
    ...(archivedFrom ? { archivedFrom: new Date(archivedFrom).toISOString() } : {}),
    ...(archivedTo ? { archivedTo: new Date(archivedTo).toISOString() } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    archiveEntityType: type,
  });

  const openDetail = async (row: ArchiveRow) => {
    if (!session) return;
    setDetail(await apiRequest<ArchiveDetail>(session, `/admin/archive/${type}/${row.id}`));
  };

  const openPreview = async (row: ArchiveRow) => {
    if (!session) return;
    setConfirmation("");
    setPurgeError("");
    setJob(undefined);
    setPreview(
      await apiRequest<PurgePreview>(session, "/admin/archive/purge/preview", {
        body: JSON.stringify({ rootId: row.id, rootType: type }),
        method: "POST",
      }),
    );
  };

  const purge = async () => {
    if (!session || !preview || purging) return;
    setPurging(true);
    setPurgeError("");
    try {
      setJob(
        await apiRequest<DeletionJob>(session, "/admin/archive/purge/jobs", {
          body: JSON.stringify({
            confirmation,
            idempotencyKey: crypto.randomUUID(),
            previewHash: preview.previewHash,
            rootId: preview.rootId,
            rootType: preview.rootType,
          }),
          method: "POST",
        }),
      );
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
      setJob(
        await apiRequest<DeletionJob>(session, `/admin/archive/purge/jobs/${job.id}/retry`, {
          body: JSON.stringify({ acknowledgeFailure: true }),
          method: "POST",
        }),
      );
    } catch (requestError) {
      setPurgeError(
        requestError instanceof ApiError ? requestError.message : t("archive.jobFailed"),
      );
    }
  };

  const requestExport = async () => {
    if (!session || !canExport) return;
    setExportError("");
    try {
      setExportJob(
        await apiRequest<ReportJobRecord>(session, "/admin/reports/export", {
          body: JSON.stringify({
            filters: archiveFilters(),
            format: exportFormat,
            reportType: "ARCHIVE_EVIDENCE",
          }),
          method: "POST",
        }),
      );
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
            <Button leftSection={<IconRefresh size={16} />} onClick={() => void load()}>
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
              setPage(1);
              setType(event.currentTarget.value as ArchiveType);
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
              setPage(1);
              setCompanyId(event.currentTarget.value);
            }}
          />
          <TextInput
            label={t("archive.siteFilter")}
            value={areaId}
            onChange={(event) => {
              setPage(1);
              setAreaId(event.currentTarget.value);
            }}
          />
          <TextInput
            label={t("archive.buildingFilter")}
            value={buildingId}
            onChange={(event) => {
              setPage(1);
              setBuildingId(event.currentTarget.value);
            }}
          />
          <TextInput
            label={t("archive.actorFilter")}
            value={archivedBy}
            onChange={(event) => {
              setPage(1);
              setArchivedBy(event.currentTarget.value);
            }}
          />
        </Group>
        <Group align="end" grow mt="sm">
          <TextInput
            type="datetime-local"
            label={t("archive.archivedFrom")}
            value={archivedFrom}
            onChange={(event) => {
              setPage(1);
              setArchivedFrom(event.currentTarget.value);
            }}
          />
          <TextInput
            type="datetime-local"
            label={t("archive.archivedTo")}
            value={archivedTo}
            onChange={(event) => {
              setPage(1);
              setArchivedTo(event.currentTarget.value);
            }}
          />
        </Group>
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
      {loading ? (
        <LoadingState title={t("common.loading")} />
      ) : error ? (
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
              setPage(1);
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
                      setJob(undefined);
                      void load();
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
