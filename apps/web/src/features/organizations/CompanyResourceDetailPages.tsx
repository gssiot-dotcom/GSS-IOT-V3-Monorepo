import type {
  AreaRecord,
  BuildingRecord,
  CompanyDeviceSnapshot,
  CompanyDeviceInventoryResponse,
  CompanyUserRecord,
  PaginatedResponse,
} from "@gss-iot/contracts";
import { Can } from "../../shared/rbac/Can";
import { ApiError, apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import {
  DataTable,
  EntityActionMenu,
  EntityPrimaryCell,
  EntityStatusBadge,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  ModalFormFooter,
  PageHeader,
} from "@gss-iot/ui";
import { Button, Group, Modal, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { IconChartBar, IconEdit, IconMap } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { t } from "../../app/i18n";
import { hasPermission } from "../../shared/rbac/has-permission";
import {
  deviceConnectivityBadge,
  deviceLifecycleBadge,
  formatDeviceDate,
} from "../devices/device-labels";
import { BuildingImageManager } from "./BuildingImageManager";

export function CompanyAreaDetailPage() {
  const { areaId } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [area, setArea] = useState<AreaRecord>();
  const [buildings, setBuildings] = useState<BuildingRecord[]>([]);
  const [users, setUsers] = useState<CompanyUserRecord[]>([]);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState("");

  const load = async () => {
    if (!session || !areaId) return;
    setErrorStatus(null);
    try {
      const nextArea = await apiRequest<AreaRecord>(session, `/company/areas/${areaId}`);
      setArea(nextArea);
      setName(nextArea.name);
    } catch (error) {
      setErrorStatus(error instanceof ApiError ? error.status : 500);
      return;
    }

    if (hasPermission(session, "buildings.view")) {
      try {
        const nextBuildings = await apiRequest<PaginatedResponse<BuildingRecord>>(
          session,
          "/company/buildings?pageSize=100",
        );
        setBuildings(nextBuildings.items.filter((building) => building.areaId === areaId));
      } catch {
        setBuildings([]);
      }
    } else {
      setBuildings([]);
    }

    if (hasPermission(session, "company-users.view")) {
      try {
        const nextUsers = await apiRequest<PaginatedResponse<CompanyUserRecord>>(
          session,
          "/company/users?pageSize=100",
        );
        setUsers(
          nextUsers.items.filter((user) =>
            user.areaAccess?.some((access) => access.areaId === areaId),
          ),
        );
      } catch {
        setUsers([]);
      }
    } else {
      setUsers([]);
    }
  };

  useEffect(() => {
    void load();
  }, [session, areaId]);

  const save = async () => {
    if (!session || !areaId) return;
    await apiRequest(session, `/company/areas/${areaId}`, {
      body: JSON.stringify({ name }),
      method: "PATCH",
    });
    setOpened(false);
    await load();
  };

  if (!area && !errorStatus) return <LoadingState title={t("common.loading")} />;
  if (errorStatus === 403)
    return (
      <ForbiddenState description={t("common.pageUnavailable")} title={t("common.forbidden")} />
    );
  if (errorStatus === 404)
    return (
      <ErrorState description={t("common.notFoundDescription")} title={t("common.notFoundTitle")} />
    );
  if (errorStatus)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;
  if (!area) return null;

  return (
    <Stack gap="lg">
      <PageHeader
        eyebrow={t("organizations.areaDetail")}
        meta={
          <Text c="dimmed" size="sm">
            {area.address ?? t("organizations.noAddress")}
          </Text>
        }
        status={
          <EntityStatusBadge
            label={area.status === "ACTIVE" ? t("management.active") : t("management.inactive")}
            status={area.status === "ACTIVE" ? "active" : "inactive"}
          />
        }
        title={area.name}
        subtitle={t("organizations.areaDetailSubtitle")}
        action={
          <Can permission="areas.update">
            <Button leftSection={<IconEdit size={16} />} onClick={() => setOpened(true)}>
              {t("organizations.edit")}
            </Button>
          </Can>
        }
      />
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {hasPermission(session, "buildings.view") ? (
          <Stack>
            <Text fw={600}>{t("organizations.buildingsTitle")}</Text>
            {buildings.length ? (
              <DataTable
                ariaLabel={t("organizations.buildingsTitle")}
                columns={[
                  {
                    key: "identity",
                    label: t("organizations.name"),
                    render: (building) => (
                      <EntityPrimaryCell
                        identifier={building.number ?? undefined}
                        title={building.title}
                      />
                    ),
                  },
                  {
                    key: "status",
                    label: t("organizations.status"),
                    render: (building) => (
                      <EntityStatusBadge
                        label={
                          building.status === "ACTIVE"
                            ? t("management.active")
                            : t("management.inactive")
                        }
                        status={building.status === "ACTIVE" ? "active" : "inactive"}
                      />
                    ),
                  },
                ]}
                density="compact"
                onRowClick={(building) => navigate(`/company/buildings/${building.id}`)}
                rows={buildings}
              />
            ) : (
              <EmptyState
                description={t("organizations.emptyScopedDescription")}
                title={t("common.emptyTitle")}
              />
            )}
          </Stack>
        ) : null}
        {hasPermission(session, "company-users.view") ? (
          <Stack>
            <Text fw={600}>{t("management.assignedUsers")}</Text>
            <DataTable
              ariaLabel={t("management.assignedUsers")}
              columns={[
                {
                  key: "name",
                  label: t("organizations.name"),
                  render: (user) => <EntityPrimaryCell identifier={user.email} title={user.name} />,
                },
                { key: "role", label: t("management.role"), render: (user) => user.role.name },
              ]}
              density="compact"
              rows={users}
            />
          </Stack>
        ) : null}
      </SimpleGrid>
      <Modal opened={opened} onClose={() => setOpened(false)} title={t("organizations.save")}>
        <Stack>
          <TextInput
            label={t("organizations.name")}
            onChange={(event) => setName(event.currentTarget.value)}
            value={name}
          />
          <ModalFormFooter
            cancelLabel={t("common.cancel")}
            onCancel={() => setOpened(false)}
            onSubmit={() => void save()}
            submitLabel={t("organizations.save")}
          />
        </Stack>
      </Modal>
    </Stack>
  );
}

export function CompanyBuildingDetailPage() {
  const { buildingId } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [building, setBuilding] = useState<BuildingRecord>();
  const [area, setArea] = useState<AreaRecord>();
  const [users, setUsers] = useState<CompanyUserRecord[]>([]);
  const [devices, setDevices] = useState<CompanyDeviceSnapshot>();
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [opened, setOpened] = useState(false);
  const [title, setTitle] = useState("");

  const load = async () => {
    if (!session || !buildingId) return;
    setErrorStatus(null);
    try {
      const nextBuilding = await apiRequest<BuildingRecord>(
        session,
        `/company/buildings/${buildingId}`,
      );
      setBuilding(nextBuilding);
      setTitle(nextBuilding.title);
      if (hasPermission(session, "areas.view")) {
        try {
          setArea(await apiRequest<AreaRecord>(session, `/company/areas/${nextBuilding.areaId}`));
        } catch {
          setArea(undefined);
        }
      }
      if (hasPermission(session, "company-users.view")) {
        try {
          const nextUsers = await apiRequest<PaginatedResponse<CompanyUserRecord>>(
            session,
            "/company/users?pageSize=100",
          );
          setUsers(
            nextUsers.items.filter(
              (user) =>
                user.buildingAccess?.some((access) => access.buildingId === buildingId) ||
                user.areaAccess?.some((access) => access.areaId === nextBuilding.areaId),
            ),
          );
        } catch {
          setUsers([]);
        }
      } else {
        setUsers([]);
      }
      if (hasPermission(session, "company-devices.view")) {
        try {
          const inventory = await apiRequest<CompanyDeviceInventoryResponse>(
            session,
            "/company/devices?gatewayPageSize=100&nodePageSize=100",
          );
          setDevices({ gateways: inventory.gateways.items, nodes: inventory.nodes.items });
        } catch {
          setDevices(undefined);
        }
      } else {
        setDevices(undefined);
      }
    } catch (error) {
      setErrorStatus(error instanceof ApiError ? error.status : 500);
    }
  };

  useEffect(() => {
    void load();
  }, [session, buildingId]);

  const save = async () => {
    if (!session || !buildingId) return;
    await apiRequest(session, `/company/buildings/${buildingId}`, {
      body: JSON.stringify({ title }),
      method: "PATCH",
    });
    setOpened(false);
    await load();
  };

  if (!building && !errorStatus) return <LoadingState title={t("common.loading")} />;
  if (errorStatus === 403)
    return (
      <ForbiddenState description={t("common.pageUnavailable")} title={t("common.forbidden")} />
    );
  if (errorStatus === 404)
    return (
      <ErrorState description={t("common.notFoundDescription")} title={t("common.notFoundTitle")} />
    );
  if (errorStatus)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;
  if (!building) return null;

  const assignedGateways =
    devices?.gateways.filter((gateway) =>
      gateway.buildingAssignments.some((assignment) => assignment.buildingId === buildingId),
    ) ?? [];

  return (
    <Stack gap="lg">
      <PageHeader
        eyebrow={area?.name ?? t("organizations.building")}
        meta={
          <Group gap="sm">
            <Text c="dimmed" size="sm">
              {building.number ?? t("organizations.noNumber")}
            </Text>
            <Text c="dimmed" size="sm">
              {building.address ?? t("organizations.noAddress")}
            </Text>
          </Group>
        }
        overflowAction={
          <EntityActionMenu
            ariaLabel={`${t("common.moreActions")}: ${building.title}`}
            items={[
              ...(hasPermission(session, "monitoring.view")
                ? [
                    {
                      icon: <IconChartBar size={16} />,
                      key: "monitoring",
                      label: t("monitoring.open"),
                      onClick: () => navigate(`/company/buildings/${building.id}/monitoring`),
                    },
                  ]
                : []),
              ...(hasPermission(session, "building-plans.view")
                ? [
                    {
                      icon: <IconMap size={16} />,
                      key: "plan",
                      label: t("organizations.buildingPlan"),
                      onClick: () => navigate(`/company/buildings/${building.id}/plan`),
                    },
                  ]
                : []),
            ]}
          />
        }
        status={
          <EntityStatusBadge
            label={building.status === "ACTIVE" ? t("management.active") : t("management.inactive")}
            status={building.status === "ACTIVE" ? "active" : "inactive"}
          />
        }
        title={building.title}
        subtitle={t("organizations.buildingDetailSubtitle")}
        action={
          <Can permission="buildings.update">
            <Button leftSection={<IconEdit size={16} />} onClick={() => setOpened(true)}>
              {t("organizations.edit")}
            </Button>
          </Can>
        }
      />
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {hasPermission(session, "company-users.view") ? (
          <Stack>
            <Text fw={600}>{t("management.assignedUsers")}</Text>
            <DataTable
              ariaLabel={t("management.assignedUsers")}
              columns={[
                {
                  key: "name",
                  label: t("organizations.name"),
                  render: (user) => <EntityPrimaryCell identifier={user.email} title={user.name} />,
                },
                { key: "role", label: t("management.role"), render: (user) => user.role.name },
              ]}
              density="compact"
              rows={users}
            />
          </Stack>
        ) : null}
        {hasPermission(session, "company-devices.view") ? (
          <Stack>
            <Text fw={600}>{t("devices.gatewaysTitle")}</Text>
            <DataTable
              ariaLabel={t("devices.gatewaysTitle")}
              columns={[
                {
                  key: "identity",
                  label: t("devices.gateway"),
                  render: (gateway) => <EntityPrimaryCell title={gateway.serialNumber} />,
                },
                {
                  key: "status",
                  label: t("devices.status"),
                  render: (gateway) => deviceLifecycleBadge(gateway.status),
                },
                {
                  key: "connection",
                  label: t("devices.connection"),
                  render: (gateway) => deviceConnectivityBadge(gateway.lastSeenAt),
                },
                {
                  key: "lastSeen",
                  label: t("devices.lastSeen"),
                  render: (gateway) => formatDeviceDate(gateway.lastSeenAt),
                },
              ]}
              density="compact"
              rows={assignedGateways}
            />
          </Stack>
        ) : null}
      </SimpleGrid>
      <Modal opened={opened} onClose={() => setOpened(false)} title={t("organizations.save")}>
        <Stack>
          <TextInput
            label={t("organizations.name")}
            onChange={(event) => setTitle(event.currentTarget.value)}
            value={title}
          />
          <ModalFormFooter
            cancelLabel={t("common.cancel")}
            onCancel={() => setOpened(false)}
            onSubmit={() => void save()}
            submitLabel={t("organizations.save")}
          />
        </Stack>
      </Modal>
    </Stack>
  );
}

export function CompanyBuildingPlanPage() {
  const { buildingId } = useParams();

  return (
    <Stack gap="lg">
      <PageHeader
        title={t("organizations.buildingPlan")}
        subtitle={t("organizations.buildingPlanSubtitle")}
      />
      {buildingId ? <BuildingImageManager basePath="/company" buildingId={buildingId} /> : null}
    </Stack>
  );
}
