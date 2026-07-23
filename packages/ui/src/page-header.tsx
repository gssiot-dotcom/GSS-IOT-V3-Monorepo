import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  action?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  overflowAction?: ReactNode;
  status?: ReactNode;
  subtitle?: string;
  title: string;
}

export function PageHeader({
  action,
  eyebrow,
  meta,
  overflowAction,
  status,
  subtitle,
  title,
}: PageHeaderProps) {
  return (
    <Group
      align="flex-start"
      className="gss-page-header"
      justify="space-between"
      gap="md"
      wrap="wrap"
    >
      <Stack className="gss-page-header-title" gap={4} style={{ flex: "1 1 220px", minWidth: 0 }}>
        {eyebrow ? <Text className="gss-page-header-eyebrow">{eyebrow}</Text> : null}
        <Group align="center" gap="sm" wrap="wrap">
          <Title order={1} style={{ overflowWrap: "anywhere" }}>
            {title}
          </Title>
          {status}
        </Group>
        {subtitle ? (
          <Text c="dimmed" size="sm">
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Group className="gss-page-header-meta" gap="sm">
            {meta}
          </Group>
        ) : null}
      </Stack>
      {action || overflowAction ? (
        <Group
          className="gss-page-header-actions"
          gap="xs"
          style={{ flex: "0 1 auto", maxWidth: "100%" }}
        >
          {action}
          {overflowAction}
        </Group>
      ) : null}
    </Group>
  );
}
