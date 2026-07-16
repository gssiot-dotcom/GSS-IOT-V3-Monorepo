import type {
  GatewayCommandRecord,
  GatewayRecord,
  NodeRecord,
  NodeTypeRecord,
} from "@gss-iot/contracts";
import { DataTable, EmptyState, ErrorState, LoadingState, PageHeader } from "@gss-iot/ui";
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

import { t } from "../../app/i18n";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { Can } from "../../shared/rbac/Can";
import { deviceStatusLabel, gatewayTypeLabel } from "./device-labels";

type AssignmentTarget =
  | { id: string; kind: "gateway-building" | "gateway-company" }
  | { id: string; kind: "node-company" };

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
  const [gatewayOpened, setGatewayOpened] = useState(false);
  const [nodeOpened, setNodeOpened] = useState(false);
  const [assignmentTarget, setAssignmentTarget] = useState<AssignmentTarget>();
  const [serialNumber, setSerialNumber] = useState("");
  const [gatewayType, setGatewayType] = useState("NODES_GATEWAY");
  const [nodeNumber, setNodeNumber] = useState("");
  const [nodeTypeId, setNodeTypeId] = useState("");
  const [assignmentValue, setAssignmentValue] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [gatewayId, setGatewayId] = useState("");
  const [provisionNodeTypeId, setProvisionNodeTypeId] = useState("");
  const [provisionNodeIds, setProvisionNodeIds] = useState<string[]>([]);

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
  const eligibleNodeOptions = (nodes ?? [])
    .filter(
      (node) =>
        node.companyAssignments[0]?.companyId === companyId &&
        node.gatewayAssignments.length === 0 &&
        node.nodeTypeId === provisionNodeTypeId,
    )
    .map((node) => ({ label: `${node.number} (${node.nodeType.displayName})`, value: node.id }));
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

  const createGateway = async () => {
    if (!session) return;
    setFormError("");
    await apiRequest(session, "/admin/devices/gateways", {
      body: JSON.stringify({ gatewayType, serialNumber }),
      method: "POST",
    });
    setGatewayOpened(false);
    setSerialNumber("");
    await load();
  };

  const createNode = async () => {
    if (!session) return;
    setFormError("");
    await apiRequest(session, "/admin/devices/nodes", {
      body: JSON.stringify({ nodeTypeId, number: nodeNumber }),
      method: "POST",
    });
    setNodeOpened(false);
    setNodeNumber("");
    await load();
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
      }),
      method: "POST",
    });
    setProvisionNodeIds([]);
    await load();
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
              <Button onClick={() => setGatewayOpened(true)}>{t("devices.createGateway")}</Button>
            </Can>
            <Can permission="nodes.create">
              <Button onClick={() => setNodeOpened(true)} variant="light">
                {t("devices.createNode")}
              </Button>
            </Can>
          </Group>
        }
      />
      <Can permission="mqtt-commands.manage">
        <Stack gap="sm">
          <Text fw={600}>{t("devices.provisioningTitle")}</Text>
          {formError ? <Alert color="red">{formError}</Alert> : null}
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
              }}
              value={buildingId}
            />
            <Select
              data={gatewayOptions}
              disabled={!buildingId}
              label={t("devices.gateway")}
              onChange={(value) => setGatewayId(value ?? "")}
              value={gatewayId}
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
            data={eligibleNodeOptions}
            disabled={!companyId || !provisionNodeTypeId}
            label={t("devices.eligibleNodes")}
            onChange={setProvisionNodeIds}
            searchable
            value={provisionNodeIds}
          />
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
                  render: (row) => <Badge>{row.status}</Badge>,
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
              rows={registerCommands}
            />
          ) : null}
        </Stack>
      </Can>
      <Tabs defaultValue="gateways">
        <Tabs.List>
          <Tabs.Tab value="gateways">{t("devices.gatewaysTitle")}</Tabs.Tab>
          <Tabs.Tab value="nodes">{t("devices.nodesTitle")}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel pt="md" value="gateways">
          {gateways.length ? (
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
                  key: "company",
                  label: t("devices.company"),
                  render: (row) => row.companyAssignments[0]?.company?.name ?? "-",
                },
                {
                  key: "building",
                  label: t("devices.building"),
                  render: (row) => row.buildingAssignments[0]?.building.title ?? "-",
                },
                {
                  key: "actions",
                  label: t("organizations.actions"),
                  render: (row) => (
                    <Group gap="xs">
                      <Can permission="gateways.assign">
                        <Button
                          onClick={() =>
                            setAssignmentTarget({ id: row.id, kind: "gateway-company" })
                          }
                          size="xs"
                          variant="light"
                        >
                          {t("devices.assignCompany")}
                        </Button>
                        <Button
                          disabled={!row.companyAssignments.length}
                          onClick={() =>
                            setAssignmentTarget({ id: row.id, kind: "gateway-building" })
                          }
                          size="xs"
                          variant="light"
                        >
                          {t("devices.assignBuilding")}
                        </Button>
                        <Button
                          disabled={!row.buildingAssignments.length}
                          onClick={() =>
                            void unassign(`/admin/devices/gateways/${row.id}/building-assignment`)
                          }
                          size="xs"
                          variant="subtle"
                        >
                          {t("devices.unassignBuilding")}
                        </Button>
                      </Can>
                    </Group>
                  ),
                },
              ]}
              rows={gateways}
            />
          ) : (
            <EmptyState
              description={t("devices.emptyDescription")}
              title={t("common.emptyTitle")}
            />
          )}
        </Tabs.Panel>
        <Tabs.Panel pt="md" value="nodes">
          {nodes.length ? (
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
                  key: "company",
                  label: t("devices.company"),
                  render: (row) => row.companyAssignments[0]?.company?.name ?? "-",
                },
                {
                  key: "gateway",
                  label: t("devices.gateway"),
                  render: (row) => row.gatewayAssignments[0]?.gateway.serialNumber ?? "-",
                },
                {
                  key: "actions",
                  label: t("organizations.actions"),
                  render: (row) => (
                    <Group gap="xs">
                      <Can permission="nodes.assign">
                        <Button
                          onClick={() => setAssignmentTarget({ id: row.id, kind: "node-company" })}
                          size="xs"
                          variant="light"
                        >
                          {t("devices.assignCompany")}
                        </Button>
                        <Button
                          disabled={!row.gatewayAssignments.length}
                          onClick={() =>
                            void unassign(`/admin/devices/nodes/${row.id}/gateway-assignment`)
                          }
                          size="xs"
                          variant="subtle"
                        >
                          {t("devices.unassignGateway")}
                        </Button>
                      </Can>
                    </Group>
                  ),
                },
              ]}
              rows={nodes}
            />
          ) : (
            <EmptyState
              description={t("devices.emptyDescription")}
              title={t("common.emptyTitle")}
            />
          )}
        </Tabs.Panel>
      </Tabs>
      <Modal
        opened={gatewayOpened}
        onClose={() => setGatewayOpened(false)}
        title={t("devices.createGateway")}
      >
        <Stack>
          <TextInput
            label={t("devices.serialNumber")}
            onChange={(event) => setSerialNumber(event.currentTarget.value)}
            value={serialNumber}
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
          <Button
            onClick={() => void createGateway().catch((err: Error) => setFormError(err.message))}
          >
            {t("devices.createGateway")}
          </Button>
        </Stack>
      </Modal>
      <Modal
        opened={nodeOpened}
        onClose={() => setNodeOpened(false)}
        title={t("devices.createNode")}
      >
        <Stack>
          <TextInput
            label={t("devices.nodeNumber")}
            onChange={(event) => setNodeNumber(event.currentTarget.value)}
            value={nodeNumber}
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
          <Button
            onClick={() => void createNode().catch((err: Error) => setFormError(err.message))}
          >
            {t("devices.createNode")}
          </Button>
        </Stack>
      </Modal>
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
          <Button
            disabled={!assignmentValue}
            onClick={() => void assign().catch((err: Error) => setFormError(err.message))}
          >
            {t(
              assignmentTarget?.kind === "gateway-building"
                ? "devices.assignBuilding"
                : "devices.assignCompany",
            )}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
