import { Group, SegmentedControl, Stack, Text, type SegmentedControlProps } from "@mantine/core";
import type { ReactNode } from "react";

export function DataToolbar({ children }: { children: ReactNode }) {
  return (
    <Group
      className="gss-data-toolbar"
      align="flex-end"
      gap="sm"
      justify="space-between"
      wrap="wrap"
    >
      {children}
    </Group>
  );
}

export function DataViewToggle(props: SegmentedControlProps) {
  return <SegmentedControl aria-label={props["aria-label"] ?? "Data view"} size="sm" {...props} />;
}

export function FilterChipRow({ children }: { children: ReactNode }) {
  return (
    <Group className="gss-filter-chip-row" gap="xs">
      {children}
    </Group>
  );
}

export function ChartPanel({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle?: ReactNode;
  title: ReactNode;
}) {
  return (
    <Stack className="gss-chart-panel" gap="md">
      <Stack gap={2}>
        <Text fw={700}>{title}</Text>
        {subtitle ? (
          <Text c="dimmed" size="sm">
            {subtitle}
          </Text>
        ) : null}
      </Stack>
      {children}
    </Stack>
  );
}

export function MetricTrend({
  children,
  label,
  value,
}: {
  children?: ReactNode;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Group gap="xs">
        <Text fw={700} size="lg">
          {value}
        </Text>
        {children}
      </Group>
    </Stack>
  );
}

export function StatusDistribution({ children }: { children: ReactNode }) {
  return (
    <Group className="gss-status-distribution" gap="xs">
      {children}
    </Group>
  );
}
