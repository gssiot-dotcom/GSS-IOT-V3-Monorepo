import type { CompanyRecord } from "@gss-iot/contracts";
import { Can } from "../../shared/rbac/Can";
import { ApiError, apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import {
  DataTable,
  DataToolbar,
  DataViewToggle,
  EmptyState,
  EntityCard,
  EntityCardGrid,
  EntityMetric,
  EntityStatusRow,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@gss-iot/ui";
import { Alert, Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
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
  const [formError, setFormError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [view, setView] = useState("cards");

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
    if (!name.trim() || !managerName.trim() || !managerEmail.trim() || !managerPassword) {
      setFormError(t("organizations.validationRequired"));
      return;
    }
    if (companies?.some((company) => company.name.toLowerCase() === name.trim().toLowerCase())) {
      setFormError(t("organizations.duplicateFeedback"));
      return;
    }
    setFormError(undefined);
    setIsSaving(true);
    try {
      await apiRequest(session, "/admin/companies", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          platformManager: {
            email: managerEmail.trim(),
            name: managerName.trim(),
            password: managerPassword,
          },
        }),
      });
      setOpened(false);
      setName("");
      setManagerName("");
      setManagerEmail("");
      setManagerPassword("");
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
        <Stack gap="md">
          <DataToolbar>
            <Text c="dimmed" size="sm">
              {companies.length} {t("organizations.companiesTitle")}
            </Text>
            <DataViewToggle
              data={[
                { label: t("common.cardView"), value: "cards" },
                { label: t("common.tableView"), value: "table" },
              ]}
              onChange={setView}
              value={view}
            />
          </DataToolbar>
          {view === "cards" ? (
            <EntityCardGrid>
              {companies.map((company) => (
                <EntityCard
                  action={
                    <Button
                      onClick={() => void navigate(`/admin/companies/${company.id}`)}
                      size="xs"
                      variant="light"
                    >
                      {t("organizations.open")}
                    </Button>
                  }
                  description={company.address ?? company.email ?? undefined}
                  eyebrow={company.code ?? t("organizations.companiesTitle")}
                  key={company.id}
                  title={company.name}
                >
                  <EntityStatusRow
                    color={company.status === "ACTIVE" ? "green" : "gray"}
                    label={t("organizations.status")}
                    value={company.status}
                  />
                  <Group gap="lg">
                    <EntityMetric
                      label={t("organizations.managerEmail")}
                      value={company.email ?? "-"}
                    />
                    <EntityMetric label={t("organizations.phone")} value={company.phone ?? "-"} />
                  </Group>
                </EntityCard>
              ))}
            </EntityCardGrid>
          ) : (
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
          )}
        </Stack>
      ) : (
        <EmptyState
          description={t("organizations.emptyCompaniesDescription")}
          title={t("common.emptyTitle")}
        />
      )}
      <Modal
        opened={opened}
        onClose={() => {
          setOpened(false);
          setFormError(undefined);
        }}
        title={t("organizations.createCompany")}
      >
        <Stack>
          {formError ? <Alert color="red">{formError}</Alert> : null}
          <TextInput
            label={t("organizations.name")}
            onChange={(event) => setName(event.currentTarget.value)}
            required
            value={name}
          />
          <TextInput
            label={t("organizations.managerName")}
            onChange={(event) => setManagerName(event.currentTarget.value)}
            required
            value={managerName}
          />
          <TextInput
            label={t("organizations.managerEmail")}
            onChange={(event) => setManagerEmail(event.currentTarget.value)}
            required
            type="email"
            value={managerEmail}
          />
          <TextInput
            label={t("organizations.managerPassword")}
            onChange={(event) => setManagerPassword(event.currentTarget.value)}
            required
            type="password"
            value={managerPassword}
          />
          <Button loading={isSaving} onClick={() => void create()}>
            {t("organizations.createCompany")}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
