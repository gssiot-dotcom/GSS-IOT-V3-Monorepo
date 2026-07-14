import type { AuthContext } from "@gss-iot/contracts";
import type { ReactElement, ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { LoginPage } from "../features/auth/LoginPage";
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
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedPage context="gss-admin" permission="dashboard.view">
                  <PlaceholderPage titleKey="nav.adminDashboard" />
                </ProtectedPage>
              }
            />
            <Route
              path="/admin/companies"
              element={
                <ProtectedPage context="gss-admin" permission="companies.view">
                  <PlaceholderPage titleKey="nav.adminCompanies" />
                </ProtectedPage>
              }
            />
            <Route
              path="/admin/settings/roles"
              element={
                <ProtectedPage context="gss-admin" permission="admin-roles.view">
                  <PlaceholderPage titleKey="nav.adminRoles" />
                </ProtectedPage>
              }
            />
            <Route
              path="/company/dashboard"
              element={
                <ProtectedPage context="company-user" permission="dashboard.view">
                  <PlaceholderPage titleKey="nav.companyDashboard" />
                </ProtectedPage>
              }
            />
            <Route
              path="/company/buildings"
              element={
                <ProtectedPage context="company-user" permission="buildings.view">
                  <PlaceholderPage titleKey="nav.companyBuildings" />
                </ProtectedPage>
              }
            />
            <Route
              path="/company/users"
              element={
                <ProtectedPage context="company-user" permission="company-users.view">
                  <PlaceholderPage titleKey="nav.companyUsers" />
                </ProtectedPage>
              }
            />
            <Route
              path="/company/roles"
              element={
                <ProtectedPage context="company-user" permission="company-roles.view">
                  <PlaceholderPage titleKey="nav.companyRoles" />
                </ProtectedPage>
              }
            />
            <Route path="*" element={<Navigate replace to="/login" />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
