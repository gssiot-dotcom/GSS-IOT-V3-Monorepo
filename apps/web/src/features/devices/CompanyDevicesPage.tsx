import type { CompanyDeviceSnapshot } from "@gss-iot/contracts";
import {
  DataTable,
  DataToolbar,
  EmptyState,
  ErrorState,
  EntityPrimaryCell,
  LoadingState,
  PageHeader,
} from "@gss-iot/ui";
import { Stack, Tabs, Text, TextInput } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

import { t } from "../../app/i18n";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import {
  deviceConnectivityBadge,
  deviceLifecycleBadge,
  formatDeviceDate,
  gatewayTypeLabel,
} from "./device-labels";

export function CompanyDevicesPage() {
  const { session } = useAuth();
  const [snapshot, setSnapshot] = useState<CompanyDeviceSnapshot>();
  const [error, setError] = useState(false);
  const [gatewaySearch, setGatewaySearch] = useState("");
  const [nodeSearch, setNodeSearch] = useState("");

  useEffect(() => {
    if (!session) return;
    setError(false);
    void apiRequest<CompanyDeviceSnapshot>(session, "/company/devices")
      .then(setSnapshot)
      .catch(() => setError(true));
  }, [session]);

  const gateways = useMemo(() => {
    const query = gatewaySearch.trim().toLowerCase();
    return (snapshot?.gateways ?? []).filter((gateway) => {
      if (!query) return true;
      return [
        gateway.serialNumber,
        gateway.gatewayType,
        gateway.buildingAssignments[0]?.building.title,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [gatewaySearch, snapshot?.gateways]);
  const nodes = useMemo(() => {
    const query = nodeSearch.trim().toLowerCase();
    return (snapshot?.nodes ?? []).filter((node) => {
      if (!query) return true;
      return [
        node.number,
        node.nodeType.displayName,
        node.gatewayAssignments[0]?.gateway.serialNumber,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [nodeSearch, snapshot?.nodes]);

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
          <DataToolbar>
            <TextInput
              aria-label={t("devices.searchGateways")}
              onChange={(event) => setGatewaySearch(event.currentTarget.value)}
              placeholder={t("devices.searchGateways")}
              value={gatewaySearch}
            />
            <Text c="dimmed" size="sm">
              {gateways.length} / {snapshot.gateways.length}
            </Text>
          </DataToolbar>
          {gateways.length ? (
            <DataTable
              ariaLabel={t("devices.gatewaysTitle")}
              columns={[
                {
                  key: "identity",
                  label: t("devices.gateway"),
                  render: (row) => (
                    <EntityPrimaryCell
                      identifier={gatewayTypeLabel(row.gatewayType)}
                      title={row.serialNumber}
                    />
                  ),
                },
                {
                  key: "status",
                  label: t("devices.status"),
                  render: (row) => deviceLifecycleBadge(row.status),
                },
                {
                  key: "connection",
                  label: t("devices.connection"),
                  render: (row) => deviceConnectivityBadge(row.lastSeenAt),
                },
                {
                  key: "building",
                  label: t("devices.building"),
                  render: (row) =>
                    row.buildingAssignments[0]?.building.title ?? t("devices.unassigned"),
                },
                {
                  key: "lastSeen",
                  label: t("devices.lastSeen"),
                  render: (row) => formatDeviceDate(row.lastSeenAt),
                },
              ]}
              density="compact"
              rows={gateways}
            />
          ) : (
            <EmptyState
              description={t(
                gatewaySearch ? "devices.noResultsDescription" : "devices.emptyGatewaysDescription",
              )}
              title={t("common.emptyTitle")}
            />
          )}
        </Tabs.Panel>
        <Tabs.Panel pt="md" value="nodes">
          <DataToolbar>
            <TextInput
              aria-label={t("devices.searchNodes")}
              onChange={(event) => setNodeSearch(event.currentTarget.value)}
              placeholder={t("devices.searchNodes")}
              value={nodeSearch}
            />
            <Text c="dimmed" size="sm">
              {nodes.length} / {snapshot.nodes.length}
            </Text>
          </DataToolbar>
          {nodes.length ? (
            <DataTable
              ariaLabel={t("devices.nodesTitle")}
              columns={[
                {
                  key: "identity",
                  label: t("devices.node"),
                  render: (row) => (
                    <EntityPrimaryCell identifier={row.nodeType.displayName} title={row.number} />
                  ),
                },
                {
                  key: "status",
                  label: t("devices.status"),
                  render: (row) => deviceLifecycleBadge(row.status),
                },
                {
                  key: "connection",
                  label: t("devices.connection"),
                  render: (row) => deviceConnectivityBadge(row.lastSeenAt),
                },
                {
                  key: "gateway",
                  label: t("devices.gateway"),
                  render: (row) =>
                    row.gatewayAssignments[0]?.gateway.serialNumber ?? t("devices.unassigned"),
                },
                {
                  key: "lastSeen",
                  label: t("devices.lastSeen"),
                  render: (row) => formatDeviceDate(row.lastSeenAt),
                },
              ]}
              density="compact"
              rows={nodes}
            />
          ) : (
            <EmptyState
              description={t(
                nodeSearch ? "devices.noResultsDescription" : "devices.emptyNodesDescription",
              )}
              title={t("common.emptyTitle")}
            />
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
