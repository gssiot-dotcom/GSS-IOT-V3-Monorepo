import type {
  AccessLevel,
  AreaRecord,
  BuildingRecord,
  CompanyPermissionRecord,
  CompanyPositionRecord,
  CompanyRoleRecord,
  CompanyUserEffectiveAccessRecord,
  CompanyUserRecord,
  PermissionEffect,
} from "@gss-iot/contracts";
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
  Divider,
  Group,
  Modal,
  MultiSelect,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconEdit, IconPlus, IconShield, IconTrash } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { t, tf } from "../../app/i18n";
import { hasPermission } from "../../shared/rbac/has-permission";

interface AccessForm {
  id: string;
  accessLevel: AccessLevel;
}

interface PositionAssignmentForm {
  areaId: string | null;
  buildingId: string | null;
  positionId: string;
}

interface UserFormState {
  areaAccess: AccessForm[];
  buildingAccess: AccessForm[];
  directAllowIds: string[];
  directDenyIds: string[];
  email: string;
  isActive: boolean;
  name: string;
  password: string;
  phone: string;
  positionAssignments: PositionAssignmentForm[];
  roleId: string | null;
}

const emptyUserForm: UserFormState = {
  areaAccess: [],
  buildingAccess: [],
  directAllowIds: [],
  directDenyIds: [],
  email: "",
  isActive: true,
  name: "",
  password: "",
  phone: "",
  positionAssignments: [],
  roleId: null,
};

