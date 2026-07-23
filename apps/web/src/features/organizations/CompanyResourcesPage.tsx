import type { AreaRecord, BuildingRecord } from "@gss-iot/contracts";
import { Can } from "../../shared/rbac/Can";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import {
  DataTable,
  DataToolbar,
  DataViewToggle,
  EmptyState,
  EntityActionMenu,
  EntityCard,
  EntityCardGrid,
  EntityMetric,
  EntityPrimaryCell,
  EntityStatusBadge,
  EntityStatusRow,
  ErrorState,
  LoadingState,
  ConfirmActionModal,
  ModalFormFooter,
  PageHeader,
} from "@gss-iot/ui";
import { Button, Group, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import { IconArrowUpRight, IconPlayerPause, IconPlugConnected } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { t } from "../../app/i18n";
import { hasPermission } from "../../shared/rbac/has-permission";

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
  const [pendingDeactivate, setPendingDeactivate] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const isAreas = resource === "areas";
  const createPermission = isAreas ? "areas.create" : "buildings.create";

  const load = async () => {
    if (!session) return;
    setError(false);
    try {
      const records = isAreas
        ? await apiRequest<AreaRecord[]>(session, "/company/areas")
        : await apiRequest<BuildingRecord[]>(session, "/company/buildings");
      setRows(records);
      if (!isAreas) setAreas(await apiRequest<AreaRecord[]>(session, "/company/areas"));
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    void load();
  }, [session, resource]);

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

  const deactivate = async (id: string) => {
    if (!session) return;
    setIsMutating(true);
    try {
      await apiRequest(session, `/company/${isAreas ? "areas" : "buildings"}/${id}`, {
        method: "DELETE",
      });
      await load();
    } finally {
      setIsMutating(false);
    }
  };

  const openPath = (id: string) => `/company/${isAreas ? "areas" : "buildings"}/${id}`;
  const monitoringPath = (id: string) => `/company/buildings/${id}/monitoring`;
  const nameFor = (row: AreaRecord | BuildingRecord) => ("name" in row ? row.name : row.title);
  const deletePermission = isAreas ? "areas.delete" : "buildings.delete";

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
      {rows?.length ? (
        <Stack gap="md">
          <DataToolbar>
            <Text c="dimmed" size="sm">
              {rows.length} {title}
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
                return (
                  <EntityCard
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
                          ...(hasPermission(session, deletePermission)
                            ? [
                                {
                                  color: "red" as const,
                                  destructive: true,
                                  icon: <IconPlayerPause size={16} />,
                                  key: "deactivate",
                                  label: t("organizations.deactivate"),
                                  onClick: () => setPendingDeactivate({ id: row.id, name }),
                                },
                              ]
                            : []),
                        ]}
                      />
                    }
                    description={detail ?? undefined}
                    eyebrow={
                      isAreas ? t("organizations.areasTitle") : t("organizations.buildingsTitle")
                    }
                    key={row.id}
                    onClick={() => navigate(openPath(row.id))}
                    title={name}
                  >
                    <EntityStatusRow
                      label={t("organizations.status")}
                      value={
                        <EntityStatusBadge
                          label={
                            row.status === "ACTIVE"
                              ? t("management.active")
                              : t("management.inactive")
                          }
                          status={row.status === "ACTIVE" ? "active" : "inactive"}
                        />
                      }
                    />
                    <Group gap="lg">
                      <EntityMetric
                        label={isAreas ? t("organizations.code") : t("devices.nodeNumber")}
                        value={identifier}
                      />
                    </Group>
                  </EntityCard>
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
                        ...(hasPermission(session, deletePermission)
                          ? [
                              {
                                color: "red" as const,
                                destructive: true,
                                icon: <IconPlayerPause size={16} />,
                                key: "deactivate",
                                label: t("organizations.deactivate"),
                                onClick: () =>
                                  setPendingDeactivate({ id: row.id, name: nameFor(row) }),
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
        confirmLabel={t("organizations.deactivate")}
        description={t("organizations.confirmDeactivateImpact")}
        entityName={pendingDeactivate?.name ?? ""}
        loading={isMutating}
        onClose={() => setPendingDeactivate(null)}
        onConfirm={() => {
          if (!pendingDeactivate) return;
          void deactivate(pendingDeactivate.id).finally(() => setPendingDeactivate(null));
        }}
        opened={Boolean(pendingDeactivate)}
        title={t("organizations.confirmDeactivateTitle")}
      />
    </Stack>
  );
}
