import { NodeTypeSelectionCard, PageHeader } from "@gss-iot/ui";
import { Card, SimpleGrid, Stack } from "@mantine/core";

import { t, tf } from "../../app/i18n";

const buildingNodeTypes = [
  {
    count: 6,
    description: t("monitoring.doorDescription"),
    imageAlt: t("monitoring.doorTitle"),
    imageSrc: "/assets/legacy-node-types/door-node.png",
    title: t("monitoring.doorTitle"),
    type: "door_node" as const,
  },
  {
    count: 10,
    description: t("monitoring.angleDescription"),
    imageAlt: t("monitoring.angleTitle"),
    imageSrc: "/assets/legacy-node-types/angle-node.png",
    title: t("monitoring.angleTitle"),
    type: "angle_node" as const,
  },
  {
    count: 3,
    description: t("monitoring.gangformDescription"),
    disabled: true,
    imageAlt: t("monitoring.gangformTitle"),
    imageSrc: "/assets/legacy-node-types/gangform.png",
    title: t("monitoring.gangformTitle"),
    type: "gangform_node" as const,
  },
];

export function NodeTypeMonitoringPage() {
  return (
    <Card>
      <Stack gap="md">
        <PageHeader
          subtitle={t("monitoring.nodeCardsSubtitle")}
          title={t("monitoring.nodeCardsTitle")}
        />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          {buildingNodeTypes.map((card) => (
            <NodeTypeSelectionCard
              countLabel={tf("monitoring.count", { count: card.count })}
              description={card.description}
              disabled={card.disabled}
              disabledLabel={t("monitoring.disabled")}
              imageAlt={card.imageAlt}
              imageSrc={card.imageSrc}
              key={card.type}
              title={card.title}
              type={card.type}
            />
          ))}
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
