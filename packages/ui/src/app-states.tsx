import { Alert, Button, Center, Group, Loader, Stack, Text, Title } from "@mantine/core";
import {
  IconAlertTriangle,
  IconCircleOff,
  IconLock,
  IconPlugConnectedX,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

interface StateProps {
  action?: ReactNode;
  description?: string;
  title: string;
}

export function LoadingState({ title }: Pick<StateProps, "title">) {
  return (
    <Center mih={220} aria-label={title}>
      <Stack align="center" gap="sm">
        <Loader />
        <Text c="dimmed" size="sm">
          {title}
        </Text>
      </Stack>
    </Center>
  );
}

export function EmptyState({ action, description, title }: StateProps) {
  return (
    <Center mih={220}>
      <Stack align="center" gap="sm" ta="center">
        <IconCircleOff size={34} stroke={1.7} />
        <Title order={3}>{title}</Title>
        {description ? (
          <Text c="dimmed" maw={420} size="sm">
            {description}
          </Text>
        ) : null}
        {action}
      </Stack>
    </Center>
  );
}

export function ErrorState({
  description,
  retryLabel,
  title,
  onRetry,
}: StateProps & { onRetry?: () => void; retryLabel?: string }) {
  return (
    <Alert color="red" icon={<IconAlertTriangle size={18} />} radius="md" title={title}>
      <Stack gap="sm">
        {description ? <Text size="sm">{description}</Text> : null}
        {onRetry && retryLabel ? (
          <Group>
            <Button color="red" onClick={onRetry} size="xs" variant="light">
              {retryLabel}
            </Button>
          </Group>
        ) : null}
      </Stack>
    </Alert>
  );
}

export function ForbiddenState({ description, title }: Omit<StateProps, "action">) {
  return (
    <Center mih={280}>
      <Stack align="center" gap="xs" ta="center">
        <IconLock size={36} stroke={1.7} />
        <Title order={2}>{title}</Title>
        {description ? (
          <Text c="dimmed" maw={440} size="sm">
            {description}
          </Text>
        ) : null}
      </Stack>
    </Center>
  );
}

export function SessionExpiredState({ action, description, title }: StateProps) {
  return (
    <Center mih={280}>
      <Stack align="center" gap="sm" ta="center">
        <IconPlugConnectedX size={36} stroke={1.7} />
        <Title order={2}>{title}</Title>
        {description ? (
          <Text c="dimmed" maw={440} size="sm">
            {description}
          </Text>
        ) : null}
        {action}
      </Stack>
    </Center>
  );
}
