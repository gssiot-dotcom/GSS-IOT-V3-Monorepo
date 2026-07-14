import { AppShell, Button, Group, NavLink, Stack, Title } from "@mantine/core";
import {
  IconBuilding,
  IconLayoutDashboard,
  IconLogout,
  IconShield,
  IconUsers,
} from "@tabler/icons-react";
import type { AuthContext } from "@gss-iot/contracts";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { t } from "../../app/i18n";
import { useAuth } from "../../shared/auth/auth-context";
import { filterSidebarItems, type SidebarItem } from "../../shared/rbac/filter-sidebar-items";

const adminItems: SidebarItem[] = [
  { path: "/admin/dashboard", permission: "dashboard.view", titleKey: "nav.adminDashboard" },
  { path: "/admin/companies", permission: "companies.view", titleKey: "nav.adminCompanies" },
  { path: "/admin/settings/roles", permission: "admin-roles.view", titleKey: "nav.adminRoles" },
];

const companyItems: SidebarItem[] = [
  { path: "/company/dashboard", permission: "dashboard.view", titleKey: "nav.companyDashboard" },
  { path: "/company/buildings", permission: "buildings.view", titleKey: "nav.companyBuildings" },
  { path: "/company/users", permission: "company-users.view", titleKey: "nav.companyUsers" },
  { path: "/company/roles", permission: "company-roles.view", titleKey: "nav.companyRoles" },
];

function iconFor(titleKey: SidebarItem["titleKey"]) {
  if (titleKey.includes("Dashboard")) {
    return IconLayoutDashboard;
  }
  if (titleKey.includes("Companies") || titleKey.includes("Buildings")) {
    return IconBuilding;
  }
  if (titleKey.includes("Users")) {
    return IconUsers;
  }
  return IconShield;
}

export function PortalLayout({ children, context }: { children: ReactNode; context: AuthContext }) {
  const { logout, session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const items = filterSidebarItems(context === "gss-admin" ? adminItems : companyItems, session);

  return (
    <AppShell header={{ height: 56 }} navbar={{ breakpoint: "sm", width: 252 }} padding="md">
      <AppShell.Header>
        <Group h="100%" justify="space-between" px="md">
          <Title order={3}>{t("app.name")}</Title>
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
      </AppShell.Header>
      <AppShell.Navbar p="sm">
        <Stack gap={4}>
          {items.map((item) => (
            <NavLink
              active={location.pathname === item.path}
              component={Link}
              key={item.path}
              label={t(item.titleKey)}
              leftSection={(() => {
                const Icon = iconFor(item.titleKey);
                return <Icon size={17} />;
              })()}
              to={item.path}
            />
          ))}
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
