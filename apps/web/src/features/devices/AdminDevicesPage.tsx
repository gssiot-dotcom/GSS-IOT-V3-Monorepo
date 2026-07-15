import type { GatewayRecord, NodeRecord, NodeTypeRecord } from "@gss-iot/contracts";
import { DataTable, EmptyState, ErrorState, LoadingState, PageHeader } from "@gss-iot/ui";
import { Button, Group, Modal, Select, Stack, Tabs, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";

import { t } from "../../app/i18n";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { Can } from "../../shared/rbac/Can";
import { deviceStatusLabel, gatewayTypeLabel } from "./device-labels";

type AssignmentTarget =
  | { id: string; kind: "gateway-building" | "gateway-company" }
  | { id: string; kind: "node-company" | "node-gateway" };

export function AdminDevicesPage() {
  const { session } = useAuth();
  const [gateways, setGateways] = useState<GatewayRecord[]>();
  const [nodes, setNodes] = useState<NodeRecord[]>();
  const [nodeTypes, setNodeTypes] = useState<NodeTypeRecord[]>([]);
  const [error, setError] = useState(false);
  const [gatewayOpened, setGatewayOpened] = useState(false);
  const [nodeOpened, setNodeOpened] = useState(false);
  const [assignmentTarget, setAssignmentTarget] = useState<AssignmentTarget>();
  const [serialNumber, setSerialNumber] = useState("");
  const [gatewayType, setGatewayType] = useState("NODES_GATEWAY");
  const [nodeNumber, setNodeNumber] = useState("");
  const [nodeTypeId, setNodeTypeId] = useState("");
  const [assignmentValue, setAssignmentValue] = useState("");

  const load = async () => {
    if (!session) return;
    setError(false);
    try {
      const [loadedGateways, loadedNodes, loadedNodeTypes] = await Promise.all([
        apiRequest<GatewayRecord[]>(session, "/admin/devices/gateways"),
        apiRequest<NodeRecord[]>(session, "/admin/devices/nodes"),
        apiRequest<NodeTypeRecord[]>(session, "/admin/devices/node-types"),
      ]);
      setGateways(loadedGateways);
      setNodes(loadedNodes);
      setNodeTypes(loadedNodeTypes);
      setNodeTypeId(loadedNodeTypes[0]?.id ?? "");
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    void load();
  }, [session]);

  const createGateway = async () => {
    if (!session) return;
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
    const path =
      assignmentTarget.kind === "gateway-company"
        ? `/admin/devices/gateways/${assignmentTarget.id}/company-assignment`
        : assignmentTarget.kind === "gateway-building"
          ? `/admin/devices/gateways/${assignmentTarget.id}/building-assignment`
          : assignmentTarget.kind === "node-company"
            ? `/admin/devices/nodes/${assignmentTarget.id}/company-assignment`
            : `/admin/devices/nodes/${assignmentTarget.id}/gateway-assignment`;
    const body =
      assignmentTarget.kind === "gateway-building"
        ? { buildingId: assignmentValue }
        : assignmentTarget.kind === "node-gateway"
          ? { gatewayId: assignmentValue }
          : { companyId: assignmentValue };
    await apiRequest(session, path, { body: JSON.stringify(body), method: "POST" });
    setAssignmentTarget(undefined);
    setAssignmentValue("");
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
                          onClick={() =>
                            setAssignmentTarget({ id: row.id, kind: "gateway-building" })
                          }
                          size="xs"
                          variant="light"
                        >
                          {t("devices.assignBuilding")}
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
                          onClick={() => setAssignmentTarget({ id: row.id, kind: "node-gateway" })}
                          size="xs"
                          variant="light"
                        >
                          {t("devices.assignGateway")}
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
          <Button onClick={() => void createGateway()}>{t("devices.createGateway")}</Button>
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
          <Button onClick={() => void createNode()}>{t("devices.createNode")}</Button>
        </Stack>
      </Modal>
      <Modal
        opened={Boolean(assignmentTarget)}
        onClose={() => setAssignmentTarget(undefined)}
        title={t(
          assignmentTarget?.kind === "gateway-building"
            ? "devices.assignBuilding"
            : assignmentTarget?.kind === "node-gateway"
              ? "devices.assignGateway"
              : "devices.assignCompany",
        )}
      >
        <Stack>
          <TextInput
            label={
              assignmentTarget?.kind === "gateway-building"
                ? t("devices.building")
                : assignmentTarget?.kind === "node-gateway"
                  ? t("devices.gateway")
                  : t("devices.company")
            }
            onChange={(event) => setAssignmentValue(event.currentTarget.value)}
            value={assignmentValue}
          />
          <Button onClick={() => void assign()}>
            {t(
              assignmentTarget?.kind === "gateway-building"
                ? "devices.assignBuilding"
                : assignmentTarget?.kind === "node-gateway"
                  ? "devices.assignGateway"
                  : "devices.assignCompany",
            )}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
