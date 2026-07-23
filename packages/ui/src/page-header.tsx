import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  action?: ReactNode;
  subtitle?: string;
  title: string;
}

export function PageHeader({ action, subtitle, title }: PageHeaderProps) {
  return (
    <Group
      align="flex-start"
      className="gss-page-header"
      justify="space-between"
      gap="md"
      wrap="wrap"
    >
      <Stack className="gss-page-header-title" gap={4} style={{ flex: "1 1 220px", minWidth: 0 }}>
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
        <Group
          className="gss-page-header-actions"
          gap="xs"
          style={{ flex: "0 1 auto", maxWidth: "100%" }}
        >
          {action}
        </Group>
      ) : null}
    </Group>
  );
}
