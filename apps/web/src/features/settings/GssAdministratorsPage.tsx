import type {
  CollectionPageSize,
  GssAdminRoleOption,
  GssAdminUserRecord,
  PaginatedResponse,
} from "@gss-iot/contracts";
import {
  CollectionPagination,
  ConfirmActionModal,
  DataTable,
  EmptyState,
  EntityActionMenu,
  EntityPrimaryCell,
  EntityStatusBadge,
  ErrorState,
  ForbiddenState,
  LoadingState,
  ModalFormFooter,
  PageHeader,
  SessionExpiredState,
} from "@gss-iot/ui";
import {
  Alert,
  Button,
  Drawer,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconEdit,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";

import { formatDateTime, t, tf } from "../../app/i18n";
import { ApiError } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { useApiMutation, useApiQuery } from "../../shared/query/api-query";
import { portalDomainKey, portalQueryKey } from "../../shared/query/query-keys";
import { Can } from "../../shared/rbac/Can";
import { useCollectionSearchParams } from "../../shared/url/collection-search-params";

interface AdministratorForm {
  email: string;
  isActive: boolean;
  name: string;
  password: string;
  phone: string;
  roleId: string | null;
}

const emptyForm: AdministratorForm = {
  email: "",
  isActive: true,
  name: "",
  password: "",
  phone: "",
  roleId: null,
};

export function GssAdministratorsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const collection = useCollectionSearchParams(50);
  const { page, pageSize } = collection;
  const search = collection.search;
  const [searchDraft, setSearchDraft] = useState(search);
  const [viewing, setViewing] = useState<GssAdminUserRecord | null>(null);
  const [editing, setEditing] = useState<GssAdminUserRecord | null>(null);
  const [formOpened, setFormOpened] = useState(false);
  const [form, setForm] = useState<AdministratorForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState<GssAdminUserRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GssAdminUserRecord | null>(null);
  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState("");

  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) query.set("search", search);
  const usersQuery = useApiQuery<PaginatedResponse<GssAdminUserRecord>>(
    session,
    session
      ? portalQueryKey(session, "gss-users", "list", { page, pageSize, search })
      : ["gss-users", "anonymous"],
    `/admin/gss-users?${query.toString()}`,
    { placeholderData: keepPreviousData },
  );
  const rolesQuery = useApiQuery<GssAdminRoleOption[]>(
    session,
    session
      ? portalQueryKey(session, "gss-users", "role-options")
      : ["gss-users", "anonymous", "role-options"],
    "/admin/gss-users/options",
  );
  const administrators = usersQuery.data?.items;
  const roles = rolesQuery.data ?? [];
  const total = usersQuery.data?.total ?? 0;
  const userMutation = useApiMutation(session, {
    onSuccess: async () => {
      if (session)
        await queryClient.invalidateQueries({ queryKey: portalDomainKey(session, "gss-users") });
    },
  });

  useEffect(() => {
    if (!administrators) return;
    setViewing((current) =>
      current ? (administrators.find(({ id }) => id === current.id) ?? null) : null,
    );
  }, [administrators]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpened(true);
  };

  const openEdit = (user: GssAdminUserRecord) => {
    setEditing(user);
    setForm({
      email: user.email,
      isActive: user.isActive,
      name: user.name,
      password: "",
      phone: user.phone ?? "",
      roleId: user.role.id,
    });
    setFormError("");
    setFormOpened(true);
  };

  const save = async () => {
    if (!session || saving) return;
    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.roleId ||
      (!editing && form.password.length < 8)
    ) {
      setFormError(t("settings.requiredAdministratorFields"));
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await userMutation.mutateAsync({
        path: editing ? `/admin/gss-users/${editing.id}` : "/admin/gss-users",
        options: {
          body: JSON.stringify({
            email: form.email,
            ...(editing ? { isActive: form.isActive } : {}),
            name: form.name,
            ...(form.password ? { password: form.password } : {}),
            phone: form.phone,
            roleId: form.roleId,
          }),
          method: editing ? "PATCH" : "POST",
        },
      });
      setFormOpened(false);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : t("settings.actionFailed"));
    } finally {
      setSaving(false);
    }
  };

  const mutate = async (kind: "delete" | "status") => {
    if (!session || mutating) return;
    const target = kind === "delete" ? deleteTarget : statusTarget;
    if (!target) return;
    setMutating(true);
    setMutationError("");
    try {
      await userMutation.mutateAsync({
        path: `/admin/gss-users/${target.id}`,
        options: {
          ...(kind === "status"
            ? { body: JSON.stringify({ isActive: !target.isActive }), method: "PATCH" }
            : { method: "DELETE" }),
        },
      });
      setDeleteTarget(null);
      setStatusTarget(null);
    } catch (error) {
      setMutationError(error instanceof ApiError ? error.message : t("settings.actionFailed"));
      setDeleteTarget(null);
      setStatusTarget(null);
    } finally {
      setMutating(false);
    }
  };

  if (!administrators && usersQuery.isLoading) {
    return <LoadingState title={t("common.loading")} />;
  }
  const loadStatus = usersQuery.error instanceof ApiError ? usersQuery.error.status : undefined;
  if (loadStatus === 401) return <SessionExpiredState title={t("common.sessionExpired")} />;
  if (loadStatus === 403) return <ForbiddenState title={t("common.forbidden")} />;
  if (usersQuery.isError) {
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;
  }

  const roleOptions = roles.map((role) => ({
    label: role.isSuperAdmin ? `${role.name} · ${t("settings.superAdminRole")}` : role.name,
    value: role.id,
  }));
  const canUpdateAdministrators = Boolean(
    session?.user.permissions.includes("admin-users.update") || session?.user.isSuperAdmin,
  );
  const canDeleteAdministrators = Boolean(
    session?.user.permissions.includes("admin-users.delete") || session?.user.isSuperAdmin,
  );

  return (
    <Stack gap="lg">
      <PageHeader
        action={
          <Can permission="admin-users.create">
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
              {t("settings.createAdministrator")}
            </Button>
          </Can>
        }
        subtitle={t("settings.administratorsSubtitle")}
        title={t("settings.administratorsTitle")}
      />
      {mutationError ? <Alert color="red">{mutationError}</Alert> : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          collection.setSearch(searchDraft.trim());
        }}
      >
        <Group align="end" wrap="nowrap">
          <TextInput
            aria-label={t("settings.searchAdministrators")}
            label={t("settings.searchAdministrators")}
            onChange={(event) => setSearchDraft(event.currentTarget.value)}
            style={{ flex: 1 }}
            value={searchDraft}
          />
          <Button type="submit" variant="light">
            {t("settings.search")}
          </Button>
        </Group>
      </form>
      {administrators?.length ? (
        <Stack gap="sm">
          <DataTable
            columns={[
              {
                key: "administrator",
                label: t("settings.administratorsTitle"),
                render: (user) => <EntityPrimaryCell identifier={user.email} title={user.name} />,
              },
              { key: "role", label: t("settings.roleName"), render: (user) => user.role.name },
              {
                key: "phone",
                label: t("management.phone"),
                render: (user) => user.phone || "—",
              },
              {
                key: "status",
                label: t("organizations.status"),
                render: (user) => (
                  <EntityStatusBadge
                    label={user.isActive ? t("settings.active") : t("settings.inactive")}
                    status={user.isActive ? "active" : "inactive"}
                  />
                ),
              },
              {
                key: "lastLogin",
                label: t("settings.lastLogin"),
                render: (user) =>
                  user.lastLoginAt ? formatDateTime(user.lastLoginAt) : t("settings.never"),
              },
              {
                key: "actions",
                label: t("organizations.actions"),
                render: (user) =>
                  canUpdateAdministrators || canDeleteAdministrators ? (
                    <EntityActionMenu
                      ariaLabel={`${t("common.moreActions")}: ${user.name}`}
                      items={[
                        ...(canUpdateAdministrators
                          ? [
                              {
                                icon: <IconEdit size={16} />,
                                key: "edit",
                                label: t("settings.editAdministrator"),
                                onClick: () => openEdit(user),
                              },
                              {
                                icon: user.isActive ? (
                                  <IconPlayerPause size={16} />
                                ) : (
                                  <IconPlayerPlay size={16} />
                                ),
                                key: "status",
                                label: user.isActive
                                  ? t("settings.deactivateAdministrator")
                                  : t("settings.activateAdministrator"),
                                onClick: () => setStatusTarget(user),
                              },
                            ]
                          : []),
                        ...(canDeleteAdministrators
                          ? [
                              {
                                color: "red" as const,
                                destructive: true,
                                disabled: !user.deletion?.allowed,
                                disabledReason: user.deletion?.blocker ?? undefined,
                                icon: <IconTrash size={16} />,
                                key: "delete",
                                label: t("settings.deleteAdministrator"),
                                onClick: () => setDeleteTarget(user),
                              },
                            ]
                          : []),
                      ]}
                    />
                  ) : null,
              },
            ]}
            isRowSelected={(user) => viewing?.id === user.id}
            onRowClick={setViewing}
            rowAriaLabel={(user) => `${t("settings.administratorDetails")}: ${user.name}`}
            rows={administrators}
          />
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
        </Stack>
      ) : (
        <EmptyState
          description={
            search
              ? t("settings.noAdministratorsSearchDescription")
              : t("settings.noAdministratorsDescription")
          }
          title={t("common.emptyTitle")}
        />
      )}

      <Drawer
        onClose={() => setViewing(null)}
        opened={Boolean(viewing)}
        position="right"
        size="md"
        title={t("settings.administratorDetails")}
      >
        {viewing ? (
          <Stack>
            <EntityPrimaryCell identifier={viewing.email} title={viewing.name} />
            <SimpleGrid cols={2}>
              <Detail label={t("settings.roleName")} value={viewing.role.name} />
              <Detail
                label={t("organizations.status")}
                value={viewing.isActive ? t("settings.active") : t("settings.inactive")}
              />
              <Detail label={t("management.phone")} value={viewing.phone || "—"} />
              <Detail
                label={t("settings.lastLogin")}
                value={
                  viewing.lastLoginAt ? formatDateTime(viewing.lastLoginAt) : t("settings.never")
                }
              />
            </SimpleGrid>
            <Group>
              <Can permission="admin-users.update">
                <Button onClick={() => openEdit(viewing)} variant="light">
                  {t("settings.editAdministrator")}
                </Button>
              </Can>
              <Can permission="admin-users.delete">
                <Button
                  color="red"
                  disabled={!viewing.deletion?.allowed}
                  onClick={() => setDeleteTarget(viewing)}
                  variant="light"
                >
                  {t("settings.deleteAdministrator")}
                </Button>
              </Can>
            </Group>
            {!viewing.deletion?.allowed && viewing.deletion?.blocker ? (
              <Alert color="orange">{viewing.deletion.blocker}</Alert>
            ) : null}
          </Stack>
        ) : null}
      </Drawer>

      <Modal
        onClose={() => setFormOpened(false)}
        opened={formOpened}
        size="lg"
        title={editing ? t("settings.editAdministrator") : t("settings.createAdministrator")}
      >
        <Stack>
          {formError ? <Alert color="red">{formError}</Alert> : null}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label={t("organizations.name")}
              onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
              required
              value={form.name}
            />
            <TextInput
              label={t("management.email")}
              onChange={(event) => setForm({ ...form, email: event.currentTarget.value })}
              required
              type="email"
              value={form.email}
            />
            <TextInput
              label={t("management.phone")}
              onChange={(event) => setForm({ ...form, phone: event.currentTarget.value })}
              value={form.phone}
            />
            <Select
              data={roleOptions}
              label={t("settings.roleName")}
              onChange={(roleId) => setForm({ ...form, roleId })}
              required
              value={form.roleId}
            />
            <TextInput
              label={editing ? t("settings.passwordOptional") : t("settings.password")}
              minLength={8}
              onChange={(event) => setForm({ ...form, password: event.currentTarget.value })}
              required={!editing}
              type="password"
              value={form.password}
            />
            {editing ? (
              <Switch
                checked={form.isActive}
                label={form.isActive ? t("settings.active") : t("settings.inactive")}
                onChange={(event) => setForm({ ...form, isActive: event.currentTarget.checked })}
              />
            ) : null}
          </SimpleGrid>
          <ModalFormFooter
            cancelLabel={t("common.cancel")}
            onCancel={() => setFormOpened(false)}
            onSubmit={() => void save()}
            submitLabel={t("organizations.save")}
            submitLoading={saving}
          />
        </Stack>
      </Modal>

      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={
          statusTarget?.isActive
            ? t("settings.deactivateAdministrator")
            : t("settings.activateAdministrator")
        }
        description={t("settings.confirmAdministratorStatusImpact")}
        entityName={statusTarget?.name ?? ""}
        loading={mutating}
        onClose={() => setStatusTarget(null)}
        onConfirm={() => void mutate("status")}
        opened={Boolean(statusTarget)}
        title={t("settings.confirmAdministratorStatusTitle")}
      />
      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t("settings.deleteAdministrator")}
        description={t("settings.confirmAdministratorDeleteImpact")}
        entityName={deleteTarget?.name ?? ""}
        loading={mutating}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void mutate("delete")}
        opened={Boolean(deleteTarget)}
        title={t("settings.confirmAdministratorDeleteTitle")}
      />
    </Stack>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text fw={650} size="sm">
        {value}
      </Text>
    </Stack>
  );
}
