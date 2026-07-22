import type { AuthContext, AuthSession } from "@gss-iot/contracts";
import { Avatar, Badge, Card, Group, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconArrowUpRight, IconBuilding, IconKey, IconMail, IconPhone } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { PageHeader, ResponsiveContentGrid, EmptyState, LoadingState } from "@gss-iot/ui";

import { t, tf } from "../../app/i18n";
import { useAuth } from "../../shared/auth/auth-context";
import { filterSidebarItems } from "../../shared/rbac/filter-sidebar-items";
import { adminNavItems, companyNavItems } from "./navigation";

function displayDate(value: string | null | undefined): string {
  if (!value) return t("welcome.notAvailable");
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function sessionProfile(session: AuthSession) {
  const { user } = session;
  return (
    <Card padding="lg" radius="md" withBorder>
      <Group align="flex-start" wrap="nowrap">
        <Avatar color="gss" size="lg">
          {user.name.slice(0, 1).toUpperCase()}
        </Avatar>
        <Stack gap="xs">
          <Text fw={700} size="lg">
            {user.name}
          </Text>
          <Group gap="xs">
            <Badge variant="light">{user.role?.name ?? t("welcome.roleUnavailable")}</Badge>
            {user.isSuperAdmin ? <Badge color="violet">{t("welcome.superAdmin")}</Badge> : null}
            <Badge color={user.isActive ? "gss" : "gray"} variant="outline">
              {user.isActive ? t("management.active") : t("management.inactive")}
            </Badge>
          </Group>
          <Text c="dimmed" size="sm">
            {user.email}
          </Text>
        </Stack>
      </Group>
    </Card>
  );
}

export function WelcomePage({ context }: { context: AuthContext }) {
  const { session, status } = useAuth();
  const navItems = context === "gss-admin" ? adminNavItems : companyNavItems;
  const quickLinks = filterSidebarItems(navItems, session).filter(
    (item) => !item.path.endsWith("/welcome"),
  );

  if (status === "loading" || !session) return <LoadingState title={t("common.loading")} />;

  return (
    <Stack gap="xl">
      <PageHeader
        subtitle={
          context === "gss-admin" ? t("welcome.adminSubtitle") : t("welcome.companySubtitle")
        }
        title={tf("welcome.greeting", { name: session.user.name })}
      />
      <ResponsiveContentGrid>
        {sessionProfile(session)}
        <Card padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon color="gss" variant="light">
                <IconKey size={17} />
              </ThemeIcon>
              <Text fw={700}>{t("welcome.accessSummary")}</Text>
            </Group>
            <Text c="dimmed" size="sm">
              {tf("welcome.permissionCount", { count: session.user.permissions.length })}
            </Text>
            {context === "company-user" && session.user.company ? (
              <Group gap="xs">
                <IconBuilding size={16} />
                <Text size="sm">{session.user.company.name}</Text>
              </Group>
            ) : null}
          </Stack>
        </Card>
      </ResponsiveContentGrid>
      <Stack gap="md">
        <PageHeader subtitle={t("welcome.quickLinksSubtitle")} title={t("welcome.quickLinks")} />
        {quickLinks.length ? (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Card component={Link} key={item.path} padding="md" to={item.path} withBorder>
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm">
                      <ThemeIcon color="gss" variant="light">
                        <Icon size={17} />
                      </ThemeIcon>
                      <Text fw={600}>{t(item.titleKey)}</Text>
                    </Group>
                    <IconArrowUpRight aria-hidden size={17} />
                  </Group>
                </Card>
              );
            })}
          </SimpleGrid>
        ) : (
          <EmptyState
            description={t("welcome.noModulesDescription")}
            title={t("welcome.noModules")}
          />
        )}
      </Stack>
    </Stack>
  );
}

export function ProfilePage({ context }: { context: AuthContext }) {
  const { session, status } = useAuth();
  if (status === "loading" || !session) return <LoadingState title={t("common.loading")} />;

  const { user } = session;
  return (
    <Stack gap="xl">
      <PageHeader
        subtitle={
          context === "gss-admin" ? t("profile.adminSubtitle") : t("profile.companySubtitle")
        }
        title={t("profile.title")}
      />
      {sessionProfile(session)}
      <Card padding="lg" radius="md" withBorder>
        <Stack gap="sm">
          <Text fw={700}>{t("profile.details")}</Text>
          <Group gap="xs">
            <IconMail size={16} />
            <Text size="sm">{user.email}</Text>
          </Group>
          <Group gap="xs">
            <IconPhone size={16} />
            <Text size="sm">{user.phone || t("welcome.notAvailable")}</Text>
          </Group>
          {context === "company-user" && user.company ? (
            <Group gap="xs">
              <IconBuilding size={16} />
              <Text size="sm">{user.company.name}</Text>
            </Group>
          ) : null}
          <Text c="dimmed" size="sm">
            {tf("profile.roleMetadata", {
              key: user.role?.key ?? t("welcome.notAvailable"),
              id: user.role?.id ?? t("welcome.notAvailable"),
            })}
          </Text>
          <Text c="dimmed" size="sm">
            {tf("profile.lastLogin", { date: displayDate(user.lastLoginAt) })}
          </Text>
          <Text c="dimmed" size="sm">
            {tf("welcome.permissionCount", { count: user.permissions.length })}
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
