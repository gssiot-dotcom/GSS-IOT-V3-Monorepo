import type {
  AreaRecord,
  BuildingRecord,
  CompanyRecord,
  CompanyRoleRecord,
  CompanyUserRecord,
  GatewayRecord,
  NodeRecord,
  PaginatedResponse,
} from "@gss-iot/contracts";
import {
  DataTable,
  ConfirmActionModal,
  EmptyState,
  EntityActionMenu,
  EntityCardGrid,
  EntityStatusBadge,
  ErrorState,
  ForbiddenState,
  LoadingState,
  ModalFormFooter,
  PageContainer,
  PageHeader,
  WorkspaceTabs,
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
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconEdit,
  IconPhoto,
  IconPlayerPause,
  IconPlayerPlay,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";

import { nodeTypeLabel, t } from "../../app/i18n";
import { ApiError, apiMultipartRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { CompanyLogoEditor } from "../../shared/branding/CompanyLogoEditor";
import { useAuthenticatedLogo } from "../../shared/branding/use-authenticated-logo";
import { useApiMutation, useApiQuery } from "../../shared/query/api-query";
import { portalQueryKey } from "../../shared/query/query-keys";
import { OrganizationResourceCard } from "./OrganizationResourceCard";
import { Can } from "../../shared/rbac/Can";
import { hasPermission } from "../../shared/rbac/has-permission";
import { deviceLifecycleBadge, gatewayTypeLabel } from "../devices/device-labels";
import { BuildingImageManager } from "./BuildingImageManager";

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
  const { companyId = "" } = useParams();
  const { logout, session } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const section = getSection(location.pathname);
  const [formError, setFormError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [lifecycleConfirmOpen, setLifecycleConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string>();
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
  const canViewDevicesTab = hasPermission(session, "devices.view");
  const canLoadDevices =
    hasPermission(session, "gateways.view") && hasPermission(session, "nodes.view");

  const routeBase = `/admin/companies/${companyId}`;
  const openEditCompany = () => {
    setCompanyName(detail.company?.name ?? "");
    setCompanyCode(detail.company?.code ?? "");
    setFormError(undefined);
    setModal("company");
  };

  const key = (resource: string) =>
    session
      ? portalQueryKey(session, "company-detail", resource, { companyId })
      : (["company-detail", "anonymous", resource, companyId] as const);
  const companyQuery = useApiQuery<CompanyRecord>(
    session,
    key("company"),
    `/admin/companies/${companyId}`,
    { enabled: Boolean(companyId) },
  );
  const areasQuery = useApiQuery<PaginatedResponse<AreaRecord>>(
    session,
    key("areas"),
    `/admin/companies/${companyId}/areas?pageSize=100`,
    { enabled: Boolean(companyId) && canLoadAreas },
  );
  const buildingsQuery = useApiQuery<PaginatedResponse<BuildingRecord>>(
    session,
    key("buildings"),
    `/admin/companies/${companyId}/buildings?pageSize=100`,
    { enabled: Boolean(companyId) && canLoadBuildings },
  );
  const usersQuery = useApiQuery<PaginatedResponse<CompanyUserRecord>>(
    session,
    key("users"),
    `/admin/companies/${companyId}/users?pageSize=100`,
    { enabled: Boolean(companyId) && canLoadUsers },
  );
  const rolesQuery = useApiQuery<PaginatedResponse<CompanyRoleRecord>>(
    session,
    key("roles"),
    `/admin/companies/${companyId}/roles?pageSize=100`,
    { enabled: Boolean(companyId) && canLoadRoles },
  );
  const gatewaysQuery = useApiQuery<PaginatedResponse<GatewayRecord>>(
    session,
    key("gateways"),
    "/admin/devices/gateways?pageSize=100",
    { enabled: canLoadDevices },
  );
  const nodesQuery = useApiQuery<PaginatedResponse<NodeRecord>>(
    session,
    key("nodes"),
    "/admin/devices/nodes?pageSize=100",
    { enabled: canLoadDevices },
  );
  const detail = useMemo<DetailState>(
    () => ({
      areas: areasQuery.data?.items ?? [],
      buildings: buildingsQuery.data?.items ?? [],
      company: companyQuery.data,
      gateways: (gatewaysQuery.data?.items ?? []).filter((gateway) =>
        gateway.companyAssignments.some((assignment) => assignment.companyId === companyId),
      ),
      nodes: (nodesQuery.data?.items ?? []).filter((node) =>
        node.companyAssignments.some((assignment) => assignment.companyId === companyId),
      ),
      roles: rolesQuery.data?.items ?? [],
      users: usersQuery.data?.items ?? [],
    }),
    [
      areasQuery.data,
      buildingsQuery.data,
      companyId,
      companyQuery.data,
      gatewaysQuery.data,
      nodesQuery.data,
      rolesQuery.data,
      usersQuery.data,
    ],
  );
  const adminLogo = useAuthenticatedLogo(
    `/admin/companies/${companyId}/logo`,
    Boolean(detail.company?.hasLogo),
  );
  const queries = [
    companyQuery,
    areasQuery,
    buildingsQuery,
    usersQuery,
    rolesQuery,
    gatewaysQuery,
    nodesQuery,
  ];
  const isLoading = queries.some((query) => query.isLoading);
  const hasError = queries.some((query) => query.isError);
  const refetchAll = async () => {
    await Promise.all(queries.map((query) => query.refetch()));
  };
  const mutation = useApiMutation(session);

  useEffect(() => {
    const unauthorized = queries.some(
      (query) => query.error instanceof ApiError && query.error.status === 401,
    );
    if (!unauthorized) return;
    void logout().then(() => navigate("/login", { replace: true }));
  }, [
    companyQuery.error,
    areasQuery.error,
    buildingsQuery.error,
    usersQuery.error,
    rolesQuery.error,
    gatewaysQuery.error,
    nodesQuery.error,
    logout,
    navigate,
  ]);

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
      await mutation.mutateAsync({
        path: `/admin/companies/${detail.company.id}`,
        options: {
          body: JSON.stringify({ code: companyCode.trim() || undefined, name: companyName.trim() }),
          method: "PATCH",
        },
      });
      closeModal();
      await companyQuery.refetch();
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

  const updateCompanyStatus = async () => {
    if (!session || !detail.company) return;
    setIsSaving(true);
    setLifecycleError(undefined);
    try {
      await mutation.mutateAsync({
        path: `/admin/companies/${detail.company.id}/status`,
        options: {
          body: JSON.stringify({
            status: detail.company.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
          }),
          method: "PATCH",
        },
      });
      await companyQuery.refetch();
      setLifecycleConfirmOpen(false);
    } catch (error) {
      setLifecycleError(error instanceof ApiError ? error.message : t("common.errorDescription"));
    } finally {
      setIsSaving(false);
    }
  };

  const archiveCompany = async () => {
    if (!session || !detail.company) return;
    setIsSaving(true);
    setLifecycleError(undefined);
    try {
      await mutation.mutateAsync({
        path: `/admin/companies/${detail.company.id}`,
        options: { method: "DELETE" },
      });
      void navigate("/admin/companies", { replace: true });
    } catch (error) {
      setLifecycleError(error instanceof ApiError ? error.message : t("common.errorDescription"));
    } finally {
      setIsSaving(false);
    }
  };

  const uploadCompanyLogo = async (file: File) => {
    if (!session || !detail.company) return;
    const body = new FormData();
    body.append("logo", file);
    await apiMultipartRequest(session, `/admin/companies/${detail.company.id}/logo`, body);
    queryClient.setQueryData<CompanyRecord>(key("company"), (current) =>
      current ? { ...current, hasLogo: true } : current,
    );
    await adminLogo.refreshLogo();
  };

  const removeCompanyLogo = async () => {
    if (!session || !detail.company) return;
    await mutation.mutateAsync({
      path: `/admin/companies/${detail.company.id}/logo`,
      options: { method: "DELETE" },
    });
    queryClient.setQueryData<CompanyRecord>(key("company"), (current) =>
      current ? { ...current, hasLogo: false } : current,
    );
    await adminLogo.refreshLogo();
  };

  const createArea = async () => {
    if (!session || !areaName.trim()) {
      setFormError(t("organizations.validationRequired"));
      return;
    }
    setIsSaving(true);
    setFormError(undefined);
    try {
      await mutation.mutateAsync({
        path: `/admin/companies/${companyId}/areas`,
        options: {
          body: JSON.stringify({ address: areaAddress.trim() || undefined, name: areaName.trim() }),
          method: "POST",
        },
      });
      closeModal();
      await areasQuery.refetch();
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
      await mutation.mutateAsync({
        path: `/admin/areas/${buildingAreaId}/buildings`,
        options: { body: JSON.stringify({ title: buildingTitle.trim() }), method: "POST" },
      });
      closeModal();
      await buildingsQuery.refetch();
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
      await mutation.mutateAsync({
        path: `/admin/companies/${companyId}/users`,
        options: {
          body: JSON.stringify({
            email: userEmail.trim(),
            name: userName.trim(),
            password: userPassword,
            roleId: userRoleId,
          }),
          method: "POST",
        },
      });
      closeModal();
      await usersQuery.refetch();
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
        onRetry={() => void refetchAll()}
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
        eyebrow={t("shell.admin")}
        meta={
          <>
            <Text size="xs">{detail.company.code ?? t("organizations.noCode")}</Text>
            <Text size="xs">{detail.company.email ?? "-"}</Text>
          </>
        }
        title={detail.company.name}
        subtitle={t("organizations.companyDetailSubtitle")}
        status={
          <EntityStatusBadge
            label={
              detail.company.status === "ACTIVE" ? t("management.active") : t("management.inactive")
            }
            status={detail.company.status === "ACTIVE" ? "active" : "inactive"}
          />
        }
        action={
          <Can permission="companies.update">
            <Button leftSection={<IconEdit size={16} />} onClick={openEditCompany}>
              {t("organizations.editCompany")}
            </Button>
          </Can>
        }
        overflowAction={
          hasPermission(session, "companies.update") ||
          hasPermission(session, "companies.delete") ? (
            <EntityActionMenu
              ariaLabel={`${t("common.moreActions")}: ${detail.company.name}`}
              items={[
                ...(hasPermission(session, "companies.update")
                  ? [
                      {
                        icon:
                          detail.company.status === "ACTIVE" ? (
                            <IconPlayerPause size={16} />
                          ) : (
                            <IconPlayerPlay size={16} />
                          ),
                        key: "status",
                        label: t(
                          detail.company.status === "ACTIVE"
                            ? "organizations.deactivate"
                            : "organizations.activate",
                        ),
                        onClick: () => setLifecycleConfirmOpen(true),
                      },
                    ]
                  : []),
                ...(hasPermission(session, "companies.delete")
                  ? [
                      {
                        color: "red" as const,
                        destructive: true,
                        disabled: !detail.company.deletion?.allowed,
                        disabledReason: detail.company.deletion?.blocker ?? undefined,
                        icon: <IconTrash size={16} />,
                        key: "delete",
                        label: t("organizations.deleteCompany"),
                        onClick: () => setDeleteConfirmOpen(true),
                      },
                    ]
                  : []),
              ]}
            />
          ) : null
        }
      />
      {lifecycleError ? <Alert color="red">{lifecycleError}</Alert> : null}
      <WorkspaceTabs
        ariaLabel={t("organizations.companyWorkspaceTabs")}
        items={[
          { label: t("organizations.overview"), value: "overview" },
          ...(canLoadAreas ? [{ label: t("organizations.areasTitle"), value: "sites" }] : []),
          ...(canLoadBuildings
            ? [{ label: t("organizations.buildingsTitle"), value: "buildings" }]
            : []),
          ...(canLoadUsers ? [{ label: t("management.usersTitle"), value: "users" }] : []),
          ...(canViewDevicesTab
            ? [{ label: t("devices.companyDevicesTitle"), value: "devices" }]
            : []),
        ]}
        onChange={(value) =>
          void navigate(value === "overview" ? routeBase : `${routeBase}/${value}`)
        }
        value={section}
      />
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

      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t(
          detail.company.status === "ACTIVE"
            ? "organizations.deactivate"
            : "organizations.activate",
        )}
        description={t(
          detail.company.status === "ACTIVE"
            ? "organizations.confirmDeactivateImpact"
            : "organizations.confirmActivateImpact",
        )}
        entityName={detail.company.name}
        loading={isSaving}
        onClose={() => {
          if (!isSaving) setLifecycleConfirmOpen(false);
        }}
        onConfirm={() => void updateCompanyStatus()}
        opened={lifecycleConfirmOpen}
        title={t(
          detail.company.status === "ACTIVE"
            ? "organizations.confirmDeactivateTitle"
            : "organizations.confirmActivateTitle",
        )}
      />
      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t("organizations.deleteCompany")}
        description={t("organizations.confirmDeleteCompanyImpact")}
        entityName={detail.company.name}
        loading={isSaving}
        onClose={() => {
          if (!isSaving) setDeleteConfirmOpen(false);
        }}
        onConfirm={() => void archiveCompany()}
        opened={deleteConfirmOpen}
        title={t("organizations.confirmDeleteCompanyTitle")}
      />

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
          <CompanyLogoEditor
            canManage
            companyName={detail.company.name}
            logoUrl={adminLogo.logoUrl}
            onRemove={removeCompanyLogo}
            onUpload={uploadCompanyLogo}
            status={adminLogo.status}
          />
          <ModalFormFooter
            cancelLabel={t("common.cancel")}
            onCancel={closeModal}
            onSubmit={() => void saveCompany()}
            submitDisabled={!companyName.trim()}
            submitLabel={t("organizations.save")}
            submitLoading={isSaving}
          />
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
          <ModalFormFooter
            cancelLabel={t("common.cancel")}
            onCancel={closeModal}
            onSubmit={() => void createArea()}
            submitDisabled={!areaName.trim()}
            submitLabel={t("organizations.create")}
            submitLoading={isSaving}
          />
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
          <ModalFormFooter
            cancelLabel={t("common.cancel")}
            onCancel={closeModal}
            onSubmit={() => void createBuilding()}
            submitDisabled={!buildingTitle.trim() || !buildingAreaId}
            submitLabel={t("organizations.create")}
            submitLoading={isSaving}
          />
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
          <ModalFormFooter
            cancelLabel={t("common.cancel")}
            onCancel={closeModal}
            onSubmit={() => void createUser()}
            submitDisabled={!userEmail.trim() || !userName.trim() || !userPassword || !userRoleId}
            submitLabel={t("management.createUser")}
            submitLoading={isSaving}
          />
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
      areas={detail.areas}
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
        <SummaryCard
          label={t("organizations.status")}
          value={
            <EntityStatusBadge
              label={
                detail.company?.status === "ACTIVE"
                  ? t("management.active")
                  : t("management.inactive")
              }
              status={detail.company?.status === "ACTIVE" ? "active" : "inactive"}
            />
          }
        />
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

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Paper p="md" withBorder>
      <Text c="dimmed" size="xs" tt="uppercase">
        {label}
      </Text>
      <Text component="div" fw={700} size="xl">
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
            <OrganizationResourceCard
              description={area.address ?? area.description ?? undefined}
              identifier={area.id.slice(0, 8)}
              key={area.id}
              kind="site"
              kindLabel={t("organizations.area")}
              status={area.status}
              statusLabel={
                area.status === "ACTIVE" ? t("management.active") : t("management.inactive")
              }
              title={area.name}
            />
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
  areas,
  buildings,
  canCreate,
  canView,
  onCreate,
}: {
  areas: AreaRecord[];
  buildings: BuildingRecord[];
  canCreate: boolean;
  canView: boolean;
  onCreate: () => void;
}) {
  const [imageBuilding, setImageBuilding] = useState<BuildingRecord>();
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
            <OrganizationResourceCard
              action={
                <Can permission="building-plans.view">
                  <EntityActionMenu
                    ariaLabel={`${t("common.moreActions")}: ${building.title}`}
                    items={[
                      {
                        icon: <IconPhoto size={16} />,
                        key: "images",
                        label: t("buildingImages.title"),
                        onClick: () => setImageBuilding(building),
                      },
                    ]}
                  />
                </Can>
              }
              description={building.address ?? building.buildingType ?? undefined}
              identifier={building.number ?? "-"}
              key={building.id}
              kind="building"
              kindLabel={t("organizations.building")}
              parent={areas.find((area) => area.id === building.areaId)?.name}
              status={building.status}
              statusLabel={
                building.status === "ACTIVE" ? t("management.active") : t("management.inactive")
              }
              title={building.title}
            />
          ))}
        </EntityCardGrid>
      ) : (
        <EmptyState
          description={t("organizations.emptyScopedDescription")}
          title={t("common.emptyTitle")}
        />
      )}
      <Modal
        opened={Boolean(imageBuilding)}
        onClose={() => setImageBuilding(undefined)}
        size="xl"
        title={imageBuilding ? `${t("buildingImages.title")} · ${imageBuilding.title}` : ""}
      >
        {imageBuilding ? (
          <BuildingImageManager basePath="/admin" buildingId={imageBuilding.id} />
        ) : null}
      </Modal>
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
  const [tab, setTab] = useState<"gateways" | "nodes">("gateways");
  if (!canView)
    return (
      <ForbiddenState description={t("common.pageUnavailable")} title={t("common.forbidden")} />
    );
  return (
    <Stack gap="md">
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
        gateways.length ? (
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
                render: (gateway) => deviceLifecycleBadge(gateway.status),
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
        )
      ) : nodes.length ? (
        <DataTable
          columns={[
            { key: "number", label: t("devices.nodeNumber"), render: (node) => node.number },
            {
              key: "type",
              label: t("devices.nodeType"),
              render: (node) => nodeTypeLabel(node.nodeType.key, node.nodeType.displayName),
            },
            {
              key: "status",
              label: t("devices.status"),
              render: (node) => deviceLifecycleBadge(node.status),
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
    </Stack>
  );
}
