import type { AuthContext } from "@gss-iot/contracts";
import type { ReactElement, ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { LoginPage } from "../features/auth/LoginPage";
import { CompanyRolesPage } from "../features/company-management/CompanyRolesPage";
import { CompanyUsersPage } from "../features/company-management/CompanyUsersPage";
import { AdminDevicesPage } from "../features/devices/AdminDevicesPage";
import { CompanyDevicesPage } from "../features/devices/CompanyDevicesPage";
import { GatewayCommandsPage } from "../features/gateway-commands/GatewayCommandsPage";
import {
  BuildingMonitoringPage,
  CompanyMonitoringIndexPage,
  NodeTypeMonitoringPage,
} from "../features/monitoring/CompanyMonitoringPage";
import { CompaniesPage } from "../features/organizations/CompaniesPage";
import { CompanyResourcesPage } from "../features/organizations/CompanyResourcesPage";
import { DesignSystemDemoPage } from "../features/shell/DesignSystemDemoPage";
import { adminNavItems, companyNavItems } from "../features/shell/navigation";
import { PlaceholderPage } from "../features/shell/PlaceholderPage";
import { PortalLayout } from "../features/shell/PortalLayout";
import { AuthProvider } from "../shared/auth/auth-context";
import { RequireAuth } from "../shared/rbac/RequireAuth";
import { RequirePermission } from "../shared/rbac/RequirePermission";

function ProtectedPage({
  children,
  context,
  permission,
}: {
  children: ReactNode;
  context: AuthContext;
  permission: string;
}) {
  return (
    <RequireAuth context={context}>
      <PortalLayout context={context}>
        <RequirePermission permission={permission}>{children}</RequirePermission>
      </PortalLayout>
    </RequireAuth>
  );
}

export function AppRouter(): ReactElement {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div data-testid="app-root">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/phase-2/demo" element={<DesignSystemDemoPage />} />
            {adminNavItems.map((item) => (
              <Route
                element={
                  <ProtectedPage context="gss-admin" permission={item.permission}>
                    {item.path === "/admin/design-system" ? (
                      <DesignSystemDemoPage />
                    ) : item.path === "/admin/companies" ? (
                      <CompaniesPage />
                    ) : item.path === "/admin/devices" ? (
                      <AdminDevicesPage />
                    ) : item.path === "/admin/gateway-commands" ? (
                      <GatewayCommandsPage />
                    ) : (
                      <PlaceholderPage titleKey={item.titleKey} />
                    )}
                  </ProtectedPage>
                }
                key={item.path}
                path={item.path}
              />
            ))}
            {companyNavItems.map((item) => (
              <Route
                element={
                  <ProtectedPage context="company-user" permission={item.permission}>
                    {item.path === "/company/monitoring" ? (
                      <CompanyMonitoringIndexPage />
                    ) : item.path === "/company/devices" ? (
                      <CompanyDevicesPage />
                    ) : item.path === "/company/areas" ? (
                      <CompanyResourcesPage resource="areas" />
                    ) : item.path === "/company/buildings" ? (
                      <CompanyResourcesPage resource="buildings" />
                    ) : item.path === "/company/users" ? (
                      <CompanyUsersPage />
                    ) : item.path === "/company/roles" ? (
                      <CompanyRolesPage />
                    ) : (
                      <PlaceholderPage titleKey={item.titleKey} />
                    )}
                  </ProtectedPage>
                }
                key={item.path}
                path={item.path}
              />
            ))}
            <Route
              element={
                <ProtectedPage context="company-user" permission="monitoring.view">
                  <BuildingMonitoringPage />
                </ProtectedPage>
              }
              path="/company/buildings/:buildingId/monitoring"
            />
            <Route
              element={
                <ProtectedPage context="company-user" permission="monitoring.view">
                  <NodeTypeMonitoringPage />
                </ProtectedPage>
              }
              path="/company/buildings/:buildingId/monitoring/:nodeType"
            />
            <Route path="*" element={<Navigate replace to="/login" />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