export function CompanyUsersPage() {
  const { session } = useAuth();
  const [users, setUsers] = useState<CompanyUserRecord[]>();
  const [roles, setRoles] = useState<CompanyRoleRecord[]>([]);
  const [permissions, setPermissions] = useState<CompanyPermissionRecord[]>([]);
  const [areas, setAreas] = useState<AreaRecord[]>([]);
  const [buildings, setBuildings] = useState<BuildingRecord[]>([]);
  const [positions, setPositions] = useState<CompanyPositionRecord[]>([]);
  const [preview, setPreview] = useState<CompanyUserEffectiveAccessRecord | null>(null);
  const [error, setError] = useState(false);
  const [userModalOpened, setUserModalOpened] = useState(false);
  const [positionModalOpened, setPositionModalOpened] = useState(false);
  const [editingUser, setEditingUser] = useState<CompanyUserRecord | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyUserForm);
  const [positionKey, setPositionKey] = useState("");
  const [positionName, setPositionName] = useState("");

  const permissionOptions = permissions.map((permission) => ({
    label: permission.key,
    value: permission.id,
  }));
  const areaOptions = areas.map((area) => ({ label: area.name, value: area.id }));
  const buildingOptions = buildings.map((building) => ({
    label: building.title,
    value: building.id,
  }));
  const positionOptions = positions
    .filter((position) => position.isActive)
    .map((position) => ({ label: position.name, value: position.id }));

  const roleOptions = roles.map((role) => ({ label: role.name, value: role.id }));
  const selectedAreaIds = useMemo(() => form.areaAccess.map(({ id }) => id), [form.areaAccess]);
  const selectedBuildingIds = useMemo(
    () => form.buildingAccess.map(({ id }) => id),
    [form.buildingAccess],
  );

  const load = async () => {
    if (!session) return;
    setError(false);
    try {
      setUsers(await apiRequest<CompanyUserRecord[]>(session, "/company/users"));

      if (hasPermission(session, "company-roles.view")) {
        try {
          setRoles(await apiRequest<CompanyRoleRecord[]>(session, "/company/roles"));
        } catch {
          setRoles([]);
        }
      } else {
        setRoles([]);
      }

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

      if (hasPermission(session, "areas.view")) {
        try {
          setAreas(await apiRequest<AreaRecord[]>(session, "/company/areas"));
        } catch {
          setAreas([]);
        }
      } else {
        setAreas([]);
      }

      if (hasPermission(session, "buildings.view")) {
        try {
          setBuildings(await apiRequest<BuildingRecord[]>(session, "/company/buildings"));
        } catch {
          setBuildings([]);
        }
      } else {
        setBuildings([]);
      }

      try {
        setPositions(await apiRequest<CompanyPositionRecord[]>(session, "/company/positions"));
      } catch {
        setPositions([]);
      }
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    void load();
  }, [session]);

  const openCreate = () => {
    setEditingUser(null);
    setPreview(null);
    setForm(emptyUserForm);
    setUserModalOpened(true);
  };

  const openEdit = async (user: CompanyUserRecord) => {
    setEditingUser(user);
    setForm({
      areaAccess:
        user.areaAccess?.map((access) => ({
          accessLevel: access.accessLevel,
          id: access.areaId,
        })) ?? [],
      buildingAccess:
        user.buildingAccess?.map((access) => ({
          accessLevel: access.accessLevel,
          id: access.buildingId,
        })) ?? [],
      directAllowIds:
        user.permissions
          ?.filter(({ effect }) => effect === "ALLOW")
          .map(({ permissionId }) => permissionId) ?? [],
      directDenyIds:
        user.permissions
          ?.filter(({ effect }) => effect === "DENY")
          .map(({ permissionId }) => permissionId) ?? [],
      email: user.email,
      isActive: user.isActive,
      name: user.name,
      password: "",
      phone: user.phone ?? "",
      positionAssignments:
        user.positionAssignments?.map((assignment) => ({
          areaId: assignment.areaId,
          buildingId: assignment.buildingId,
          positionId: assignment.positionId,
        })) ?? [],
      roleId: user.roleId,
    });
    if (session) {
      setPreview(
        await apiRequest<CompanyUserEffectiveAccessRecord>(
          session,
          `/company/users/${user.id}/effective-access`,
        ),
      );
    }
    setUserModalOpened(true);
  };

  const setAreaIds = (ids: string[]) => {
    setForm((current) => ({
      ...current,
      areaAccess: ids.map((id) => ({
        accessLevel: current.areaAccess.find((access) => access.id === id)?.accessLevel ?? "VIEW",
        id,
      })),
    }));
  };

  const setBuildingIds = (ids: string[]) => {
    setForm((current) => ({
      ...current,
      buildingAccess: ids.map((id) => ({
        accessLevel:
          current.buildingAccess.find((access) => access.id === id)?.accessLevel ?? "VIEW",
        id,
      })),
    }));
  };

  const saveUser = async () => {
    if (!session || !form.roleId) return;
    const directPermissions = [
      ...form.directAllowIds.map((permissionId) => ({
        effect: "ALLOW" as PermissionEffect,
        permissionId,
      })),
      ...form.directDenyIds.map((permissionId) => ({
        effect: "DENY" as PermissionEffect,
        permissionId,
      })),
    ].filter((permission, index, permissions) => {
      return (
        permissions.findIndex((candidate) => candidate.permissionId === permission.permissionId) ===
        index
      );
    });
    const body = JSON.stringify({
      areaAccess: form.areaAccess.map(({ accessLevel, id }) => ({ accessLevel, areaId: id })),
      buildingAccess: form.buildingAccess.map(({ accessLevel, id }) => ({
        accessLevel,
        buildingId: id,
      })),
      directPermissions,
      email: form.email,
      isActive: form.isActive,
      name: form.name,
      password: form.password || undefined,
      phone: form.phone || undefined,
      roleId: form.roleId,
    });
    let userId = editingUser?.id;
    if (editingUser) {
      await apiRequest(session, `/company/users/${editingUser.id}`, { body, method: "PATCH" });
    } else {
      const created = await apiRequest<CompanyUserRecord>(session, "/company/users", {
        body,
        method: "POST",
      });
      userId = created.id;
    }
    if (userId) {
      await apiRequest(session, `/company/users/${userId}/positions`, {
        body: JSON.stringify({ assignments: form.positionAssignments }),
        method: "PATCH",
      });
    }
    setUserModalOpened(false);
    setEditingUser(null);
    setPreview(null);
    setForm(emptyUserForm);
    await load();
  };

  const deactivate = async (userId: string) => {
    if (!session) return;
    await apiRequest(session, `/company/users/${userId}`, { method: "DELETE" });
    await load();
  };

  const createPosition = async () => {
    if (!session) return;
    await apiRequest(session, "/company/positions", {
      body: JSON.stringify({ key: positionKey, name: positionName }),
      method: "POST",
    });
    setPositionKey("");
    setPositionName("");
    setPositionModalOpened(false);
    await load();
  };

  const deactivatePosition = async (positionId: string) => {
    if (!session) return;
    await apiRequest(session, `/company/positions/${positionId}`, { method: "DELETE" });
    await load();
  };

  if (!users && !error) return <LoadingState title={t("common.loading")} />;
  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;

  return (
    <Stack gap="lg">
      <PageHeader
        title={t("management.usersTitle")}
        subtitle={t("management.usersSubtitle")}
        action={
          <Group>
            <Can permission="company-users.manage">
              <Button
                leftSection={<IconShield size={16} />}
                onClick={() => setPositionModalOpened(true)}
                variant="light"
              >
                {t("management.positions")}
              </Button>
            </Can>
            <Can permission="company-users.create">
              <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
                {t("management.createUser")}
              </Button>
            </Can>
          </Group>
        }
      />
      {users?.length ? (
        <DataTable
          columns={[
            { key: "name", label: t("organizations.name"), render: (user) => user.name },
            { key: "email", label: t("management.email"), render: (user) => user.email },
            { key: "role", label: t("management.role"), render: (user) => user.role.name },
            {
              key: "status",
              label: t("organizations.status"),
              render: (user) => (user.isActive ? t("management.active") : t("management.inactive")),
            },
            {
              key: "scope",
              label: t("management.scope"),
              render: (user) =>
                tf("management.scopeSummary", {
                  areas: user.areaAccess?.length ?? 0,
                  buildings: user.buildingAccess?.length ?? 0,
                }),
            },
            {
              key: "action",
              label: t("organizations.actions"),
              render: (user) => (
                <Group gap="xs">
                  <Can permission="company-users.update">
                    <Button
                      leftSection={<IconEdit size={16} />}
                      onClick={() => void openEdit(user)}
                      size="xs"
                      variant="light"
                    >
                      {t("management.editUser")}
                    </Button>
                  </Can>
                  <Can permission="company-users.delete">
                    <Button
                      color="red"
                      disabled={!user.isActive}
                      leftSection={<IconTrash size={16} />}
                      onClick={() => void deactivate(user.id)}
                      size="xs"
                      variant="light"
                    >
                      {t("organizations.deactivate")}
                    </Button>
                  </Can>
                </Group>
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

      <Modal
        opened={userModalOpened}
        onClose={() => setUserModalOpened(false)}
        size="xl"
        title={editingUser ? t("management.editUser") : t("management.createUser")}
      >
        <FormWorkspace>
          <FormSection title={t("management.role")}>
            <FormFieldGrid>
              <TextInput
                label={t("organizations.name")}
                onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
                value={form.name}
              />
              <TextInput
                label={t("management.email")}
                onChange={(event) => setForm({ ...form, email: event.currentTarget.value })}
                value={form.email}
              />
              <TextInput
                label={t("management.phone")}
                onChange={(event) => setForm({ ...form, phone: event.currentTarget.value })}
                value={form.phone}
              />
              <TextInput
                label={t("management.password")}
                onChange={(event) => setForm({ ...form, password: event.currentTarget.value })}
                type="password"
                value={form.password}
              />
              <Select
                data={roleOptions}
                label={t("management.role")}
                onChange={(roleId) => setForm({ ...form, roleId })}
                value={form.roleId}
              />
              <Checkbox
                checked={form.isActive}
                label={t("management.active")}
                onChange={(event) => setForm({ ...form, isActive: event.currentTarget.checked })}
              />
            </FormFieldGrid>
          </FormSection>
          <FormSection title={t("management.directPermissions")}>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <MultiSelect
                data={permissionOptions.filter(
                  (permission) => !form.directDenyIds.includes(permission.value),
                )}
                label={t("management.directAllow")}
                onChange={(directAllowIds) => setForm({ ...form, directAllowIds })}
                searchable
                value={form.directAllowIds}
              />
              <MultiSelect
                data={permissionOptions.filter(
                  (permission) => !form.directAllowIds.includes(permission.value),
                )}
                label={t("management.directDeny")}
                onChange={(directDenyIds) => setForm({ ...form, directDenyIds })}
                searchable
                value={form.directDenyIds}
              />
            </SimpleGrid>
          </FormSection>
          <FormSection title={t("management.resourceScope")}>
            <MultiSelect
              data={areaOptions}
              label={t("management.siteAccess")}
              onChange={setAreaIds}
              searchable
              value={selectedAreaIds}
            />
            {form.areaAccess.map((access) => (
              <Select
                data={["VIEW", "MANAGE"]}
                key={access.id}
                label={areas.find((area) => area.id === access.id)?.name ?? t("organizations.area")}
                onChange={(accessLevel) =>
                  setForm({
                    ...form,
                    areaAccess: form.areaAccess.map((item) =>
                      item.id === access.id
                        ? { ...item, accessLevel: (accessLevel ?? "VIEW") as AccessLevel }
                        : item,
                    ),
                  })
                }
                value={access.accessLevel}
              />
            ))}
            <MultiSelect
              data={buildingOptions}
              label={t("management.buildingAccess")}
              onChange={setBuildingIds}
              searchable
              value={selectedBuildingIds}
            />
            {form.buildingAccess.map((access) => (
              <Select
                data={["VIEW", "MANAGE"]}
                key={access.id}
                label={
                  buildings.find((building) => building.id === access.id)?.title ??
                  t("organizations.building")
                }
                onChange={(accessLevel) =>
                  setForm({
                    ...form,
                    buildingAccess: form.buildingAccess.map((item) =>
                      item.id === access.id
                        ? { ...item, accessLevel: (accessLevel ?? "VIEW") as AccessLevel }
                        : item,
                    ),
                  })
                }
                value={access.accessLevel}
              />
            ))}
          </FormSection>
          <FormSection title={t("management.positionAssignments")}>
            {form.positionAssignments.map((assignment, index) => (
              <SimpleGrid cols={{ base: 1, md: 3 }} key={`${assignment.positionId}-${index}`}>
                <Select
                  data={positionOptions}
                  label={t("management.position")}
                  onChange={(positionId) =>
                    setForm({
                      ...form,
                      positionAssignments: form.positionAssignments.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, positionId: positionId ?? "" } : item,
                      ),
                    })
                  }
                  value={assignment.positionId}
                />
                <Select
                  clearable
                  data={areaOptions}
                  label={t("organizations.area")}
                  onChange={(areaId) =>
                    setForm({
                      ...form,
                      positionAssignments: form.positionAssignments.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, areaId } : item,
                      ),
                    })
                  }
                  value={assignment.areaId}
                />
                <Select
                  clearable
                  data={buildingOptions.filter((building) => {
                    const buildingRecord = buildings.find((item) => item.id === building.value);
                    return !assignment.areaId || buildingRecord?.areaId === assignment.areaId;
                  })}
                  label={t("organizations.building")}
                  onChange={(buildingId) =>
                    setForm({
                      ...form,
                      positionAssignments: form.positionAssignments.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, buildingId } : item,
                      ),
                    })
                  }
                  value={assignment.buildingId}
                />
              </SimpleGrid>
            ))}
            <Button
              onClick={() =>
                setForm({
                  ...form,
                  positionAssignments: [
                    ...form.positionAssignments,
                    { areaId: null, buildingId: null, positionId: positionOptions[0]?.value ?? "" },
                  ],
                })
              }
              variant="light"
            >
              {t("management.addPositionAssignment")}
            </Button>
          </FormSection>
          {preview ? (
            <Stack gap="xs">
              <Divider label={t("management.effectiveAccessPreview")} />
              <Text size="sm">
                {tf("management.previewPermissions", {
                  count: preview.effectivePermissions.length,
                })}
              </Text>
              <Group gap="xs">
                {preview.effectivePermissions.slice(0, 8).map((permission) => (
                  <Badge key={permission.id} variant="light">
                    {permission.key}
                  </Badge>
                ))}
              </Group>
              <Text size="sm">
                {tf("management.previewBuildings", {
                  direct: preview.assignedBuildings.length,
                  inherited: preview.inheritedBuildings.length,
                })}
              </Text>
            </Stack>
          ) : null}
          <StickyFormActions>
            <Button
              disabled={!form.name || !form.email || !form.roleId}
              onClick={() => void saveUser()}
            >
              {t("organizations.save")}
            </Button>
          </StickyFormActions>
        </FormWorkspace>
      </Modal>

      <Modal
        opened={positionModalOpened}
        onClose={() => setPositionModalOpened(false)}
        size="lg"
        title={t("management.positions")}
      >
        <Stack>
          <DataTable
            columns={[
              { key: "name", label: t("organizations.name"), render: (position) => position.name },
              { key: "key", label: t("management.roleKey"), render: (position) => position.key },
              {
                key: "status",
                label: t("organizations.status"),
                render: (position) =>
                  position.isActive ? t("management.active") : t("management.inactive"),
              },
              {
                key: "action",
                label: t("organizations.actions"),
                render: (position) => (
                  <Button
                    color="red"
                    disabled={!position.isActive}
                    onClick={() => void deactivatePosition(position.id)}
                    size="xs"
                    variant="light"
                  >
                    {t("organizations.deactivate")}
                  </Button>
                ),
              },
            ]}
            rows={positions}
          />
          <Divider label={t("management.createPosition")} />
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput
              label={t("management.roleKey")}
              onChange={(event) => setPositionKey(event.currentTarget.value)}
              value={positionKey}
            />
            <TextInput
              label={t("organizations.name")}
              onChange={(event) => setPositionName(event.currentTarget.value)}
              value={positionName}
            />
          </SimpleGrid>
          <Button disabled={!positionKey || !positionName} onClick={() => void createPosition()}>
            {t("management.createPosition")}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
