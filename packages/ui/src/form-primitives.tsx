import { Group, Paper, SimpleGrid, Stack, Text, Title, type SimpleGridProps } from "@mantine/core";
import type { ReactNode } from "react";

export function FormWorkspace({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: ReactNode;
  title?: ReactNode;
}) {
  return (
    <Stack className="gss-form-workspace" gap="lg">
      {title ? (
        <Stack gap={2}>
          <Title order={2}>{title}</Title>
          {description ? (
            <Text c="dimmed" size="sm">
              {description}
            </Text>
          ) : null}
        </Stack>
      ) : null}
      {children}
    </Stack>
  );
}

export function FormSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <Paper className="gss-form-section" p="lg" shadow="md" withBorder>
      <Stack gap="md">
        <Stack gap={2}>
          <Text fw={700} size="lg">
            {title}
          </Text>
          {description ? (
            <Text c="dimmed" size="sm">
              {description}
            </Text>
          ) : null}
        </Stack>
        {children}
      </Stack>
    </Paper>
  );
}

export function FormFieldGrid({ children, ...props }: SimpleGridProps) {
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" {...props}>
      {children}
    </SimpleGrid>
  );
}

export function FormSectionNav({ children }: { children: ReactNode }) {
  return (
    <Paper className="gss-form-section-nav" p="xs" shadow="md" withBorder>
      {children}
    </Paper>
  );
}

export function StickyFormActions({ children }: { children: ReactNode }) {
  return (
    <Group className="gss-sticky-form-actions" justify="flex-end" wrap="wrap">
      {children}
    </Group>
  );
}

export function DestructiveActionZone({
  children,
  title,
}: {
  children: ReactNode;
  title: ReactNode;
}) {
  return (
    <Paper className="gss-destructive-zone" p="md" withBorder>
      <Stack gap="xs">
        <Text c="red" fw={700}>
          {title}
        </Text>
        {children}
      </Stack>
    </Paper>
  );
}
