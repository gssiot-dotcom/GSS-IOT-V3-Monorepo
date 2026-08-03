import type { AuthContext } from "@gss-iot/contracts";
import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { PortalLayout } from "../features/shell/PortalLayout";

vi.mock("../shared/auth/auth-context", () => ({
  useAuth: () => ({
    logout: vi.fn(),
    session: {
      context: "gss-admin",
      user: {
        email: "admin@example.com",
        id: "admin-1",
        isActive: true,
        isSuperAdmin: true,
        name: "Admin",
        permissions: ["devices.view", "mqtt-commands.view", "welcome.view"],
      },
    },
  }),
}));

vi.mock("../shared/api/api-client", () => ({
  apiRequest: vi.fn().mockResolvedValue({ unreadCount: 0 }),
}));

vi.mock("../app/env", () => ({ readWebEnv: () => ({ apiBaseUrl: "http://localhost:3000" }) }));

vi.mock("socket.io-client", () => ({
  io: () => ({
    close: vi.fn(),
    io: { off: vi.fn(), on: vi.fn() },
    off: vi.fn(),
    on: vi.fn(),
  }),
}));

describe("Portal sidebar", () => {
  it("keeps the Devices links in the shared visible scroll area", () => {
    render(
      <MantineProvider theme={gssTheme}>
        <MemoryRouter initialEntries={["/admin/devices"]}>
          <PortalLayout context={"gss-admin" as AuthContext}>
            <div>Content</div>
          </PortalLayout>
        </MemoryRouter>
      </MantineProvider>,
    );

    expect(screen.getAllByText("Devices").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Devices" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Gateway commands" })).toBeTruthy();
    expect(screen.getAllByText("Administrators").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("link", { name: "Administrators" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "GSS roles" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Permissions" })).toBeTruthy();
    const headerLogo = document.querySelector<HTMLImageElement>(".gss-platform-logo");
    expect(headerLogo).toBeTruthy();
    expect(headerLogo?.src.endsWith("/assets/gss-logos/Gss-logo-blue.svg")).toBe(true);
    const headerBrand = document.querySelector(".gss-platform-brand");
    expect(headerBrand?.textContent).toBe("Global Smart Solutions");
    expect(headerBrand?.nextElementSibling?.classList.contains("mantine-Divider-root")).toBe(true);
    const sidebarLogo = document.querySelector<HTMLImageElement>(".gss-admin-sidebar-brand > img");
    expect(sidebarLogo?.src.endsWith("/assets/gss-logos/GSS-logo.svg")).toBe(true);
    const sidebarBrand = document.querySelector(".gss-admin-sidebar-brand");
    expect(sidebarBrand?.textContent).toContain("GSS IoT V3");
    expect(sidebarBrand?.textContent).toContain("GSS Admin Portal");
    const scrollArea = document.querySelector(".gss-sidebar-scrollarea");
    const viewport = document.querySelector(".gss-sidebar-scrollarea-viewport");
    expect(scrollArea).toBeTruthy();
    expect(viewport).toBeTruthy();
    expect(viewport?.getAttribute("data-scrollbars")).toBe("y");
    expect(scrollArea?.querySelector("[data-mantine-scrollbar]")?.getAttribute("data-hidden")).toBe(
      "true",
    );
  });
});
