import {
  ActionIcon,
  Avatar,
  Badge,
  Card,
  Group,
  Menu,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  type MantineColor,
  type SimpleGridProps,
} from "@mantine/core";
import { IconDotsVertical } from "@tabler/icons-react";
import { Fragment, type ReactNode } from "react";
import { isInteractiveTarget } from "./data-table";
import { StatusBadge, type GssStatus } from "./status-badge";

export function EntityCardGrid({ children, ...props }: SimpleGridProps) {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, lg: 3 }} spacing="md" {...props}>
      {children}
    </SimpleGrid>
  );
}

export function EntityMetric({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text fw={700} size="sm">
        {value}
      </Text>
    </Stack>
  );
}

export function EntityPrimaryCell({
  avatar,
  identifier,
  onClick,
  title,
}: {
  avatar?: ReactNode;
  identifier?: ReactNode;
  onClick?: () => void;
  title: ReactNode;
}) {
  const content = (
    <Group align="center" gap="sm" wrap="nowrap">
      {avatar ?? (
        <Avatar color="gss" radius="md" size="sm">
          {String(title).slice(0, 1).toUpperCase()}
        </Avatar>
      )}
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Text className="gss-entity-primary-title" fw={650} size="sm">
          {title}
        </Text>
        {identifier ? (
          <Text c="dimmed" size="xs">
            {identifier}
          </Text>
        ) : null}
      </Stack>
    </Group>
  );

  return onClick ? (
    <UnstyledButton className="gss-entity-primary-button" onClick={onClick}>
      {content}
    </UnstyledButton>
  ) : (
    content
  );
}

export function EntityStatusBadge({ label, status }: { label: string; status: GssStatus }) {
  return <StatusBadge label={label} status={status} />;
}

export function EntityStatusRow({
  color = "gss",
  label,
  value,
}: {
  color?: MantineColor;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <Group gap="xs" justify="space-between" wrap="nowrap">
      <Text c="dimmed" size="sm">
        {label}
      </Text>
      <Badge color={color} variant="light">
        {value}
      </Badge>
    </Group>
  );
}

export function EntityActionMenu({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: Array<{
    key: string;
    label: ReactNode;
    onClick: () => void;
    color?: MantineColor;
    disabled?: boolean;
    disabledReason?: string;
    icon?: ReactNode;
    destructive?: boolean;
  }>;
}) {
  return (
    <Menu aria-label={ariaLabel} position="bottom-end" shadow="md" withinPortal>
      <Tooltip label={ariaLabel}>
        <Menu.Target>
          <ActionIcon aria-label={ariaLabel} data-row-action variant="subtle">
            <IconDotsVertical size={18} />
          </ActionIcon>
        </Menu.Target>
      </Tooltip>
      <Menu.Dropdown>
        {items.map((item, index) => (
          <Fragment key={item.key}>
            {item.destructive && index > 0 ? <Menu.Divider /> : null}
            <Menu.Item
              color={item.color}
              data-row-action
              data-destructive={item.destructive || undefined}
              disabled={item.disabled}
              leftSection={item.icon}
              onClick={item.onClick}
              title={item.disabledReason}
            >
              {item.label}
            </Menu.Item>
          </Fragment>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

export function EntityCard({
  action,
  children,
  description,
  eyebrow,
  onClick,
  title,
}: {
  action?: ReactNode;
  children?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  onClick?: () => void;
  title: ReactNode;
}) {
  return (
    <Card
      className={onClick ? "gss-entity-card gss-entity-card-interactive" : "gss-entity-card"}
      onClick={(event) => {
        if (isInteractiveTarget(event.target, event.currentTarget)) return;
        onClick?.();
      }}
      role={onClick ? "button" : undefined}
      shadow="md"
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (
          onClick &&
          !isInteractiveTarget(event.target, event.currentTarget) &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <Stack gap={4} style={{ minWidth: 0 }}>
          {eyebrow ? (
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
              {eyebrow}
            </Text>
          ) : null}
          <Text fw={700} size="lg" style={{ overflowWrap: "anywhere" }}>
            {title}
          </Text>
          {description ? (
            <Text c="dimmed" size="sm">
              {description}
            </Text>
          ) : null}
        </Stack>
        {action}
      </Group>
      {children ? (
        <Stack gap="sm" mt="md">
          {children}
        </Stack>
      ) : null}
    </Card>
  );
}
