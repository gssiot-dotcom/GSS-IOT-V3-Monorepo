import type { AuthContext } from "@gss-iot/contracts";
import type { ReactElement, ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { LoginPage } from "../features/auth/LoginPage";
import { DesignSystemDemoPage } from "../features/shell/DesignSystemDemoPage";
import { NodeTypeMonitoringPage } from "../features/shell/NodeTypeMonitoringPage";
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
                    {item.path.includes("/monitoring") ? (
                      <NodeTypeMonitoringPage />
                    ) : (
                      <PlaceholderPage titleKey={item.titleKey} />
                    )}
                  </ProtectedPage>
                }
                key={item.path}
                path={item.path}
              />
            ))}
            <Route path="*" element={<Navigate replace to="/login" />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
