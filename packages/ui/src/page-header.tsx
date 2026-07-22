import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  action?: ReactNode;
  subtitle?: string;
  title: string;
}

export function PageHeader({ action, subtitle, title }: PageHeaderProps) {
  return (
    <Group align="flex-start" justify="space-between" gap="md" wrap="wrap">
      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
        <Title order={1} style={{ overflowWrap: "anywhere" }}>
          {title}
        </Title>
        {subtitle ? (
          <Text c="dimmed" size="sm">
            {subtitle}
          </Text>
        ) : null}
      </Stack>
      {action ? (
        <Group gap="xs" style={{ flexShrink: 0 }}>
          {action}
        </Group>
      ) : null}
    </Group>
  );
}
