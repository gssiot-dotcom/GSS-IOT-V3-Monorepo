import type {
  AreaRecord,
  BuildingRecord,
  CompanyDeviceSnapshot,
  CompanyRecord,
  CompanyRoleRecord,
  CompanyUserRecord,
  GatewayRecord,
  NodeRecord,
} from "@gss-iot/contracts";
import {
  DataTable,
  ContextSectionLayout,
  ContextSectionNav,
  EmptyState,
  EntityCard,
  EntityCardGrid,
  EntityMetric,
  EntityStatusRow,
  ErrorState,
  ForbiddenState,
  LoadingState,
  PageContainer,
  PageHeader,
} from "@gss-iot/ui";
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  NavLink,
  Text,
  TextInput,
} from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";

import { t } from "../../app/i18n";
import { ApiError, apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { Can } from "../../shared/rbac/Can";
import { hasPermission } from "../../shared/rbac/has-permission";
import { deviceStatusLabel, gatewayTypeLabel } from "../devices/device-labels";

type CompanyDetailSection = "overview" | "sites" | "buildings" | "users" | "devices";

export interface DetailState {
  areas: AreaRecord[];
  buildings: BuildingRecord[];
  company?: CompanyRecord;
  gateways: GatewayRecord[];
  nodes: NodeRecord[];
  roles: CompanyRoleRecord[];
  users: CompanyUserRecord[];
}

export interface AdminCompanyWorkspaceContext {
  canLoadAreas: boolean;
  canLoadDevices: boolean;
  canLoadBuildings: boolean;
  canLoadUsers: boolean;
  detail: DetailState;
  onCreateArea: () => void;
  onCreateBuilding: () => void;
  onCreateUser: () => void;
}

const emptyState: DetailState = {
  areas: [],
  buildings: [],
  gateways: [],
  nodes: [],
  roles: [],
  users: [],
};

function getSection(pathname: string): CompanyDetailSection {
  if (pathname.endsWith("/sites")) return "sites";
  if (pathname.endsWith("/buildings")) return "buildings";
  if (pathname.endsWith("/users")) return "users";
  if (pathname.endsWith("/devices")) return "devices";
  return "overview";
}

let workspaceInstanceCounter = 0;

export function AdminCompanyWorkspaceLayout(): ReactElement {
  const [workspaceInstance] = useState(() => {
    workspaceInstanceCounter += 1;
    return `workspace-${workspaceInstanceCounter}`;
  });
  const initialLoadKeyRef = useRef<string | undefined>(undefined);
  const { companyId = "" } = useParams();
  const { logout, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const section = getSection(location.pathname);
  const [detail, setDetail] = useState<DetailState>(emptyState);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [modal, setModal] = useState<"area" | "building" | "company" | "user" | undefined>();
  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [areaName, setAreaName] = useState("");
  const [areaAddress, setAreaAddress] = useState("");
  const [buildingTitle, setBuildingTitle] = useState("");
  const [buildingAreaId, setBuildingAreaId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRoleId, setUserRoleId] = useState<string | null>(null);

  const canLoadAreas = hasPermission(session, "areas.view");
  const canLoadBuildings = hasPermission(session, "buildings.view");
  const canLoadUsers = hasPermission(session, "company-users.view");
  const canLoadRoles = hasPermission(session, "company-roles.view");
  const canLoadDevices =
    hasPermission(session, "gateways.view") && hasPermission(session, "nodes.view");

  const routeBase = `/admin/companies/${companyId}`;
  const openEditCompany = () => {
    setCompanyName(detail.company?.name ?? "");
    setCompanyCode(detail.company?.code ?? "");
    setFormError(undefined);
    setModal("company");
  };

  const handleApiError = useCallback(
    async (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        await logout();
        void navigate("/login", { replace: true });
        return;
      }
      setHasError(true);
    },
    [logout, navigate],
  );

  const load = useCallback(async () => {
    if (!session || !companyId) return;
    setIsLoading(true);
    setHasError(false);
    try {
      const company = await apiRequest<CompanyRecord>(session, `/admin/companies/${companyId}`);
      const [areas, buildings, users, roles, devices] = await Promise.all([
        canLoadAreas
          ? apiRequest<AreaRecord[]>(session, `/admin/companies/${companyId}/areas`)
          : Promise.resolve([]),
        canLoadBuildings
          ? apiRequest<BuildingRecord[]>(session, `/admin/companies/${companyId}/buildings`)
          : Promise.resolve([]),
        canLoadUsers
          ? apiRequest<CompanyUserRecord[]>(session, `/admin/companies/${companyId}/users`)
          : Promise.resolve([]),
        canLoadRoles
          ? apiRequest<CompanyRoleRecord[]>(session, `/admin/companies/${companyId}/roles`)
          : Promise.resolve([]),
        canLoadDevices
          ? Promise.all([
              apiRequest<GatewayRecord[]>(session, "/admin/devices/gateways"),
              apiRequest<NodeRecord[]>(session, "/admin/devices/nodes"),
            ]).then(([gateways, nodes]) => ({ gateways, nodes }))
          : Promise.resolve<CompanyDeviceSnapshot>({ gateways: [], nodes: [] }),
      ]);

      setDetail({
        areas,
        buildings,
        company,
        gateways: devices.gateways.filter((gateway) =>
          gateway.companyAssignments.some((assignment) => assignment.companyId === companyId),
        ),
        nodes: devices.nodes.filter((node) =>
          node.companyAssignments.some((assignment) => assignment.companyId === companyId),
        ),
        roles,
        users,
      });
    } catch (error) {
      await handleApiError(error);
    } finally {
      setIsLoading(false);
    }
  }, [
    canLoadAreas,
    canLoadBuildings,
    canLoadDevices,
    canLoadRoles,
    canLoadUsers,
    companyId,
    handleApiError,
    session,
  ]);

  useEffect(() => {
    const loadKey = `${session?.accessToken ?? ""}:${companyId}`;
    if (!loadKey || initialLoadKeyRef.current === loadKey) return;
    initialLoadKeyRef.current = loadKey;
    void load();
  }, [companyId, load, session?.accessToken]);

  const roleOptions = useMemo(
    () => detail.roles.map((role) => ({ label: role.name, value: role.id })),
    [detail.roles],
  );
  const areaOptions = useMemo(
    () => detail.areas.map((area) => ({ label: area.name, value: area.id })),
    [detail.areas],
  );

  const closeModal = () => {
    setModal(undefined);
    setFormError(undefined);
    setAreaName("");
    setAreaAddress("");
    setBuildingTitle("");
    setBuildingAreaId(null);
    setUserName("");
    setUserEmail("");
    setUserPassword("");
    setUserRoleId(null);
  };

  const saveCompany = async () => {
    if (!session || !detail.company) return;
    if (!companyName.trim()) {
      setFormError(t("organizations.validationRequired"));
      return;
    }
    setIsSaving(true);
    setFormError(undefined);
    try {
      await apiRequest(session, `/admin/companies/${detail.company.id}`, {
        body: JSON.stringify({ code: companyCode.trim() || undefined, name: companyName.trim() }),
        method: "PATCH",
      });
      closeModal();
      await load();
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.status === 409
          ? t("organizations.duplicateFeedback")
          : t("common.errorDescription"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deactivateCompany = async () => {
    if (!session || !detail.company) return;
    setIsSaving(true);
    try {
      await apiRequest(session, `/admin/companies/${detail.company.id}`, { method: "DELETE" });
      await load();
    } catch (error) {
      await handleApiError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const createArea = async () => {
    if (!session || !areaName.trim()) {
      setFormError(t("organizations.validationRequired"));
      return;
    }
    setIsSaving(true);
    setFormError(undefined);
    try {
      await apiRequest(session, `/admin/companies/${companyId}/areas`, {
        body: JSON.stringify({ address: areaAddress.trim() || undefined, name: areaName.trim() }),
        method: "POST",
      });
      closeModal();
      await load();
    } catch {
      setFormError(t("organizations.duplicateFeedback"));
    } finally {
      setIsSaving(false);
    }
  };

  const createBuilding = async () => {
    if (!session || !buildingTitle.trim() || !buildingAreaId) {
      setFormError(t("organizations.validationRequired"));
      return;
    }
    setIsSaving(true);
    setFormError(undefined);
    try {
      await apiRequest(session, `/admin/areas/${buildingAreaId}/buildings`, {
        body: JSON.stringify({ title: buildingTitle.trim() }),
        method: "POST",
      });
      closeModal();
      await load();
    } catch {
      setFormError(t("organizations.duplicateFeedback"));
    } finally {
      setIsSaving(false);
    }
  };

  const createUser = async () => {
    if (!session || !userName.trim() || !userEmail.trim() || !userPassword || !userRoleId) {
      setFormError(t("organizations.validationRequired"));
      return;
    }
    setIsSaving(true);
    setFormError(undefined);
    try {
      await apiRequest(session, `/admin/companies/${companyId}/users`, {
        body: JSON.stringify({
          email: userEmail.trim(),
          name: userName.trim(),
          password: userPassword,
          roleId: userRoleId,
        }),
        method: "POST",
      });
      closeModal();
      await load();
    } catch {
      setFormError(t("organizations.duplicateFeedback"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingState title={t("common.loading")} />;
  if (hasError || !detail.company) {
    return (
      <ErrorState
        description={t("common.errorDescription")}
        onRetry={() => void load()}
        retryLabel={t("common.retry")}
        title={t("common.errorTitle")}
      />
    );
  }

  return (
    <PageContainer
      data-testid="admin-company-workspace-layout"
      data-workspace-instance={workspaceInstance}
    >
      <PageHeader
        title={detail.company.name}
        subtitle={t("organizations.companyDetailSubtitle")}
        action={
          <Group>
            <Can permission="companies.update">
              <Button onClick={openEditCompany} variant="light">
                {t("organizations.editCompany")}
              </Button>
            </Can>
            <Can permission="companies.delete">
              <Button
                color="red"
                loading={isSaving}
                onClick={() => void deactivateCompany()}
                variant="light"
              >
                {t("organizations.deactivate")}
              </Button>
            </Can>
          </Group>
        }
      />
      <ContextSectionLayout
        navigation={
          <ContextSectionNav>
            <NavLink
              active={section === "overview"}
              component={Link}
              label={t("organizations.overview")}
              to={routeBase}
            />
            <NavLink
              active={section === "sites"}
              component={Link}
              label={t("organizations.areasTitle")}
              to={`${routeBase}/sites`}
            />
            <NavLink
              active={section === "buildings"}
              component={Link}
              label={t("organizations.buildingsTitle")}
              to={`${routeBase}/buildings`}
            />
            <NavLink
              active={section === "users"}
              component={Link}
              label={t("management.usersTitle")}
              to={`${routeBase}/users`}
            />
            <NavLink
              active={section === "devices"}
              component={Link}
              label={t("devices.companyDevicesTitle")}
              to={`${routeBase}/devices`}
            />
          </ContextSectionNav>
        }
      >
        <Stack gap="md">
          <Outlet
            context={
              {
                canLoadAreas,
                canLoadBuildings,
                canLoadDevices,
                canLoadUsers,
                detail,
                onCreateArea: () => setModal("area"),
                onCreateBuilding: () => setModal("building"),
                onCreateUser: () => setModal("user"),
              } satisfies AdminCompanyWorkspaceContext
            }
          />
        </Stack>
      </ContextSectionLayout>

      <Modal
        opened={modal === "company"}
        onClose={closeModal}
        title={t("organizations.editCompany")}
      >
        <Stack>
          {formError ? <Alert color="red">{formError}</Alert> : null}
          <TextInput
            label={t("organizations.name")}
            onChange={(event) => setCompanyName(event.currentTarget.value)}
            required
            value={companyName}
          />
          <TextInput
            label={t("organizations.code")}
            onChange={(event) => setCompanyCode(event.currentTarget.value)}
            value={companyCode}
          />
          <Button loading={isSaving} onClick={() => void saveCompany()}>
            {t("organizations.save")}
          </Button>
        </Stack>
      </Modal>
      <Modal opened={modal === "area"} onClose={closeModal} title={t("organizations.createSite")}>
        <Stack>
          {formError ? <Alert color="red">{formError}</Alert> : null}
          <TextInput
            label={t("organizations.name")}
            onChange={(event) => setAreaName(event.currentTarget.value)}
            required
            value={areaName}
          />
          <TextInput
            label={t("organizations.address")}
            onChange={(event) => setAreaAddress(event.currentTarget.value)}
            value={areaAddress}
          />
          <Button loading={isSaving} onClick={() => void createArea()}>
            {t("organizations.create")}
          </Button>
        </Stack>
      </Modal>
      <Modal
        opened={modal === "building"}
        onClose={closeModal}
        title={t("organizations.createBuilding")}
      >
        <Stack>
          {formError ? <Alert color="red">{formError}</Alert> : null}
          <Select
            data={areaOptions}
            label={t("organizations.area")}
            onChange={setBuildingAreaId}
            required
            value={buildingAreaId}
          />
          <TextInput
            label={t("organizations.building")}
            onChange={(event) => setBuildingTitle(event.currentTarget.value)}
            required
            value={buildingTitle}
          />
          <Button loading={isSaving} onClick={() => void createBuilding()}>
            {t("organizations.create")}
          </Button>
        </Stack>
      </Modal>
      <Modal opened={modal === "user"} onClose={closeModal} title={t("management.createUser")}>
        <Stack>
          {formError ? <Alert color="red">{formError}</Alert> : null}
          <TextInput
            label={t("management.email")}
            onChange={(event) => setUserEmail(event.currentTarget.value)}
            required
            type="email"
            value={userEmail}
          />
          <TextInput
            label={t("organizations.managerName")}
            onChange={(event) => setUserName(event.currentTarget.value)}
            required
            value={userName}
          />
          <TextInput
            label={t("management.password")}
            onChange={(event) => setUserPassword(event.currentTarget.value)}
            required
            type="password"
            value={userPassword}
          />
          <Select
            data={roleOptions}
            label={t("management.role")}
            onChange={setUserRoleId}
            required
            value={userRoleId}
          />
          <Button loading={isSaving} onClick={() => void createUser()}>
            {t("management.createUser")}
          </Button>
        </Stack>
      </Modal>
    </PageContainer>
  );
}

export function AdminCompanyDetailPage(): ReactElement {
  return <AdminCompanyWorkspaceLayout />;
}

function useAdminCompanyWorkspaceContext() {
  return useOutletContext<AdminCompanyWorkspaceContext>();
}

export function AdminCompanyOverviewSection() {
  const { detail } = useAdminCompanyWorkspaceContext();
  return <OverviewSection detail={detail} />;
}

export function AdminCompanySitesSection() {
  const { canLoadAreas, detail, onCreateArea } = useAdminCompanyWorkspaceContext();
  return <SitesSection areas={detail.areas} canView={canLoadAreas} onCreate={onCreateArea} />;
}

export function AdminCompanyBuildingsSection() {
  const { canLoadBuildings, detail, onCreateBuilding } = useAdminCompanyWorkspaceContext();
  return (
    <BuildingsSection
      buildings={detail.buildings}
      canCreate={detail.areas.length > 0}
      canView={canLoadBuildings}
      onCreate={onCreateBuilding}
    />
  );
}

export function AdminCompanyUsersSection() {
  const { canLoadUsers, detail, onCreateUser } = useAdminCompanyWorkspaceContext();
  return <UsersSection canView={canLoadUsers} onCreate={onCreateUser} users={detail.users} />;
}

export function AdminCompanyDevicesSection() {
  const { canLoadDevices, detail } = useAdminCompanyWorkspaceContext();
  return (
    <DevicesSection canView={canLoadDevices} gateways={detail.gateways} nodes={detail.nodes} />
  );
}

function OverviewSection({ detail }: { detail: DetailState }) {
  const platformManagers = detail.users.filter((user) => user.role.isCompanyOwnerRole);
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <SummaryCard label={t("organizations.status")} value={detail.company?.status ?? "-"} />
        <SummaryCard label={t("organizations.areasTitle")} value={detail.areas.length} />
        <SummaryCard label={t("organizations.buildingsTitle")} value={detail.buildings.length} />
        <SummaryCard
          label={t("devices.companyDevicesTitle")}
          value={detail.gateways.length + detail.nodes.length}
        />
      </SimpleGrid>
      <Paper p="md" withBorder>
        <Stack gap="xs">
          <Text fw={600}>{t("organizations.companyProfile")}</Text>
          <Text size="sm">{detail.company?.code ?? t("organizations.noCode")}</Text>
          <Text c="dimmed" size="sm">
            {detail.company?.email ?? "-"} {detail.company?.phone ?? ""}
          </Text>
        </Stack>
      </Paper>
      <Paper p="md" withBorder>
        <Stack gap="xs">
          <Text fw={600}>{t("organizations.platformManagers")}</Text>
          {platformManagers.length ? (
            platformManagers.map((user) => (
              <Text key={user.id} size="sm">
                {user.name} - {user.email}
              </Text>
            ))
          ) : (
            <Text c="dimmed" size="sm">
              {t("common.emptyTitle")}
            </Text>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Paper p="md" withBorder>
      <Text c="dimmed" size="xs" tt="uppercase">
        {label}
      </Text>
      <Text fw={700} size="xl">
        {value}
      </Text>
    </Paper>
  );
}

function SitesSection({
  areas,
  canView,
  onCreate,
}: {
  areas: AreaRecord[];
  canView: boolean;
  onCreate: () => void;
}) {
  if (!canView)
    return (
      <ForbiddenState description={t("common.pageUnavailable")} title={t("common.forbidden")} />
    );
  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Can permission="areas.create">
          <Button onClick={onCreate}>{t("organizations.createSite")}</Button>
        </Can>
      </Group>
      {areas.length ? (
        <EntityCardGrid>
          {areas.map((area) => (
            <EntityCard
              description={area.address ?? area.description ?? undefined}
              eyebrow={t("organizations.areasTitle")}
              key={area.id}
              title={area.name}
            >
              <EntityStatusRow
                color={area.status === "ACTIVE" ? "green" : "gray"}
                label={t("organizations.status")}
                value={area.status}
              />
              <EntityMetric label={t("organizations.code")} value={area.id.slice(0, 8)} />
            </EntityCard>
          ))}
        </EntityCardGrid>
      ) : (
        <EmptyState
          description={t("organizations.emptyScopedDescription")}
          title={t("common.emptyTitle")}
        />
      )}
    </Stack>
  );
}

function BuildingsSection({
  buildings,
  canCreate,
  canView,
  onCreate,
}: {
  buildings: BuildingRecord[];
  canCreate: boolean;
  canView: boolean;
  onCreate: () => void;
}) {
  if (!canView)
    return (
      <ForbiddenState description={t("common.pageUnavailable")} title={t("common.forbidden")} />
    );
  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Can permission="buildings.create">
          <Button disabled={!canCreate} onClick={onCreate}>
            {t("organizations.createBuilding")}
          </Button>
        </Can>
      </Group>
      {buildings.length ? (
        <EntityCardGrid>
          {buildings.map((building) => (
            <EntityCard
              description={building.address ?? building.buildingType ?? undefined}
              eyebrow={t("organizations.buildingsTitle")}
              key={building.id}
              title={building.title}
            >
              <EntityStatusRow
                color={building.status === "ACTIVE" ? "green" : "gray"}
                label={t("organizations.status")}
                value={building.status}
              />
              <EntityMetric label={t("organizations.code")} value={building.number ?? "-"} />
            </EntityCard>
          ))}
        </EntityCardGrid>
      ) : (
        <EmptyState
          description={t("organizations.emptyScopedDescription")}
          title={t("common.emptyTitle")}
        />
      )}
    </Stack>
  );
}

function UsersSection({
  canView,
  onCreate,
  users,
}: {
  canView: boolean;
  onCreate: () => void;
  users: CompanyUserRecord[];
}) {
  if (!canView)
    return (
      <ForbiddenState description={t("common.pageUnavailable")} title={t("common.forbidden")} />
    );
  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Can permission="company-users.create">
          <Button onClick={onCreate}>{t("management.createUser")}</Button>
        </Can>
      </Group>
      {users.length ? (
        <DataTable
          columns={[
            { key: "name", label: t("organizations.name"), render: (user) => user.name },
            { key: "email", label: t("management.email"), render: (user) => user.email },
            { key: "role", label: t("management.role"), render: (user) => user.role.name },
            {
              key: "status",
              label: t("organizations.status"),
              render: (user) => (
                <Badge color={user.isActive ? "green" : "gray"} variant="light">
                  {user.isActive ? t("management.active") : t("management.inactive")}
                </Badge>
              ),
            },
          ]}
          rows={users}
        />
      ) : (
        <EmptyState
          description={t("management.emptyUsersDescription")}
          title={t("common.emptyTitle")}
        />
      )}
    </Stack>
  );
}

function DevicesSection({
  canView,
  gateways,
  nodes,
}: {
  canView: boolean;
  gateways: GatewayRecord[];
  nodes: NodeRecord[];
}) {
  if (!canView)
    return (
      <ForbiddenState description={t("common.pageUnavailable")} title={t("common.forbidden")} />
    );
  return (
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
                render: (gateway) => gateway.serialNumber,
              },
              {
                key: "type",
                label: t("devices.gatewayType"),
                render: (gateway) => gatewayTypeLabel(gateway.gatewayType),
              },
              {
                key: "status",
                label: t("devices.status"),
                render: (gateway) => deviceStatusLabel(gateway.status),
              },
              {
                key: "building",
                label: t("devices.building"),
                render: (gateway) => gateway.buildingAssignments[0]?.building.title ?? "-",
              },
            ]}
            rows={gateways}
          />
        ) : (
          <EmptyState description={t("devices.emptyDescription")} title={t("common.emptyTitle")} />
        )}
      </Tabs.Panel>
      <Tabs.Panel pt="md" value="nodes">
        {nodes.length ? (
          <DataTable
            columns={[
              { key: "number", label: t("devices.nodeNumber"), render: (node) => node.number },
              {
                key: "type",
                label: t("devices.nodeType"),
                render: (node) => node.nodeType.displayName,
              },
              {
                key: "status",
                label: t("devices.status"),
                render: (node) => deviceStatusLabel(node.status),
              },
              {
                key: "gateway",
                label: t("devices.gateway"),
                render: (node) => node.gatewayAssignments[0]?.gateway.serialNumber ?? "-",
              },
            ]}
            rows={nodes}
          />
        ) : (
          <EmptyState description={t("devices.emptyDescription")} title={t("common.emptyTitle")} />
        )}
      </Tabs.Panel>
    </Tabs>
  );
}
