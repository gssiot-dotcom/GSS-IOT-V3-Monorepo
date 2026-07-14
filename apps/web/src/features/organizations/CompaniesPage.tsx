import type { CompanyRecord } from "@gss-iot/contracts";
import { Can } from "../../shared/rbac/Can";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { DataTable, EmptyState, ErrorState, LoadingState, PageHeader } from "@gss-iot/ui";
import { Button, Modal, Stack, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { t } from "../../app/i18n";

export function CompaniesPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyRecord[]>();
  const [error, setError] = useState(false);
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");

  const load = async () => {
    if (!session) return;
    setError(false);
    try {
      setCompanies(await apiRequest<CompanyRecord[]>(session, "/admin/companies"));
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    void load();
  }, [session]);

  const create = async () => {
    if (!session) return;
    await apiRequest(session, "/admin/companies", {
      method: "POST",
      body: JSON.stringify({
        name,
        platformManager: { email: managerEmail, name: managerName, password: managerPassword },
      }),
    });
    setOpened(false);
    setName("");
    setManagerName("");
    setManagerEmail("");
    setManagerPassword("");
    await load();
  };

  if (!companies && !error) return <LoadingState title={t("common.loading")} />;
  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;

  return (
    <Stack gap="lg">
      <PageHeader
        title={t("organizations.companiesTitle")}
        subtitle={t("organizations.companiesSubtitle")}
        action={
          <Can permission="companies.create">
            <Button onClick={() => setOpened(true)}>{t("organizations.createCompany")}</Button>
          </Can>
        }
      />
      {companies?.length ? (
        <DataTable
          columns={[
            { key: "name", label: t("organizations.name"), render: (company) => company.name },
            {
              key: "code",
              label: t("organizations.code"),
              render: (company) => company.code ?? "-",
            },
            {
              key: "status",
              label: t("organizations.status"),
              render: (company) => company.status,
            },
            {
              key: "open",
              label: t("organizations.actions"),
              render: (company) => (
                <Button
                  onClick={() => void navigate(`/admin/companies/${company.id}`)}
                  size="xs"
                  variant="light"
                >
                  {t("organizations.open")}
                </Button>
              ),
            },
          ]}
          rows={companies}
        />
      ) : (
        <EmptyState
          description={t("organizations.emptyCompaniesDescription")}
          title={t("common.emptyTitle")}
        />
      )}
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={t("organizations.createCompany")}
      >
        <Stack>
          <TextInput
            label={t("organizations.name")}
            onChange={(event) => setName(event.currentTarget.value)}
            value={name}
          />
          <TextInput
            label={t("organizations.managerName")}
            onChange={(event) => setManagerName(event.currentTarget.value)}
            value={managerName}
          />
          <TextInput
            label={t("organizations.managerEmail")}
            onChange={(event) => setManagerEmail(event.currentTarget.value)}
            value={managerEmail}
          />
          <TextInput
            label={t("organizations.managerPassword")}
            onChange={(event) => setManagerPassword(event.currentTarget.value)}
            type="password"
            value={managerPassword}
          />
          <Button onClick={() => void create()}>{t("organizations.createCompany")}</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
