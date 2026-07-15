import type { CompanyDeviceSnapshot } from "@gss-iot/contracts";
import { DataTable, EmptyState, ErrorState, LoadingState, PageHeader } from "@gss-iot/ui";
import { Stack, Tabs } from "@mantine/core";
import { useEffect, useState } from "react";

import { t } from "../../app/i18n";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { deviceStatusLabel, gatewayTypeLabel } from "./device-labels";

export function CompanyDevicesPage() {
  const { session } = useAuth();
  const [snapshot, setSnapshot] = useState<CompanyDeviceSnapshot>();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session) return;
    setError(false);
    void apiRequest<CompanyDeviceSnapshot>(session, "/company/devices")
      .then(setSnapshot)
      .catch(() => setError(true));
  }, [session]);

  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;
  if (!snapshot) return <LoadingState title={t("common.loading")} />;

  return (
    <Stack gap="lg">
      <PageHeader
        title={t("devices.companyDevicesTitle")}
        subtitle={t("devices.companyDevicesSubtitle")}
      />
      <Tabs defaultValue="gateways">
        <Tabs.List>
          <Tabs.Tab value="gateways">{t("devices.gatewaysTitle")}</Tabs.Tab>
          <Tabs.Tab value="nodes">{t("devices.nodesTitle")}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel pt="md" value="gateways">
          {snapshot.gateways.length ? (
            <DataTable
              columns={[
                {
                  key: "serial",
                  label: t("devices.serialNumber"),
                  render: (row) => row.serialNumber,
                },
                {
                  key: "type",
                  label: t("devices.gatewayType"),
                  render: (row) => gatewayTypeLabel(row.gatewayType),
                },
                {
                  key: "status",
                  label: t("devices.status"),
                  render: (row) => deviceStatusLabel(row.status),
                },
                {
                  key: "building",
                  label: t("devices.building"),
                  render: (row) => row.buildingAssignments[0]?.building.title ?? "-",
                },
              ]}
              rows={snapshot.gateways}
            />
          ) : (
            <EmptyState
              description={t("devices.emptyDescription")}
              title={t("common.emptyTitle")}
            />
          )}
        </Tabs.Panel>
        <Tabs.Panel pt="md" value="nodes">
          {snapshot.nodes.length ? (
            <DataTable
              columns={[
                { key: "number", label: t("devices.nodeNumber"), render: (row) => row.number },
                {
                  key: "type",
                  label: t("devices.nodeType"),
                  render: (row) => row.nodeType.displayName,
                },
                {
                  key: "status",
                  label: t("devices.status"),
                  render: (row) => deviceStatusLabel(row.status),
                },
                {
                  key: "gateway",
                  label: t("devices.gateway"),
                  render: (row) => row.gatewayAssignments[0]?.gateway.serialNumber ?? "-",
                },
              ]}
              rows={snapshot.nodes}
            />
          ) : (
            <EmptyState
              description={t("devices.emptyDescription")}
              title={t("common.emptyTitle")}
            />
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
