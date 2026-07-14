import type { AuthSession } from "@gss-iot/contracts";
import { describe, expect, it } from "vitest";

import { filterSidebarItems } from "../shared/rbac/filter-sidebar-items";
import { hasPermission } from "../shared/rbac/has-permission";
import { companyNavItems } from "../features/shell/navigation";

const session: AuthSession = {
  accessToken: "token",
  context: "company-user",
  user: {
    email: "viewer@example.com",
    id: "user-1",
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
});
