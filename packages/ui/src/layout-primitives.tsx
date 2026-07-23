import { Box, Group, Paper, SimpleGrid, Stack, Text, type MantineSpacing } from "@mantine/core";
import type { ComponentProps, ReactNode } from "react";

export function PageContainer({
  children,
  gap = "lg",
  ...props
}: { children: ReactNode; gap?: MantineSpacing } & Omit<
  ComponentProps<typeof Stack>,
  "children" | "gap"
>) {
  return (
    <Stack className="gss-page-container" gap={gap} {...props}>
      {children}
    </Stack>
  );
}

export function SectionPanel({
  action,
  children,
  subtitle,
  title,
}: {
  action?: ReactNode;
  children?: ReactNode;
  subtitle?: ReactNode;
  title?: ReactNode;
}) {
  return (
    <Paper className="gss-section-panel" p="lg" shadow="md" withBorder>
      {title || subtitle || action ? (
        <Group align="flex-start" justify="space-between" mb={children ? "md" : 0} wrap="wrap">
          <Stack gap={2}>
            {title ? (
              <Text fw={700} size="lg">
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text c="dimmed" size="sm">
                {subtitle}
              </Text>
            ) : null}
          </Stack>
          {action}
        </Group>
      ) : null}
      {children}
    </Paper>
  );
}

export function ContextSectionLayout({
  children,
  navigation,
}: {
  children: ReactNode;
  navigation: ReactNode;
}) {
  return (
    <SimpleGrid className="gss-context-layout" cols={{ base: 1, md: 4 }} spacing="lg">
      <Box style={{ minWidth: 0 }}>{navigation}</Box>
      <Box style={{ gridColumn: "span 3", minWidth: 0 }}>{children}</Box>
    </SimpleGrid>
  );
}

export function ContextSectionNav({ children, title }: { children: ReactNode; title?: ReactNode }) {
  return (
    <Paper className="gss-context-nav" p="xs" shadow="md" withBorder>
      {title ? (
        <Text c="dimmed" fw={700} p="sm" size="xs" tt="uppercase">
          {title}
        </Text>
      ) : null}
      <Stack gap={2}>{children}</Stack>
    </Paper>
  );
}

export function StickyPageActions({ children }: { children: ReactNode }) {
  return (
    <Group className="gss-sticky-actions" justify="flex-end" wrap="wrap">
      {children}
    </Group>
  );
}

export function SidebarSection({ children, label }: { children: ReactNode; label?: ReactNode }) {
  return (
    <Stack gap="xs">
      {label ? (
        <Text c="dimmed" fw={700} size="xs" tt="uppercase">
          {label}
        </Text>
      ) : null}
      {children}
    </Stack>
  );
}
