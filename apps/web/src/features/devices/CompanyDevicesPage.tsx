import type { CollectionPageSize, CompanyDeviceInventoryResponse } from "@gss-iot/contracts";
import {
  CollectionPagination,
  DataTable,
  DataToolbar,
  EmptyState,
  ErrorState,
  EntityPrimaryCell,
  LoadingState,
  PageHeader,
  WorkspaceTabs,
} from "@gss-iot/ui";
import { Stack, Text, TextInput } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

import { nodeTypeLabel, t, tf } from "../../app/i18n";
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
  const [snapshot, setSnapshot] = useState<CompanyDeviceInventoryResponse>();
  const [error, setError] = useState(false);
  const [gatewaySearch, setGatewaySearch] = useState("");
  const [nodeSearch, setNodeSearch] = useState("");
  const [tab, setTab] = useState<"gateways" | "nodes">("gateways");
  const [gatewayPage, setGatewayPage] = useState(1);
  const [nodePage, setNodePage] = useState(1);
  const [gatewayPageSize, setGatewayPageSize] = useState<CollectionPageSize>(50);
  const [nodePageSize, setNodePageSize] = useState<CollectionPageSize>(50);

  useEffect(() => {
    if (!session) return;
    setError(false);
    const params = new URLSearchParams({
      gatewayPage: String(gatewayPage),
      gatewayPageSize: String(gatewayPageSize),
      nodePage: String(nodePage),
      nodePageSize: String(nodePageSize),
    });
    void apiRequest<CompanyDeviceInventoryResponse>(session, `/company/devices?${params}`)
      .then(setSnapshot)
      .catch(() => setError(true));
  }, [gatewayPage, gatewayPageSize, nodePage, nodePageSize, session]);

  const gateways = useMemo(() => {
    const query = gatewaySearch.trim().toLowerCase();
    return (snapshot?.gateways.items ?? []).filter((gateway) => {
      if (!query) return true;
      return [
        gateway.serialNumber,
        gateway.gatewayType,
        gateway.buildingAssignments[0]?.building.title,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [gatewaySearch, snapshot?.gateways.items]);
  const nodes = useMemo(() => {
    const query = nodeSearch.trim().toLowerCase();
    return (snapshot?.nodes.items ?? []).filter((node) => {
      if (!query) return true;
      return [
        node.number,
        node.nodeType.displayName,
        node.gatewayAssignments[0]?.gateway.serialNumber,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [nodeSearch, snapshot?.nodes.items]);

  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;
  if (!snapshot) return <LoadingState title={t("common.loading")} />;

  return (
    <Stack gap="lg">
      <PageHeader
        title={t("devices.companyDevicesTitle")}
        subtitle={t("devices.companyDevicesSubtitle")}
      />
      <WorkspaceTabs
        ariaLabel={t("devices.companyDevicesTitle")}
        items={[
          { label: t("devices.gatewaysTitle"), value: "gateways" },
          { label: t("devices.nodesTitle"), value: "nodes" },
        ]}
        onChange={(value) => setTab(value as "gateways" | "nodes")}
        value={tab}
      />
      {tab === "gateways" ? (
        <Stack gap="sm">
          <CollectionPagination
            onPageChange={setGatewayPage}
            onPageSizeChange={(value) => {
              setGatewayPageSize(Number(value) as CollectionPageSize);
              setGatewayPage(1);
            }}
            page={gatewayPage}
            pageSize={gatewayPageSize}
            pageSizeLabel={t("table.pageSize")}
            rangeLabel={tf("table.range", {
              from: snapshot.gateways.total === 0 ? 0 : (gatewayPage - 1) * gatewayPageSize + 1,
              to: Math.min(gatewayPage * gatewayPageSize, snapshot.gateways.total),
              total: snapshot.gateways.total,
            })}
            totalPages={Math.max(1, Math.ceil(snapshot.gateways.total / gatewayPageSize))}
          />
          <DataToolbar>
            <TextInput
              aria-label={t("devices.searchGateways")}
              onChange={(event) => setGatewaySearch(event.currentTarget.value)}
              placeholder={t("devices.searchGateways")}
              value={gatewaySearch}
            />
            <Text c="dimmed" size="sm">
              {gateways.length} / {snapshot.gateways.total}
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
        </Stack>
      ) : (
        <Stack gap="sm">
          <CollectionPagination
            onPageChange={setNodePage}
            onPageSizeChange={(value) => {
              setNodePageSize(Number(value) as CollectionPageSize);
              setNodePage(1);
            }}
            page={nodePage}
            pageSize={nodePageSize}
            pageSizeLabel={t("table.pageSize")}
            rangeLabel={tf("table.range", {
              from: snapshot.nodes.total === 0 ? 0 : (nodePage - 1) * nodePageSize + 1,
              to: Math.min(nodePage * nodePageSize, snapshot.nodes.total),
              total: snapshot.nodes.total,
            })}
            totalPages={Math.max(1, Math.ceil(snapshot.nodes.total / nodePageSize))}
          />
          <DataToolbar>
            <TextInput
              aria-label={t("devices.searchNodes")}
              onChange={(event) => setNodeSearch(event.currentTarget.value)}
              placeholder={t("devices.searchNodes")}
              value={nodeSearch}
            />
            <Text c="dimmed" size="sm">
              {nodes.length} / {snapshot.nodes.total}
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
                    <EntityPrimaryCell
                      identifier={nodeTypeLabel(row.nodeType.key, row.nodeType.displayName)}
                      title={row.number}
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
        </Stack>
      )}
    </Stack>
  );
}
