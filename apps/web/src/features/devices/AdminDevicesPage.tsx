import type {
  CollectionPageSize,
  GatewayCommandRecord,
  GatewayRecord,
  NodeRecord,
  NodeTypeRecord,
  PaginatedResponse,
} from "@gss-iot/contracts";
import { parseNodeNumberInput } from "@gss-iot/contracts";
import {
  ConfirmActionModal,
  CollectionPagination,
  DataTable,
  DataToolbar,
  EmptyState,
  EntityActionMenu,
  EntityPrimaryCell,
  ErrorState,
  LoadingState,
  ModalFormFooter,
  PageHeader,
  WorkspaceTabs,
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
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import {
  IconBuilding,
  IconBuildingCommunity,
  IconEdit,
  IconPlayerPause,
  IconPlayerPlay,
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

type UnassignTarget = {
  impact: string;
  label: string;
  path: string;
};

type DeviceLifecycleTarget = {
  id: string;
  kind: "gateway" | "node";
  label: string;
  nextStatus: "ACTIVE" | "INACTIVE";
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
  const [unassignTarget, setUnassignTarget] = useState<UnassignTarget>();
  const [unassigning, setUnassigning] = useState(false);
  const [lifecycleTarget, setLifecycleTarget] = useState<DeviceLifecycleTarget>();
  const [lifecycleMutating, setLifecycleMutating] = useState(false);
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
  const [gatewayPage, setGatewayPage] = useState(1);
  const [nodePage, setNodePage] = useState(1);
  const [gatewayPageSize, setGatewayPageSize] = useState<CollectionPageSize>(50);
  const [nodePageSize, setNodePageSize] = useState<CollectionPageSize>(50);
  const [gatewayTotal, setGatewayTotal] = useState(0);
  const [nodeTotal, setNodeTotal] = useState(0);
  const [inventoryTab, setInventoryTab] = useState<"gateways" | "nodes">("gateways");

  const load = async () => {
    if (!session) return;
    setError(false);
    try {
      const [loadedGateways, loadedNodes, loadedNodeTypes, loadedCommands, loadedOptions] =
        await Promise.all([
          apiRequest<PaginatedResponse<GatewayRecord>>(
            session,
            `/admin/devices/gateways?page=${gatewayPage}&pageSize=${gatewayPageSize}${gatewaySearch.trim() ? `&search=${encodeURIComponent(gatewaySearch.trim())}` : ""}`,
          ),
          apiRequest<PaginatedResponse<NodeRecord>>(
            session,
            `/admin/devices/nodes?page=${nodePage}&pageSize=${nodePageSize}${nodeSearch.trim() ? `&search=${encodeURIComponent(nodeSearch.trim())}` : ""}`,
          ),
          apiRequest<NodeTypeRecord[]>(session, "/admin/devices/node-types"),
          apiRequest<PaginatedResponse<GatewayCommandRecord>>(
            session,
            "/admin/gateway-commands?pageSize=50",
          ),
          apiRequest<ProvisioningOptions>(session, "/admin/devices/provisioning-options"),
        ]);
      setGateways(loadedGateways.items);
      setNodes(loadedNodes.items);
      setGatewayTotal(loadedGateways.total);
      setNodeTotal(loadedNodes.total);
      setNodeTypes(loadedNodeTypes);
      setCommands(loadedCommands.items);
      setOptions(loadedOptions);
      setNodeTypeId(loadedNodeTypes[0]?.id ?? "");
      setProvisionNodeTypeId((current) => current || loadedNodeTypes[0]?.id || "");
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    void load();
  }, [session, gatewayPage, gatewayPageSize, gatewaySearch, nodePage, nodePageSize, nodeSearch]);

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
  const filteredGateways = gateways;
  const filteredNodes = nodes;
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

  const unassign = async () => {
    if (!session || !unassignTarget || unassigning) return;
    setFormError("");
    setUnassigning(true);
    try {
      await apiRequest(session, unassignTarget.path, { method: "DELETE" });
      setUnassignTarget(undefined);
      await load();
      setSuccessMessage(t("devices.unassignedSuccess"));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("common.errorDescription"));
    } finally {
      setUnassigning(false);
    }
  };

  const updateDeviceLifecycle = async () => {
    if (!session || !lifecycleTarget || lifecycleMutating) return;
    setLifecycleMutating(true);
    setFormError("");
    try {
      await apiRequest(
        session,
        `/admin/devices/${lifecycleTarget.kind === "gateway" ? "gateways" : "nodes"}/${lifecycleTarget.id}`,
        { body: JSON.stringify({ status: lifecycleTarget.nextStatus }), method: "PATCH" },
      );
      const activated = lifecycleTarget.nextStatus === "ACTIVE";
      setLifecycleTarget(undefined);
      await load();
      setSuccessMessage(t(activated ? "devices.reactivated" : "devices.deactivated"));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("common.errorDescription"));
    } finally {
      setLifecycleMutating(false);
    }
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
            {
              icon:
                row.status === "ACTIVE" ? (
                  <IconPlayerPause size={16} />
                ) : (
                  <IconPlayerPlay size={16} />
                ),
              key: "status",
              label: t(row.status === "ACTIVE" ? "organizations.deactivate" : "devices.reactivate"),
              onClick: () =>
                setLifecycleTarget({
                  id: row.id,
                  kind: "gateway",
                  label: row.serialNumber,
                  nextStatus: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                }),
            },
          ]
        : []),
      ...(hasPermission(session, "gateways.assign")
        ? [
            ...(row.companyAssignments.length
              ? [
                  {
                    icon: <IconUnlink size={16} />,
                    key: "unassign-company",
                    label: t("devices.unassignCompany"),
                    onClick: () =>
                      setUnassignTarget({
                        impact: t("devices.confirmGatewayCompanyUnassignImpact"),
                        label: row.serialNumber,
                        path: `/admin/devices/gateways/${row.id}/company-assignment`,
                      }),
                  },
                ]
              : [
                  {
                    icon: <IconBuildingCommunity size={16} />,
                    key: "assign-company",
                    label: t("devices.assignCompany"),
                    onClick: () => setAssignmentTarget({ id: row.id, kind: "gateway-company" }),
                  },
                ]),
            ...(row.buildingAssignments.length
              ? [
                  {
                    icon: <IconUnlink size={16} />,
                    key: "unassign-building",
                    label: t("devices.unassignBuilding"),
                    onClick: () =>
                      setUnassignTarget({
                        impact: t("devices.confirmUnassignImpact"),
                        label: row.serialNumber,
                        path: `/admin/devices/gateways/${row.id}/building-assignment`,
                      }),
                  },
                ]
              : [
                  {
                    disabled: !row.companyAssignments.length,
                    disabledReason: t("devices.companyAssignmentRequired"),
                    icon: <IconBuilding size={16} />,
                    key: "assign-building",
                    label: t("devices.assignBuilding"),
                    onClick: () => setAssignmentTarget({ id: row.id, kind: "gateway-building" }),
                  },
                ]),
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
            {
              icon:
                row.status === "ACTIVE" ? (
                  <IconPlayerPause size={16} />
                ) : (
                  <IconPlayerPlay size={16} />
                ),
              key: "status",
              label: t(row.status === "ACTIVE" ? "organizations.deactivate" : "devices.reactivate"),
              onClick: () =>
                setLifecycleTarget({
                  id: row.id,
                  kind: "node",
                  label: row.number,
                  nextStatus: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                }),
            },
          ]
        : []),
      ...(hasPermission(session, "nodes.assign")
        ? [
            ...(row.companyAssignments.length
              ? [
                  {
                    icon: <IconUnlink size={16} />,
                    key: "unassign-company",
                    label: t("devices.unassignCompany"),
                    onClick: () =>
                      setUnassignTarget({
                        impact: t("devices.confirmNodeCompanyUnassignImpact"),
                        label: row.number,
                        path: `/admin/devices/nodes/${row.id}/company-assignment`,
                      }),
                  },
                ]
              : [
                  {
                    icon: <IconBuildingCommunity size={16} />,
                    key: "assign-company",
                    label: t("devices.assignCompany"),
                    onClick: () => setAssignmentTarget({ id: row.id, kind: "node-company" }),
                  },
                ]),
            {
              disabled: !row.gatewayAssignments.length,
              disabledReason: t("devices.noGatewayAssignment"),
              icon: <IconUnlink size={16} />,
              key: "unassign-gateway",
              label: t("devices.unassignGateway"),
              onClick: () =>
                setUnassignTarget({
                  impact: t("devices.confirmNodeGatewayUnassignImpact"),
                  label: row.number,
                  path: `/admin/devices/nodes/${row.id}/gateway-assignment`,
                }),
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
      <WorkspaceTabs
        ariaLabel={t("devices.companyDevicesTitle")}
        items={[
          { label: t("devices.gatewaysTitle"), value: "gateways" },
          { label: t("devices.nodesTitle"), value: "nodes" },
        ]}
        onChange={(value) => setInventoryTab(value as "gateways" | "nodes")}
        value={inventoryTab}
      />
      {inventoryTab === "gateways" ? (
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
              from: gatewayTotal === 0 ? 0 : (gatewayPage - 1) * gatewayPageSize + 1,
              to: Math.min(gatewayPage * gatewayPageSize, gatewayTotal),
              total: gatewayTotal,
            })}
            totalPages={Math.max(1, Math.ceil(gatewayTotal / gatewayPageSize))}
          />
          <DataToolbar>
            <TextInput
              aria-label={t("devices.searchGateways")}
              onChange={(event) => {
                setGatewaySearch(event.currentTarget.value);
                setGatewayPage(1);
              }}
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
              from: nodeTotal === 0 ? 0 : (nodePage - 1) * nodePageSize + 1,
              to: Math.min(nodePage * nodePageSize, nodeTotal),
              total: nodeTotal,
            })}
            totalPages={Math.max(1, Math.ceil(nodeTotal / nodePageSize))}
          />
          <DataToolbar>
            <TextInput
              aria-label={t("devices.searchNodes")}
              onChange={(event) => {
                setNodeSearch(event.currentTarget.value);
                setNodePage(1);
              }}
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
        </Stack>
      )}
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
      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t("devices.unassign")}
        description={unassignTarget?.impact ?? t("devices.confirmUnassignImpact")}
        entityName={unassignTarget?.label ?? ""}
        loading={unassigning}
        onClose={() => {
          if (!unassigning) setUnassignTarget(undefined);
        }}
        onConfirm={() => void unassign()}
        opened={Boolean(unassignTarget)}
        title={tf("devices.confirmUnassign", { label: unassignTarget?.label ?? "" })}
      />
      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t(
          lifecycleTarget?.nextStatus === "ACTIVE"
            ? "devices.reactivate"
            : "organizations.deactivate",
        )}
        description={t(
          lifecycleTarget?.nextStatus === "ACTIVE"
            ? "organizations.confirmActivateImpact"
            : "devices.confirmRetireImpact",
        )}
        entityName={lifecycleTarget?.label ?? ""}
        loading={lifecycleMutating}
        onClose={() => {
          if (!lifecycleMutating) setLifecycleTarget(undefined);
        }}
        onConfirm={() => void updateDeviceLifecycle()}
        opened={Boolean(lifecycleTarget)}
        title={t(
          lifecycleTarget?.nextStatus === "ACTIVE"
            ? "organizations.confirmActivateTitle"
            : "organizations.confirmDeactivateTitle",
        )}
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
