import type { DashboardRange, DashboardSummary, ReportJobRecord } from "@gss-iot/contracts";
import {
  Box,
  Group,
  Paper,
  NativeSelect,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  IconActivity,
  IconAlertTriangle,
  IconBellRinging,
  IconBuilding,
  IconChartBar,
  IconDeviceDesktopAnalytics,
  IconReportAnalytics,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { t, tf } from "../../app/i18n";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { hasPermission } from "../../shared/rbac/has-permission";
import {
  DashboardKpiCard,
  DashboardSection,
  EmptyState,
  ErrorState,
  GssButton,
  PageHeader,
  StatusBadge,
} from "@gss-iot/ui";
import {
  ChartTooltip,
  chartTooltipPosition,
  type ChartTooltipState,
} from "../../shared/ui/ChartTooltip";

function statusLabel(status: ReportJobRecord["status"]): string {
  return t(`reports.status.${status}` as never);
}

export function ReportsDashboardCard({ basePath }: { basePath: "/admin" | "/company" }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<ReportJobRecord[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || !hasPermission(session, "reports.view")) {
      setLoading(false);
      return;
    }
    void apiRequest<{ items: ReportJobRecord[] }>(session, `${basePath}/reports?page=1&pageSize=50`)
      .then((response) => setJobs(response.items.slice(0, 5)))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [basePath, session]);

  if (!hasPermission(session, "reports.view")) return null;
  if (loading)
    return (
      <DashboardSection
        accent="indigo"
        icon={<IconReportAnalytics size={18} />}
        subtitle={t("reports.dashboardSubtitle")}
        title={t("reports.dashboardTitle")}
      >
        <Skeleton height={92} />
      </DashboardSection>
    );
  if (error)
    return (
      <DashboardSection
        accent="indigo"
        icon={<IconReportAnalytics size={18} />}
        subtitle={t("common.errorDescription")}
        title={t("reports.dashboardTitle")}
      >
        <Text c="red" size="sm">
          {t("common.errorTitle")}
        </Text>
      </DashboardSection>
    );

  const counts = {
    completed: jobs.filter((job) => job.status === "COMPLETED").length,
    failed: jobs.filter((job) => job.status === "FAILED").length,
    pending: jobs.filter((job) => job.status === "PENDING").length,
    processing: jobs.filter((job) => job.status === "PROCESSING").length,
  };

  return (
    <DashboardSection
      accent="indigo"
      action={
        <GssButton onClick={() => void navigate(`${basePath}/reports`)} variant="soft">
          {t("reports.dashboardOpen")}
        </GssButton>
      }
      icon={<IconReportAnalytics size={18} />}
      subtitle={t("reports.dashboardSubtitle")}
      title={t("reports.dashboardTitle")}
    >
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        {(["PENDING", "PROCESSING", "COMPLETED", "FAILED"] as const).map((status) => (
          <Paper
            className={`gss-status-tile gss-status-${status.toLowerCase()}`}
            key={status}
            p="sm"
            withBorder
          >
            <Text c="dimmed" size="xs">
              {statusLabel(status)}
            </Text>
            <Text fw={700} size="xl">
              {counts[status.toLowerCase() as keyof typeof counts]}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
      {jobs.length ? (
        <>
          <Box hiddenFrom="sm">
            <Stack gap="xs">
              {jobs.map((job) => (
                <Paper key={job.id} p="sm" withBorder>
                  <Group align="flex-start" justify="space-between" wrap="nowrap">
                    <Stack gap={4} style={{ minWidth: 0 }}>
                      <Text fw={700}>{t(`reports.type.${job.reportType}` as never)}</Text>
                      <Text c="dimmed" size="sm">
                        {new Date(job.createdAt).toLocaleString()}
                      </Text>
                    </Stack>
                    <Box style={{ flexShrink: 0 }}>
                      <StatusBadge
                        label={statusLabel(job.status)}
                        status={
                          job.status === "PENDING"
                            ? "pending"
                            : job.status === "PROCESSING"
                              ? "processing"
                              : job.status === "COMPLETED"
                                ? "completed"
                                : "failed"
                        }
                      />
                    </Box>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Box>
          <Box visibleFrom="sm">
            <Table.ScrollContainer minWidth={520}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t("reports.reportType")}</Table.Th>
                    <Table.Th>{t("reports.statusLabel")}</Table.Th>
                    <Table.Th>{t("reports.createdAt")}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {jobs.map((job) => (
                    <Table.Tr key={job.id}>
                      <Table.Td>{t(`reports.type.${job.reportType}` as never)}</Table.Td>
                      <Table.Td>
                        <StatusBadge
                          label={statusLabel(job.status)}
                          status={
                            job.status === "PENDING"
                              ? "pending"
                              : job.status === "PROCESSING"
                                ? "processing"
                                : job.status === "COMPLETED"
                                  ? "completed"
                                  : "failed"
                          }
                        />
                      </Table.Td>
                      <Table.Td>{new Date(job.createdAt).toLocaleString()}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Box>
        </>
      ) : (
        <EmptyState description={t("reports.emptyDescription")} title={t("reports.emptyTitle")} />
      )}
      <Text c="dimmed" size="sm">
        {tf("reports.dashboardSummary", counts)}
      </Text>
    </DashboardSection>
  );
}

function DashboardLoading() {
  return (
    <Stack gap="lg">
      <Skeleton height={42} width="45%" />
      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }}>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton height={120} key={index} />
        ))}
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Skeleton height={260} />
        <Skeleton height={260} />
      </SimpleGrid>
    </Stack>
  );
}

function telemetryDays(
  trend: NonNullable<DashboardSummary["telemetryTrend"]>,
  range: DashboardSummary["range"],
) {
  const counts = new Map(trend.map((item) => [item.date, item.count]));
  const cursor = new Date(range.from);
  const last = new Date(range.to);
  cursor.setUTCHours(0, 0, 0, 0);
  last.setUTCHours(0, 0, 0, 0);
  const days: Array<{ count: number; date: string }> = [];
  while (cursor <= last) {
    const date = cursor.toISOString().slice(0, 10);
    days.push({ count: counts.get(date) ?? 0, date });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function TrendChart({
  range,
  total,
  trend,
}: {
  range: DashboardSummary["range"];
  total: number;
  trend: NonNullable<DashboardSummary["telemetryTrend"]>;
}) {
  const [tooltip, setTooltip] = useState<ChartTooltipState>();
  if (!trend.length && total === 0) {
    return (
      <EmptyState
        description={t("dashboard.emptyTelemetryDescription")}
        title={t("dashboard.emptyTelemetry")}
      />
    );
  }

  const days = telemetryDays(trend, range);
  const chartWidth = 720;
  const chartHeight = 260;
  const left = 52;
  const right = 18;
  const top = 18;
  const bottom = 42;
  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;
  const max = Math.max(...days.map((item) => item.count), 1);
  const yMax = Math.max(1, Math.ceil(max / 5) * 5);
  const xPosition = (index: number) => left + (index / Math.max(days.length - 1, 1)) * plotWidth;
  const yPosition = (count: number) => top + plotHeight - (count / yMax) * plotHeight;
  const pointList = days.map((item, index) => `${xPosition(index)},${yPosition(item.count)}`);
  const linePoints = pointList.join(" ");
  const areaPoints = `${left},${top + plotHeight} ${linePoints} ${left + plotWidth},${top + plotHeight}`;
  const yTicks = [...new Set([0, Math.ceil(yMax / 2), yMax])];
  const labelEvery = days.length <= 8 ? 1 : days.length <= 31 ? 5 : 15;
  const sampledCount = trend.reduce((sum, item) => sum + item.count, 0);
  const fullDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeZone: "UTC",
  });
  const shortDate = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  const showTooltip = (target: SVGElement, item: (typeof days)[number]) => {
    setTooltip({
      content: (
        <Stack gap={2}>
          <Text fw={650} size="sm">
            {fullDate.format(new Date(`${item.date}T00:00:00.000Z`))}
          </Text>
          <Text size="sm">{tf("dashboard.telemetryTooltipCount", { count: item.count })}</Text>
        </Stack>
      ),
      ...chartTooltipPosition(target),
    });
  };

  return (
    <Stack gap="xs">
      <svg
        aria-label={t("dashboard.telemetryChartLabel")}
        height="260"
        onMouseLeave={() => setTooltip(undefined)}
        role="img"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        width="100%"
      >
        <desc>{t("dashboard.telemetryChartDescription")}</desc>
        <defs>
          <linearGradient id="telemetry-area-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--mantine-color-gss-5)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--mantine-color-gss-1)" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {yTicks.map((tick) => {
          const y = yPosition(tick);
          return (
            <g key={tick}>
              <line
                stroke="var(--gss-border)"
                strokeDasharray={tick === 0 ? undefined : "4 4"}
                strokeWidth="1"
                x1={left}
                x2={left + plotWidth}
                y1={y}
                y2={y}
              />
              <text fill="var(--gss-muted)" fontSize="11" textAnchor="end" x={left - 9} y={y + 4}>
                {tick}
              </text>
            </g>
          );
        })}
        <polygon fill="url(#telemetry-area-fill)" points={areaPoints} />
        <polyline
          fill="none"
          points={linePoints}
          stroke="var(--mantine-color-gss-6)"
          strokeLinejoin="round"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
        {days.map((item, index) => {
          const date = new Date(`${item.date}T00:00:00.000Z`);
          const pointLabel = tf("dashboard.telemetryPointLabel", {
            count: item.count,
            date: fullDate.format(date),
          });
          return (
            <g key={item.date}>
              {(index % labelEvery === 0 || index === days.length - 1) && (
                <text
                  fill="var(--gss-muted)"
                  fontSize="11"
                  textAnchor={index === 0 ? "start" : index === days.length - 1 ? "end" : "middle"}
                  x={xPosition(index)}
                  y={chartHeight - 15}
                >
                  {shortDate.format(date)}
                </text>
              )}
              <circle
                aria-label={pointLabel}
                cx={xPosition(index)}
                cy={yPosition(item.count)}
                fill="var(--gss-surface)"
                onBlur={() => setTooltip(undefined)}
                onFocus={(event) => showTooltip(event.currentTarget, item)}
                onMouseEnter={(event) => showTooltip(event.currentTarget, item)}
                r="4"
                role="button"
                stroke="var(--mantine-color-gss-6)"
                strokeWidth="2"
                tabIndex={0}
              />
            </g>
          );
        })}
      </svg>
      <Group align="flex-start" justify="space-between" wrap="wrap">
        <Text c="dimmed" size="xs">
          {t("dashboard.telemetryUtcHint")}
        </Text>
        {sampledCount < total ? (
          <Text c="dimmed" size="xs">
            {tf("dashboard.telemetrySampledHint", { count: sampledCount, total })}
          </Text>
        ) : null}
      </Group>
      <ChartTooltip id="dashboard-telemetry-tooltip" state={tooltip} />
    </Stack>
  );
}

function SeverityChart({
  distribution,
}: {
  distribution: NonNullable<DashboardSummary["severityDistribution"]>;
}) {
  const entries = Object.entries(distribution);
  const max = Math.max(...entries.map(([, count]) => count), 1);
  return (
    <Stack gap="sm">
      {entries.map(([severity, count]) => (
        <Stack gap={4} key={severity}>
          <Group justify="space-between">
            <Text size="sm" tt="capitalize">
              {t(`status.${severity}` as never)}
            </Text>
            <Text fw={600} size="sm">
              {count}
            </Text>
          </Group>
          <div aria-label={tf("dashboard.severityBarLabel", { severity, count })} role="img">
            <div
              className={`gss-severity-bar gss-status-${severity.toLowerCase()}`}
              style={{
                borderRadius: 999,
                height: 8,
                width: `${(count / max) * 100}%`,
              }}
            />
          </div>
        </Stack>
      ))}
    </Stack>
  );
}

function DashboardPage({
  basePath,
  context,
}: {
  basePath: "/admin" | "/company";
  context: "admin" | "company";
}) {
  const { session } = useAuth();
  const [range, setRange] = useState<DashboardRange>("7d");
  const [summary, setSummary] = useState<DashboardSummary>();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session) return;
    setError(false);
    void apiRequest<DashboardSummary>(session, `${basePath}/dashboard/summary?range=${range}`)
      .then(setSummary)
      .catch(() => setError(true));
  }, [basePath, range, session]);

  const kpis = useMemo(() => {
    if (!summary) return [];
    const items = [];
    if (summary.kpis.activeCompanies !== undefined)
      items.push({
        accent: "indigo" as const,
        icon: <IconBuilding size={19} />,
        label: t("dashboard.activeCompanies"),
        value: summary.kpis.activeCompanies,
      });
    if (summary.kpis.activeSites !== undefined)
      items.push({
        accent: "blue" as const,
        icon: <IconBuilding size={19} />,
        label: t("dashboard.activeSites"),
        value: summary.kpis.activeSites,
      });
    if (summary.kpis.activeBuildings !== undefined)
      items.push({
        accent: "violet" as const,
        icon: <IconBuilding size={19} />,
        label: t("dashboard.activeBuildings"),
        value: summary.kpis.activeBuildings,
      });
    if (summary.kpis.gateways !== undefined)
      items.push({
        accent: "cyan" as const,
        icon: <IconDeviceDesktopAnalytics size={19} />,
        label: t("dashboard.gateways"),
        value: summary.kpis.gateways,
        hint:
          summary.kpis.gatewaysOffline === undefined
            ? undefined
            : tf("dashboard.offlineHint", { count: summary.kpis.gatewaysOffline }),
      });
    if (summary.kpis.nodes !== undefined)
      items.push({
        accent: "teal" as const,
        icon: <IconActivity size={19} />,
        label: t("dashboard.nodes"),
        value: summary.kpis.nodes,
        hint:
          summary.kpis.nodesUnassigned === undefined
            ? undefined
            : tf("dashboard.unassignedHint", { count: summary.kpis.nodesUnassigned }),
      });
    if (summary.kpis.telemetryReadings !== undefined)
      items.push({
        accent: "blue" as const,
        icon: <IconActivity size={19} />,
        label: t("dashboard.telemetryReadings"),
        value: summary.kpis.telemetryReadings,
      });
    return items;
  }, [summary]);

  if (!session || (!summary && !error)) return <DashboardLoading />;
  if (error)
    return (
      <ErrorState description={t("common.errorDescription")} title={t("dashboard.loadError")} />
    );
  if (!summary) return <DashboardLoading />;

  return (
    <Stack gap="xl">
      <PageHeader
        action={
          <NativeSelect
            aria-label={t("dashboard.range")}
            data={[
              { label: t("dashboard.range7d"), value: "7d" },
              { label: t("dashboard.range30d"), value: "30d" },
              { label: t("dashboard.range90d"), value: "90d" },
            ]}
            onChange={(event) => setRange(event.currentTarget.value as DashboardRange)}
            value={range}
            w={150}
          />
        }
        subtitle={
          context === "admin" ? t("dashboard.adminSubtitle") : t("dashboard.companySubtitle")
        }
        title={context === "admin" ? t("nav.adminDashboard") : t("nav.companyDashboard")}
      />
      <Box className="gss-dashboard-kpi-grid" data-testid="dashboard-kpi-grid">
        {kpis.map((item) => (
          <DashboardKpiCard {...item} key={item.label} />
        ))}
      </Box>
      {summary.severityDistribution || summary.telemetryTrend ? (
        <SimpleGrid cols={{ base: 1, lg: 2 }}>
          {summary.severityDistribution ? (
            <DashboardSection
              accent="violet"
              icon={<IconAlertTriangle size={18} />}
              subtitle={t("dashboard.severitySubtitle")}
              title={t("dashboard.severityTitle")}
            >
              <SeverityChart distribution={summary.severityDistribution} />
            </DashboardSection>
          ) : null}
          {summary.telemetryTrend ? (
            <DashboardSection
              accent="blue"
              icon={<IconChartBar size={18} />}
              subtitle={t("dashboard.telemetrySubtitle")}
              title={t("dashboard.telemetryTitle")}
            >
              <TrendChart
                range={summary.range}
                total={summary.kpis.telemetryReadings ?? 0}
                trend={summary.telemetryTrend}
              />
            </DashboardSection>
          ) : null}
        </SimpleGrid>
      ) : (
        <EmptyState
          description={t("dashboard.noOperationalSectionsDescription")}
          title={t("dashboard.noOperationalSections")}
        />
      )}
      {summary.openAlarmsBySeverity ? (
        <DashboardSection
          accent="neutral"
          icon={<IconBellRinging size={18} />}
          subtitle={t("dashboard.alarmsSubtitle")}
          title={t("dashboard.alarmsTitle")}
        >
          <Group gap="lg">
            {Object.entries(summary.openAlarmsBySeverity).map(([severity, count]) => (
              <Group gap="xs" key={severity}>
                <ThemeIcon color={severity === "DANGER" ? "red" : "yellow"} variant="light">
                  <IconAlertTriangle size={17} />
                </ThemeIcon>
                <Text>
                  {t(`status.${severity.toLowerCase()}` as never)}: <strong>{count}</strong>
                </Text>
              </Group>
            ))}
          </Group>
        </DashboardSection>
      ) : null}
      {summary.gateways ? (
        <DashboardSection
          accent="cyan"
          icon={<IconDeviceDesktopAnalytics size={18} />}
          title={t("dashboard.gatewayStatusTitle")}
        >
          <Group gap="lg">
            <Text className="gss-status-online">
              {tf("dashboard.gatewayOnline", { count: summary.gateways.online })}
            </Text>
            <Text className="gss-status-offline">
              {tf("dashboard.gatewayOffline", { count: summary.gateways.offline })}
            </Text>
            <Text className="gss-status-pending">
              {tf("dashboard.gatewayUnassigned", { count: summary.gateways.unassigned })}
            </Text>
          </Group>
        </DashboardSection>
      ) : null}
      <ReportsDashboardCard basePath={basePath} />
    </Stack>
  );
}

export function AdminDashboardPage() {
  return <DashboardPage basePath="/admin" context="admin" />;
}

export function CompanyDashboardPage() {
  return <DashboardPage basePath="/company" context="company" />;
}
