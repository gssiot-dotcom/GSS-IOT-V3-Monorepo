import type { CollectionPageSize, CompanyRecord, PaginatedResponse } from "@gss-iot/contracts";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { Can } from "../../shared/rbac/Can";
import { ApiError } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import {
  DataTable,
  CollectionPagination,
  ConfirmActionModal,
  DataToolbar,
  DataViewToggle,
  EmptyState,
  EntityActionMenu,
  EntityCardGrid,
  EntityPrimaryCell,
  EntityStatusBadge,
  ErrorState,
  LoadingState,
  ModalFormFooter,
  PageHeader,
} from "@gss-iot/ui";
import { Alert, Button, Modal, Stack, Text, TextInput } from "@mantine/core";
import {
  IconArrowUpRight,
  IconEdit,
  IconPlayerPause,
  IconPlayerPlay,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { t, tf } from "../../app/i18n";
import { hasPermission } from "../../shared/rbac/has-permission";
import { useApiMutation, useApiQuery } from "../../shared/query/api-query";
import { queryKeys } from "../../shared/query/query-keys";
import { useCollectionSearchParams } from "../../shared/url/collection-search-params";
import { CompanyIdentityCard } from "./CompanyIdentityCard";

export function CompaniesPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [formError, setFormError] = useState<string>();
  const [view, setView] = useState("cards");
  const { page, pageSize, setPage, setPageSize } = useCollectionSearchParams();
  const [editTarget, setEditTarget] = useState<CompanyRecord>();
  const [editForm, setEditForm] = useState({
    address: "",
    code: "",
    email: "",
    name: "",
    phone: "",
  });
  const [statusTarget, setStatusTarget] = useState<CompanyRecord>();
  const [deleteTarget, setDeleteTarget] = useState<CompanyRecord>();
  const [mutationError, setMutationError] = useState<string>();

  const userId = session?.user.id ?? "anonymous";
  const companiesKey = queryKeys.admin.companies(userId, { page, pageSize });
  const companiesQuery = useApiQuery<PaginatedResponse<CompanyRecord>>(
    session,
    companiesKey,
    `/admin/companies?page=${page}&pageSize=${pageSize}`,
    { placeholderData: keepPreviousData },
  );
  const companies = companiesQuery.data?.items;
  const total = companiesQuery.data?.total ?? 0;
  const mutation = useApiMutation(session, {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.companiesRoot(userId) });
    },
  });
  const isSaving = mutation.isPending;

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
    try {
      await mutation.mutateAsync({
        path: "/admin/companies",
        options: {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            platformManager: {
              email: managerEmail.trim(),
              name: managerName.trim(),
              password: managerPassword,
            },
          }),
        },
      });
      setOpened(false);
      setName("");
      setManagerName("");
      setManagerEmail("");
      setManagerPassword("");
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.status === 409
          ? t("organizations.duplicateFeedback")
          : t("common.errorDescription"),
      );
    } finally {
      mutation.reset();
    }
  };

  const openEdit = (company: CompanyRecord) => {
    setMutationError(undefined);
    setEditTarget(company);
    setEditForm({
      address: company.address ?? "",
      code: company.code ?? "",
      email: company.email ?? "",
      name: company.name,
      phone: company.phone ?? "",
    });
  };

  const saveEdit = async () => {
    if (!session || !editTarget || !editForm.name.trim() || isSaving) return;
    setMutationError(undefined);
    try {
      await mutation.mutateAsync({
        path: `/admin/companies/${editTarget.id}`,
        options: {
          body: JSON.stringify({
            address: editForm.address.trim() || undefined,
            code: editForm.code.trim() || undefined,
            email: editForm.email.trim() || undefined,
            name: editForm.name.trim(),
            phone: editForm.phone.trim() || undefined,
          }),
          method: "PATCH",
        },
      });
      setEditTarget(undefined);
    } catch (error) {
      setMutationError(error instanceof ApiError ? error.message : t("common.errorDescription"));
    } finally {
      mutation.reset();
    }
  };

  const changeStatus = async () => {
    if (!session || !statusTarget || isSaving) return;
    setMutationError(undefined);
    try {
      await mutation.mutateAsync({
        path: `/admin/companies/${statusTarget.id}/status`,
        options: {
          body: JSON.stringify({
            status: statusTarget.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
          }),
          method: "PATCH",
        },
      });
      setStatusTarget(undefined);
    } catch (error) {
      setMutationError(error instanceof ApiError ? error.message : t("common.errorDescription"));
    } finally {
      mutation.reset();
    }
  };

  const remove = async () => {
    if (!session || !deleteTarget || isSaving) return;
    setMutationError(undefined);
    try {
      await mutation.mutateAsync({
        path: `/admin/companies/${deleteTarget.id}`,
        options: { method: "DELETE" },
      });
      setDeleteTarget(undefined);
    } catch (error) {
      setMutationError(error instanceof ApiError ? error.message : t("common.errorDescription"));
    } finally {
      mutation.reset();
    }
  };

  const companyActions = (company: CompanyRecord) => [
    {
      icon: <IconArrowUpRight size={16} />,
      key: "open",
      label: t("organizations.openCompany"),
      onClick: () => void navigate(`/admin/companies/${company.id}`),
    },
    ...(hasPermission(session, "companies.update")
      ? [
          {
            icon: <IconEdit size={16} />,
            key: "edit",
            label: t("organizations.edit"),
            onClick: () => openEdit(company),
          },
          {
            icon:
              company.status === "ACTIVE" ? (
                <IconPlayerPause size={16} />
              ) : (
                <IconPlayerPlay size={16} />
              ),
            key: "status",
            label: t(
              company.status === "ACTIVE" ? "organizations.deactivate" : "organizations.activate",
            ),
            onClick: () => setStatusTarget(company),
          },
        ]
      : []),
    ...(hasPermission(session, "companies.delete")
      ? [
          {
            color: "red" as const,
            destructive: true,
            disabled: company.deletion?.allowed !== true,
            disabledReason: company.deletion?.blocker ?? undefined,
            icon: <IconTrash size={16} />,
            key: "delete",
            label: t("organizations.delete"),
            onClick: () => setDeleteTarget(company),
          },
        ]
      : []),
  ];

  if (companiesQuery.isPending) return <LoadingState title={t("common.loading")} />;
  if (companiesQuery.isError)
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
      {mutationError ? (
        <Alert color="red" title={t("organizations.actionFailed")}>
          {mutationError}
        </Alert>
      ) : null}
      {companies?.length ? (
        <Stack gap="md">
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
            <Text c="dimmed" size="sm">
              {total} {t("organizations.companiesTitle")}
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
                <CompanyIdentityCard
                  action={
                    <EntityActionMenu
                      ariaLabel={`${t("common.moreActions")}: ${company.name}`}
                      items={companyActions(company)}
                    />
                  }
                  company={company}
                  key={company.id}
                  onOpen={() => void navigate(`/admin/companies/${company.id}`)}
                  status={
                    <EntityStatusBadge
                      label={
                        company.status === "ACTIVE"
                          ? t("management.active")
                          : t("management.inactive")
                      }
                      status={company.status === "ACTIVE" ? "active" : "inactive"}
                    />
                  }
                />
              ))}
            </EntityCardGrid>
          ) : (
            <DataTable
              ariaLabel={t("organizations.companiesTitle")}
              columns={[
                {
                  key: "name",
                  label: t("organizations.name"),
                  render: (company) => (
                    <EntityPrimaryCell
                      identifier={company.code ?? t("organizations.noCode")}
                      onClick={() => void navigate(`/admin/companies/${company.id}`)}
                      title={company.name}
                    />
                  ),
                },
                {
                  key: "code",
                  label: t("organizations.code"),
                  render: (company) => company.code ?? "-",
                },
                {
                  key: "status",
                  label: t("organizations.status"),
                  render: (company) => (
                    <EntityStatusBadge
                      label={
                        company.status === "ACTIVE"
                          ? t("management.active")
                          : t("management.inactive")
                      }
                      status={company.status === "ACTIVE" ? "active" : "inactive"}
                    />
                  ),
                },
                {
                  key: "actions",
                  label: t("organizations.actions"),
                  align: "right",
                  render: (company) => (
                    <EntityActionMenu
                      ariaLabel={`${t("common.moreActions")}: ${company.name}`}
                      items={companyActions(company)}
                    />
                  ),
                },
              ]}
              onRowClick={(company) => void navigate(`/admin/companies/${company.id}`)}
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
        size="md"
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
          <ModalFormFooter
            cancelLabel={t("common.cancel")}
            onCancel={() => {
              setOpened(false);
              setFormError(undefined);
            }}
            onSubmit={() => void create()}
            submitDisabled={
              !name.trim() || !managerName.trim() || !managerEmail.trim() || !managerPassword
            }
            submitLabel={t("organizations.createCompany")}
            submitLoading={isSaving}
          />
        </Stack>
      </Modal>
      <Modal
        onClose={() => !isSaving && setEditTarget(undefined)}
        opened={Boolean(editTarget)}
        title={t("organizations.editCompany")}
      >
        <Stack>
          <TextInput
            label={t("organizations.name")}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setEditForm((current) => ({ ...current, name: nextValue }));
            }}
            required
            value={editForm.name}
          />
          <TextInput
            label={t("organizations.code")}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setEditForm((current) => ({ ...current, code: nextValue }));
            }}
            value={editForm.code}
          />
          <TextInput
            label={t("organizations.managerEmail")}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setEditForm((current) => ({ ...current, email: nextValue }));
            }}
            type="email"
            value={editForm.email}
          />
          <TextInput
            label={t("organizations.phone")}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setEditForm((current) => ({ ...current, phone: nextValue }));
            }}
            value={editForm.phone}
          />
          <TextInput
            label={t("organizations.address")}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setEditForm((current) => ({ ...current, address: nextValue }));
            }}
            value={editForm.address}
          />
          <ModalFormFooter
            cancelLabel={t("common.cancel")}
            onCancel={() => setEditTarget(undefined)}
            onSubmit={() => void saveEdit()}
            submitDisabled={!editForm.name.trim()}
            submitLabel={t("organizations.save")}
            submitLoading={isSaving}
          />
        </Stack>
      </Modal>
      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t(
          statusTarget?.status === "ACTIVE" ? "organizations.deactivate" : "organizations.activate",
        )}
        description={t(
          statusTarget?.status === "ACTIVE"
            ? "organizations.confirmDeactivateImpact"
            : "organizations.confirmActivateImpact",
        )}
        entityName={statusTarget?.name ?? ""}
        loading={isSaving}
        onClose={() => !isSaving && setStatusTarget(undefined)}
        onConfirm={() => void changeStatus()}
        opened={Boolean(statusTarget)}
        title={t(
          statusTarget?.status === "ACTIVE"
            ? "organizations.confirmDeactivateTitle"
            : "organizations.confirmActivateTitle",
        )}
      />
      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t("organizations.delete")}
        description={t("organizations.confirmDeleteCompanyImpact")}
        entityName={deleteTarget?.name ?? ""}
        loading={isSaving}
        onClose={() => !isSaving && setDeleteTarget(undefined)}
        onConfirm={() => void remove()}
        opened={Boolean(deleteTarget)}
        title={t("organizations.confirmDeleteCompanyTitle")}
      />
    </Stack>
  );
}
