import type { CompanyPermissionRecord, CompanyRoleRecord } from "@gss-iot/contracts";
import { Can } from "../../shared/rbac/Can";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import {
  DataTable,
  EmptyState,
  ErrorState,
  FormFieldGrid,
  FormSection,
  FormWorkspace,
  LoadingState,
  PageHeader,
  StickyFormActions,
} from "@gss-iot/ui";
import {
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconEdit, IconTrash } from "@tabler/icons-react";
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
      setRoles(await apiRequest<CompanyRoleRecord[]>(session, "/company/roles"));
      if (hasPermission(session, "company-permissions.view")) {
        try {
          setPermissions(
            await apiRequest<CompanyPermissionRecord[]>(session, "/company/permissions"),
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
  }, [session]);

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
      {roles?.length ? (
        <DataTable
          columns={[
            { key: "name", label: t("organizations.name"), render: (role) => role.name },
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
              key: "system",
              label: t("management.protection"),
              render: (role) =>
                role.isSystem || role.isCompanyOwnerRole ? (
                  <Badge color="gray" variant="light">
                    {t("management.protectedRole")}
                  </Badge>
                ) : (
                  <Badge color="blue" variant="light">
                    {t("management.customRole")}
                  </Badge>
                ),
            },
            {
              key: "actions",
              label: t("organizations.actions"),
              render: (role) => (
                <Can permission="company-roles.manage">
                  <Group gap="xs">
                    <Button
                      leftSection={<IconEdit size={16} />}
                      onClick={() => openEdit(role)}
                      size="xs"
                      variant="light"
                    >
                      {role.isSystem || role.isCompanyOwnerRole
                        ? t("management.viewRole")
                        : t("management.editRole")}
                    </Button>
                    <Button
                      color="red"
                      disabled={role.isSystem || role.isCompanyOwnerRole || !!role._count?.users}
                      leftSection={<IconTrash size={16} />}
                      onClick={() => void deleteRole(role.id)}
                      size="xs"
                      variant="light"
                    >
                      {t("management.deleteRole")}
                    </Button>
                  </Group>
                </Can>
              ),
            },
          ]}
          rows={roles}
        />
      ) : (
        <EmptyState
          description={t("management.emptyRolesDescription")}
          title={t("common.emptyTitle")}
        />
      )}
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        size="xl"
        title={editingRole ? t("management.editRole") : t("management.createRole")}
      >
        <FormWorkspace>
          <FormSection title={t("management.role") }>
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
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
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
          <StickyFormActions>
          <Group justify="space-between" w="100%">
            <Text c="dimmed" size="sm">
              {tf("management.permissionCount", { count: form.permissionIds.length })}
            </Text>
            <Button
              disabled={
                !form.key ||
                !form.name ||
                !!editingRole?.isSystem ||
                !!editingRole?.isCompanyOwnerRole
              }
              onClick={() => void save()}
            >
              {t("organizations.save")}
            </Button>
          </Group>
          </StickyFormActions>
        </FormWorkspace>
      </Modal>
    </Stack>
  );
}
