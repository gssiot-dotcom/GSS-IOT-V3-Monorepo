import {
  IconAdjustments,
  IconBell,
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
  sectionKey: TranslationKey;
}

export const adminNavItems: ShellNavItem[] = [
  {
    icon: IconHome,
    path: "/admin/welcome",
    permission: "welcome.view",
    sectionKey: "shell.sectionOverview",
    titleKey: "nav.adminWelcome",
  },
  {
    icon: IconDashboard,
    path: "/admin/dashboard",
    permission: "dashboard.view",
    sectionKey: "shell.sectionOverview",
    titleKey: "nav.adminDashboard",
  },
  {
    icon: IconBuildingCommunity,
    path: "/admin/companies",
    permission: "companies.view",
    sectionKey: "shell.sectionOrganizations",
    titleKey: "nav.adminCompanies",
  },
  {
    icon: IconDeviceDesktopAnalytics,
    path: "/admin/devices",
    permission: "devices.view",
    sectionKey: "shell.sectionDevices",
    titleKey: "nav.adminDevices",
  },
  {
    icon: IconExchange,
    path: "/admin/gateway-commands",
    permission: "mqtt-commands.view",
    sectionKey: "shell.sectionDevices",
    titleKey: "nav.adminGatewayCommands",
  },
  {
    icon: IconChartBar,
    path: "/admin/monitoring",
    permission: "monitoring.view",
    sectionKey: "shell.sectionOverview",
    titleKey: "nav.adminMonitoring",
  },
  {
    icon: IconBellRinging,
    path: "/admin/alarms",
    permission: "alarms.view",
    sectionKey: "shell.sectionOperations",
    titleKey: "nav.adminAlarms",
  },
  {
    icon: IconAdjustments,
    path: "/admin/alarm-rules",
    permission: "alarm-rules.view",
    sectionKey: "shell.sectionOperations",
    titleKey: "nav.adminAlarmRules",
  },
  {
    icon: IconBell,
    path: "/admin/notifications",
    permission: "notifications.view",
    sectionKey: "shell.sectionOperations",
    titleKey: "nav.adminNotifications",
  },
  {
    icon: IconReportAnalytics,
    path: "/admin/reports",
    permission: "reports.view",
    sectionKey: "shell.sectionOperations",
    titleKey: "nav.adminReports",
  },
  {
    icon: IconShield,
    path: "/admin/settings/roles",
    permission: "admin-roles.view",
    sectionKey: "shell.sectionSettings",
    titleKey: "nav.adminRoles",
  },
  {
    icon: IconSettings,
    path: "/admin/settings/system",
    permission: "settings.system.view",
    sectionKey: "shell.sectionSettings",
    titleKey: "nav.adminSettings",
  },
  {
    icon: IconClipboardList,
    path: "/admin/design-system",
    permission: "settings.system.view",
    sectionKey: "shell.sectionSettings",
    titleKey: "nav.adminDesignSystem",
  },
];

export const companyNavItems: ShellNavItem[] = [
  {
    icon: IconHome,
    path: "/company/welcome",
    permission: "welcome.view",
    sectionKey: "shell.sectionOverview",
    titleKey: "nav.companyWelcome",
  },
  {
    icon: IconDashboard,
    path: "/company/dashboard",
    permission: "dashboard.view",
    sectionKey: "shell.sectionOverview",
    titleKey: "nav.companyDashboard",
  },
  {
    icon: IconSitemap,
    path: "/company/areas",
    permission: "areas.view",
    sectionKey: "shell.sectionOrganizations",
    titleKey: "nav.companyAreas",
  },
  {
    icon: IconBuilding,
    path: "/company/buildings",
    permission: "buildings.view",
    sectionKey: "shell.sectionOrganizations",
    titleKey: "nav.companyBuildings",
  },
  {
    icon: IconDevices,
    path: "/company/devices",
    permission: "company-devices.view",
    sectionKey: "shell.sectionDevices",
    titleKey: "nav.companyDevices",
  },
  {
    icon: IconChartBar,
    path: "/company/monitoring",
    permission: "monitoring.view",
    sectionKey: "shell.sectionOverview",
    titleKey: "nav.companyMonitoring",
  },
  {
    icon: IconBellRinging,
    path: "/company/alarms",
    permission: "alarms.view",
    sectionKey: "shell.sectionOperations",
    titleKey: "nav.companyAlarms",
  },
  {
    icon: IconAdjustments,
    path: "/company/alarm-rules",
    permission: "alarm-rules.view",
    sectionKey: "shell.sectionOperations",
    titleKey: "nav.companyAlarmRules",
  },
  {
    icon: IconBell,
    path: "/company/notifications",
    permission: "notifications.view",
    sectionKey: "shell.sectionOperations",
    titleKey: "nav.companyNotifications",
  },
  {
    icon: IconReportAnalytics,
    path: "/company/reports",
    permission: "reports.view",
    sectionKey: "shell.sectionOperations",
    titleKey: "nav.companyReports",
  },
  {
    icon: IconUsers,
    path: "/company/users",
    permission: "company-users.view",
    sectionKey: "shell.sectionPeople",
    titleKey: "nav.companyUsers",
  },
  {
    icon: IconShield,
    path: "/company/roles",
    permission: "company-roles.view",
    sectionKey: "shell.sectionPeople",
    titleKey: "nav.companyRoles",
  },
  {
    icon: IconSettings,
    path: "/company/settings",
    permission: "settings.company.view",
    sectionKey: "shell.sectionSettings",
    titleKey: "nav.companySettings",
  },
];

export const routeTitles = new Map<string, TranslationKey>(
  [...adminNavItems, ...companyNavItems].map((item) => [item.path, item.titleKey]),
);
