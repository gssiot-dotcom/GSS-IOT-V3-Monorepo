import type {
  GatewayCommandRecord,
  GatewayRecord,
  NodeRecord,
  NodeTypeRecord,
} from "@gss-iot/contracts";
import { parseNodeNumberInput } from "@gss-iot/contracts";
import {
  ConfirmActionModal,
  DataTable,
  DataToolbar,
  EmptyState,
  EntityActionMenu,
  EntityPrimaryCell,
  ErrorState,
  LoadingState,
  ModalFormFooter,
  PageHeader,
} from "@gss-iot/ui";
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  MultiSelect,
  Paper,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import {
  IconBuilding,
  IconBuildingCommunity,
  IconEdit,
  IconTrash,
  IconUnlink,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { t, tf } from "../../app/i18n";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { Can } from "../../shared/rbac/Can";
import { hasPermission } from "../../shared/rbac/has-permission";
import {
  deviceConnectivityBadge,
  deviceLifecycleBadge,
  formatDeviceDate,
  gatewayCommandStatusBadge,
  gatewayTypeLabel,
} from "./device-labels";

type AssignmentTarget =
  | { id: string; kind: "gateway-building" | "gateway-company" }
  | { id: string; kind: "node-company" };

type DeleteTarget = {
  blocker: string | null;
  id: string;
  kind: "gateway" | "node";
  label: string;
};

type ProvisioningMode = "APPEND" | "REPLACE";

interface ProvisioningOptions {
  areas: Array<{ companyId: string; id: string; name: string; status: string }>;
  buildings: Array<{
    areaId: string;
    companyId: string;
    id: string;
    status: string;
    title: string;
  }>;
  companies: Array<{ id: string; name: string; status: string }>;
}

const emptyOptions: ProvisioningOptions = { areas: [], buildings: [], companies: [] };

export function AdminDevicesPage() {
  const { session } = useAuth();
  const [gateways, setGateways] = useState<GatewayRecord[]>();
  const [nodes, setNodes] = useState<NodeRecord[]>();
  const [nodeTypes, setNodeTypes] = useState<NodeTypeRecord[]>([]);
  const [commands, setCommands] = useState<GatewayCommandRecord[]>([]);
  const [options, setOptions] = useState<ProvisioningOptions>(emptyOptions);
  const [error, setError] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [gatewayOpened, setGatewayOpened] = useState(false);
  const [nodeOpened, setNodeOpened] = useState(false);
  const [editingGateway, setEditingGateway] = useState<GatewayRecord | null>(null);
  const [editingNode, setEditingNode] = useState<NodeRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>();
  const [assignmentTarget, setAssignmentTarget] = useState<AssignmentTarget>();
  const [serialNumber, setSerialNumber] = useState("");
  const [installedLocation, setInstalledLocation] = useState("");
  const [gatewayType, setGatewayType] = useState("NODES_GATEWAY");
  const [nodeNumber, setNodeNumber] = useState("");
  const [nodeInstalledLocation, setNodeInstalledLocation] = useState("");
  const [nodeTypeId, setNodeTypeId] = useState("");
  const [assignmentValue, setAssignmentValue] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [gatewayId, setGatewayId] = useState("");
  const [provisioningMode, setProvisioningMode] = useState<ProvisioningMode>("REPLACE");
  const [provisionNodeTypeId, setProvisionNodeTypeId] = useState("");
  const [provisionNodeIds, setProvisionNodeIds] = useState<string[]>([]);
  const [gatewaySearch, setGatewaySearch] = useState("");
  const [nodeSearch, setNodeSearch] = useState("");

  const load = async () => {
    if (!session) return;
    setError(false);
    try {
      const [loadedGateways, loadedNodes, loadedNodeTypes, loadedCommands, loadedOptions] =
        await Promise.all([
          apiRequest<GatewayRecord[]>(session, "/admin/devices/gateways"),
          apiRequest<NodeRecord[]>(session, "/admin/devices/nodes"),
          apiRequest<NodeTypeRecord[]>(session, "/admin/devices/node-types"),
          apiRequest<GatewayCommandRecord[]>(session, "/admin/gateway-commands"),
          apiRequest<ProvisioningOptions>(session, "/admin/devices/provisioning-options"),
        ]);
      setGateways(loadedGateways);
      setNodes(loadedNodes);
      setNodeTypes(loadedNodeTypes);
      setCommands(loadedCommands);
      setOptions(loadedOptions);
      setNodeTypeId(loadedNodeTypes[0]?.id ?? "");
      setProvisionNodeTypeId((current) => current || loadedNodeTypes[0]?.id || "");
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    void load();
  }, [session]);

  const companyOptions = options.companies.map((company) => ({
    label: company.name,
    value: company.id,
  }));
  const buildingsForCompany = options.buildings.filter(
    (building) => building.companyId === companyId,
  );
  const buildingOptions = buildingsForCompany.map((building) => ({
    label: building.title,
    value: building.id,
  }));
  const gatewayOptions = (gateways ?? [])
    .filter(
      (gateway) =>
        gateway.gatewayType === "NODES_GATEWAY" &&
        gateway.companyAssignments[0]?.companyId === companyId &&
        gateway.buildingAssignments[0]?.buildingId === buildingId,
    )
    .map((gateway) => ({ label: gateway.serialNumber, value: gateway.id }));
  const currentProvisionNodes = (nodes ?? []).filter(
    (node) =>
      node.nodeTypeId === provisionNodeTypeId &&
      node.gatewayAssignments[0]?.gatewayId === gatewayId,
  );
  const selectableNodeOptions = (nodes ?? [])
    .filter(
      (node) =>
        node.companyAssignments[0]?.companyId === companyId &&
        (node.gatewayAssignments.length === 0 ||
          (provisioningMode === "REPLACE" &&
            node.gatewayAssignments[0]?.gatewayId === gatewayId)) &&
        node.nodeTypeId === provisionNodeTypeId,
    )
    .map((node) => ({ label: `${node.number} (${node.nodeType.displayName})`, value: node.id }));
  const finalProvisionNodeIds = useMemo(() => {
    const ids = provisioningMode === "APPEND" ? currentProvisionNodes.map((node) => node.id) : [];
    return [...new Set([...ids, ...provisionNodeIds])];
  }, [currentProvisionNodes, provisionNodeIds, provisioningMode]);
  const removedProvisionNodeCount =
    provisioningMode === "REPLACE"
      ? currentProvisionNodes.filter((node) => !finalProvisionNodeIds.includes(node.id)).length
      : 0;
  const assignmentBuildingOptions = useMemo(() => {
    if (!assignmentTarget || assignmentTarget.kind !== "gateway-building") return [];
    const gateway = gateways?.find((item) => item.id === assignmentTarget.id);
    const assignedCompanyId = gateway?.companyAssignments[0]?.companyId;
    return options.buildings
      .filter((building) => building.companyId === assignedCompanyId)
      .map((building) => ({ label: building.title, value: building.id }));
  }, [assignmentTarget, gateways, options.buildings]);
  const registerCommands = commands
    .filter((command) => command.commandType === "REGISTER_NODES")
    .slice(0, 5);
  const filteredGateways = gateways?.filter((gateway) => {
    const query = gatewaySearch.trim().toLowerCase();
    if (!query) return true;
    return [
      gateway.serialNumber,
      gateway.gatewayType,
      gateway.companyAssignments[0]?.company?.name,
      gateway.buildingAssignments[0]?.building.title,
    ].some((value) => value?.toLowerCase().includes(query));
  });
  const filteredNodes = nodes?.filter((node) => {
    const query = nodeSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      node.number,
      node.nodeType.displayName,
      node.companyAssignments[0]?.company?.name,
      node.gatewayAssignments[0]?.gateway.serialNumber,
    ].some((value) => value?.toLowerCase().includes(query));
  });
  const nodeNumberParse = parseNodeNumberInput(nodeNumber);

  const createGateway = async () => {
    if (!session) return;
    setFormError("");
    setSuccessMessage("");
    const wasEditing = Boolean(editingGateway);
    await apiRequest(
      session,
      editingGateway ? `/admin/devices/gateways/${editingGateway.id}` : "/admin/devices/gateways",
      {
        body: JSON.stringify({ gatewayType, installedLocation, serialNumber }),
        method: editingGateway ? "PATCH" : "POST",
      },
    );
    setGatewayOpened(false);
    setEditingGateway(null);
    setSerialNumber("");
    setInstalledLocation("");
    await load();
    setSuccessMessage(t(wasEditing ? "devices.saved" : "devices.created"));
  };

  const createNode = async () => {
    if (!session) return;
    setFormError("");
    setSuccessMessage("");
    const wasEditing = Boolean(editingNode);
    await apiRequest(
      session,
      editingNode ? `/admin/devices/nodes/${editingNode.id}` : "/admin/devices/nodes/bulk",
      {
        body: JSON.stringify({
          installedLocation: nodeInstalledLocation,
          ...(editingNode ? { nodeTypeId, number: nodeNumber } : { input: nodeNumber, nodeTypeId }),
        }),
        method: editingNode ? "PATCH" : "POST",
      },
    );
    setNodeOpened(false);
    setEditingNode(null);
    setNodeNumber("");
    setNodeInstalledLocation("");
    await load();
    setSuccessMessage(t(wasEditing ? "devices.saved" : "devices.created"));
  };

  const openCreateGateway = () => {
    setEditingGateway(null);
    setSerialNumber("");
    setInstalledLocation("");
    setGatewayType("NODES_GATEWAY");
    setGatewayOpened(true);
  };

  const openEditGateway = (gateway: GatewayRecord) => {
    setEditingGateway(gateway);
    setSerialNumber(gateway.serialNumber);
    setInstalledLocation(gateway.installedLocation ?? "");
    setGatewayType(gateway.gatewayType);
    setGatewayOpened(true);
  };

  const openCreateNode = () => {
    setEditingNode(null);
    setNodeNumber("");
    setNodeInstalledLocation("");
    setNodeOpened(true);
  };

  const openEditNode = (node: NodeRecord) => {
    setEditingNode(node);
    setNodeNumber(node.number);
    setNodeInstalledLocation(node.installedLocation ?? "");
    setNodeTypeId(node.nodeTypeId);
    setNodeOpened(true);
  };

  const deleteDevice = async () => {
    if (!session || !deleteTarget) return;
    setFormError("");
    setSuccessMessage("");
    try {
      await apiRequest(
        session,
        `/admin/devices/${deleteTarget.kind === "gateway" ? "gateways" : "nodes"}/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      setDeleteTarget(undefined);
      await load();
      setSuccessMessage(t("devices.deleted"));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("devices.deleteFailed"));
    }
  };

  const deleteBlockerLabel = (blocker: string | null) => {
    switch (blocker) {
      case "companyAssignmentHistory":
        return t("devices.deleteBlockedCompanyAssignment");
      case "buildingAssignmentHistory":
        return t("devices.deleteBlockedBuildingAssignment");
      case "nodeAssignmentHistory":
        return t("devices.deleteBlockedNodeAssignment");
      case "commandHistory":
        return t("devices.deleteBlockedCommand");
      case "provisioningHistory":
        return t("devices.deleteBlockedProvisioning");
      default:
        return blocker ? t("devices.deleteBlockedHistory") : t("devices.deleteAllowed");
    }
  };

  const assign = async () => {
    if (!session || !assignmentTarget) return;
    setFormError("");
    const path =
      assignmentTarget.kind === "gateway-company"
        ? `/admin/devices/gateways/${assignmentTarget.id}/company-assignment`
        : assignmentTarget.kind === "gateway-building"
          ? `/admin/devices/gateways/${assignmentTarget.id}/building-assignment`
          : `/admin/devices/nodes/${assignmentTarget.id}/company-assignment`;
    const body =
      assignmentTarget.kind === "gateway-building"
        ? { buildingId: assignmentValue }
        : { companyId: assignmentValue };
    await apiRequest(session, path, { body: JSON.stringify(body), method: "POST" });
    setAssignmentTarget(undefined);
    setAssignmentValue("");
    await load();
  };

  const unassign = async (path: string) => {
    if (!session) return;
    await apiRequest(session, path, { method: "DELETE" });
    await load();
  };

  const createProvisioning = async () => {
    if (!session) return;
    setFormError("");
    await apiRequest(session, "/admin/gateway-commands/register-nodes", {
      body: JSON.stringify({
        buildingId,
        gatewayId,
        nodeIds: provisionNodeIds,
        nodeTypeId: provisionNodeTypeId,
        mode: provisioningMode,
      }),
      method: "POST",
    });
    setProvisionNodeIds([]);
    await load();
  };

  const gatewayActionMenu = (row: GatewayRecord) => {
    const items = [
      ...(hasPermission(session, "gateways.update")
        ? [
            {
              icon: <IconEdit size={16} />,
              key: "edit",
              label: t("devices.editGateway"),
              onClick: () => openEditGateway(row),
            },
          ]
        : []),
      ...(hasPermission(session, "gateways.assign")
        ? [
            {
              icon: <IconBuildingCommunity size={16} />,
              key: "assign-company",
              label: t("devices.assignCompany"),
              onClick: () => setAssignmentTarget({ id: row.id, kind: "gateway-company" }),
            },
            {
              disabled: !row.companyAssignments.length,
              disabledReason: t("devices.companyAssignmentRequired"),
              icon: <IconBuilding size={16} />,
              key: "assign-building",
              label: t("devices.assignBuilding"),
              onClick: () => setAssignmentTarget({ id: row.id, kind: "gateway-building" }),
            },
            {
              disabled: !row.buildingAssignments.length,
              disabledReason: t("devices.noBuildingAssignment"),
              icon: <IconUnlink size={16} />,
              key: "unassign-building",
              label: t("devices.unassignBuilding"),
              onClick: () => void unassign(`/admin/devices/gateways/${row.id}/building-assignment`),
            },
          ]
        : []),
      ...(hasPermission(session, "gateways.delete")
        ? [
            {
              color: "red" as const,
              destructive: true,
              disabled: !row.deletion?.allowed,
              disabledReason: deleteBlockerLabel(row.deletion?.blocker ?? null),
              icon: <IconTrash size={16} />,
              key: "delete",
              label: t("devices.deleteGateway"),
              onClick: () =>
                setDeleteTarget({
                  blocker: row.deletion?.blocker ?? null,
                  id: row.id,
                  kind: "gateway",
                  label: row.serialNumber,
                }),
            },
          ]
        : []),
    ] satisfies Parameters<typeof EntityActionMenu>[0]["items"];

    return items.length ? (
      <EntityActionMenu
        ariaLabel={`${t("common.moreActions")}: ${row.serialNumber}`}
        items={items}
      />
    ) : null;
  };

  const nodeActionMenu = (row: NodeRecord) => {
    const items = [
      ...(hasPermission(session, "nodes.update")
        ? [
            {
              icon: <IconEdit size={16} />,
              key: "edit",
              label: t("devices.editNode"),
              onClick: () => openEditNode(row),
            },
          ]
        : []),
      ...(hasPermission(session, "nodes.assign")
        ? [
            {
              icon: <IconBuildingCommunity size={16} />,
              key: "assign-company",
              label: t("devices.assignCompany"),
              onClick: () => setAssignmentTarget({ id: row.id, kind: "node-company" }),
            },
            {
              disabled: !row.gatewayAssignments.length,
              disabledReason: t("devices.noGatewayAssignment"),
              icon: <IconUnlink size={16} />,
              key: "unassign-gateway",
              label: t("devices.unassignGateway"),
              onClick: () => void unassign(`/admin/devices/nodes/${row.id}/gateway-assignment`),
            },
          ]
        : []),
      ...(hasPermission(session, "nodes.delete")
        ? [
            {
              color: "red" as const,
              destructive: true,
              disabled: !row.deletion?.allowed,
              disabledReason: deleteBlockerLabel(row.deletion?.blocker ?? null),
              icon: <IconTrash size={16} />,
              key: "delete",
              label: t("devices.deleteNode"),
              onClick: () =>
                setDeleteTarget({
                  blocker: row.deletion?.blocker ?? null,
                  id: row.id,
                  kind: "node",
                  label: row.number,
                }),
            },
          ]
        : []),
    ] satisfies Parameters<typeof EntityActionMenu>[0]["items"];

    return items.length ? (
      <EntityActionMenu ariaLabel={`${t("common.moreActions")}: ${row.number}`} items={items} />
    ) : null;
  };

  if (!gateways || !nodes) return <LoadingState title={t("common.loading")} />;
  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;

  return (
    <Stack gap="lg">
      <PageHeader
        title={t("devices.inventoryTitle")}
        subtitle={t("devices.inventorySubtitle")}
        action={
          <Group>
            <Can permission="gateways.create">
              <Button onClick={openCreateGateway}>{t("devices.createGateway")}</Button>
            </Can>
            <Can permission="nodes.create">
              <Button onClick={openCreateNode} variant="light">
                {t("devices.createNode")}
              </Button>
            </Can>
          </Group>
        }
      />
      {successMessage ? <Alert color="green">{successMessage}</Alert> : null}
      {formError ? <Alert color="red">{formError}</Alert> : null}
      <Can permission="mqtt-commands.manage">
        <Paper p="md" withBorder>
          <Stack gap="sm">
            <Text fw={600}>{t("devices.provisioningTitle")}</Text>
            <Group align="flex-end">
              <Select
                data={companyOptions}
                label={t("devices.company")}
                onChange={(value) => {
                  setCompanyId(value ?? "");
                  setBuildingId("");
                  setGatewayId("");
                  setProvisionNodeIds([]);
                }}
                value={companyId}
              />
              <Select
                data={buildingOptions}
                disabled={!companyId}
                label={t("devices.building")}
                onChange={(value) => {
                  setBuildingId(value ?? "");
                  setGatewayId("");
                  setProvisionNodeIds([]);
                }}
                value={buildingId}
              />
              <Select
                data={gatewayOptions}
                disabled={!buildingId}
                label={t("devices.gateway")}
                onChange={(value) => {
                  setGatewayId(value ?? "");
                  setProvisionNodeIds([]);
                }}
                value={gatewayId}
              />
              <Select
                data={[
                  { label: t("devices.provisioningModeAppend"), value: "APPEND" },
                  { label: t("devices.provisioningModeReplace"), value: "REPLACE" },
                ]}
                label={t("devices.provisioningMode")}
                onChange={(value) => {
                  setProvisioningMode((value as ProvisioningMode | null) ?? "REPLACE");
                  setProvisionNodeIds([]);
                }}
                value={provisioningMode}
              />
              <Select
                data={nodeTypes.map((nodeType) => ({
                  label: nodeType.displayName,
                  value: nodeType.id,
                }))}
                label={t("devices.nodeType")}
                onChange={(value) => {
                  setProvisionNodeTypeId(value ?? "");
                  setProvisionNodeIds([]);
                }}
                value={provisionNodeTypeId}
              />
            </Group>
            <MultiSelect
              data={selectableNodeOptions}
              disabled={!companyId || !provisionNodeTypeId}
              label={t("devices.eligibleNodes")}
              onChange={setProvisionNodeIds}
              searchable
              value={provisionNodeIds}
            />
            <Stack gap={2}>
              <Text c="dimmed" size="sm">
                {t(
                  provisioningMode === "APPEND"
                    ? "devices.provisioningAppendHint"
                    : "devices.provisioningReplaceHint",
                )}
              </Text>
              <Group gap="xs">
                <Badge variant="light">
                  {tf("devices.provisioningCurrentCount", { count: currentProvisionNodes.length })}
                </Badge>
                <Badge variant="light">
                  {tf("devices.provisioningSelectedCount", { count: provisionNodeIds.length })}
                </Badge>
                <Badge color="blue" variant="light">
                  {tf("devices.provisioningFinalCount", { count: finalProvisionNodeIds.length })}
                </Badge>
              </Group>
              {removedProvisionNodeCount ? (
                <Alert color="yellow" variant="light">
                  {tf("devices.provisioningRemovalWarning", { count: removedProvisionNodeCount })}
                </Alert>
              ) : null}
            </Stack>
            <Group justify="space-between">
              <Text c="dimmed" size="sm">
                {t("devices.provisioningHint")}
              </Text>
              <Button
                disabled={
                  !buildingId || !gatewayId || !provisionNodeTypeId || !provisionNodeIds.length
                }
                onClick={() =>
                  void createProvisioning().catch((err: Error) => setFormError(err.message))
                }
              >
                {t("devices.provisionNodes")}
              </Button>
            </Group>
            {registerCommands.length ? (
              <DataTable
                columns={[
                  {
                    key: "gateway",
                    label: t("devices.gateway"),
                    render: (row) => row.gateway.serialNumber,
                  },
                  {
                    key: "status",
                    label: t("devices.commandStatus"),
                    render: (row) => gatewayCommandStatusBadge(row.status),
                  },
                  {
                    key: "nodes",
                    label: t("devices.nodesTitle"),
                    render: (row) =>
                      row.provisioningRequest?.items.map((item) => item.node.number).join(", ") ??
                      "-",
                  },
                  {
                    key: "reason",
                    label: t("devices.failureReason"),
                    render: (row) =>
                      row.failureReason ?? row.provisioningRequest?.failureReason ?? "-",
                  },
                ]}
                ariaLabel={t("devices.provisioningTitle")}
                density="compact"
                rows={registerCommands}
              />
            ) : null}
          </Stack>
        </Paper>
      </Can>
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
              {filteredGateways?.length ?? 0} / {gateways.length}
            </Text>
          </DataToolbar>
          {filteredGateways?.length ? (
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
                  key: "company",
                  label: t("devices.company"),
                  render: (row) =>
                    row.companyAssignments[0]?.company?.name ?? t("devices.unassigned"),
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
                {
                  key: "actions",
                  label: t("organizations.actions"),
                  align: "right",
                  render: gatewayActionMenu,
                },
              ]}
              density="compact"
              rows={filteredGateways}
            />
          ) : gateways.length ? (
            <EmptyState
              description={t(
                gatewaySearch ? "devices.noResultsDescription" : "devices.emptyDescription",
              )}
              title={t("common.emptyTitle")}
            />
          ) : (
            <EmptyState
              description={t("devices.emptyGatewaysDescription")}
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
              {filteredNodes?.length ?? 0} / {nodes.length}
            </Text>
          </DataToolbar>
          {filteredNodes?.length ? (
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
                  key: "company",
                  label: t("devices.company"),
                  render: (row) =>
                    row.companyAssignments[0]?.company?.name ?? t("devices.unassigned"),
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
                {
                  key: "actions",
                  label: t("organizations.actions"),
                  align: "right",
                  render: nodeActionMenu,
                },
              ]}
              density="compact"
              rows={filteredNodes}
            />
          ) : nodes.length ? (
            <EmptyState
              description={t(
                nodeSearch ? "devices.noResultsDescription" : "devices.emptyDescription",
              )}
              title={t("common.emptyTitle")}
            />
          ) : (
            <EmptyState
              description={t("devices.emptyNodesDescription")}
              title={t("common.emptyTitle")}
            />
          )}
        </Tabs.Panel>
      </Tabs>
      <Modal
        opened={gatewayOpened}
        onClose={() => setGatewayOpened(false)}
        title={t(editingGateway ? "devices.editGateway" : "devices.createGateway")}
      >
        <Stack>
          <TextInput
            label={t("devices.serialNumber")}
            onChange={(event) => setSerialNumber(event.currentTarget.value)}
            value={serialNumber}
          />
          <TextInput
            label={t("devices.location")}
            onChange={(event) => setInstalledLocation(event.currentTarget.value)}
            value={installedLocation}
          />
          <Select
            data={[
              { label: t("devices.typeNodesGateway"), value: "NODES_GATEWAY" },
              { label: t("devices.typeSecurityOfficeGateway"), value: "SECURITY_OFFICE_GATEWAY" },
            ]}
            label={t("devices.gatewayType")}
            onChange={(value) => setGatewayType(value ?? "NODES_GATEWAY")}
            value={gatewayType}
          />
          <ModalFormFooter
            cancelLabel={t("common.cancel")}
            onCancel={() => setGatewayOpened(false)}
            onSubmit={() => void createGateway().catch((err: Error) => setFormError(err.message))}
            submitLabel={t(editingGateway ? "organizations.save" : "devices.createGateway")}
          />
        </Stack>
      </Modal>
      <Modal
        opened={nodeOpened}
        onClose={() => setNodeOpened(false)}
        title={t(editingNode ? "devices.editNode" : "devices.createNode")}
      >
        <Stack>
          {editingNode ? (
            <TextInput
              label={t("devices.nodeNumber")}
              onChange={(event) => setNodeNumber(event.currentTarget.value)}
              value={nodeNumber}
            />
          ) : (
            <>
              <Textarea
                description={t("devices.bulkInputHint")}
                label={t("devices.nodeNumber")}
                minRows={3}
                onChange={(event) => setNodeNumber(event.currentTarget.value)}
                value={nodeNumber}
              />
              {nodeNumber.trim() ? (
                <>
                  {nodeNumberParse.errors.length ? (
                    <Alert color="red">
                      {tf("devices.bulkInvalid", {
                        segments: nodeNumberParse.invalidSegments.join(", "),
                      })}
                    </Alert>
                  ) : null}
                  {nodeNumberParse.numbers.length ? (
                    <Stack gap="xs">
                      <Text size="sm">
                        {tf("devices.bulkPreviewCount", { count: nodeNumberParse.numbers.length })}
                      </Text>
                      <Group gap="xs">
                        {nodeNumberParse.numbers.slice(0, 20).map((number) => (
                          <Badge key={number} variant="light">
                            {number}
                          </Badge>
                        ))}
                        {nodeNumberParse.numbers.length > 20 ? (
                          <Text c="dimmed" size="sm">
                            {tf("devices.bulkPreviewMore", {
                              count: nodeNumberParse.numbers.length - 20,
                            })}
                          </Text>
                        ) : null}
                      </Group>
                    </Stack>
                  ) : null}
                </>
              ) : null}
            </>
          )}
          <TextInput
            label={t("devices.location")}
            onChange={(event) => setNodeInstalledLocation(event.currentTarget.value)}
            value={nodeInstalledLocation}
          />
          <Select
            data={nodeTypes.map((nodeType) => ({
              label: nodeType.displayName,
              value: nodeType.id,
            }))}
            label={t("devices.nodeType")}
            onChange={(value) => setNodeTypeId(value ?? "")}
            value={nodeTypeId}
          />
          <ModalFormFooter
            cancelLabel={t("common.cancel")}
            onCancel={() => setNodeOpened(false)}
            onSubmit={() => void createNode().catch((err: Error) => setFormError(err.message))}
            submitDisabled={
              !editingNode && (nodeNumberParse.errors.length > 0 || !nodeNumberParse.numbers.length)
            }
            submitLabel={t(editingNode ? "organizations.save" : "devices.createNode")}
          />
        </Stack>
      </Modal>
      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t("devices.confirmDelete")}
        description={t("devices.confirmDeleteImpact")}
        entityName={deleteTarget?.label ?? ""}
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={() => void deleteDevice()}
        opened={Boolean(deleteTarget)}
        title={t("devices.confirmDeleteTitle")}
      />
      <Modal
        opened={Boolean(assignmentTarget)}
        onClose={() => {
          setAssignmentTarget(undefined);
          setAssignmentValue("");
        }}
        title={t(
          assignmentTarget?.kind === "gateway-building"
            ? "devices.assignBuilding"
            : "devices.assignCompany",
        )}
      >
        <Stack>
          <Select
            data={
              assignmentTarget?.kind === "gateway-building"
                ? assignmentBuildingOptions
                : companyOptions
            }
            label={
              assignmentTarget?.kind === "gateway-building"
                ? t("devices.building")
                : t("devices.company")
            }
            onChange={(value) => setAssignmentValue(value ?? "")}
            searchable
            value={assignmentValue}
          />
          <ModalFormFooter
            cancelLabel={t("common.cancel")}
            onCancel={() => {
              setAssignmentTarget(undefined);
              setAssignmentValue("");
            }}
            onSubmit={() => void assign().catch((err: Error) => setFormError(err.message))}
            submitDisabled={!assignmentValue}
            submitLabel={t(
              assignmentTarget?.kind === "gateway-building"
                ? "devices.assignBuilding"
                : "devices.assignCompany",
            )}
          />
        </Stack>
      </Modal>
    </Stack>
  );
}
