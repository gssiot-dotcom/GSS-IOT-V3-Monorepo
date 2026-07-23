import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Box,
  Burger,
  Divider,
  Group,
  Menu,
  Indicator,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconBell,
  IconBuilding,
  IconKey,
  IconLogout,
  IconMoonStars,
  IconSun,
  IconUserCircle,
} from "@tabler/icons-react";
import type { AuthContext } from "@gss-iot/contracts";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

import { readWebEnv } from "../../app/env";
import { t, tf } from "../../app/i18n";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { filterSidebarItems } from "../../shared/rbac/filter-sidebar-items";
import { hasPermission } from "../../shared/rbac/has-permission";
import { GssIconButton, RealtimeStatusBadge, type RealtimeConnectionState } from "@gss-iot/ui";
import { adminNavItems, companyNavItems, routeTitles, type ShellNavItem } from "./navigation";

export function PortalLayout({ children, context }: { children: ReactNode; context: AuthContext }) {
  const [opened, { close, toggle }] = useDisclosure();
  const [unreadCount, setUnreadCount] = useState(0);
  const [realtimeState, setRealtimeState] = useState<RealtimeConnectionState>("idle");
  const { logout, session } = useAuth();
  const { setColorScheme } = useMantineColorScheme({ keepTransitions: true });
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: false,
  });
  const location = useLocation();
  const navigate = useNavigate();
  const allItems = context === "gss-admin" ? adminNavItems : companyNavItems;
  const items = filterSidebarItems(allItems, session);
  const titleKey =
    routeTitles.get(location.pathname) ??
    allItems.find((item) => location.pathname.startsWith(`${item.path}/`))?.titleKey;
  const shellTitle = context === "gss-admin" ? t("shell.admin") : t("shell.company");
  const canViewNotifications = Boolean(session && hasPermission(session, "notifications.view"));
  const sections = items.reduce<
    Array<{ key: string; titleKey: ShellNavItem["sectionKey"]; items: typeof items }>
  >((result, item) => {
    const section = result.find((entry) => entry.key === item.sectionKey);
    if (section) {
      section.items.push(item);
    } else {
      result.push({ key: item.sectionKey, titleKey: item.sectionKey, items: [item] });
    }
    return result;
  }, []);

  useEffect(() => {
    if (!session || !canViewNotifications) {
      setUnreadCount(0);
      setRealtimeState("idle");
      return;
    }
    setRealtimeState("connecting");
    const basePath = context === "gss-admin" ? "/admin" : "/company";
    let cancelled = false;
    void apiRequest<{ unreadCount: number }>(session, `${basePath}/notifications/unread-count`)
      .then((response) => {
        if (!cancelled) setUnreadCount(response.unreadCount);
      })
      .catch(() => {
        if (!cancelled) setUnreadCount(0);
      });
    const socket = io(readWebEnv().apiBaseUrl, {
      auth: { token: session.accessToken },
      transports: ["websocket"],
    });
    socket.on("connect", () => {
      setRealtimeState("connected");
      socket.emit("notifications:join");
    });
    socket.on("disconnect", () => setRealtimeState("offline"));
    socket.on("connect_error", () => setRealtimeState("offline"));
    socket.io.on("reconnect_attempt", () => setRealtimeState("reconnecting"));
    socket.io.on("reconnect", () => setRealtimeState("connected"));
    socket.on("notifications:update", (event: { unreadCount?: number }) => {
      if (typeof event.unreadCount === "number") {
        setUnreadCount(event.unreadCount);
      }
    });
    return () => {
      cancelled = true;
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("notifications:update");
      socket.io.off("reconnect_attempt");
      socket.io.off("reconnect");
      socket.close();
    };
  }, [canViewNotifications, context, session]);

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ breakpoint: "sm", collapsed: { mobile: !opened }, width: 272 }}
      padding="md"
    >
      <AppShell.Header className="gss-shell-header">
        <Group h="100%" justify="space-between" px="lg" wrap="wrap">
          <Group gap="sm">
            <Burger
              aria-label={t("shell.toggleNavigation")}
              hiddenFrom="sm"
              onClick={toggle}
              opened={opened}
              size="sm"
            />
            <Stack gap={0}>
              <Title order={3}>{shellTitle}</Title>
              <Group gap="xs">
                <Text c="dimmed" size="xs">
                  {t("app.name")}
                </Text>
                <Text c="dimmed" size="xs">
                  /
                </Text>
                <Text fw={600} size="xs">
                  {titleKey ? t(titleKey) : t("app.name")}
                </Text>
              </Group>
            </Stack>
          </Group>
          <Group gap="xs">
            {realtimeState !== "idle" && realtimeState !== "connected" ? (
              <RealtimeStatusBadge
                label={
                  realtimeState === "connecting"
                    ? t("shell.realtimeConnecting")
                    : realtimeState === "reconnecting"
                      ? t("shell.realtimeReconnecting")
                      : t("shell.realtimeOffline")
                }
                status={realtimeState}
              />
            ) : null}
            {canViewNotifications ? (
              <Tooltip label={t("app.notifications")}>
                <Indicator disabled={!unreadCount} inline label={unreadCount} size={16}>
                  <ActionIcon
                    aria-label={t("app.notifications")}
                    onClick={() =>
                      navigate(
                        context === "gss-admin" ? "/admin/notifications" : "/company/notifications",
                      )
                    }
                  >
                    <IconBell size={18} />
                  </ActionIcon>
                </Indicator>
              </Tooltip>
            ) : null}
            <Tooltip
              label={
                computedColorScheme === "dark"
                  ? t("shell.themeSwitchToLight")
                  : t("shell.themeSwitchToDark")
              }
            >
              <GssIconButton
                aria-label={
                  computedColorScheme === "dark"
                    ? t("shell.themeSwitchToLight")
                    : t("shell.themeSwitchToDark")
                }
                data-testid="theme-toggle"
                onClick={() => setColorScheme(computedColorScheme === "dark" ? "light" : "dark")}
              >
                {computedColorScheme === "dark" ? (
                  <IconSun size={18} />
                ) : (
                  <IconMoonStars size={18} />
                )}
              </GssIconButton>
            </Tooltip>
            <Menu position="bottom-end" shadow="md" withinPortal>
              <Menu.Target>
                <UnstyledButton aria-label={t("shell.accountMenu")}>
                  <Group gap="xs" wrap="nowrap">
                    <Avatar color="gss" size="sm">
                      {session?.user.name.slice(0, 1).toUpperCase()}
                    </Avatar>
                    <Stack gap={0} visibleFrom="sm">
                      <Text fw={600} size="sm">
                        {session?.user.name}
                      </Text>
                      <Text c="dimmed" size="xs">
                        {session?.user.email}
                      </Text>
                    </Stack>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{session?.user.name}</Menu.Label>
                <Menu.Item
                  leftSection={<IconUserCircle size={16} />}
                  component={Link}
                  to={context === "gss-admin" ? "/admin/profile" : "/company/profile"}
                >
                  {t("profile.open")}
                </Menu.Item>
                <Menu.Item leftSection={<IconKey size={16} />}>
                  {tf("welcome.permissionCount", { count: session?.user.permissions.length ?? 0 })}
                </Menu.Item>
                {session?.user.company ? (
                  <Menu.Item leftSection={<IconBuilding size={16} />}>
                    {session.user.company.name}
                  </Menu.Item>
                ) : null}
                <Menu.Label>{session?.user.role?.name ?? t("welcome.roleUnavailable")}</Menu.Label>
                {session?.user.isSuperAdmin ? (
                  <Menu.Label>{t("welcome.superAdmin")}</Menu.Label>
                ) : null}
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconLogout size={16} />}
                  onClick={async () => {
                    await logout();
                    void navigate("/login");
                  }}
                >
                  {t("auth.signOut")}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar className="gss-shell-navbar">
        <ScrollArea
          className="gss-sidebar-scrollarea"
          classNames={{ viewport: "gss-sidebar-scrollarea-viewport" }}
          px="sm"
          py="md"
          type="auto"
        >
          <Stack gap="lg">
            <Group className="gss-shell-brand" gap="sm" px="xs" py="xs" wrap="nowrap">
              <Avatar color="gss" radius="md" size="md">
                G
              </Avatar>
              <Stack gap={0} style={{ minWidth: 0 }}>
                <Text fw={800} size="sm">
                  {t("app.name")}
                </Text>
                <Badge color="gss" size="xs" variant="light">
                  {shellTitle}
                </Badge>
              </Stack>
            </Group>
            <Divider />
            {sections.map((section) => (
              <Stack gap={4} key={section.key}>
                <Text
                  className="gss-sidebar-section-title"
                  fw={700}
                  px="xs"
                  size="xs"
                  tt="uppercase"
                >
                  {t(section.titleKey)}
                </Text>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      active={
                        location.pathname === item.path ||
                        location.pathname.startsWith(`${item.path}/`)
                      }
                      component={Link}
                      key={item.path}
                      label={t(item.titleKey)}
                      leftSection={<Icon size={17} />}
                      onClick={close}
                      to={item.path}
                    />
                  );
                })}
              </Stack>
            ))}
          </Stack>
        </ScrollArea>
      </AppShell.Navbar>
      <AppShell.Main
        className="gss-shell-main"
        style={{ backgroundColor: "var(--gss-app-background)" }}
      >
        <Box className="gss-main-content">{children}</Box>
      </AppShell.Main>
    </AppShell>
  );
}
