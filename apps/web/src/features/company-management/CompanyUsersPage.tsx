import type { CompanyRoleRecord, CompanyUserRecord } from "@gss-iot/contracts";
import { Can } from "../../shared/rbac/Can";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { DataTable, EmptyState, ErrorState, LoadingState, PageHeader } from "@gss-iot/ui";
import { Button, Modal, Select, Stack, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";

import { t } from "../../app/i18n";

export function CompanyUsersPage() {
  const { session } = useAuth();
  const [users, setUsers] = useState<CompanyUserRecord[]>();
  const [roles, setRoles] = useState<CompanyRoleRecord[]>([]);
  const [error, setError] = useState(false);
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState<string | null>(null);

  const load = async () => {
    if (!session) return;
    setError(false);
    try {
      const [nextUsers, nextRoles] = await Promise.all([
        apiRequest<CompanyUserRecord[]>(session, "/company/users"),
        apiRequest<CompanyRoleRecord[]>(session, "/company/roles"),
      ]);
      setUsers(nextUsers);
      setRoles(nextRoles);
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    void load();
  }, [session]);

  const create = async () => {
    if (!session || !roleId) return;
    await apiRequest(session, "/company/users", {
      body: JSON.stringify({ email, name, password, roleId }),
      method: "POST",
    });
    setOpened(false);
    setName("");
    setEmail("");
    setPassword("");
    setRoleId(null);
    await load();
  };

  const deactivate = async (userId: string) => {
    if (!session) return;
    await apiRequest(session, `/company/users/${userId}`, { method: "DELETE" });
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
          <Can permission="company-users.create">
            <Button onClick={() => setOpened(true)}>{t("management.createUser")}</Button>
          </Can>
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
              key: "action",
              label: t("organizations.actions"),
              render: (user) => (
                <Can permission="company-users.delete">
                  <Button
                    color="red"
                    disabled={!user.isActive}
                    onClick={() => void deactivate(user.id)}
                    size="xs"
                    variant="light"
                  >
                    {t("organizations.deactivate")}
                  </Button>
                </Can>
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
      <Modal opened={opened} onClose={() => setOpened(false)} title={t("management.createUser")}>
        <Stack>
          <TextInput
            label={t("organizations.name")}
            onChange={(event) => setName(event.currentTarget.value)}
            value={name}
          />
          <TextInput
            label={t("management.email")}
            onChange={(event) => setEmail(event.currentTarget.value)}
            value={email}
          />
          <TextInput
            label={t("management.password")}
            onChange={(event) => setPassword(event.currentTarget.value)}
            type="password"
            value={password}
          />
          <Select
            data={roles.map((role) => ({ label: role.name, value: role.id }))}
            label={t("management.role")}
            onChange={setRoleId}
            value={roleId}
          />
          <Button disabled={!roleId} onClick={() => void create()}>
            {t("management.createUser")}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
