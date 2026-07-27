import type { AuthSession } from "@gss-iot/contracts";
import { describe, expect, it } from "vitest";

import { filterSidebarItems } from "../shared/rbac/filter-sidebar-items";
import { hasPermission } from "../shared/rbac/has-permission";
import { adminNavItems, companyNavItems } from "../features/shell/navigation";

const session: AuthSession = {
  accessToken: "token",
  context: "company-user",
  user: {
    email: "viewer@example.com",
    id: "user-1",
    isActive: true,
    isSuperAdmin: false,
    name: "Viewer",
    permissions: ["buildings.view"],
  },
};

describe("web RBAC helpers", () => {
  it("filters sidebar routes by the current permission set", () => {
    const items = filterSidebarItems(
      [
        { path: "/buildings", permission: "buildings.view", titleKey: "nav.companyBuildings" },
        { path: "/roles", permission: "company-roles.view", titleKey: "nav.companyRoles" },
      ],
      session,
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.path).toBe("/buildings");
  });

  it("allows a super admin without an enumerated permission", () => {
    expect(
      hasPermission(
        { ...session, context: "gss-admin", user: { ...session.user, isSuperAdmin: true } },
        "permissions.manage",
      ),
    ).toBe(true);
  });

  it("keeps shell sidebar items mapped to permissions", () => {
    const items = filterSidebarItems(companyNavItems, session);

    expect(items.map((item) => item.path)).toEqual(["/company/buildings"]);
    expect(companyNavItems.every((item) => item.permission.includes("."))).toBe(true);
  });

  it("keeps every shell item assigned to a translated navigation section", () => {
    expect(companyNavItems.every((item) => item.sectionKey.startsWith("shell.section"))).toBe(true);
  });

  it("maps each read-only permission catalog nav item to its authoritative view permission", () => {
    expect(
      adminNavItems.find((item) => item.path === "/admin/settings/permissions")?.permission,
    ).toBe("permissions.view");
    expect(companyNavItems.find((item) => item.path === "/company/permissions")?.permission).toBe(
      "company-permissions.view",
    );
    expect(
      filterSidebarItems(companyNavItems, session).some(
        (item) => item.path === "/company/permissions",
      ),
    ).toBe(false);
  });
});
