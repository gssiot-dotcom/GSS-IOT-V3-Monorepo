import { ActionIcon, Badge, Card, Group, Menu, SimpleGrid, Stack, Text, Tooltip, type MantineColor, type SimpleGridProps } from "@mantine/core";
import { IconDotsVertical } from "@tabler/icons-react";
import type { ReactNode } from "react";

export function EntityCardGrid({ children, ...props }: SimpleGridProps) {
  return <SimpleGrid cols={{ base: 1, xs: 2, lg: 3 }} spacing="md" {...props}>{children}</SimpleGrid>;
}

export function EntityMetric({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs">{label}</Text>
      <Text fw={700} size="sm">{value}</Text>
    </Stack>
  );
}

export function EntityStatusRow({
  color = "gss",
  label,
  value,
}: {
  color?: MantineColor;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <Group gap="xs" justify="space-between" wrap="nowrap">
      <Text c="dimmed" size="sm">{label}</Text>
      <Badge color={color} variant="light">{value}</Badge>
    </Group>
  );
}

export function EntityActionMenu({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: Array<{ key: string; label: ReactNode; onClick: () => void; color?: MantineColor; disabled?: boolean; icon?: ReactNode }>;
}) {
  return (
    <Menu position="bottom-end" shadow="md" withinPortal>
      <Tooltip label={ariaLabel}>
        <Menu.Target>
          <ActionIcon aria-label={ariaLabel} variant="subtle"><IconDotsVertical size={18} /></ActionIcon>
        </Menu.Target>
      </Tooltip>
      <Menu.Dropdown>
        {items.map((item) => <Menu.Item color={item.color} disabled={item.disabled} key={item.key} leftSection={item.icon} onClick={item.onClick}>{item.label}</Menu.Item>)}
      </Menu.Dropdown>
    </Menu>
  );
}

export function EntityCard({
  action,
  children,
  description,
  eyebrow,
  onClick,
  title,
}: {
  action?: ReactNode;
  children?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  onClick?: () => void;
  title: ReactNode;
}) {
  return (
    <Card className={onClick ? "gss-entity-card gss-entity-card-interactive" : "gss-entity-card"} onClick={onClick} role={onClick ? "button" : undefined} shadow="md" tabIndex={onClick ? 0 : undefined}>
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <Stack gap={4} style={{ minWidth: 0 }}>
          {eyebrow ? <Text c="dimmed" fw={700} size="xs" tt="uppercase">{eyebrow}</Text> : null}
          <Text fw={700} size="lg" style={{ overflowWrap: "anywhere" }}>{title}</Text>
          {description ? <Text c="dimmed" size="sm">{description}</Text> : null}
        </Stack>
        {action}
      </Group>
      {children ? <Stack gap="sm" mt="md">{children}</Stack> : null}
    </Card>
  );
}
