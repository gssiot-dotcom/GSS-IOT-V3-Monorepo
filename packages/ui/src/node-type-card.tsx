import { Badge, Card, Group, Image, Stack, Text, Title } from "@mantine/core";
import { IconArrowRight, IconLock } from "@tabler/icons-react";
import type { KeyboardEvent } from "react";

export type NodeTypeKey = "angle_node" | "door_node" | "gangform_node";

export interface NodeTypeCardProps {
  countLabel: string;
  description: string;
  disabled?: boolean;
  disabledLabel?: string;
  imageAlt: string;
  imageSrc: string;
  onSelect?: () => void;
  title: string;
  type: NodeTypeKey;
}

function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, onSelect?: () => void): void {
  if (!onSelect) {
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect();
  }
}

export function NodeTypeSelectionCard({
  countLabel,
  description,
  disabled = false,
  disabledLabel,
  imageAlt,
  imageSrc,
  onSelect,
  title,
  type,
}: NodeTypeCardProps) {
  const canSelect = Boolean(onSelect && !disabled);

  return (
    <Card
      aria-disabled={disabled}
      data-node-type={type}
      data-testid={`node-type-card-${type}`}
      onClick={canSelect ? onSelect : undefined}
      onKeyDown={(event) => handleKeyDown(event, canSelect ? onSelect : undefined)}
      role={canSelect ? "button" : "group"}
      style={{
        cursor: canSelect ? "pointer" : "default",
        minHeight: 260,
        opacity: disabled ? 0.56 : 1,
        transition: "transform 160ms ease, box-shadow 160ms ease",
      }}
      tabIndex={canSelect ? 0 : -1}
    >
      <Stack h="100%" gap="md">
        <Image
          alt={imageAlt}
          fit="contain"
          h={160}
          src={imageSrc}
          style={{ objectPosition: "center" }}
        />
        <Stack gap={6}>
          <Group justify="space-between" wrap="nowrap">
            <Title order={3}>{title}</Title>
            {disabled ? (
              <Badge color="gray" leftSection={<IconLock size={12} />} variant="light">
                {disabledLabel}
              </Badge>
            ) : (
              <IconArrowRight aria-hidden size={18} />
            )}
          </Group>
          <Text c="dimmed" lineClamp={2} size="sm">
            {description}
          </Text>
          <Text fw={600} size="sm">
            {countLabel}
          </Text>
        </Stack>
      </Stack>
    </Card>
  );
}
