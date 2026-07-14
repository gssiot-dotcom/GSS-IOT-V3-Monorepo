import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  action?: ReactNode;
  subtitle?: string;
  title: string;
}

export function PageHeader({ action, subtitle, title }: PageHeaderProps) {
  return (
    <Group align="flex-start" justify="space-between" gap="md" wrap="nowrap">
      <Stack gap={4}>
        <Title order={1}>{title}</Title>
        {subtitle ? (
          <Text c="dimmed" size="sm">
            {subtitle}
          </Text>
        ) : null}
      </Stack>
      {action ? <Group gap="xs">{action}</Group> : null}
    </Group>
  );
}
