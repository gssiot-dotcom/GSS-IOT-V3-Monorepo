import type {
  CollectionPageSize,
  CompanyPermissionRecord,
  CompanyRoleRecord,
  PaginatedResponse,
} from "@gss-iot/contracts";
import { Can } from "../../shared/rbac/Can";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import {
  DataTable,
  CollectionPagination,
  DataToolbar,
  ConfirmActionModal,
  EmptyState,
  EntityActionMenu,
  EntityPrimaryCell,
  EntityStatusBadge,
  ErrorState,
  FormFieldGrid,
  FormSection,
  FormWorkspace,
  LoadingState,
  ModalFormFooter,
  PageHeader,
} from "@gss-iot/ui";
import { Button, Checkbox, Modal, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { IconEdit, IconShieldLock, IconTrash } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { t, tf } from "../../app/i18n";
import { hasPermission } from "../../shared/rbac/has-permission";

interface RoleFormState {
  key: string;
  name: string;
  permissionIds: string[];
}

const emptyForm: RoleFormState = { key: "", name: "", permissionIds: [] };

export function CompanyRolesPage() {
  const { session } = useAuth();
  const [roles, setRoles] = useState<CompanyRoleRecord[]>();
  const [permissions, setPermissions] = useState<CompanyPermissionRecord[]>([]);
  const [error, setError] = useState(false);
  const [opened, setOpened] = useState(false);
  const [editingRole, setEditingRole] = useState<CompanyRoleRecord | null>(null);
  const [form, setForm] = useState<RoleFormState>(emptyForm);
  const [roleSearch, setRoleSearch] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CompanyRoleRecord>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<CollectionPageSize>(50);
  const [total, setTotal] = useState(0);

  const groupedPermissions = useMemo(() => {
    return permissions.reduce<Record<string, CompanyPermissionRecord[]>>((groups, permission) => {
      groups[permission.module] = [...(groups[permission.module] ?? []), permission];
      return groups;
    }, {});
  }, [permissions]);

  const load = async () => {
    if (!session) return;
    setError(false);
    try {
      const response = await apiRequest<PaginatedResponse<CompanyRoleRecord>>(
        session,
        `/company/roles?page=${page}&pageSize=${pageSize}`,
      );
      setRoles(response.items);
      setTotal(response.total);
      if (hasPermission(session, "company-permissions.view")) {
        try {
          setPermissions(
            await apiRequest<CompanyPermissionRecord[]>(session, "/company/permissions/options"),
          );
        } catch {
          setPermissions([]);
        }
      } else {
        setPermissions([]);
      }
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    void load();
  }, [session, page, pageSize]);

  const openCreate = () => {
    setEditingRole(null);
    setForm(emptyForm);
    setOpened(true);
  };

  const openEdit = (role: CompanyRoleRecord) => {
    setEditingRole(role);
    setForm({
      key: role.key,
      name: role.name,
      permissionIds: role.permissions.map((permission) => permission.permissionId),
    });
    setOpened(true);
  };

  const save = async () => {
    if (!session) return;
    const payload = JSON.stringify(form);
    if (editingRole) {
      await apiRequest(session, `/company/roles/${editingRole.id}`, {
        body: payload,
        method: "PATCH",
      });
    } else {
      await apiRequest(session, "/company/roles", { body: payload, method: "POST" });
    }
    setOpened(false);
    setEditingRole(null);
    setForm(emptyForm);
    await load();
  };

  const deleteRole = async (roleId: string) => {
    if (!session) return;
    await apiRequest(session, `/company/roles/${roleId}`, { method: "DELETE" });
    await load();
  };

  const closeEditor = () => {
    setOpened(false);
    setEditingRole(null);
    setForm(emptyForm);
    setPermissionSearch("");
  };

  const filteredRoles = roles?.filter((role) => {
    const query = roleSearch.trim().toLowerCase();
    if (!query) return true;
    return [role.name, role.key].some((value) => value.toLowerCase().includes(query));
  });

  const filteredPermissionGroups = Object.entries(groupedPermissions).reduce<
    Record<string, CompanyPermissionRecord[]>
  >((groups, [module, modulePermissions]) => {
    const query = permissionSearch.trim().toLowerCase();
    const filtered = query
      ? modulePermissions.filter((permission) =>
          [permission.key, permission.module, permission.action].some((value) =>
            value.toLowerCase().includes(query),
          ),
        )
      : modulePermissions;
    if (filtered.length) groups[module] = filtered;
    return groups;
  }, {});

  const roleActionMenu = (role: CompanyRoleRecord) => {
    const protectedRole = role.isSystem || role.isCompanyOwnerRole;
    const items = [
      {
        icon: protectedRole ? <IconShieldLock size={16} /> : <IconEdit size={16} />,
        key: protectedRole ? "view" : "edit",
        label: protectedRole ? t("management.viewRole") : t("management.editRole"),
        onClick: () => openEdit(role),
      },
      ...(hasPermission(session, "company-roles.manage") && !protectedRole
        ? [
            {
              color: "red" as const,
              destructive: true,
              disabled: !role.deletion?.allowed,
              disabledReason: role.deletion?.blocker ?? undefined,
              icon: <IconTrash size={16} />,
              key: "delete",
              label: t("management.deleteRole"),
              onClick: () => setDeleteTarget(role),
            },
          ]
        : []),
    ] satisfies Parameters<typeof EntityActionMenu>[0]["items"];
    return (
      <EntityActionMenu ariaLabel={`${t("common.moreActions")}: ${role.name}`} items={items} />
    );
  };

  const confirmDeleteRole = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setActionError("");
    try {
      await deleteRole(deleteTarget.id);
      setDeleteTarget(undefined);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("settings.actionFailed"));
    } finally {
      setIsDeleting(false);
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

  if (!roles && !error) return <LoadingState title={t("common.loading")} />;
  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;

  return (
    <Stack gap="lg">
      <PageHeader
        title={t("management.rolesTitle")}
        subtitle={t("management.rolesSubtitle")}
        action={
          <Can permission="company-roles.manage">
            <Button onClick={openCreate}>{t("management.createRole")}</Button>
          </Can>
        }
      />
      {actionError ? <Text c="red">{actionError}</Text> : null}
      {filteredRoles?.length ? (
        <>
          <CollectionPagination
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(Number(value) as CollectionPageSize);
              setPage(1);
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
          <DataToolbar>
            <TextInput
              aria-label={t("management.roleName")}
              onChange={(event) => setRoleSearch(event.currentTarget.value)}
              placeholder={t("management.roleName")}
              value={roleSearch}
            />
            <Text c="dimmed" size="sm">
              {filteredRoles.length} / {roles?.length ?? 0}
            </Text>
          </DataToolbar>
          <DataTable
            ariaLabel={t("management.rolesTitle")}
            density="compact"
            columns={[
              {
                key: "identity",
                label: t("organizations.name"),
                render: (role) => <EntityPrimaryCell identifier={role.key} title={role.name} />,
              },
              {
                key: "permissions",
                label: t("management.permissions"),
                render: (role) =>
                  role.permissions.length
                    ? tf("management.permissionCount", { count: role.permissions.length })
                    : t("management.noPermissions"),
              },
              {
                key: "users",
                label: t("management.assignedUsers"),
                render: (role) => String(role._count?.users ?? 0),
              },
              {
                key: "system",
                label: t("management.protection"),
                render: (role) =>
                  role.isSystem || role.isCompanyOwnerRole ? (
                    <EntityStatusBadge label={t("management.protectedRole")} status="maintenance" />
                  ) : (
                    <EntityStatusBadge label={t("management.customRole")} status="available" />
                  ),
              },
              {
                key: "actions",
                label: t("organizations.actions"),
                align: "right",
                render: (role) =>
                  hasPermission(session, "company-roles.manage") ? roleActionMenu(role) : null,
              },
            ]}
            rows={filteredRoles}
          />
        </>
      ) : (
        <EmptyState
          description={t("management.emptyRolesDescription")}
          title={t("common.emptyTitle")}
        />
      )}
      <Modal
        opened={opened}
        onClose={closeEditor}
        size="xl"
        title={editingRole ? t("management.editRole") : t("management.createRole")}
      >
        <FormWorkspace>
          {editingRole?.isSystem || editingRole?.isCompanyOwnerRole ? (
            <Text c="dimmed" size="sm">
              {t("management.systemRoleNotice")}
            </Text>
          ) : null}
          <FormSection title={t("management.role")}>
            <FormFieldGrid>
              <TextInput
                disabled={!!editingRole?.isSystem || !!editingRole?.isCompanyOwnerRole}
                label={t("management.roleKey")}
                onChange={(event) => setForm({ ...form, key: event.currentTarget.value })}
                value={form.key}
              />
              <TextInput
                disabled={!!editingRole?.isSystem || !!editingRole?.isCompanyOwnerRole}
                label={t("organizations.name")}
                onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
                value={form.name}
              />
            </FormFieldGrid>
          </FormSection>
          <FormSection title={t("management.effectiveRolePermissions")}>
            <TextInput
              aria-label={t("management.permissionSearch")}
              label={t("management.permissionSearch")}
              mb="md"
              onChange={(event) => setPermissionSearch(event.currentTarget.value)}
              value={permissionSearch}
            />
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              {Object.entries(filteredPermissionGroups).map(([module, modulePermissions]) => (
                <Stack gap={6} key={module}>
                  <Text c="dimmed" fw={600} size="sm">
                    {module}
                  </Text>
                  {modulePermissions.map((permission) => (
                    <Checkbox
                      checked={form.permissionIds.includes(permission.id)}
                      disabled={!!editingRole?.isSystem || !!editingRole?.isCompanyOwnerRole}
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
          </FormSection>
          <Stack gap="xs" mt="lg">
            <Text c="dimmed" size="sm">
              {tf("management.permissionCount", { count: form.permissionIds.length })}
            </Text>
            <ModalFormFooter
              cancelLabel={t("common.cancel")}
              onCancel={closeEditor}
              onSubmit={() => void save()}
              submitDisabled={
                !form.key ||
                !form.name ||
                !!editingRole?.isSystem ||
                !!editingRole?.isCompanyOwnerRole
              }
              submitLabel={t("organizations.save")}
            />
          </Stack>
        </FormWorkspace>
      </Modal>
      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t("management.deleteRole")}
        description={t("management.confirmDeleteRoleImpact")}
        entityName={deleteTarget?.name ?? ""}
        loading={isDeleting}
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={() => void confirmDeleteRole()}
        opened={Boolean(deleteTarget)}
        title={
          deleteTarget
            ? t("management.confirmDeleteRole").replace("{label}", deleteTarget.name)
            : t("management.deleteRole")
        }
      />
    </Stack>
  );
}
