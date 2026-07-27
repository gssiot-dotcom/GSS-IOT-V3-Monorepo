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

export type DashboardAccent = "blue" | "cyan" | "indigo" | "neutral" | "teal" | "violet";

const accentColors: Record<DashboardAccent, MantineColor> = {
  blue: "gss",
  cyan: "gssCyan",
  indigo: "gssIndigo",
  neutral: "gray",
  teal: "gssTeal",
  violet: "gssViolet",
};

export function TintedIconBox({
  accent = "blue",
  children,
  size = "lg",
}: {
  accent?: DashboardAccent;
  children: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <ThemeIcon
      className={`gss-tinted-icon-box gss-tone-${accent}`}
      color={accentColors[accent]}
      radius="md"
      size={size}
      variant="light"
    >
      {children}
    </ThemeIcon>
  );
}

export function MetricIcon({
  accent = "blue",
  children,
}: {
  accent?: DashboardAccent;
  children: ReactNode;
}) {
  return <TintedIconBox accent={accent}>{children}</TintedIconBox>;
}

export interface DashboardKpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  color?: MantineColor;
  accent?: DashboardAccent;
}

export function DashboardKpiCard({
  label,
  value,
  hint,
  icon,
  color = "gss",
  accent = "blue",
}: DashboardKpiCardProps) {
  return (
    <Card
      className={`gss-metric-card gss-dashboard-kpi-card gss-tone-${accent}`}
      h="100%"
      shadow="sm"
    >
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <Stack gap={4}>
          <Text className="gss-metric-label" fw={600} size="xs" tt="uppercase">
            {label}
          </Text>
          <Title className="gss-metric-value" order={3}>
            {value}
          </Title>
          {hint ? (
            <Text className="gss-metric-meta" size="xs">
              {hint}
            </Text>
          ) : null}
        </Stack>
        {icon ? (
          <ThemeIcon
            className={`gss-tinted-icon-box gss-tone-${accent}`}
            color={color}
            radius="md"
            size="lg"
            variant="light"
          >
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
  accent?: DashboardAccent;
  icon?: ReactNode;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  accent = "blue",
  icon,
}: SectionHeaderProps) {
  return (
    <Group align="flex-start" justify="space-between" wrap="wrap">
      <Group align="flex-start" gap="sm" wrap="nowrap">
        {icon ? <TintedIconBox accent={accent}>{icon}</TintedIconBox> : null}
        <Stack gap={2}>
          <Text className="gss-section-title" fw={600} size="lg">
            {title}
          </Text>
          {subtitle ? (
            <Text className="gss-section-subtitle" size="sm">
              {subtitle}
            </Text>
          ) : null}
        </Stack>
      </Group>
      {action}
    </Group>
  );
}

export function DashboardSection({
  title,
  subtitle,
  action,
  accent,
  icon,
  children,
}: SectionHeaderProps & { children: ReactNode }) {
  return (
    <Card className={`gss-dashboard-section gss-tone-${accent ?? "blue"}`} shadow="sm">
      <SectionHeader
        action={action}
        accent={accent}
        icon={icon}
        subtitle={subtitle}
        title={title}
      />
      <Stack gap="md" mt="md">
        {children}
      </Stack>
    </Card>
  );
}

export function MetricCard({
  accent = "blue",
  compact = false,
  hint,
  icon,
  label,
  meta,
  value,
}: {
  accent?: DashboardAccent;
  compact?: boolean;
  hint?: ReactNode;
  icon?: ReactNode;
  label: ReactNode;
  meta?: ReactNode;
  value: ReactNode;
}) {
  return (
    <Card
      className={`gss-metric-card${compact ? " gss-operational-summary-card" : ""} gss-tone-${accent}`}
      h="100%"
      shadow="sm"
    >
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <Stack gap={4}>
          <Text className="gss-metric-label" fw={600} size="xs" tt="uppercase">
            {label}
          </Text>
          <Title className="gss-metric-value" order={3}>
            {value}
          </Title>
          {hint ? (
            <Text className="gss-metric-meta" size="xs">
              {hint}
            </Text>
          ) : null}
          {meta ? (
            <Text className="gss-metric-secondary" size="xs">
              {meta}
            </Text>
          ) : null}
        </Stack>
        {icon ? <MetricIcon accent={accent}>{icon}</MetricIcon> : null}
      </Group>
    </Card>
  );
}

export function OperationalSummaryCard({
  accent = "blue",
  helper,
  icon,
  label,
  value,
}: {
  accent?: DashboardAccent;
  helper?: ReactNode;
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <MetricCard accent={accent} compact hint={helper} icon={icon} label={label} value={value} />
  );
}

export function SectionIcon({
  accent = "blue",
  children,
}: {
  accent?: DashboardAccent;
  children: ReactNode;
}) {
  return <TintedIconBox accent={accent}>{children}</TintedIconBox>;
}

export function StatusMetric({
  accent,
  label,
  value,
}: {
  accent: DashboardAccent;
  label: ReactNode;
  value: ReactNode;
}) {
  return <MetricCard accent={accent} label={label} value={value} />;
}

export function SectionAction({ children }: { children: ReactNode }) {
  return <div className="gss-section-action">{children}</div>;
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
