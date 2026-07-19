import type {
  AreaRecord,
  BuildingPlanImageRecord,
  BuildingRecord,
  CompanyDeviceSnapshot,
  CompanyUserRecord,
} from "@gss-iot/contracts";
import { Can } from "../../shared/rbac/Can";
import { ApiError, apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import {
  DataTable,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  PageHeader,
} from "@gss-iot/ui";
import { Button, Group, Modal, Select, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { IconChartBar, IconMap, IconUpload } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { t } from "../../app/i18n";
import { hasPermission } from "../../shared/rbac/has-permission";

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
        const nextBuildings = await apiRequest<BuildingRecord[]>(session, "/company/buildings");
        setBuildings(nextBuildings.filter((building) => building.areaId === areaId));
      } catch {
        setBuildings([]);
      }
    } else {
      setBuildings([]);
    }

    if (hasPermission(session, "company-users.view")) {
      try {
        const nextUsers = await apiRequest<CompanyUserRecord[]>(session, "/company/users");
        setUsers(
          nextUsers.filter((user) => user.areaAccess?.some((access) => access.areaId === areaId)),
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
        title={area.name}
        subtitle={t("organizations.areaDetailSubtitle")}
        action={
          <Can permission="areas.update">
            <Button onClick={() => setOpened(true)}>{t("organizations.save")}</Button>
          </Can>
        }
      />
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {hasPermission(session, "buildings.view") ? (
          <Stack>
            <Text fw={600}>{t("organizations.buildingsTitle")}</Text>
            {buildings.length ? (
              <DataTable
                columns={[
                  {
                    key: "title",
                    label: t("organizations.name"),
                    render: (building) => building.title,
                  },
                  {
                    key: "status",
                    label: t("organizations.status"),
                    render: (building) => building.status,
                  },
                  {
                    key: "actions",
                    label: t("organizations.actions"),
                    render: (building) => (
                      <Button
                        onClick={() => navigate(`/company/buildings/${building.id}`)}
                        size="xs"
                        variant="light"
                      >
                        {t("organizations.open")}
                      </Button>
                    ),
                  },
                ]}
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
              columns={[
                { key: "name", label: t("organizations.name"), render: (user) => user.name },
                { key: "role", label: t("management.role"), render: (user) => user.role.name },
              ]}
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
          <Button onClick={() => void save()}>{t("organizations.save")}</Button>
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
          const nextUsers = await apiRequest<CompanyUserRecord[]>(session, "/company/users");
          setUsers(
            nextUsers.filter(
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
          setDevices(await apiRequest<CompanyDeviceSnapshot>(session, "/company/devices"));
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
        title={building.title}
        subtitle={area?.name ?? t("organizations.buildingDetailSubtitle")}
        action={
          <Group>
            <Can permission="monitoring.view">
              <Button
                leftSection={<IconChartBar size={16} />}
                onClick={() => navigate(`/company/buildings/${building.id}/monitoring`)}
                variant="light"
              >
                {t("monitoring.open")}
              </Button>
            </Can>
            <Can permission="building-plans.view">
              <Button
                leftSection={<IconMap size={16} />}
                onClick={() => navigate(`/company/buildings/${building.id}/plan`)}
                variant="light"
              >
                {t("organizations.buildingPlan")}
              </Button>
            </Can>
            <Can permission="buildings.update">
              <Button onClick={() => setOpened(true)}>{t("organizations.save")}</Button>
            </Can>
          </Group>
        }
      />
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {hasPermission(session, "company-users.view") ? (
          <Stack>
            <Text fw={600}>{t("management.assignedUsers")}</Text>
            <DataTable
              columns={[
                { key: "name", label: t("organizations.name"), render: (user) => user.name },
                { key: "role", label: t("management.role"), render: (user) => user.role.name },
              ]}
              rows={users}
            />
          </Stack>
        ) : null}
        {hasPermission(session, "company-devices.view") ? (
          <Stack>
            <Text fw={600}>{t("devices.gatewaysTitle")}</Text>
            <DataTable
              columns={[
                {
                  key: "serialNumber",
                  label: t("devices.serialNumber"),
                  render: (gateway) => gateway.serialNumber,
                },
                { key: "status", label: t("devices.status"), render: (gateway) => gateway.status },
              ]}
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
          <Button onClick={() => void save()}>{t("organizations.save")}</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

export function CompanyBuildingPlanPage() {
  const { buildingId } = useParams();
  const { session } = useAuth();
  const [images, setImages] = useState<BuildingPlanImageRecord[]>();
  const [error, setError] = useState(false);
  const [opened, setOpened] = useState(false);
  const [storageKey, setStorageKey] = useState("");
  const [kind, setKind] = useState<"PLAN" | "REAL">("PLAN");

  const load = async () => {
    if (!session || !buildingId) return;
    setError(false);
    try {
      setImages(
        await apiRequest<BuildingPlanImageRecord[]>(
          session,
          `/company/buildings/${buildingId}/plan-images`,
        ),
      );
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    void load();
  }, [session, buildingId]);

  const addImage = async () => {
    if (!session || !buildingId) return;
    await apiRequest(session, `/company/buildings/${buildingId}/plan-images`, {
      body: JSON.stringify({
        images: [{ kind, orderIndex: images?.length ?? 0, storageKey }],
      }),
      method: "POST",
    });
    setStorageKey("");
    setOpened(false);
    await load();
  };

  if (!images && !error) return <LoadingState title={t("common.loading")} />;
  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;

  return (
    <Stack gap="lg">
      <PageHeader
        title={t("organizations.buildingPlan")}
        subtitle={t("organizations.buildingPlanSubtitle")}
        action={
          <Can permission="building-plans.manage">
            <Button leftSection={<IconUpload size={16} />} onClick={() => setOpened(true)}>
              {t("organizations.addPlanImage")}
            </Button>
          </Can>
        }
      />
      {images?.length ? (
        <DataTable
          columns={[
            { key: "kind", label: t("organizations.kind"), render: (image) => image.kind },
            {
              key: "storageKey",
              label: t("organizations.storageKey"),
              render: (image) => image.storageKey,
            },
          ]}
          rows={images}
        />
      ) : (
        <EmptyState
          description={t("organizations.emptyPlanDescription")}
          title={t("common.emptyTitle")}
        />
      )}
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={t("organizations.addPlanImage")}
      >
        <Stack>
          <Select
            data={["PLAN", "REAL"]}
            label={t("organizations.kind")}
            onChange={(nextKind) => setKind((nextKind ?? "PLAN") as "PLAN" | "REAL")}
            value={kind}
          />
          <TextInput
            label={t("organizations.storageKey")}
            onChange={(event) => setStorageKey(event.currentTarget.value)}
            value={storageKey}
          />
          <Button disabled={!storageKey} onClick={() => void addImage()}>
            {t("organizations.addPlanImage")}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
