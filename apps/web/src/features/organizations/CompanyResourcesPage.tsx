import type { AreaRecord, BuildingRecord } from "@gss-iot/contracts";
import { Can } from "../../shared/rbac/Can";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { DataTable, EmptyState, ErrorState, LoadingState, PageHeader } from "@gss-iot/ui";
import { Button, Modal, Select, Stack, TextInput } from "@mantine/core";
import { IconPlugConnected } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { t } from "../../app/i18n";

export function CompanyResourcesPage({ resource }: { resource: "areas" | "buildings" }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Array<AreaRecord | BuildingRecord>>();
  const [areas, setAreas] = useState<AreaRecord[]>([]);
  const [error, setError] = useState(false);
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState("");
  const [areaId, setAreaId] = useState<string | null>(null);
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
    await apiRequest(session, `/company/${isAreas ? "areas" : "buildings"}/${id}`, {
      method: "DELETE",
    });
    await load();
  };

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
        <DataTable
          columns={[
            {
              key: "name",
              label: t("organizations.name"),
              render: (row) => ("name" in row ? row.name : row.title),
            },
            { key: "status", label: t("organizations.status"), render: (row) => row.status },
            {
              key: "actions",
              label: t("organizations.actions"),
              render: (row) => (
                <Stack gap={6}>
                  {!isAreas ? (
                    <Can permission="monitoring.view">
                      <Button
                        leftSection={<IconPlugConnected size={16} />}
                        onClick={() => navigate(`/company/buildings/${row.id}/monitoring`)}
                        size="xs"
                        variant="light"
                      >
                        {t("monitoring.open")}
                      </Button>
                    </Can>
                  ) : null}
                  <Can permission={isAreas ? "areas.delete" : "buildings.delete"}>
                    <Button
                      color="red"
                      onClick={() => void deactivate(row.id)}
                      size="xs"
                      variant="light"
                    >
                      {t("organizations.deactivate")}
                    </Button>
                  </Can>
                </Stack>
              ),
            },
          ]}
          rows={rows}
        />
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
          <Button disabled={!isAreas && !areaId} onClick={() => void create()}>
            {t("organizations.create")}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
