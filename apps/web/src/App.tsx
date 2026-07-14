import { Badge, Container, Group, Stack, Text, Title } from "@mantine/core";
import type { ReactElement } from "react";

import { readWebEnv } from "./app/env";

export function App(): ReactElement {
  const env = readWebEnv();

  return (
    <Container data-testid="app-root" py="xl">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={1}>GSS IoT V3</Title>
          <Badge color="gss">Phase 0</Badge>
        </Group>
        <Text c="dimmed">Bootstrap scaffold is ready for the API and web workspaces.</Text>
        <Text size="sm">API base URL: {env.apiBaseUrl}</Text>
      </Stack>
    </Container>
  );
}
