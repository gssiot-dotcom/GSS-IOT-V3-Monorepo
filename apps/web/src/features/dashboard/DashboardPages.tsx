import type { ReportJobRecord } from "@gss-iot/contracts";
import { Badge, Button, Group, Paper, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import { IconReportAnalytics } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { t, tf } from "../../app/i18n";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { hasPermission } from "../../shared/rbac/has-permission";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@gss-iot/ui";

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

  if (!hasPermission(session, "reports.view")) {
    return (
      <Paper p="md" withBorder>
        <Text c="dimmed">{t("reports.dashboardNoPermission")}</Text>
      </Paper>
    );
  }
  if (loading) return <LoadingState title={t("common.loading")} />;
  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;

  const counts = {
    COMPLETED: jobs.filter((job) => job.status === "COMPLETED").length,
    FAILED: jobs.filter((job) => job.status === "FAILED").length,
    PENDING: jobs.filter((job) => job.status === "PENDING").length,
    PROCESSING: jobs.filter((job) => job.status === "PROCESSING").length,
  };

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <IconReportAnalytics size={20} />
          <Stack gap={0}>
            <Text fw={600}>{t("reports.dashboardTitle")}</Text>
            <Text c="dimmed" size="sm">
              {t("reports.dashboardSubtitle")}
            </Text>
          </Stack>
        </Group>
        <Button onClick={() => void navigate(`${basePath}/reports`)} variant="light">
          {t("reports.dashboardOpen")}
        </Button>
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
        {(["PENDING", "PROCESSING", "COMPLETED", "FAILED"] as const).map((status) => (
          <Paper key={status} p="sm" withBorder>
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
      <Text c="dimmed" mt="md" size="sm">
        {tf("reports.dashboardSummary", counts)}
      </Text>
    </Paper>
  );
}

export function AdminDashboardPage() {
  return (
    <Stack gap="lg">
      <PageHeader subtitle={t("nav.adminDashboard")} title={t("nav.adminDashboard")} />
      <ReportsDashboardCard basePath="/admin" />
    </Stack>
  );
}

export function CompanyDashboardPage() {
  return (
    <Stack gap="lg">
      <PageHeader subtitle={t("nav.companyDashboard")} title={t("nav.companyDashboard")} />
      <ReportsDashboardCard basePath="/company" />
    </Stack>
  );
}
