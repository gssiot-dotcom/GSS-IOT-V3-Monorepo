import type { AuthSession, GssAdminUserRecord } from "@gss-iot/contracts";
import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GssAdministratorsPage } from "../features/settings/GssAdministratorsPage";
import { apiRequest } from "../shared/api/api-client";

const session: AuthSession = {
  accessToken: "token",
  context: "gss-admin",
  user: {
    email: "admin@example.com",
    id: "admin-1",
    isActive: true,
    isSuperAdmin: false,
    name: "Admin",
    permissions: [
      "admin-users.view",
      "admin-users.create",
      "admin-users.update",
      "admin-users.delete",
    ],
  },
};

vi.mock("../shared/auth/auth-context", () => ({
  useAuth: () => ({ session }),
}));

vi.mock("../shared/api/api-client", () => ({
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  },
  apiRequest: vi.fn(),
}));

const user: GssAdminUserRecord = {
  createdAt: "2026-07-28T00:00:00.000Z",
  deletion: {
    allowed: false,
    blocker: "The last active GSS super admin cannot be deleted.",
    code: "LAST_ACTIVE_GSS_SUPER_ADMIN",
    mode: "NOT_ALLOWED",
  },
  email: "super@example.com",
  id: "user-1",
  isActive: true,
  lastLoginAt: null,
  name: "Super Admin",
  phone: "010-0000-0000",
  role: {
    id: "role-1",
    isSuperAdmin: true,
    isSystem: true,
    key: "super-admin",
    name: "Super Admin",
  },
  updatedAt: "2026-07-28T00:00:00.000Z",
};

describe("GSS Administrators page", () => {
  afterEach(() => {
    cleanup();
    vi.mocked(apiRequest).mockReset();
  });

  it("supports searchable rows, readable details, CRUD dialogs and lifecycle blockers", async () => {
    vi.mocked(apiRequest).mockImplementation(async (_session, path) => {
      if (path.startsWith("/admin/gss-users?")) {
        return { items: [user], page: 1, pageSize: 50, total: 1 };
      }
      if (path === "/admin/gss-users/options") return [user.role];
      throw new Error(`Unexpected request: ${path}`);
    });
    render(
      <MantineProvider theme={gssTheme}>
        <GssAdministratorsPage />
      </MantineProvider>,
    );

    expect(await screen.findByText("super@example.com")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Search name, email, phone, or role" }), {
      target: { value: "Super" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(
      vi.mocked(apiRequest).mock.calls.some(([, path]) => String(path).includes("search=Super")),
    ).toBe(true);

    fireEvent.click(screen.getByRole("row", { name: "Administrator details: Super Admin" }));
    const drawer = await screen.findByRole("dialog", { name: "Administrator details" });
    expect(
      within(drawer).getByText("The last active GSS super admin cannot be deleted."),
    ).toBeTruthy();
    expect(
      within(drawer).getByRole("button", { name: "Delete Administrator" }).hasAttribute("disabled"),
    ).toBe(true);

    fireEvent.click(within(drawer).getByRole("button", { name: "Edit Administrator" }));
    const editDialog = await screen.findByRole("dialog", { name: "Edit Administrator" });
    expect(
      within(editDialog).getByLabelText("New password (leave blank to keep current)"),
    ).toBeTruthy();
    fireEvent.click(within(editDialog).getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Create Administrator" }));
    const createDialog = await screen.findByRole("dialog", { name: "Create Administrator" });
    expect(createDialog.querySelector('input[type="password"]')).toBeTruthy();
    expect(within(createDialog).getByRole("combobox", { name: "Role name" })).toBeTruthy();
  });
});
