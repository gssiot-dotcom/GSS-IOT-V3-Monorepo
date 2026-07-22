import {
  ActionIcon,
  Card,
  Group,
  Menu,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
  type MantineColor,
  type SimpleGridProps,
} from "@mantine/core";
import { IconDotsVertical } from "@tabler/icons-react";
import type { ReactNode } from "react";

export interface DashboardKpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  color?: MantineColor;
}

export function DashboardKpiCard({
  label,
  value,
  hint,
  icon,
  color = "gss",
}: DashboardKpiCardProps) {
  return (
    <Card h="100%" shadow="md">
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <Stack gap={4}>
          <Text c="dimmed" fw={600} size="xs" tt="uppercase">
            {label}
          </Text>
          <Title order={3}>{value}</Title>
          {hint ? (
            <Text c="dimmed" size="xs">
              {hint}
            </Text>
          ) : null}
        </Stack>
        {icon ? (
          <ThemeIcon color={color} radius="md" size="lg" variant="light">
            {icon}
          </ThemeIcon>
        ) : null}
      </Group>
    </Card>
  );
}

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <Group align="flex-start" justify="space-between" wrap="wrap">
      <Stack gap={2}>
        <Text fw={600} size="lg">
          {title}
        </Text>
        {subtitle ? (
          <Text c="dimmed" size="sm">
            {subtitle}
          </Text>
        ) : null}
      </Stack>
      {action}
    </Group>
  );
}

export function DashboardSection({
  title,
  subtitle,
  action,
  children,
}: SectionHeaderProps & { children: ReactNode }) {
  return (
    <Card shadow="md">
      <SectionHeader action={action} subtitle={subtitle} title={title} />
      <Stack gap="md" mt="md">
        {children}
      </Stack>
    </Card>
  );
}

export function ResponsiveContentGrid({ children, ...props }: SimpleGridProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" {...props}>
      {children}
    </SimpleGrid>
  );
}

export interface CompactActionMenuItem {
  key: string;
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  color?: MantineColor;
  disabled?: boolean;
}

export function CompactActionMenu({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: CompactActionMenuItem[];
}) {
  return (
    <Menu aria-label={ariaLabel} position="bottom-end" shadow="md" withinPortal>
      <Tooltip label={ariaLabel}>
        <Menu.Target>
          <ActionIcon aria-label={ariaLabel} variant="subtle">
            <IconDotsVertical size={18} />
          </ActionIcon>
        </Menu.Target>
      </Tooltip>
      <Menu.Dropdown>
        {items.map((item) => (
          <Menu.Item
            color={item.color}
            disabled={item.disabled}
            key={item.key}
            leftSection={item.icon}
            onClick={item.onClick}
          >
            {item.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
