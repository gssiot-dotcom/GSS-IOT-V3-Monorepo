import type {
  CompanyRecord,
  CollectionPageSize,
  GssRoleRecord,
  PaginatedResponse,
  SystemSettingsRecord,
} from "@gss-iot/contracts";
import {
  ConfirmActionModal,
  CollectionPagination,
  DataTable,
  EmptyState,
  EntityActionMenu,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@gss-iot/ui";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Drawer,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconEdit, IconEye, IconTrash } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";

import { t, tf } from "../../app/i18n";
import { apiMultipartRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { useCompanyBranding } from "../../shared/branding/company-branding-context";
import { CompanyLogoEditor } from "../../shared/branding/CompanyLogoEditor";
import { useApiMutation, useApiQuery } from "../../shared/query/api-query";
import { portalDomainKey, portalQueryKey } from "../../shared/query/query-keys";
import { Can } from "../../shared/rbac/Can";
import { hasPermission } from "../../shared/rbac/has-permission";
import { useCollectionSearchParams } from "../../shared/url/collection-search-params";

interface RoleFormState {
  key: string;
  name: string;
  permissionIds: string[];
}

const emptyRoleForm: RoleFormState = { key: "", name: "", permissionIds: [] };

export function GssRolesPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState(false);
  const [opened, setOpened] = useState(false);
  const [editingRole, setEditingRole] = useState<GssRoleRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GssRoleRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const collection = useCollectionSearchParams(50);
  const { page, pageSize } = collection;
  const [form, setForm] = useState<RoleFormState>(emptyRoleForm);

  const rolesQuery = useApiQuery<PaginatedResponse<GssRoleRecord>>(
    session,
    session ? portalQueryKey(session, "roles", "list", { page, pageSize }) : ["roles", "anonymous"],
    `/admin/roles?page=${page}&pageSize=${pageSize}`,
    { placeholderData: keepPreviousData },
  );
  const permissionsQuery = useApiQuery<GssRoleRecord["permissions"][number]["permission"][]>(
    session,
    session
      ? portalQueryKey(session, "roles", "permissions")
      : ["roles", "anonymous", "permissions"],
    "/admin/roles/permissions",
    { enabled: hasPermission(session, "admin-roles.view") },
  );
  const roles = rolesQuery.data?.items;
  const permissions = permissionsQuery.data ?? [];
  const total = rolesQuery.data?.total ?? 0;
  const groupedPermissions = useMemo(
    () =>
      permissions.reduce<Record<string, NonNullable<(typeof permissions)[number]>[]>>(
        (groups, permission) => {
          if (permission)
            groups[permission.module] = [...(groups[permission.module] ?? []), permission];
          return groups;
        },
        {},
      ),
    [permissions],
  );
  const roleMutation = useApiMutation(session, {
    onSuccess: async () => {
      if (session)
        await queryClient.invalidateQueries({ queryKey: portalDomainKey(session, "roles") });
    },
  });

  const openCreate = () => {
    setActionError(false);
    setEditingRole(null);
    setForm(emptyRoleForm);
    setOpened(true);
  };

  const openEdit = (role: GssRoleRecord) => {
    setActionError(false);
    setEditingRole(role);
    setForm({
      key: role.key,
      name: role.name,
      permissionIds: role.permissions.map(({ permissionId }) => permissionId),
    });
    setOpened(true);
  };

  const save = async () => {
    if (!session) return;
    setActionError(false);
    try {
      await roleMutation.mutateAsync({
        path: editingRole ? `/admin/roles/${editingRole.id}` : "/admin/roles",
        options: { body: JSON.stringify(form), method: editingRole ? "PATCH" : "POST" },
      });
      setOpened(false);
    } catch {
      setActionError(true);
    }
  };

  const deleteRole = async () => {
    if (!session || !deleteTarget || deleting) return;
    setActionError(false);
    setDeleting(true);
    try {
      await roleMutation.mutateAsync({
        path: `/admin/roles/${deleteTarget.id}`,
        options: { method: "DELETE" },
      });
      setDeleteTarget(null);
    } catch {
      setActionError(true);
    } finally {
      setDeleting(false);
    }
  };

  const togglePermission = (permissionId: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      permissionIds: checked
        ? [...new Set([...current.permissionIds, permissionId])]
        : current.permissionIds.filter((id) => id !== permissionId),
    }));
  };

  if (!roles && rolesQuery.isLoading) return <LoadingState title={t("common.loading")} />;
  if (rolesQuery.isError)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;

  return (
    <Stack gap="lg">
      <PageHeader
        action={
          <Can permission="admin-roles.manage">
            <Button onClick={openCreate}>{t("settings.createGssRole")}</Button>
          </Can>
        }
        subtitle={t("settings.gssRolesSubtitle")}
        title={t("settings.gssRolesTitle")}
      />
      {actionError ? <Alert color="red" title={t("settings.actionFailed")} /> : null}
      {roles?.length ? (
        <Stack gap="sm">
          <CollectionPagination
            onPageChange={collection.setPage}
            onPageSizeChange={(value) => {
              collection.setPageSize(Number(value) as CollectionPageSize);
            }}
            page={page}
            pageSize={pageSize}
            pageSizeLabel={t("table.pageSize")}
            rangeLabel={tf("table.range", {
              from: total === 0 ? 0 : (page - 1) * pageSize + 1,
              to: Math.min(page * pageSize, total),
              total,
            })}
            totalPages={Math.max(1, Math.ceil(total / pageSize))}
          />
          <DataTable
            columns={[
              { key: "name", label: t("settings.roleName"), render: (role) => role.name },
              { key: "key", label: t("management.roleKey"), render: (role) => role.key },
              {
                key: "permissions",
                label: t("management.permissions"),
                render: (role) => String(role.permissions.length),
              },
              {
                key: "users",
                label: t("management.assignedUsers"),
                render: (role) => String(role._count?.users ?? 0),
              },
              {
                key: "protection",
                label: t("management.protection"),
                render: (role) => (
                  <Badge
                    color={role.isSuperAdmin || role.isSystem ? "gray" : "blue"}
                    variant="light"
                  >
                    {role.isSuperAdmin
                      ? t("settings.superAdminRole")
                      : role.isSystem
                        ? t("management.protectedRole")
                        : t("management.customRole")}
                  </Badge>
                ),
              },
              {
                key: "actions",
                label: t("organizations.actions"),
                render: (role) => (
                  <Can permission="admin-roles.manage">
                    <EntityActionMenu
                      ariaLabel={`${t("common.moreActions")}: ${role.name}`}
                      items={[
                        {
                          icon:
                            role.isSystem || role.isSuperAdmin ? (
                              <IconEye size={16} />
                            ) : (
                              <IconEdit size={16} />
                            ),
                          key: "open",
                          label:
                            role.isSystem || role.isSuperAdmin
                              ? t("management.viewRole")
                              : t("management.editRole"),
                          onClick: () => openEdit(role),
                        },
                        ...(!role.isSystem && !role.isSuperAdmin
                          ? [
                              {
                                color: "red" as const,
                                destructive: true,
                                disabled: !role.deletion?.allowed,
                                disabledReason:
                                  role.deletion?.blocker ??
                                  t("management.roleAssignedDeleteBlocked"),
                                icon: <IconTrash size={16} />,
                                key: "delete",
                                label: t("management.deleteRole"),
                                onClick: () => setDeleteTarget(role),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </Can>
                ),
              },
            ]}
            rows={roles}
          />
        </Stack>
      ) : (
        <EmptyState
          description={t("settings.noGssRolesDescription")}
          title={t("common.emptyTitle")}
        />
      )}
      <Drawer
        onClose={() => setOpened(false)}
        opened={opened}
        position="right"
        size="xl"
        title={editingRole ? t("settings.editGssRole") : t("settings.createGssRole")}
      >
        <Stack>
          {editingRole?.isSystem || editingRole?.isSuperAdmin ? (
            <Alert color="blue" title={t("settings.protectedRoleNotice")} />
          ) : null}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              disabled={Boolean(editingRole?.isSystem || editingRole?.isSuperAdmin)}
              label={t("management.roleKey")}
              onChange={(event) => setForm({ ...form, key: event.currentTarget.value })}
              value={form.key}
            />
            <TextInput
              disabled={Boolean(editingRole?.isSystem || editingRole?.isSuperAdmin)}
              label={t("settings.roleName")}
              onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
              value={form.name}
            />
          </SimpleGrid>
          <Text fw={600}>{t("settings.permissionEditor")}</Text>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
              <Stack gap={6} key={module}>
                <Text c="dimmed" fw={600} size="sm">
                  {module}
                </Text>
                {modulePermissions.map((permission) => (
                  <Checkbox
                    checked={form.permissionIds.includes(permission.id)}
                    disabled={Boolean(editingRole?.isSystem || editingRole?.isSuperAdmin)}
                    key={permission.id}
                    label={permission.key}
                    onChange={(event) =>
                      togglePermission(permission.id, event.currentTarget.checked)
                    }
                  />
                ))}
              </Stack>
            ))}
          </SimpleGrid>
          <Group justify="space-between">
            <Text c="dimmed" size="sm">
              {tf("management.permissionCount", { count: form.permissionIds.length })}
            </Text>
            <Can permission="admin-roles.manage">
              <Button
                disabled={
                  Boolean(editingRole?.isSystem || editingRole?.isSuperAdmin) ||
                  !form.key ||
                  !form.name
                }
                onClick={() => void save()}
              >
                {t("organizations.save")}
              </Button>
            </Can>
          </Group>
        </Stack>
      </Drawer>
      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t("management.deleteRole")}
        description={t("management.confirmRoleDeleteImpact")}
        entityName={deleteTarget?.name ?? ""}
        loading={deleting}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void deleteRole()}
        opened={Boolean(deleteTarget)}
        title={t("management.confirmRoleDeleteTitle")}
      />
    </Stack>
  );
}

