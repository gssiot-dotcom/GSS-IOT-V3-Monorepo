import type {
  AreaRecord,
  BuildingRecord,
  CollectionPageSize,
  PaginatedResponse,
} from "@gss-iot/contracts";
import { Can } from "../../shared/rbac/Can";
import { ApiError, apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import {
  DataTable,
  CollectionPagination,
  DataToolbar,
  DataViewToggle,
  EmptyState,
  EntityActionMenu,
  EntityCardGrid,
  EntityPrimaryCell,
  EntityStatusBadge,
  ErrorState,
  LoadingState,
  ConfirmActionModal,
  ModalFormFooter,
  PageHeader,
} from "@gss-iot/ui";
import { Alert, Button, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import {
  IconArrowUpRight,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlugConnected,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { t, tf } from "../../app/i18n";
import { hasPermission } from "../../shared/rbac/has-permission";
import { OrganizationResourceCard } from "./OrganizationResourceCard";

export function CompanyResourcesPage({ resource }: { resource: "areas" | "buildings" }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Array<AreaRecord | BuildingRecord>>();
  const [areas, setAreas] = useState<AreaRecord[]>([]);
  const [error, setError] = useState(false);
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState("");
  const [areaId, setAreaId] = useState<string | null>(null);
  const [view, setView] = useState("cards");
  const [pendingMutation, setPendingMutation] = useState<{
    action: "DELETE" | "STATUS";
    id: string;
    name: string;
    status?: "ACTIVE" | "INACTIVE";
  } | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<CollectionPageSize>(50);
  const [total, setTotal] = useState(0);
  const isAreas = resource === "areas";
  const createPermission = isAreas ? "areas.create" : "buildings.create";

  const load = async () => {
    if (!session) return;
    setError(false);
    try {
      const records = isAreas
        ? await apiRequest<PaginatedResponse<AreaRecord>>(
            session,
            `/company/areas?page=${page}&pageSize=${pageSize}`,
          )
        : await apiRequest<PaginatedResponse<BuildingRecord>>(
            session,
            `/company/buildings?page=${page}&pageSize=${pageSize}`,
          );
      setRows(records.items);
      setTotal(records.total);
      if (!isAreas) {
        const areaOptions = await apiRequest<PaginatedResponse<AreaRecord>>(
          session,
          "/company/areas?pageSize=100",
        );
        setAreas(areaOptions.items);
      }
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    void load();
  }, [session, resource, page, pageSize]);

  const create = async () => {
    if (!session) return;
    if (isAreas) {
      await apiRequest(session, "/company/areas", {
        body: JSON.stringify({ name }),
        method: "POST",
      });
    } else if (areaId) {
      await apiRequest(session, `/company/areas/${areaId}/buildings`, {
        body: JSON.stringify({ title: name }),
        method: "POST",
      });
    }
    setOpened(false);
    setName("");
    setAreaId(null);
    await load();
  };

  const mutateLifecycle = async () => {
    if (!session || !pendingMutation || isMutating) return;
    setIsMutating(true);
    setMutationError(undefined);
    try {
      const base = `/company/${isAreas ? "areas" : "buildings"}/${pendingMutation.id}`;
      await apiRequest(
        session,
        pendingMutation.action === "DELETE" ? base : `${base}/status`,
        pendingMutation.action === "DELETE"
          ? { method: "DELETE" }
          : {
              body: JSON.stringify({ status: pendingMutation.status }),
              method: "PATCH",
            },
      );
      await load();
      setPendingMutation(null);
    } catch (error) {
      setMutationError(error instanceof ApiError ? error.message : t("common.errorDescription"));
    } finally {
      setIsMutating(false);
    }
  };

  const openPath = (id: string) => `/company/${isAreas ? "areas" : "buildings"}/${id}`;
  const monitoringPath = (id: string) => `/company/buildings/${id}/monitoring`;
  const nameFor = (row: AreaRecord | BuildingRecord) => ("name" in row ? row.name : row.title);
  const deletePermission = isAreas ? "areas.delete" : "buildings.delete";
  const updatePermission = isAreas ? "areas.update" : "buildings.update";

  if (!rows && !error) return <LoadingState title={t("common.loading")} />;
  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;

  const title = isAreas ? t("organizations.areasTitle") : t("organizations.buildingsTitle");
  return (
    <Stack gap="lg">
      <PageHeader
        title={title}
        subtitle={t("organizations.scopedSubtitle")}
        action={
          <Can permission={createPermission}>
            <Button onClick={() => setOpened(true)}>{t("organizations.create")}</Button>
          </Can>
        }
      />
      {mutationError ? <Alert color="red">{mutationError}</Alert> : null}
      {rows?.length ? (
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
              {total} {title}
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
              {rows.map((row) => {
                const name = "name" in row ? row.name : row.title;
                const detail =
                  "name" in row
                    ? (row.address ?? row.description)
                    : (row.address ?? row.buildingType);
                const identifier = "name" in row ? row.id.slice(0, 8) : (row.number ?? "-");
                const parent =
                  "name" in row ? undefined : areas.find((area) => area.id === row.areaId)?.name;
                return (
                  <OrganizationResourceCard
                    action={
                      <EntityActionMenu
                        ariaLabel={`${t("common.moreActions")}: ${name}`}
                        items={[
                          {
                            icon: <IconArrowUpRight size={16} />,
                            key: "open",
                            label: t("organizations.open"),
                            onClick: () => navigate(openPath(row.id)),
                          },
                          ...(hasPermission(session, updatePermission)
                            ? [
                                {
                                  icon:
                                    row.status === "ACTIVE" ? (
                                      <IconPlayerPause size={16} />
                                    ) : (
                                      <IconPlayerPlay size={16} />
                                    ),
                                  key: "status",
                                  label: t(
                                    row.status === "ACTIVE"
                                      ? "organizations.deactivate"
                                      : "organizations.activate",
                                  ),
                                  onClick: () =>
                                    setPendingMutation({
                                      action: "STATUS",
                                      id: row.id,
                                      name,
                                      status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                                    }),
                                },
                              ]
                            : []),
                          ...(hasPermission(session, deletePermission)
                            ? [
                                {
                                  color: "red" as const,
                                  destructive: true,
                                  disabled: !row.deletion?.allowed,
                                  disabledReason: row.deletion?.blocker ?? undefined,
                                  icon: <IconTrash size={16} />,
                                  key: "delete",
                                  label: t("organizations.delete"),
                                  onClick: () =>
                                    setPendingMutation({ action: "DELETE", id: row.id, name }),
                                },
                              ]
                            : []),
                        ]}
                      />
                    }
                    description={detail ?? undefined}
                    footer={
                      !isAreas && hasPermission(session, "monitoring.view") ? (
                        <Button
                          fullWidth
                          leftSection={<IconPlugConnected size={16} />}
                          onClick={() => navigate(monitoringPath(row.id))}
                          size="xs"
                          variant="light"
                        >
                          {t("monitoring.open")}
                        </Button>
                      ) : undefined
                    }
                    identifier={identifier}
                    key={row.id}
                    kind={isAreas ? "site" : "building"}
                    kindLabel={isAreas ? t("organizations.area") : t("organizations.building")}
                    onClick={() => navigate(openPath(row.id))}
                    parent={parent}
                    status={row.status}
                    statusLabel={
                      row.status === "ACTIVE" ? t("management.active") : t("management.inactive")
                    }
                    title={name}
                  />
                );
              })}
            </EntityCardGrid>
          ) : (
            <DataTable
              ariaLabel={title}
              columns={[
                {
                  key: "name",
                  label: t("organizations.name"),
                  render: (row) => (
                    <EntityPrimaryCell
                      identifier={"name" in row ? row.id.slice(0, 8) : (row.number ?? "-")}
                      onClick={() => navigate(openPath(row.id))}
                      title={nameFor(row)}
                    />
                  ),
                },
                {
                  key: "status",
                  label: t("organizations.status"),
                  render: (row) => (
                    <EntityStatusBadge
                      label={
                        row.status === "ACTIVE" ? t("management.active") : t("management.inactive")
                      }
                      status={row.status === "ACTIVE" ? "active" : "inactive"}
                    />
                  ),
                },
                {
                  key: "meta",
                  label: isAreas ? t("organizations.address") : t("organizations.area"),
                  render: (row) =>
                    "name" in row
                      ? (row.address ?? row.description ?? "-")
                      : (row.number ?? row.address ?? "-"),
                },
                {
                  key: "actions",
                  label: t("organizations.actions"),
                  align: "right",
                  render: (row) => (
                    <EntityActionMenu
                      ariaLabel={`${t("common.moreActions")}: ${nameFor(row)}`}
                      items={[
                        {
                          icon: <IconArrowUpRight size={16} />,
                          key: "open",
                          label: t("organizations.open"),
                          onClick: () => navigate(openPath(row.id)),
                        },
                        ...(!isAreas && hasPermission(session, "monitoring.view")
                          ? [
                              {
                                icon: <IconPlugConnected size={16} />,
                                key: "monitoring",
                                label: t("monitoring.open"),
                                onClick: () => navigate(monitoringPath(row.id)),
                              },
                            ]
                          : []),
                        ...(hasPermission(session, updatePermission)
                          ? [
                              {
                                icon:
                                  row.status === "ACTIVE" ? (
                                    <IconPlayerPause size={16} />
                                  ) : (
                                    <IconPlayerPlay size={16} />
                                  ),
                                key: "status",
                                label: t(
                                  row.status === "ACTIVE"
                                    ? "organizations.deactivate"
                                    : "organizations.activate",
                                ),
                                onClick: () =>
                                  setPendingMutation({
                                    action: "STATUS",
                                    id: row.id,
                                    name: nameFor(row),
                                    status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                                  }),
                              },
                            ]
                          : []),
                        ...(hasPermission(session, deletePermission)
                          ? [
                              {
                                color: "red" as const,
                                destructive: true,
                                disabled: !row.deletion?.allowed,
                                disabledReason: row.deletion?.blocker ?? undefined,
                                icon: <IconTrash size={16} />,
                                key: "delete",
                                label: t("organizations.delete"),
                                onClick: () =>
                                  setPendingMutation({
                                    action: "DELETE",
                                    id: row.id,
                                    name: nameFor(row),
                                  }),
                              },
                            ]
                          : []),
                      ]}
                    />
                  ),
                },
              ]}
              onRowClick={(row) => navigate(openPath(row.id))}
              rows={rows}
            />
          )}
        </Stack>
      ) : (
        <EmptyState
          description={t("organizations.emptyScopedDescription")}
          title={t("common.emptyTitle")}
        />
      )}
      <Modal opened={opened} onClose={() => setOpened(false)} title={t("organizations.create")}>
        <Stack>
          <TextInput
            label={t("organizations.name")}
            onChange={(event) => setName(event.currentTarget.value)}
            value={name}
          />
          {!isAreas ? (
            <Select
              data={areas.map((area) => ({ label: area.name, value: area.id }))}
              label={t("organizations.area")}
              onChange={setAreaId}
              value={areaId}
            />
          ) : null}
          <ModalFormFooter
            cancelLabel={t("common.cancel")}
            onCancel={() => setOpened(false)}
            onSubmit={() => void create()}
            submitDisabled={!name.trim() || (!isAreas && !areaId)}
            submitLabel={t("organizations.create")}
          />
        </Stack>
      </Modal>
      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t(
          pendingMutation?.action === "DELETE"
            ? "organizations.delete"
            : pendingMutation?.status === "ACTIVE"
              ? "organizations.activate"
              : "organizations.deactivate",
        )}
        description={t(
          pendingMutation?.action === "DELETE"
            ? "organizations.confirmPermanentDeleteImpact"
            : pendingMutation?.status === "ACTIVE"
              ? "organizations.confirmActivateImpact"
              : "organizations.confirmDeactivateImpact",
        )}
        entityName={pendingMutation?.name ?? ""}
        loading={isMutating}
        onClose={() => {
          if (!isMutating) setPendingMutation(null);
        }}
        onConfirm={() => void mutateLifecycle()}
        opened={Boolean(pendingMutation)}
        title={t(
          pendingMutation?.action === "DELETE"
            ? "organizations.confirmDeleteTitle"
            : pendingMutation?.status === "ACTIVE"
              ? "organizations.confirmActivateTitle"
              : "organizations.confirmDeactivateTitle",
        )}
      />
    </Stack>
  );
}
