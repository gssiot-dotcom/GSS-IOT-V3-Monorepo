import type { AuthContext } from "@gss-iot/contracts";
import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PortalLayout } from "../features/shell/PortalLayout";

const defaultMatchMedia = window.matchMedia;

vi.mock("../shared/auth/auth-context", () => ({
  useAuth: () => ({
    logout: vi.fn(),
    session: {
      context: "gss-admin",
      user: {
        email: "operator@example.com",
        id: "theme-user",
        isActive: true,
        isSuperAdmin: false,
        name: "Operator",
        permissions: ["welcome.view"],
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

function renderShell() {
  return render(
    <MantineProvider defaultColorScheme="auto" theme={gssTheme}>
      <MemoryRouter initialEntries={["/admin/welcome"]}>
        <PortalLayout context={"gss-admin" as AuthContext}>
          <div>Content</div>
        </PortalLayout>
      </MemoryRouter>
    </MantineProvider>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-mantine-color-scheme");
  window.matchMedia = defaultMatchMedia;
});

describe("production shell theme control", () => {
  it("toggles without navigation and persists an explicit preference", () => {
    renderShell();

    const toggle = screen.getByTestId("theme-toggle");
    const brandLogo = document.querySelector<HTMLImageElement>(".gss-platform-logo")!;
    expect(toggle.getAttribute("aria-label")).toBe("Switch to dark mode");
    expect(brandLogo.src.endsWith("/assets/gss-logos/Gss-logo-blue.svg")).toBe(true);
    fireEvent.click(toggle);

    expect(document.documentElement.getAttribute("data-mantine-color-scheme")).toBe("dark");
    expect(window.localStorage.getItem("mantine-color-scheme-value")).toBe("dark");
    expect(toggle.getAttribute("aria-label")).toBe("Switch to light mode");
    expect(brandLogo.src.endsWith("/assets/gss-logos/GSS-logo.svg")).toBe(true);
  });

  it("uses the system dark preference when no explicit preference exists", () => {
    window.matchMedia = ((query: string) =>
      ({
        addEventListener: () => undefined,
        addListener: () => undefined,
        dispatchEvent: () => false,
        matches: query.includes("prefers-color-scheme"),
        media: query,
        onchange: null,
        removeEventListener: () => undefined,
        removeListener: () => undefined,
      }) as MediaQueryList) as typeof window.matchMedia;

    renderShell();

    expect(screen.getByTestId("theme-toggle").getAttribute("aria-label")).toBe(
      "Switch to light mode",
    );
    expect(
      document
        .querySelector<HTMLImageElement>(".gss-platform-logo")
        ?.src.endsWith("/assets/gss-logos/GSS-logo.svg"),
    ).toBe(true);
    expect(window.localStorage.getItem("mantine-color-scheme-value")).toBeNull();
  });
});
