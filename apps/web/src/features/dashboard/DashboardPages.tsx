import type { DashboardRange, DashboardSummary, ReportJobRecord } from "@gss-iot/contracts";
import {
  Badge,
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
  ResponsiveContentGrid,
} from "@gss-iot/ui";

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
    void apiRequest<{ items: ReportJobRecord[] }>(session, `${basePath}/reports?page=1&pageSize=5`)
      .then((response) => setJobs(response.items))
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
    COMPLETED: jobs.filter((job) => job.status === "COMPLETED").length,
    FAILED: jobs.filter((job) => job.status === "FAILED").length,
    PENDING: jobs.filter((job) => job.status === "PENDING").length,
    PROCESSING: jobs.filter((job) => job.status === "PROCESSING").length,
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
              {counts[status]}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
      {jobs.length ? (
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
                    <Badge variant="light">{statusLabel(job.status)}</Badge>
                  </Table.Td>
                  <Table.Td>{new Date(job.createdAt).toLocaleString()}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
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

function TrendChart({ trend }: { trend: NonNullable<DashboardSummary["telemetryTrend"]> }) {
  if (!trend.length) {
    return (
      <EmptyState
        description={t("dashboard.emptyTelemetryDescription")}
        title={t("dashboard.emptyTelemetry")}
      />
    );
  }
  const max = Math.max(...trend.map((item) => item.count), 1);
  const points = trend
    .map(
      (item, index) =>
        `${(index / Math.max(trend.length - 1, 1)) * 100},${100 - (item.count / max) * 85}`,
    )
    .join(" ");
  return (
    <Stack gap="xs">
      <svg
        aria-label={t("dashboard.telemetryChartLabel")}
        height="180"
        role="img"
        viewBox="0 0 100 100"
        width="100%"
      >
        <polyline
          fill="none"
          points={points}
          stroke="var(--mantine-color-gss-6)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <Group justify="space-between">
        <Text c="dimmed" size="xs">
          {trend[0]?.date}
        </Text>
        <Text c="dimmed" size="xs">
          {trend.at(-1)?.date}
        </Text>
      </Group>
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
      <ResponsiveContentGrid>
        {kpis.map((item) => (
          <DashboardKpiCard {...item} key={item.label} />
        ))}
      </ResponsiveContentGrid>
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
              <TrendChart trend={summary.telemetryTrend} />
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
