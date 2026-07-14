import type { CompanyRoleRecord } from "@gss-iot/contracts";
import { Can } from "../../shared/rbac/Can";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { DataTable, EmptyState, ErrorState, LoadingState, PageHeader } from "@gss-iot/ui";
import { Button, Modal, Stack, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";

import { t } from "../../app/i18n";

export function CompanyRolesPage() {
  const { session } = useAuth();
  const [roles, setRoles] = useState<CompanyRoleRecord[]>();
  const [error, setError] = useState(false);
  const [opened, setOpened] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const load = async () => {
    if (!session) return;
    setError(false);
    try {
      setRoles(await apiRequest<CompanyRoleRecord[]>(session, "/company/roles"));
    } catch {
      setError(true);
    }
  };
  useEffect(() => {
    void load();
  }, [session]);
  const create = async () => {
    if (!session) return;
    await apiRequest(session, "/company/roles", {
      body: JSON.stringify({ key, name, permissionIds: [] }),
      method: "POST",
    });
    setOpened(false);
    setKey("");
    setName("");
    await load();
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
            <Button onClick={() => setOpened(true)}>{t("management.createRole")}</Button>
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
          ]}
          rows={roles}
        />
      ) : (
        <EmptyState
          description={t("management.emptyRolesDescription")}
          title={t("common.emptyTitle")}
        />
      )}
      <Modal opened={opened} onClose={() => setOpened(false)} title={t("management.createRole")}>
        <Stack>
          <TextInput
            label={t("management.roleKey")}
            onChange={(event) => setKey(event.currentTarget.value)}
            value={key}
          />
          <TextInput
            label={t("organizations.name")}
            onChange={(event) => setName(event.currentTarget.value)}
            value={name}
          />
          <Button onClick={() => void create()}>{t("management.createRole")}</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
