import type { AreaOverviewResponse, BuildingOverviewResponse } from "@gss-iot/contracts";
import { Can } from "../../shared/rbac/Can";
import { ApiError, apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import {
  DashboardKpiCard,
  DashboardSection,
  EntityActionMenu,
  EntityCard,
  EntityCardGrid,
  EntityMetric,
  EntityStatusBadge,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  ModalFormFooter,
  PageHeader,
} from "@gss-iot/ui";
import { Badge, Button, Group, Modal, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import {
  IconBuilding,
  IconChartBar,
  IconEdit,
  IconMap,
  IconRouter,
  IconUsers,
  IconVector,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { formatDateTime, t, tf, tx } from "../../app/i18n";
import { hasPermission } from "../../shared/rbac/has-permission";
import { BuildingImageManager } from "./BuildingImageManager";

function accessSourceLabel(source: "AREA" | "BUILDING" | "COMPANY") {
  if (source === "AREA") return t("organizations.accessSourceArea");
  if (source === "BUILDING") return t("organizations.accessSourceBuilding");
  return t("organizations.accessSourceCompany");
}

export function CompanyAreaDetailPage() {
  const { areaId } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AreaOverviewResponse>();
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState("");

  const load = async () => {
    if (!session || !areaId) return;
    setErrorStatus(null);
    try {
      const response = await apiRequest<AreaOverviewResponse>(
        session,
        `/company/areas/${areaId}/overview`,
      );
      setOverview(response);
      setName(response.area.name);
    } catch (error) {
      setErrorStatus(error instanceof ApiError ? error.status : 500);
    }
  };

  useEffect(() => {
    void load();
  }, [session, areaId]);

  const save = async () => {
    if (!session || !areaId) return;
    await apiRequest(session, `/company/areas/${areaId}`, {
      body: JSON.stringify({ name }),
      method: "PATCH",
    });
    setOpened(false);
    await load();
  };

  if (!overview && !errorStatus) return <LoadingState title={t("common.loading")} />;
  if (errorStatus === 403)
    return (
      <ForbiddenState description={t("common.pageUnavailable")} title={t("common.forbidden")} />
    );
  if (errorStatus === 404)
    return (
      <ErrorState description={t("common.notFoundDescription")} title={t("common.notFoundTitle")} />
    );
  if (errorStatus)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;
  if (!overview) return null;
  const { area } = overview;
  const metricValue = (value: number | null) => value ?? t("common.notAvailable");

  return (
    <Stack gap="lg">
      <PageHeader
        eyebrow={t("organizations.areaDetail")}
        meta={
          <Text c="dimmed" size="sm">
            {area.address ?? t("organizations.noAddress")}
          </Text>
        }
        status={
          <EntityStatusBadge
            label={area.status === "ACTIVE" ? t("management.active") : t("management.inactive")}
            status={area.status === "ACTIVE" ? "active" : "inactive"}
          />
        }
        title={area.name}
        subtitle={t("organizations.areaDetailSubtitle")}
        action={
          <Can permission="areas.update">
            <Button leftSection={<IconEdit size={16} />} onClick={() => setOpened(true)}>
              {t("organizations.edit")}
            </Button>
          </Can>
        }
      />
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <DashboardKpiCard
          icon={<IconBuilding size={20} />}
          label={t("organizations.buildingsTitle")}
          value={metricValue(overview.metrics.buildings)}
        />
        <DashboardKpiCard
          accent="cyan"
          icon={<IconRouter size={20} />}
          label={t("devices.gatewaysTitle")}
          value={metricValue(overview.metrics.gateways)}
        />
        <DashboardKpiCard
          accent="teal"
          icon={<IconVector size={20} />}
          label={t("devices.nodesTitle")}
          value={metricValue(overview.metrics.nodes)}
        />
        <DashboardKpiCard
          accent="violet"
          icon={<IconUsers size={20} />}
          label={t("management.assignedUsers")}
          value={metricValue(overview.metrics.assignedUsers)}
        />
      </SimpleGrid>
      {overview.buildings.available ? (
        <DashboardSection
          icon={<IconBuilding size={20} />}
          subtitle={tf("organizations.previewCount", {
            shown: overview.buildings.items.length,
            total: overview.buildings.total ?? 0,
          })}
          title={t("organizations.buildingsTitle")}
        >
          {overview.buildings.items.length ? (
            <EntityCardGrid>
              {overview.buildings.items.map((building) => (
                <EntityCard
                  description={building.address ?? t("organizations.noAddress")}
                  eyebrow={building.number ?? t("organizations.noNumber")}
                  key={building.id}
                  onClick={() => navigate(`/company/buildings/${building.id}`)}
                  title={building.title}
                >
                  <Group justify="space-between">
                    <EntityMetric
                      label={t("devices.gatewaysTitle")}
                      value={metricValue(building.metrics.gateways)}
                    />
                    <EntityMetric
                      label={t("devices.nodesTitle")}
                      value={metricValue(building.metrics.nodes)}
                    />
                    <EntityMetric
                      label={t("management.assignedUsers")}
                      value={metricValue(building.metrics.assignedUsers)}
                    />
                    <EntityStatusBadge
                      label={
                        building.status === "ACTIVE"
                          ? t("management.active")
                          : t("management.inactive")
                      }
                      status={building.status === "ACTIVE" ? "active" : "inactive"}
                    />
                  </Group>
                </EntityCard>
              ))}
            </EntityCardGrid>
          ) : (
            <EmptyState
              description={t("organizations.emptyScopedDescription")}
              title={t("common.emptyTitle")}
            />
          )}
        </DashboardSection>
      ) : null}
      {overview.users.available ? (
        <DashboardSection
          accent="violet"
          icon={<IconUsers size={20} />}
          subtitle={tf("organizations.previewCount", {
            shown: overview.users.items.length,
            total: overview.users.total ?? 0,
          })}
          title={t("management.assignedUsers")}
        >
          {overview.users.items.length ? (
            <EntityCardGrid>
              {overview.users.items.map((user) => (
                <EntityCard description={user.email} key={user.id} title={user.name}>
                  <Group justify="space-between">
                    <Text size="sm">{user.role.name}</Text>
                    <Group gap={4}>
                      {user.accessSources.map((source) => (
                        <Badge key={source} size="sm" variant="light">
                          {accessSourceLabel(source)}
                        </Badge>
                      ))}
                    </Group>
                  </Group>
                </EntityCard>
              ))}
            </EntityCardGrid>
          ) : (
            <EmptyState
              description={t("organizations.emptyScopedDescription")}
              title={t("common.emptyTitle")}
            />
          )}
        </DashboardSection>
      ) : null}
      <Modal opened={opened} onClose={() => setOpened(false)} title={t("organizations.save")}>
        <Stack>
          <TextInput
            label={t("organizations.name")}
            onChange={(event) => setName(event.currentTarget.value)}
            value={name}
          />
          <ModalFormFooter
            cancelLabel={t("common.cancel")}
            onCancel={() => setOpened(false)}
            onSubmit={() => void save()}
            submitLabel={t("organizations.save")}
          />
        </Stack>
      </Modal>
    </Stack>
  );
}

export function CompanyBuildingDetailPage() {
  const { buildingId } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<BuildingOverviewResponse>();
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [opened, setOpened] = useState(false);
  const [title, setTitle] = useState("");

  const load = async () => {
    if (!session || !buildingId) return;
    setErrorStatus(null);
    try {
      const response = await apiRequest<BuildingOverviewResponse>(
        session,
        `/company/buildings/${buildingId}/overview`,
      );
      setOverview(response);
      setTitle(response.building.title);
    } catch (error) {
      setErrorStatus(error instanceof ApiError ? error.status : 500);
    }
  };

  useEffect(() => {
    void load();
  }, [session, buildingId]);

  const save = async () => {
    if (!session || !buildingId) return;
    await apiRequest(session, `/company/buildings/${buildingId}`, {
      body: JSON.stringify({ title }),
      method: "PATCH",
    });
    setOpened(false);
    await load();
  };

  if (!overview && !errorStatus) return <LoadingState title={t("common.loading")} />;
  if (errorStatus === 403)
    return (
      <ForbiddenState description={t("common.pageUnavailable")} title={t("common.forbidden")} />
    );
  if (errorStatus === 404)
    return (
      <ErrorState description={t("common.notFoundDescription")} title={t("common.notFoundTitle")} />
    );
  if (errorStatus)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;
  if (!overview) return null;
  const { area, building } = overview;
  const metricValue = (value: number | null) => value ?? t("common.notAvailable");

  return (
    <Stack gap="lg">
      <PageHeader
        eyebrow={area?.name ?? t("organizations.building")}
        meta={
          <Group gap="sm">
            <Text c="dimmed" size="sm">
              {building.number ?? t("organizations.noNumber")}
            </Text>
            <Text c="dimmed" size="sm">
              {building.address ?? t("organizations.noAddress")}
            </Text>
          </Group>
        }
        overflowAction={
          <EntityActionMenu
            ariaLabel={`${t("common.moreActions")}: ${building.title}`}
            items={[
              ...(hasPermission(session, "monitoring.view")
                ? [
                    {
                      icon: <IconChartBar size={16} />,
                      key: "monitoring",
                      label: t("monitoring.open"),
                      onClick: () => navigate(`/company/buildings/${building.id}/monitoring`),
                    },
                  ]
                : []),
              ...(hasPermission(session, "building-plans.view")
                ? [
                    {
                      icon: <IconMap size={16} />,
                      key: "plan",
                      label: t("organizations.buildingPlan"),
                      onClick: () => navigate(`/company/buildings/${building.id}/plan`),
                    },
                  ]
                : []),
            ]}
          />
        }
        status={
          <EntityStatusBadge
            label={building.status === "ACTIVE" ? t("management.active") : t("management.inactive")}
            status={building.status === "ACTIVE" ? "active" : "inactive"}
          />
        }
        title={building.title}
        subtitle={t("organizations.buildingDetailSubtitle")}
        action={
          <Can permission="buildings.update">
            <Button leftSection={<IconEdit size={16} />} onClick={() => setOpened(true)}>
              {t("organizations.edit")}
            </Button>
          </Can>
        }
      />
      <SimpleGrid cols={{ base: 2, md: 3, lg: 5 }}>
        <DashboardKpiCard
          icon={<IconRouter size={20} />}
          label={t("devices.gatewaysTitle")}
          value={metricValue(overview.metrics.gateways)}
        />
        <DashboardKpiCard
          accent="cyan"
          icon={<IconVector size={20} />}
          label={t("devices.nodesTitle")}
          value={metricValue(overview.metrics.nodes)}
        />
        <DashboardKpiCard
          accent="teal"
          icon={<IconVector size={20} />}
          label={t("organizations.activeNodes")}
          value={metricValue(overview.metrics.activeNodes)}
        />
        <DashboardKpiCard
          accent="indigo"
          icon={<IconVector size={20} />}
          label={t("organizations.faultNodes")}
          value={metricValue(overview.metrics.faultNodes)}
        />
        <DashboardKpiCard
          accent="violet"
          icon={<IconUsers size={20} />}
          label={t("management.assignedUsers")}
          value={metricValue(overview.metrics.assignedUsers)}
        />
      </SimpleGrid>
      {overview.devices.available ? (
        <DashboardSection
          icon={<IconRouter size={20} />}
          subtitle={tf("organizations.gatewayConnectivitySummary", {
            offline: overview.metrics.offlineGateways ?? 0,
            online: overview.metrics.onlineGateways ?? 0,
          })}
          title={t("devices.gatewaysTitle")}
        >
          {overview.devices.items.length ? (
            <EntityCardGrid>
              {overview.devices.items.map((gateway) => (
                <EntityCard
                  description={gateway.installedLocation ?? t("common.notAvailable")}
                  eyebrow={gateway.isOnline ? t("status.online") : t("status.offline")}
                  key={gateway.id}
                  title={gateway.serialNumber}
                >
                  <Group justify="space-between">
                    <EntityMetric label={t("devices.nodesTitle")} value={gateway.nodeCount} />
                    <EntityMetric
                      label={t("devices.lastSeen")}
                      value={
                        gateway.lastSeenAt
                          ? formatDateTime(gateway.lastSeenAt)
                          : t("common.notAvailable")
                      }
                    />
                    <EntityStatusBadge
                      label={
                        gateway.status === "ACTIVE"
                          ? t("management.active")
                          : t("management.inactive")
                      }
                      status={gateway.status === "ACTIVE" ? "active" : "inactive"}
                    />
                  </Group>
                </EntityCard>
              ))}
            </EntityCardGrid>
          ) : (
            <EmptyState
              description={t("organizations.emptyScopedDescription")}
              title={t("common.emptyTitle")}
            />
          )}
        </DashboardSection>
      ) : null}
      {overview.nodes.available ? (
        <DashboardSection
          accent="cyan"
          icon={<IconVector size={20} />}
          subtitle={tf("organizations.previewCount", {
            shown: overview.nodes.items.length,
            total: overview.nodes.total ?? 0,
          })}
          title={t("devices.nodesTitle")}
        >
          {overview.nodes.items.length ? (
            <EntityCardGrid>
              {overview.nodes.items.map((node) => (
                <EntityCard
                  description={node.installedLocation ?? t("common.notAvailable")}
                  eyebrow={node.nodeType.displayName}
                  key={node.id}
                  title={node.number}
                >
                  <Group justify="space-between">
                    <EntityMetric label={t("devices.gateway")} value={node.gateway.serialNumber} />
                    <EntityMetric
                      label={t("devices.lastSeen")}
                      value={
                        node.lastSeenAt ? formatDateTime(node.lastSeenAt) : t("common.notAvailable")
                      }
                    />
                    {node.latestStatus ? (
                      <EntityStatusBadge
                        label={tx(`status.${node.latestStatus}`, node.latestStatus)}
                        status={node.latestStatus}
                      />
                    ) : (
                      <Badge color="gray" variant="light">
                        {t("common.notAvailable")}
                      </Badge>
                    )}
                    <EntityStatusBadge
                      label={
                        node.status === "ACTIVE" ? t("management.active") : t("management.inactive")
                      }
                      status={node.status === "ACTIVE" ? "active" : "inactive"}
                    />
                  </Group>
                </EntityCard>
              ))}
            </EntityCardGrid>
          ) : (
            <EmptyState
              description={t("organizations.emptyScopedDescription")}
              title={t("common.emptyTitle")}
            />
          )}
        </DashboardSection>
      ) : null}
      {overview.users.available ? (
        <DashboardSection
          accent="violet"
          icon={<IconUsers size={20} />}
          subtitle={tf("organizations.previewCount", {
            shown: overview.users.items.length,
            total: overview.users.total ?? 0,
          })}
          title={t("management.assignedUsers")}
        >
          {overview.users.items.length ? (
            <EntityCardGrid>
              {overview.users.items.map((user) => (
                <EntityCard description={user.email} key={user.id} title={user.name}>
                  <Group justify="space-between">
                    <Text size="sm">{user.role.name}</Text>
                    <Group gap={4}>
                      {user.accessSources.map((source) => (
                        <Badge key={source} size="sm" variant="light">
                          {accessSourceLabel(source)}
                        </Badge>
                      ))}
                    </Group>
                  </Group>
                </EntityCard>
              ))}
            </EntityCardGrid>
          ) : (
            <EmptyState
              description={t("organizations.emptyScopedDescription")}
              title={t("common.emptyTitle")}
            />
          )}
        </DashboardSection>
      ) : null}
      <Modal opened={opened} onClose={() => setOpened(false)} title={t("organizations.save")}>
        <Stack>
          <TextInput
            label={t("organizations.name")}
            onChange={(event) => setTitle(event.currentTarget.value)}
            value={title}
          />
          <ModalFormFooter
            cancelLabel={t("common.cancel")}
            onCancel={() => setOpened(false)}
            onSubmit={() => void save()}
            submitLabel={t("organizations.save")}
          />
        </Stack>
      </Modal>
    </Stack>
  );
}

export function CompanyBuildingPlanPage() {
  const { buildingId } = useParams();

  return (
    <Stack gap="lg">
      <PageHeader
        title={t("organizations.buildingPlan")}
        subtitle={t("organizations.buildingPlanSubtitle")}
      />
      {buildingId ? <BuildingImageManager basePath="/company" buildingId={buildingId} /> : null}
    </Stack>
  );
}
