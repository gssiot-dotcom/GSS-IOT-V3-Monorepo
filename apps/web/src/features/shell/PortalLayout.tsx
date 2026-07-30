import {
  ActionIcon,
  AppShell,
  Avatar,
  Box,
  Burger,
  Divider,
  Group,
  Menu,
  Indicator,
  NavLink,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
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
import { LanguageSelector, t, tf } from "../../app/i18n";
import { apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import {
  CompanyBrandingProvider,
  useCompanyBranding,
} from "../../shared/branding/company-branding-context";
import { filterSidebarItems } from "../../shared/rbac/filter-sidebar-items";
import { hasPermission } from "../../shared/rbac/has-permission";
import {
  GssIconButton,
  GssPlatformBrand,
  RealtimeStatusBadge,
  type RealtimeConnectionState,
} from "@gss-iot/ui";
import { adminNavItems, companyNavItems, routeTitles, type ShellNavItem } from "./navigation";

export function PortalLayout({ children, context }: { children: ReactNode; context: AuthContext }) {
  if (context === "company-user") {
    return (
      <CompanyBrandingProvider>
        <PortalShell context={context}>{children}</PortalShell>
      </CompanyBrandingProvider>
    );
  }
  return <PortalShell context={context}>{children}</PortalShell>;
}

function PortalShell({ children, context }: { children: ReactNode; context: AuthContext }) {
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
        <Group h="100%" justify="space-between" px={{ base: "sm", sm: "lg" }} wrap="nowrap">
          <Group className="gss-shell-header-context" gap="sm" wrap="nowrap">
            <Burger
              aria-label={t("shell.toggleNavigation")}
              hiddenFrom="sm"
              onClick={toggle}
              opened={opened}
              size="sm"
            />
            <Box className="gss-shell-header-brand-full">
              <GssPlatformBrand label={t("branding.platformName")} />
            </Box>
            <Box className="gss-shell-header-brand-compact">
              <GssPlatformBrand compact label={t("branding.platformName")} />
            </Box>
            <Divider orientation="vertical" />
            <Stack gap={0} style={{ minWidth: 0 }}>
              <Text fw={700} lineClamp={1} size="sm">
                {titleKey ? t(titleKey) : t("app.name")}
              </Text>
              <Text c="dimmed" lineClamp={1} size="xs">
                {shellTitle} / {titleKey ? t(titleKey) : t("app.name")}
              </Text>
            </Stack>
          </Group>
          <Group className="gss-shell-header-actions" gap="xs" wrap="nowrap">
            {realtimeState !== "idle" && realtimeState !== "connected" ? (
              <Box className="gss-shell-header-realtime">
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
              </Box>
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
            <LanguageSelector />
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
          scrollbars="y"
          type="never"
        >
          <Stack gap="lg">
            {context === "company-user" ? (
              <CompanySidebarBrand companyName={session?.user.company?.name ?? shellTitle} />
            ) : (
              <Stack className="gss-admin-sidebar-brand" gap="xs" px="xs" py="xs">
                <img alt={t("branding.platformName")} src="/assets/gss-logos/GSS-logo.svg" />
                <Stack gap={0} style={{ minWidth: 0 }}>
                  <Text fw={800} size="sm">
                    {t("app.name")}
                  </Text>
                  <Text className="gss-admin-sidebar-portal-label" size="xs">
                    {shellTitle}
                  </Text>
                </Stack>
              </Stack>
            )}
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

function CompanySidebarBrand({ companyName }: { companyName: string }) {
  const { logoUrl, status } = useCompanyBranding();
  return (
    <Stack className="gss-company-sidebar-brand" gap="sm" px="xs" py="xs">
      <Box className="gss-company-sidebar-logo-plate">
        {status === "loading" ? (
          <Skeleton height={72} radius="md" width="100%" />
        ) : logoUrl ? (
          <img alt={tf("branding.logoAlt", { company: companyName })} src={logoUrl} />
        ) : (
          <Avatar color="gss" radius="md" size={64}>
            {companyInitials(companyName)}
          </Avatar>
        )}
      </Box>
      <Text fw={800} lineClamp={2} size="sm" title={companyName}>
        {companyName}
      </Text>
    </Stack>
  );
}

function companyInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || t("branding.fallbackInitials")
  );
}