export function AdminSystemSettingsPage() {
  const { session } = useAuth();
  const settingsQuery = useApiQuery<SystemSettingsRecord>(
    session,
    session ? portalQueryKey(session, "settings", "system") : ["settings", "anonymous", "system"],
    "/admin/settings/system",
  );
  const settings = settingsQuery.data;

  if (!settings && settingsQuery.isLoading) return <LoadingState title={t("common.loading")} />;
  if (settingsQuery.isError)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;

  return (
    <Stack gap="lg">
      <PageHeader subtitle={t("settings.systemSubtitle")} title={t("settings.systemTitle")} />
      <Alert color="blue" title={t("settings.readOnlyTitle")}>
        {t("settings.readOnlyDescription")}
      </Alert>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <StatusCard title={t("settings.applicationCard")}>
          <SettingRow label={t("settings.apiVersion")} value={settings!.application.apiVersion} />
          <SettingRow label={t("settings.environment")} value={settings!.application.environment} />
        </StatusCard>
        <StatusCard title={t("settings.mqttCard")}>
          <SettingRow
            label={t("settings.enabled")}
            value={<BooleanStatus value={settings!.mqtt.enabled} />}
          />
          <SettingRow
            label={t("settings.connected")}
            value={<BooleanStatus value={settings!.mqtt.connected} />}
          />
          <SettingRow
            label={t("settings.readiness")}
            value={
              <StatusBadge
                label={settings!.mqtt.ready ? t("settings.ready") : t("settings.notReady")}
                status={settings!.mqtt.ready ? "online" : "offline"}
              />
            }
          />
          <SettingRow
            label={t("settings.subscribedFilters")}
            value={String(settings!.mqtt.subscribedFilterCount)}
          />
        </StatusCard>
        <StatusCard title={t("settings.reportsCard")}>
          <SettingRow
            label={t("settings.storageProvider")}
            value={settings!.reports.storage.provider}
          />
          <SettingRow
            label={t("settings.workerEnabled")}
            value={settings!.reports.worker.enabled ? t("settings.yes") : t("settings.no")}
          />
          <SettingRow label={t("settings.workerMode")} value={settings!.reports.worker.mode} />
        </StatusCard>
        <StatusCard title={t("settings.policyCard")}>
          <SettingRow
            label={t("settings.commandAckTimeout")}
            value={`${settings!.commands.ackTimeoutMs} ms`}
          />
          <SettingRow
            label={t("settings.commandExpiry")}
            value={`${settings!.commands.expiresInSeconds} s`}
          />
          <SettingRow
            label={t("settings.commandRetries")}
            value={String(settings!.commands.maxPublishAttempts)}
          />
          <SettingRow
            label={t("settings.retention")}
            value={`${settings!.sensorHistory.retentionDays} days`}
          />
        </StatusCard>
      </SimpleGrid>
    </Stack>
  );
}

function StatusCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <Paper p="lg" withBorder>
      <Stack gap="sm">
        <Text fw={700}>{title}</Text>
        {children}
      </Stack>
    </Paper>
  );
}

function SettingRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Text c="dimmed" size="sm">
        {label}
      </Text>
      <Text fw={600} size="sm" ta="right">
        {value}
      </Text>
    </Group>
  );
}

function BooleanStatus({ value }: { value: boolean }) {
  return (
    <StatusBadge
      label={value ? t("status.online") : t("status.offline")}
      status={value ? "online" : "offline"}
    />
  );
}

export function CompanySettingsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const branding = useCompanyBranding();
  const canManage = hasPermission(session, "settings.company.manage");
  const [form, setForm] = useState({ address: "", email: "", phone: "" });
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const companyKey = session
    ? portalQueryKey(session, "settings", "company")
    : (["settings", "anonymous", "company"] as const);
  const companyQuery = useApiQuery<CompanyRecord>(session, companyKey, "/company/settings");
  const company = companyQuery.data;
  const companyMutation = useApiMutation<CompanyRecord>(session, {
    onSuccess: (next) => queryClient.setQueryData(companyKey, next),
  });
  const logoMutation = useApiMutation(session);

  useEffect(() => {
    if (company) {
      setForm({
        address: company.address ?? "",
        email: company.email ?? "",
        phone: company.phone ?? "",
      });
    }
  }, [company]);

  const save = async () => {
    if (!session || !canManage) return;
    setSaved(false);
    try {
      await companyMutation.mutateAsync({
        path: "/company/settings",
        options: { body: JSON.stringify(form), method: "PATCH" },
      });
      setSaved(true);
    } catch {
      setError(true);
    }
  };

  const uploadLogo = async (file: File) => {
    if (!session || !canManage) return;
    const body = new FormData();
    body.append("logo", file);
    await apiMultipartRequest(session, "/company/settings/logo", body);
    queryClient.setQueryData<CompanyRecord>(companyKey, (current) =>
      current ? { ...current, hasLogo: true } : current,
    );
    await branding.refreshLogo();
  };

  const removeLogo = async () => {
    if (!session || !canManage) return;
    await logoMutation.mutateAsync({
      path: "/company/settings/logo",
      options: { method: "DELETE" },
    });
    queryClient.setQueryData<CompanyRecord>(companyKey, (current) =>
      current ? { ...current, hasLogo: false } : current,
    );
    await branding.refreshLogo();
  };

  if (!company && companyQuery.isLoading) return <LoadingState title={t("common.loading")} />;
  if ((error || companyQuery.isError) && !company)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;

  return (
    <Stack gap="lg">
      <PageHeader subtitle={t("settings.companySubtitle")} title={t("settings.companyTitle")} />
      {saved ? <Alert color="green" title={t("settings.saved")} /> : null}
      {error ? <Alert color="red" title={t("settings.actionFailed")} /> : null}
      <Paper p="lg" withBorder>
        <CompanyLogoEditor
          canManage={canManage}
          companyName={company!.name}
          logoUrl={branding.logoUrl}
          onRemove={removeLogo}
          onUpload={uploadLogo}
          status={branding.status}
        />
      </Paper>
      <Paper p="lg" withBorder>
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput disabled label={t("settings.companyNameReadonly")} value={company!.name} />
            <TextInput
              disabled
              label={t("settings.companyCodeReadonly")}
              value={company!.code ?? t("settings.notAvailable")}
            />
            <TextInput disabled label={t("settings.companyIdReadonly")} value={company!.id} />
            <Stack gap={6}>
              <Text c="dimmed" fw={500} size="sm">
                {t("settings.companyStatusReadonly")}
              </Text>
              <StatusBadge
                label={t(
                  company!.status === "ACTIVE" ? "management.active" : "management.inactive",
                )}
                status={company!.status === "ACTIVE" ? "active" : "inactive"}
              />
            </Stack>
            <TextInput
              disabled={!canManage}
              label={t("settings.address")}
              onChange={(event) => setForm({ ...form, address: event.currentTarget.value })}
              value={form.address}
            />
            <TextInput
              disabled={!canManage}
              label={t("management.phone")}
              onChange={(event) => setForm({ ...form, phone: event.currentTarget.value })}
              value={form.phone}
            />
            <TextInput
              disabled={!canManage}
              label={t("management.email")}
              onChange={(event) => setForm({ ...form, email: event.currentTarget.value })}
              value={form.email}
            />
          </SimpleGrid>
          <Can permission="settings.company.manage">
            <Group justify="flex-end">
              <Button onClick={() => void save()}>{t("organizations.save")}</Button>
            </Group>
          </Can>
        </Stack>
      </Paper>
    </Stack>
  );
}
