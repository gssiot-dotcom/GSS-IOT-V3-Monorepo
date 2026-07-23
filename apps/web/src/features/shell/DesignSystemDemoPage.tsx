import {
  DataTable,
  PageContainer,
  SectionPanel,
  EmptyState,
  ErrorState,
  NodeTypeSelectionCard,
  PageHeader,
  SessionExpiredState,
  StatusBadge,
  TablePaginationFooter,
} from "@gss-iot/ui";
import { Card, SimpleGrid, Stack } from "@mantine/core";

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
  { id: "warning", label: t("status.warning"), status: "warning" as const },
  { id: "offline", label: t("status.offline"), status: "offline" as const },
];

export function DesignSystemDemoPage() {
  return (
    <PageContainer data-testid="phase-2-demo">
      <PageHeader subtitle={t("demo.subtitle")} title={t("demo.title")} />

      <SectionPanel>
        <Stack gap="md">
          <PageHeader subtitle={t("monitoring.nodeCardsSubtitle")} title={t("demo.nodeCards")} />
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
        </Stack>
      </SectionPanel>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <SectionPanel>
          <Stack gap="md">
            <PageHeader subtitle={t("demo.subtitle")} title={t("demo.components")} />
            <DataTable
              columns={[
                { key: "state", label: t("demo.components"), render: (row) => row.label },
                {
                  key: "status",
                  label: t("status.safe"),
                  render: (row) => <StatusBadge label={row.label} status={row.status} />,
                },
              ]}
              rows={statusRows}
            />
            <TablePaginationFooter
              pageSize="10"
              pageSizeLabel={t("table.pageSize")}
              rangeLabel={t("table.range")}
            />
          </Stack>
        </SectionPanel>
        <Stack gap="md">
          <Card>
            <EmptyState description={t("common.emptyDescription")} title={t("common.emptyTitle")} />
          </Card>
          <ErrorState
            description={t("common.errorDescription")}
            retryLabel={t("common.retry")}
            title={t("common.errorTitle")}
          />
          <Card>
            <SessionExpiredState
              description={t("common.sessionExpiredDescription")}
              title={t("common.sessionExpired")}
            />
          </Card>
        </Stack>
      </SimpleGrid>
    </PageContainer>
  );
}
