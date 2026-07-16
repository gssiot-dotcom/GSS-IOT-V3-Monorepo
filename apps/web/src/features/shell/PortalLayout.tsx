import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Burger,
  Button,
  Group,
  NavLink,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconBell, IconLogout } from "@tabler/icons-react";
import type { AuthContext } from "@gss-iot/contracts";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { t } from "../../app/i18n";
import { useAuth } from "../../shared/auth/auth-context";
import { filterSidebarItems } from "../../shared/rbac/filter-sidebar-items";
import { adminNavItems, companyNavItems, routeTitles } from "./navigation";

export function PortalLayout({ children, context }: { children: ReactNode; context: AuthContext }) {
  const [opened, { toggle }] = useDisclosure();
  const { logout, session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const allItems = context === "gss-admin" ? adminNavItems : companyNavItems;
  const items = filterSidebarItems(allItems, session);
  const titleKey =
    routeTitles.get(location.pathname) ??
    allItems.find((item) => location.pathname.startsWith(`${item.path}/`))?.titleKey;
  const shellTitle = context === "gss-admin" ? t("shell.admin") : t("shell.company");

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ breakpoint: "sm", collapsed: { mobile: !opened }, width: 272 }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" justify="space-between" px="md">
          <Group gap="sm">
            <Burger hiddenFrom="sm" onClick={toggle} opened={opened} size="sm" />
            <Stack gap={0}>
              <Title order={3}>{shellTitle}</Title>
              <Text c="dimmed" size="xs">
                {titleKey ? t(titleKey) : t("app.name")}
              </Text>
            </Stack>
          </Group>
          <Group gap="xs">
            <Badge color="yellow" variant="light">
              {t("shell.reconnecting")}
            </Badge>
            <Tooltip label={t("app.notifications")}>
              <ActionIcon aria-label={t("app.notifications")}>
                <IconBell size={18} />
              </ActionIcon>
            </Tooltip>
            <Group gap="xs" visibleFrom="sm">
              <Avatar color="gss" size="sm">
                {session?.user.name.slice(0, 1)}
              </Avatar>
              <Text fw={500} size="sm">
                {session?.user.name}
              </Text>
            </Group>
            <Button
              leftSection={<IconLogout size={16} />}
              onClick={async () => {
                await logout();
                void navigate("/login");
              }}
              variant="subtle"
            >
              {t("auth.signOut")}
            </Button>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="sm">
        <Stack gap={4}>
          {items.map((item) =>
            (() => {
              const Icon = item.icon;
              return (
                <NavLink
                  active={
                    location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
                  }
                  component={Link}
                  key={item.path}
                  label={t(item.titleKey)}
                  leftSection={<Icon size={17} />}
                  to={item.path}
                />
              );
            })(),
          )}
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
