import { Badge, Card, Group, Stack, Text, ThemeIcon } from "@mantine/core";
import {
  IconBuildingCommunity,
  IconBuildingSkyscraper,
  IconHash,
  IconMapPin,
} from "@tabler/icons-react";
import { type ReactNode } from "react";

import { isInteractiveTarget } from "@gss-iot/ui";

export function OrganizationResourceCard({
  action,
  description,
  footer,
  identifier,
  kind,
  kindLabel,
  onClick,
  parent,
  status,
  statusLabel,
  title,
}: {
  action?: ReactNode;
  description?: string;
  footer?: ReactNode;
  identifier?: string;
  kind: "site" | "building";
  kindLabel: string;
  onClick?: () => void;
  parent?: string;
  status: "ACTIVE" | "INACTIVE";
  statusLabel: string;
  title: string;
}) {
  const ResourceIcon = kind === "site" ? IconBuildingCommunity : IconBuildingSkyscraper;
  return (
    <Card
      className={`gss-organization-card gss-organization-card-${kind}${onClick ? " gss-organization-card-interactive" : ""}`}
      onClick={(event) => {
        if (onClick && !isInteractiveTarget(event.target, event.currentTarget)) onClick();
      }}
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
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      withBorder
    >
      <div className="gss-organization-card-visual" aria-hidden="true">
        <ThemeIcon className="gss-organization-card-icon" radius="lg" size={48} variant="light">
          <ResourceIcon size={26} stroke={1.7} />
        </ThemeIcon>
      </div>
      <Stack className="gss-organization-card-content" gap="md">
        <Group align="flex-start" justify="space-between" wrap="nowrap">
          <Stack gap={4} style={{ minWidth: 0 }}>
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
              {kindLabel}
            </Text>
            <Text fw={750} lineClamp={2} size="lg">
              {title}
            </Text>
          </Stack>
          {action}
        </Group>
        <Group gap="xs" wrap="wrap">
          <Badge color={status === "ACTIVE" ? "gss" : "gray"} variant="light">
            {statusLabel}
          </Badge>
          {identifier ? (
            <Group gap={4} wrap="nowrap">
              <IconHash size={14} />
              <Text c="dimmed" size="xs">
                {identifier}
              </Text>
            </Group>
          ) : null}
        </Group>
        <Stack gap={6} mih={44}>
          {parent ? (
            <Text c="dimmed" lineClamp={1} size="sm">
              {parent}
            </Text>
          ) : null}
          <Group align="flex-start" gap={6} wrap="nowrap">
            <IconMapPin className="gss-organization-card-meta-icon" size={16} />
            <Text c="dimmed" lineClamp={2} size="sm">
              {description || "-"}
            </Text>
          </Group>
        </Stack>
        {footer ? <div className="gss-organization-card-footer">{footer}</div> : null}
      </Stack>
    </Card>
  );
}
