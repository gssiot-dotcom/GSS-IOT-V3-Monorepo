import {
  IconBellRinging,
  IconBuilding,
  IconBuildingCommunity,
  IconChartBar,
  IconClipboardList,
  IconDashboard,
  IconDeviceDesktopAnalytics,
  IconDevices,
  IconExchange,
  IconHome,
  IconReportAnalytics,
  IconSettings,
  IconShield,
  IconSitemap,
  IconUsers,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

import type { TranslationKey } from "../../app/i18n";
import type { SidebarItem } from "../../shared/rbac/filter-sidebar-items";

export interface ShellNavItem extends SidebarItem {
  icon: ComponentType<{ size?: number }>;
}

export const adminNavItems: ShellNavItem[] = [
  {
    icon: IconHome,
    path: "/admin/welcome",
    permission: "welcome.view",
    titleKey: "nav.adminWelcome",
  },
  {
    icon: IconDashboard,
    path: "/admin/dashboard",
    permission: "dashboard.view",
    titleKey: "nav.adminDashboard",
  },
  {
    icon: IconBuildingCommunity,
    path: "/admin/companies",
    permission: "companies.view",
    titleKey: "nav.adminCompanies",
  },
  {
    icon: IconDeviceDesktopAnalytics,
    path: "/admin/devices",
    permission: "devices.view",
    titleKey: "nav.adminDevices",
  },
  {
    icon: IconExchange,
    path: "/admin/gateway-commands",
    permission: "mqtt-commands.view",
    titleKey: "nav.adminGatewayCommands",
  },
  {
    icon: IconChartBar,
    path: "/admin/monitoring",
    permission: "monitoring.view",
    titleKey: "nav.adminMonitoring",
  },
  {
    icon: IconBellRinging,
    path: "/admin/alarms",
    permission: "alarms.view",
    titleKey: "nav.adminAlarms",
  },
  {
    icon: IconReportAnalytics,
    path: "/admin/reports",
    permission: "reports.view",
    titleKey: "nav.adminReports",
  },
  {
    icon: IconShield,
    path: "/admin/settings/roles",
    permission: "admin-roles.view",
    titleKey: "nav.adminRoles",
  },
  {
    icon: IconSettings,
    path: "/admin/settings/system",
    permission: "settings.system.view",
    titleKey: "nav.adminSettings",
  },
  {
    icon: IconClipboardList,
    path: "/admin/design-system",
    permission: "settings.system.view",
    titleKey: "nav.adminDesignSystem",
  },
];

export const companyNavItems: ShellNavItem[] = [
  {
    icon: IconHome,
    path: "/company/welcome",
    permission: "welcome.view",
    titleKey: "nav.companyWelcome",
  },
  {
    icon: IconDashboard,
    path: "/company/dashboard",
    permission: "dashboard.view",
    titleKey: "nav.companyDashboard",
  },
  {
    icon: IconSitemap,
    path: "/company/areas",
    permission: "areas.view",
    titleKey: "nav.companyAreas",
  },
  {
    icon: IconBuilding,
    path: "/company/buildings",
    permission: "buildings.view",
    titleKey: "nav.companyBuildings",
  },
  {
    icon: IconDevices,
    path: "/company/devices",
    permission: "company-devices.view",
    titleKey: "nav.companyDevices",
  },
  {
    icon: IconChartBar,
    path: "/company/monitoring",
    permission: "monitoring.view",
    titleKey: "nav.companyMonitoring",
  },
  {
    icon: IconBellRinging,
    path: "/company/alarms",
    permission: "alarms.view",
    titleKey: "nav.companyAlarms",
  },
  {
    icon: IconReportAnalytics,
    path: "/company/reports",
    permission: "reports.view",
    titleKey: "nav.companyReports",
  },
  {
    icon: IconUsers,
    path: "/company/users",
    permission: "company-users.view",
    titleKey: "nav.companyUsers",
  },
  {
    icon: IconShield,
    path: "/company/roles",
    permission: "company-roles.view",
    titleKey: "nav.companyRoles",
  },
  {
    icon: IconSettings,
    path: "/company/settings",
    permission: "settings.company.view",
    titleKey: "nav.companySettings",
  },
];

export const routeTitles = new Map<string, TranslationKey>(
  [...adminNavItems, ...companyNavItems].map((item) => [item.path, item.titleKey]),
);
