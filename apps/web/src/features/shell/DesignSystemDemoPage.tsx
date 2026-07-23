import {
  ConfirmActionModal,
  DataTable,
  EmptyState,
  EntityActionMenu,
  EntityPrimaryCell,
  EntityStatusBadge,
  ErrorState,
  ForbiddenState,
  ModalFormFooter,
  NodeTypeSelectionCard,
  PageContainer,
  PageHeader,
  SectionPanel,
  SessionExpiredState,
  StatusBadge,
  TablePaginationFooter,
} from "@gss-iot/ui";
import { Badge, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconBuildingCommunity, IconPlayerPause } from "@tabler/icons-react";
import { useState } from "react";

import { t, tf } from "../../app/i18n";

const nodeCards = [
  {
    count: 12,
    description: t("monitoring.gangformDescription"),
    imageAlt: t("monitoring.gangformTitle"),
    imageSrc: "/assets/legacy-node-types/gangform.png",
    title: t("monitoring.gangformTitle"),
    type: "gangform_node" as const,
  },
  {
    count: 18,
    description: t("monitoring.angleDescription"),
    imageAlt: t("monitoring.angleTitle"),
    imageSrc: "/assets/legacy-node-types/angle-node.png",
    title: t("monitoring.angleTitle"),
    type: "angle_node" as const,
  },
  {
    count: 7,
    description: t("monitoring.doorDescription"),
    imageAlt: t("monitoring.doorTitle"),
    imageSrc: "/assets/legacy-node-types/door-node.png",
    title: t("monitoring.doorTitle"),
    type: "door_node" as const,
  },
];

const statusRows = [
  { id: "safe", label: t("status.safe"), status: "safe" as const },
  { id: "caution", label: t("status.caution"), status: "caution" as const },
  { id: "warning", label: t("status.warning"), status: "warning" as const },
  { id: "danger", label: t("status.danger"), status: "danger" as const },
  { id: "offline", label: t("status.offline"), status: "offline" as const },
  { id: "unconfigured", label: t("status.unconfigured"), status: "unconfigured" as const },
];

const entityRows = [
  { id: "company-1", code: "GSS-001", name: "Acme Safety", status: "active" as const },
  { id: "company-2", code: "GSS-002", name: "North Build", status: "inactive" as const },
];

export function DesignSystemDemoPage() {
  const [confirmOpened, setConfirmOpened] = useState(false);

  return (
    <PageContainer data-testid="phase-2-demo">
      <PageHeader eyebrow={t("app.name")} subtitle={t("demo.subtitle")} title={t("demo.title")} />

      <SectionPanel title={t("demo.nodeCards")} subtitle={t("monitoring.nodeCardsSubtitle")}>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          {nodeCards.map((card) => (
            <NodeTypeSelectionCard
              countLabel={tf("monitoring.count", { count: card.count })}
              description={card.description}
              imageAlt={card.imageAlt}
              imageSrc={card.imageSrc}
              key={card.type}
              title={card.title}
              type={card.type}
            />
          ))}
        </SimpleGrid>
      </SectionPanel>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <SectionPanel title={t("demo.statuses")} subtitle={t("demo.components")}>
          <Group gap="xs">
            {statusRows.map((row) => (
              <StatusBadge key={row.id} label={row.label} status={row.status} />
            ))}
          </Group>
          <Stack gap="xs" mt="lg">
            <Text c="dimmed" size="xs" tt="uppercase">
              {t("demo.typography")}
            </Text>
            <Title order={2}>{t("organizations.companiesTitle")}</Title>
            <Text>{t("organizations.companiesSubtitle")}</Text>
            <Text c="dimmed" size="sm">
              {t("organizations.companyDetailSubtitle")}
            </Text>
          </Stack>
        </SectionPanel>
        <SectionPanel title={t("demo.actions")} subtitle={t("demo.actionMenu")}>
          <Group justify="space-between" wrap="nowrap">
            <EntityPrimaryCell
              avatar={<IconBuildingCommunity aria-hidden size={18} />}
              identifier={t("demo.fixtureCompanyCode")}
              title={t("demo.fixtureCompanyName")}
            />
            <EntityActionMenu
              ariaLabel={`${t("common.moreActions")}: ${t("demo.fixtureCompanyName")}`}
              items={[
                { key: "open", label: t("organizations.open"), onClick: () => undefined },
                { key: "edit", label: t("organizations.edit"), onClick: () => undefined },
                {
                  color: "red",
                  destructive: true,
                  icon: <IconPlayerPause size={16} />,
                  key: "deactivate",
                  label: t("organizations.deactivate"),
                  onClick: () => setConfirmOpened(true),
                },
              ]}
            />
          </Group>
          <ModalFormFooter
            cancelLabel={t("common.cancel")}
            onCancel={() => undefined}
            onSubmit={() => undefined}
            submitLabel={t("organizations.save")}
          />
        </SectionPanel>
      </SimpleGrid>

      <SectionPanel title={t("demo.surfaces")} subtitle={t("demo.components")}>
        <DataTable
          ariaLabel={t("organizations.companiesTitle")}
          caption={t("organizations.companiesSubtitle")}
          columns={[
            {
              key: "name",
              label: t("organizations.name"),
              render: (row) => <EntityPrimaryCell identifier={row.code} title={row.name} />,
            },
            {
              key: "status",
              label: t("organizations.status"),
              render: (row) => (
                <EntityStatusBadge
                  label={
                    row.status === "active" ? t("management.active") : t("management.inactive")
                  }
                  status={row.status}
                />
              ),
            },
            {
              key: "actions",
              label: t("organizations.actions"),
              align: "right",
              render: (row) => (
                <EntityActionMenu
                  ariaLabel={`${t("common.moreActions")}: ${row.name}`}
                  items={[
                    { key: "open", label: t("organizations.open"), onClick: () => undefined },
                  ]}
                />
              ),
            },
          ]}
          onRowClick={() => undefined}
          rows={entityRows}
        />
        <TablePaginationFooter
          pageSize="10"
          pageSizeLabel={t("table.pageSize")}
          rangeLabel={t("table.range")}
        />
      </SectionPanel>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Stack gap="md">
          <Card>
            <EmptyState description={t("common.emptyDescription")} title={t("common.emptyTitle")} />
          </Card>
          <ErrorState
            description={t("common.errorDescription")}
            retryLabel={t("common.retry")}
            title={t("common.errorTitle")}
          />
        </Stack>
        <Stack gap="md">
          <Card>
            <ForbiddenState
              description={t("common.pageUnavailable")}
              title={t("common.forbidden")}
            />
          </Card>
          <Card>
            <SessionExpiredState
              description={t("common.sessionExpiredDescription")}
              title={t("common.sessionExpired")}
            />
          </Card>
        </Stack>
      </SimpleGrid>

      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t("organizations.deactivate")}
        description={t("organizations.confirmDeactivateImpact")}
        entityName={t("demo.fixtureCompanyName")}
        onClose={() => setConfirmOpened(false)}
        onConfirm={() => setConfirmOpened(false)}
        opened={confirmOpened}
        title={t("demo.confirmation")}
      />
      <Badge color="gray" variant="light">
        {t("demo.footer")}
      </Badge>
    </PageContainer>
  );
}
