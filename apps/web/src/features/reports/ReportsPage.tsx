import type {
  AreaRecord,
  BuildingRecord,
  CollectionPageSize,
  CompanyDeviceInventoryResponse,
  CompanyRecord,
  GatewayRecord,
  NodeRecord,
  PaginatedResponse,
  ReportFileFormat,
  ReportJobRecord,
  ReportJobStatus,
  ReportType,
} from "@gss-iot/contracts";
import {
  Alert,
  Box,
  Button,
  Group,
  NativeSelect,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconDownload,
  IconRefresh,
  IconReportAnalytics,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";

import { formatDateTime, nodeTypeLabel, t, tf, tx } from "../../app/i18n";
import { ApiError, apiDownload, apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { hasPermission } from "../../shared/rbac/has-permission";
import {
  CollectionPagination,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@gss-iot/ui";
import {
  COMPANY_REPORT_TYPES,
  GSS_REPORT_TYPE_PERMISSIONS,
  maxDateRangeDays,
  REPORT_DATE_FILTER_TYPES,
  REPORT_DEVICE_FILTER_TYPES,
  REPORT_TYPES,
} from "./report-config";

export type ReportFilters = {
  companyId: string | null;
  areaId: string | null;
  buildingId: string | null;
  gatewayId: string | null;
  nodeTypeId: string | null;
  nodeId: string | null;
  from: string;
  to: string;
};

type ReportListResponse = {
  items: ReportJobRecord[];
  page: number;
  pageSize: number;
  total: number;
};

interface ReportOptions {
  companies: CompanyRecord[];
  areas: AreaRecord[];
  buildings: BuildingRecord[];
  gateways: GatewayRecord[];
  nodes: NodeRecord[];
}

interface ReportsWorkspaceProps {
  basePath: "/admin" | "/company";
  isAdmin: boolean;
  options: ReportOptions;
  optionsError?: boolean;
  onCompanyChange?: (companyId: string | null) => void;
}

const emptyFilters = (): ReportFilters => ({
  areaId: null,
  buildingId: null,
  companyId: null,
  from: "",
  gatewayId: null,
  nodeId: null,
  nodeTypeId: null,
  to: "",
});

function reportLabel(reportType: ReportType): string {
  return tx(`reports.type.${reportType}`, reportType);
}

function statusLabel(status: ReportJobStatus): string {
  return tx(`reports.status.${status}`, status);
}

function formatLabel(format: ReportFileFormat): string {
  return tx(`reports.format.${format}`, format);
}

function dateText(value: string | null | undefined): string {
  return value ? formatDateTime(value) : t("reports.notAvailable");
}

function displayFailure(message: string | null): string | undefined {
  if (!message) return undefined;
  const safe = message.replace(/(?:https?:\/\/|s3:\/\/|[A-Za-z]:\\|\/var\/|\/tmp\/)[^\s]*/gi, "");
  return safe.slice(0, 300);
}

export function cleanReportFilters(
  filters: ReportFilters,
  isAdmin: boolean,
): Record<string, string> {
  const entries: Array<[string, string | null]> = [
    ["areaId", filters.areaId],
    ["buildingId", filters.buildingId],
    ["companyId", isAdmin ? filters.companyId : null],
    ["from", filters.from],
    ["gatewayId", filters.gatewayId],
    ["nodeId", filters.nodeId],
    ["nodeTypeId", filters.nodeTypeId],
    ["to", filters.to],
  ];
  return Object.fromEntries(entries.filter(([, value]) => Boolean(value))) as Record<
    string,
    string
  >;
}

export function dateRangeError(reportType: ReportType, filters: ReportFilters): string | undefined {
  if (!filters.from && !filters.to) return undefined;
  if (!filters.from || !filters.to) return t("reports.validationBothDates");
  const from = new Date(`${filters.from}T00:00:00.000Z`);
  const to = new Date(`${filters.to}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return t("reports.validationDateOrder");
  }
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  const maximum = maxDateRangeDays(reportType);
  return days > maximum ? tf("reports.validationMaximumDays", { days: maximum }) : undefined;
}

function reportStatusBadge(status: ReportJobStatus): ReactElement {
  return (
    <StatusBadge
      label={statusLabel(status)}
      status={
        status === "PENDING"
          ? "pending"
          : status === "PROCESSING"
            ? "processing"
            : status === "COMPLETED"
              ? "completed"
              : "failed"
      }
    />
  );
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

function reportScope(job: ReportJobRecord): string {
  if (job.buildingId) return t("reports.scopeBuilding");
  if (job.areaId) return t("reports.scopeSite");
  if (job.companyId) return t("reports.scopeCompany");
  return t("reports.scopeAll");
}

function ReportJobsTable({
  jobs,
  canExport,
  onDownload,
  downloadingId,
}: {
  jobs: ReportJobRecord[];
  canExport: boolean;
  onDownload: (job: ReportJobRecord) => void;
  downloadingId: string | null;
}) {
  const mobileJobs = jobs.map((job) => {
    const exportRecord = job.exports[0];
    const expired = exportRecord ? isExpired(exportRecord.expiresAt) : false;
    return (
      <Paper key={job.id} p="md" withBorder>
        <Stack gap="xs">
          <Group align="flex-start" justify="space-between" wrap="nowrap">
            <Text fw={700} style={{ minWidth: 0 }}>
              {reportLabel(job.reportType)}
            </Text>
            <Box style={{ flexShrink: 0 }}>{reportStatusBadge(job.status)}</Box>
          </Group>
          <Text c="dimmed" size="sm">
            {reportScope(job)}
          </Text>
          <Text c="dimmed" size="xs">
            {dateText(job.createdAt)}
          </Text>
          {job.status === "FAILED" && displayFailure(job.errorMessage) ? (
            <Text c="red" size="xs">
              {displayFailure(job.errorMessage)}
            </Text>
          ) : null}
          {job.status === "COMPLETED" && exportRecord && !expired && canExport ? (
            <Button
              aria-label={`${t("reports.download")} ${exportRecord.fileName}`}
              disabled={downloadingId === exportRecord.id}
              leftSection={<IconDownload size={16} />}
              loading={downloadingId === exportRecord.id}
              onClick={() => onDownload(job)}
              size="xs"
              variant="light"
            >
              {t("reports.download")}
            </Button>
          ) : null}
        </Stack>
      </Paper>
    );
  });
  return (
    <>
      <Stack gap="sm" hiddenFrom="sm">
        {mobileJobs}
      </Stack>
      <Box visibleFrom="sm">
        <Table.ScrollContainer minWidth={980}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("reports.reportType")}</Table.Th>
                <Table.Th>{t("reports.scope")}</Table.Th>
                <Table.Th>{t("reports.statusLabel")}</Table.Th>
                <Table.Th>{t("reports.progress")}</Table.Th>
                <Table.Th>{t("reports.createdAt")}</Table.Th>
                <Table.Th>{t("reports.completedAt")}</Table.Th>
                <Table.Th>{t("reports.expiration")}</Table.Th>
                <Table.Th>{t("reports.actions")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {jobs.map((job) => {
                const exportRecord = job.exports[0];
                const expired = exportRecord ? isExpired(exportRecord.expiresAt) : false;
                return (
                  <Table.Tr key={job.id}>
                    <Table.Td>{reportLabel(job.reportType)}</Table.Td>
                    <Table.Td>{reportScope(job)}</Table.Td>
                    <Table.Td>
                      <Stack gap={3}>
                        {reportStatusBadge(job.status)}
                        {job.status === "FAILED" && displayFailure(job.errorMessage) ? (
                          <Text c="red" size="xs">
                            {displayFailure(job.errorMessage)}
                          </Text>
                        ) : null}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      {job.status === "PENDING" || job.status === "PROCESSING"
                        ? `${job.progress}%`
                        : t("reports.notAvailable")}
                    </Table.Td>
                    <Table.Td>{dateText(job.createdAt)}</Table.Td>
                    <Table.Td>{dateText(job.completedAt)}</Table.Td>
                    <Table.Td>
                      {exportRecord ? (
                        <Stack gap={3}>
                          <Text size="sm">{formatLabel(exportRecord.format)}</Text>
                          <Text c={expired ? "red" : undefined} size="xs">
                            {expired
                              ? t("reports.expired")
                              : tf("reports.expiresAt", { date: dateText(exportRecord.expiresAt) })}
                          </Text>
                        </Stack>
                      ) : (
                        t("reports.notAvailable")
                      )}
                    </Table.Td>
                    <Table.Td>
                      {job.status === "COMPLETED" && exportRecord && !expired && canExport ? (
                        <Button
                          aria-label={`${t("reports.download")} ${exportRecord.fileName}`}
                          disabled={downloadingId === exportRecord.id}
                          leftSection={<IconDownload size={16} />}
                          loading={downloadingId === exportRecord.id}
                          onClick={() => onDownload(job)}
                          size="xs"
                          variant="light"
                        >
                          {t("reports.download")}
                        </Button>
                      ) : job.status === "COMPLETED" && exportRecord && expired ? (
                        <Text c="red" size="sm">
                          {t("reports.expired")}
                        </Text>
                      ) : null}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Box>
    </>
  );
}

function ReportFiltersForm({
  filters,
  reportType,
  reportTypes,
  format,
  isAdmin,
  options,
  canExport,
  submitting,
  validationError,
  onFiltersChange,
  onReportTypeChange,
  onFormatChange,
  onSubmit,
}: {
  filters: ReportFilters;
  reportType: ReportType;
  reportTypes: ReportType[];
  format: ReportFileFormat;
  isAdmin: boolean;
  options: ReportOptions;
  canExport: boolean;
  submitting: boolean;
  validationError?: string;
  onFiltersChange: (next: ReportFilters) => void;
  onReportTypeChange: (next: ReportType) => void;
  onFormatChange: (next: ReportFileFormat) => void;
  onSubmit: () => void;
}) {
  const deviceFilters = REPORT_DEVICE_FILTER_TYPES.has(reportType);
  const dateFilters = REPORT_DATE_FILTER_TYPES.has(reportType);
  const filteredBuildings = filters.areaId
    ? options.buildings.filter((building) => building.areaId === filters.areaId)
    : options.buildings;
  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Group align="flex-end" justify="space-between">
          <Select
            aria-label={t("reports.reportType")}
            data={reportTypes.map((type) => ({ label: reportLabel(type), value: type }))}
            label={t("reports.reportType")}
            onChange={(value) => value && onReportTypeChange(value as ReportType)}
            value={reportType}
          />
          <NativeSelect
            data={[
              { label: formatLabel("CSV"), value: "CSV" },
              { label: formatLabel("XLSX"), value: "XLSX" },
            ]}
            label={t("reports.format")}
            onChange={(event) => onFormatChange(event.currentTarget.value as ReportFileFormat)}
            value={format}
          />
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {isAdmin ? (
            <Select
              clearable
              data={options.companies.map((company) => ({
                label: company.name,
                value: company.id,
              }))}
              label={t("reports.company")}
              onChange={(value) =>
                onFiltersChange({ ...filters, areaId: null, buildingId: null, companyId: value })
              }
              value={filters.companyId}
            />
          ) : null}
          <Select
            clearable
            data={options.areas.map((area) => ({ label: area.name, value: area.id }))}
            label={t("reports.site")}
            onChange={(value) =>
              onFiltersChange({
                ...filters,
                areaId: value,
                buildingId:
                  value &&
                  options.buildings.some(
                    (building) => building.id === filters.buildingId && building.areaId === value,
                  )
                    ? filters.buildingId
                    : null,
              })
            }
            value={filters.areaId}
          />
          <Select
            clearable
            data={filteredBuildings.map((building) => ({
              label: building.title,
              value: building.id,
            }))}
            label={t("reports.building")}
            onChange={(value) => onFiltersChange({ ...filters, buildingId: value })}
            value={filters.buildingId}
          />
          {deviceFilters ? (
            <>
              <Select
                clearable
                data={options.gateways.map((gateway) => ({
                  label: gateway.serialNumber,
                  value: gateway.id,
                }))}
                label={t("reports.gateway")}
                onChange={(value) => onFiltersChange({ ...filters, gatewayId: value })}
                value={filters.gatewayId}
              />
              <Select
                clearable
                data={Array.from(
                  new Map(options.nodes.map((node) => [node.nodeTypeId, node.nodeType])).values(),
                ).map((nodeType) => ({
                  label: nodeTypeLabel(nodeType.key, nodeType.displayName),
                  value: nodeType.id,
                }))}
                label={t("reports.nodeType")}
                onChange={(value) =>
                  onFiltersChange({ ...filters, nodeTypeId: value, nodeId: null })
                }
                value={filters.nodeTypeId}
              />
              <Select
                clearable
                data={options.nodes
                  .filter((node) => !filters.nodeTypeId || node.nodeTypeId === filters.nodeTypeId)
                  .map((node) => ({ label: node.number, value: node.id }))}
                label={t("reports.node")}
                onChange={(value) => onFiltersChange({ ...filters, nodeId: value })}
                value={filters.nodeId}
              />
            </>
          ) : null}
          {dateFilters ? (
            <>
              <TextInput
                aria-label={t("reports.dateFrom")}
                label={t("reports.dateFrom")}
                onChange={(event) =>
                  onFiltersChange({ ...filters, from: event.currentTarget.value })
                }
                type="date"
                value={filters.from}
              />
              <TextInput
                aria-label={t("reports.dateTo")}
                description={tf("reports.maximumDateRange", { days: maxDateRangeDays(reportType) })}
                label={t("reports.dateTo")}
                onChange={(event) => onFiltersChange({ ...filters, to: event.currentTarget.value })}
                type="date"
                value={filters.to}
              />
            </>
          ) : null}
        </SimpleGrid>
        {validationError ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />} role="alert">
            {validationError}
          </Alert>
        ) : null}
        <Button
          disabled={!canExport || Boolean(validationError)}
          loading={submitting}
          onClick={onSubmit}
        >
          {canExport ? t("reports.requestExport") : t("reports.exportPermissionRequired")}
        </Button>
      </Stack>
    </Paper>
  );
}

export function ReportsWorkspace({
  basePath,
  isAdmin,
  options,
  optionsError,
  onCompanyChange,
}: ReportsWorkspaceProps) {
  const { session } = useAuth();
  const canView = hasPermission(session, "reports.view");
  const canExport = hasPermission(session, "reports.export");
  const [reportType, setReportType] = useState<ReportType>(
    isAdmin ? "COMPANY_SUMMARY" : "SITE_SUMMARY",
  );
  const [format, setFormat] = useState<ReportFileFormat>("CSV");
  const [filters, setFilters] = useState<ReportFilters>(emptyFilters);
  const [jobs, setJobs] = useState<ReportJobRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloadError, setDownloadError] = useState<string>();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<CollectionPageSize>(50);
  const loadRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const queryPath = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    const reportPermission = isAdmin ? GSS_REPORT_TYPE_PERMISSIONS[reportType] : undefined;
    if (!isAdmin || !reportPermission || hasPermission(session, reportPermission)) {
      params.set("reportType", reportType);
    }
    const listFilters = cleanReportFilters(filters, isAdmin);
    for (const key of ["companyId", "areaId", "buildingId"]) {
      if (listFilters[key]) params.set(key, listFilters[key]);
    }
    return `${basePath}/reports?${params.toString()}`;
  }, [basePath, filters, isAdmin, page, pageSize, reportType, session]);

  const load = useCallback(async () => {
    if (!session || !canView) return;
    setRefreshing(true);
    try {
      const response = await apiRequest<ReportListResponse>(session, queryPath);
      setJobs(response.items);
      setTotal(response.total);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canView, queryPath, session]);

  loadRef.current = load;
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!jobs.some((job) => job.status === "PENDING" || job.status === "PROCESSING")) return;
    const timer = window.setInterval(() => void loadRef.current?.(), 2_000);
    return () => window.clearInterval(timer);
  }, [jobs]);

  const availableReportTypes = (isAdmin ? REPORT_TYPES : COMPANY_REPORT_TYPES).filter((type) => {
    const permission = GSS_REPORT_TYPE_PERMISSIONS[type];
    return !isAdmin || !permission || hasPermission(session, permission);
  });

  useEffect(() => {
    if (!availableReportTypes.includes(reportType)) {
      setReportType(availableReportTypes[0] ?? (isAdmin ? "COMPANY_SUMMARY" : "SITE_SUMMARY"));
    }
  }, [availableReportTypes, isAdmin, reportType]);

  const onReportTypeChange = (next: ReportType) => {
    setPage(1);
    setReportType(next);
    setFilters((current) => ({
      ...current,
      from: REPORT_DATE_FILTER_TYPES.has(next) ? current.from : "",
      gatewayId: REPORT_DEVICE_FILTER_TYPES.has(next) ? current.gatewayId : null,
      nodeId: REPORT_DEVICE_FILTER_TYPES.has(next) ? current.nodeId : null,
      nodeTypeId: REPORT_DEVICE_FILTER_TYPES.has(next) ? current.nodeTypeId : null,
      to: REPORT_DATE_FILTER_TYPES.has(next) ? current.to : "",
    }));
  };

  const validationError = REPORT_DATE_FILTER_TYPES.has(reportType)
    ? dateRangeError(reportType, filters)
    : undefined;

  const submit = async () => {
    if (!session || !canExport || submitting || validationError) return;
    setSubmitting(true);
    setDownloadError(undefined);
    try {
      await apiRequest<ReportJobRecord>(session, `${basePath}/reports/export`, {
        body: JSON.stringify({ reportType, format, filters: cleanReportFilters(filters, isAdmin) }),
        method: "POST",
      });
      await load();
    } catch (requestError) {
      setDownloadError(
        requestError instanceof ApiError ? requestError.message : t("reports.exportFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const download = async (job: ReportJobRecord) => {
    if (!session || !canExport || downloadingId) return;
    const exportRecord = job.exports[0];
    if (!exportRecord || isExpired(exportRecord.expiresAt)) return;
    setDownloadingId(exportRecord.id);
    setDownloadError(undefined);
    try {
      const result = await apiDownload(
        session,
        `${basePath}/reports/exports/${exportRecord.id}/download`,
      );
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName || exportRecord.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (requestError) {
      setDownloadError(
        requestError instanceof ApiError ? requestError.message : t("reports.downloadFailed"),
      );
    } finally {
      setDownloadingId(null);
    }
  };

  if (!canView) return null;
  if (loading && !jobs.length) return <LoadingState title={t("common.loading")} />;
  if (error && !jobs.length) {
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;
  }

  return (
    <Stack gap="lg">
      <PageHeader
        action={
          <Button
            leftSection={<IconRefresh size={16} />}
            loading={refreshing}
            onClick={() => void load()}
            variant="light"
          >
            {t("reports.refresh")}
          </Button>
        }
        subtitle={t(isAdmin ? "reports.adminSubtitle" : "reports.companySubtitle")}
        title={t("reports.title")}
      />
      {optionsError ? <Alert color="yellow">{t("reports.optionsUnavailable")}</Alert> : null}
      {downloadError ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />} role="alert">
          {downloadError}
        </Alert>
      ) : null}
      <ReportFiltersForm
        canExport={canExport}
        filters={filters}
        isAdmin={isAdmin}
        format={format}
        onFiltersChange={(next) => {
          setPage(1);
          setFilters(next);
          if (next.companyId !== filters.companyId) onCompanyChange?.(next.companyId);
        }}
        onReportTypeChange={onReportTypeChange}
        onFormatChange={setFormat}
        onSubmit={() => void submit()}
        options={options}
        reportType={reportType}
        reportTypes={availableReportTypes}
        submitting={submitting}
        validationError={validationError}
      />
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <IconReportAnalytics size={20} />
            <Text fw={600}>{t("reports.jobsTitle")}</Text>
          </Group>
          <Text c="dimmed" size="sm">
            {tf("reports.totalJobs", { count: total })}
          </Text>
        </Group>
        {error ? <Alert color="yellow">{t("reports.backgroundRefreshFailed")}</Alert> : null}
        <CollectionPagination
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(Number(value) as CollectionPageSize);
            setPage(1);
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
        {jobs.length ? (
          <ReportJobsTable
            canExport={canExport}
            downloadingId={downloadingId}
            jobs={jobs}
            onDownload={(job) => void download(job)}
          />
        ) : (
          <EmptyState description={t("reports.emptyDescription")} title={t("reports.emptyTitle")} />
        )}
      </Paper>
    </Stack>
  );
}

export function AdminReportsPage() {
  const { session } = useAuth();
  const [options, setOptions] = useState<ReportOptions>({
    areas: [],
    buildings: [],
    companies: [],
    gateways: [],
    nodes: [],
  });
  const [optionsError, setOptionsError] = useState(false);

  useEffect(() => {
    if (!session || !hasPermission(session, "reports.view")) return;
    const load = async () => {
      try {
        const [companies, gateways, nodes] = await Promise.all([
          hasPermission(session, "companies.view")
            ? apiRequest<PaginatedResponse<CompanyRecord>>(session, "/admin/companies?pageSize=100")
            : Promise.resolve({ items: [] } as Pick<PaginatedResponse<CompanyRecord>, "items">),
          hasPermission(session, "gateways.view")
            ? apiRequest<PaginatedResponse<GatewayRecord>>(
                session,
                "/admin/devices/gateways?pageSize=100",
              )
            : Promise.resolve({ items: [] } as Pick<PaginatedResponse<GatewayRecord>, "items">),
          hasPermission(session, "nodes.view")
            ? apiRequest<PaginatedResponse<NodeRecord>>(
                session,
                "/admin/devices/nodes?pageSize=100",
              )
            : Promise.resolve({ items: [] } as Pick<PaginatedResponse<NodeRecord>, "items">),
        ]);
        setOptions((current) => ({
          ...current,
          companies: companies.items,
          gateways: gateways.items,
          nodes: nodes.items,
        }));
      } catch {
        setOptionsError(true);
      }
    };
    void load();
  }, [session]);

  const loadCompany = useCallback(
    async (companyId: string | null) => {
      if (!session || !companyId) {
        setOptions((current) => ({ ...current, areas: [], buildings: [] }));
        return;
      }
      try {
        const [areas, buildings] = await Promise.all([
          apiRequest<PaginatedResponse<AreaRecord>>(
            session,
            `/admin/companies/${companyId}/areas?pageSize=100`,
          ),
          apiRequest<PaginatedResponse<BuildingRecord>>(
            session,
            `/admin/companies/${companyId}/buildings?pageSize=100`,
          ),
        ]);
        setOptions((current) => ({ ...current, areas: areas.items, buildings: buildings.items }));
      } catch {
        setOptionsError(true);
      }
    },
    [session],
  );

  return (
    <ReportsWorkspace
      basePath="/admin"
      isAdmin
      onCompanyChange={loadCompany}
      options={options}
      optionsError={optionsError}
    />
  );
}

export function CompanyReportsPage() {
  const { session } = useAuth();
  const [options, setOptions] = useState<ReportOptions>({
    areas: [],
    buildings: [],
    companies: [],
    gateways: [],
    nodes: [],
  });
  const [optionsError, setOptionsError] = useState(false);

  useEffect(() => {
    if (!session || !hasPermission(session, "reports.view")) return;
    const load = async () => {
      try {
        const [areas, buildings, devices] = await Promise.all([
          hasPermission(session, "areas.view")
            ? apiRequest<PaginatedResponse<AreaRecord>>(session, "/company/areas?pageSize=100")
            : Promise.resolve({ items: [] } as Pick<PaginatedResponse<AreaRecord>, "items">),
          hasPermission(session, "buildings.view")
            ? apiRequest<PaginatedResponse<BuildingRecord>>(
                session,
                "/company/buildings?pageSize=100",
              )
            : Promise.resolve({ items: [] } as Pick<PaginatedResponse<BuildingRecord>, "items">),
          hasPermission(session, "company-devices.view")
            ? apiRequest<CompanyDeviceInventoryResponse>(
                session,
                "/company/devices?gatewayPageSize=100&nodePageSize=100",
              )
            : Promise.resolve({
                gateways: { items: [] },
                nodes: { items: [] },
              } as unknown as CompanyDeviceInventoryResponse),
        ]);
        setOptions((current) => ({
          ...current,
          areas: areas.items,
          buildings: buildings.items,
          gateways: devices.gateways.items,
          nodes: devices.nodes.items,
        }));
      } catch {
        setOptionsError(true);
      }
    };
    void load();
  }, [session]);

  return (
    <ReportsWorkspace
      basePath="/company"
      isAdmin={false}
      options={options}
      optionsError={optionsError}
    />
  );
}
