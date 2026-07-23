import type { AuthSession } from "@gss-iot/contracts";
import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";

const storageKey = "gss-iot-v3-auth-session";
const apiBaseUrl = "http://localhost:3000";

const companySession: AuthSession = {
  accessToken: "company-token",
  context: "company-user",
  user: {
    companyId: "company-1",
    email: "manager@example.com",
    id: "user-manager",
    isActive: true,
    isSuperAdmin: false,
    name: "Manager",
    permissions: ["welcome.view", "alarm-rules.view", "alarm-rules.manage", "notifications.manage"],
  },
};

const adminSession: AuthSession = {
  accessToken: "admin-token",
  context: "gss-admin",
  user: {
    email: "admin@example.com",
    id: "admin-1",
    isActive: true,
    isSuperAdmin: false,
    name: "Admin",
    permissions: ["welcome.view", "alarm-rules.view", "alarm-rules.manage"],
  },
};

const building = {
  address: null,
  areaId: "area-1",
  buildingType: null,
  company: { name: "Company A" },
  companyId: "company-1",
  id: "building-1",
  number: null,
  status: "ACTIVE",
  title: "성수동 A-15",
};

const gangformNodeType = {
  displayName: "Gangform Node",
  id: "node-type-gangform",
  imageAssetKey: "gangform.png",
  key: "gangform_node",
  numericCode: 2,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function storeSession(session: AuthSession) {
  window.sessionStorage.setItem(
    storageKey,
    JSON.stringify({ accessToken: session.accessToken, context: session.context }),
  );
}

function renderApp(path: string) {
  window.history.pushState({}, "", path);
  return render(
    <MantineProvider theme={gssTheme}>
      <App />
    </MantineProvider>,
  );
}

async function chooseOption(label: string, optionName: string) {
  const dialog = await screen.findByRole("dialog", { name: "Create rule" });
  fireEvent.click(within(dialog).getByRole("combobox", { name: label }));
  fireEvent.click(await screen.findByText(optionName));
}

function mockAlarmRulesFetch(options: { createStatus?: number; session?: AuthSession } = {}) {
  const session = options.session ?? companySession;
  let createdRule: unknown;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    if (url.href === `${apiBaseUrl}/auth/company/me`) return jsonResponse(session);
    if (url.href === `${apiBaseUrl}/auth/gss/me`) return jsonResponse(session);
    if (url.href.endsWith("/alarm-rules/options")) {
      return jsonResponse({
        buildings: [building],
        nodeTypes: [gangformNodeType],
        positions: [],
        users: [],
      });
    }
    if (url.href.endsWith("/notifications/providers/status")) {
      return jsonResponse({
        providers: [{ channel: "IN_APP", configured: true, providerKey: "in_app" }],
      });
    }
    if (url.href.endsWith("/alarm-rules") && init.method === "POST") {
      if (options.createStatus) {
        return jsonResponse({ message: "Validation failed" }, options.createStatus);
      }
      const body = JSON.parse(String(init.body)) as { name: string; severity: string };
      createdRule = {
        building,
        buildingId: building.id,
        createdAt: "2026-07-21T00:00:00.000Z",
        id: "rule-1",
        isActive: true,
        name: body.name,
        nodeType: gangformNodeType,
        nodeTypeId: gangformNodeType.id,
        recipientPolicies: [],
        severity: body.severity,
        updatedAt: "2026-07-21T00:00:00.000Z",
      };
      return jsonResponse(createdRule, 201);
    }
    if (url.href.endsWith("/alarm-rules")) {
      return jsonResponse({ items: createdRule ? [createdRule] : [] });
    }
    return jsonResponse({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Phase 12 alarm rule form", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("allows typing and editing the Company rule name without submitting before Save", async () => {
    storeSession(companySession);
    const fetchMock = mockAlarmRulesFetch();
    renderApp("/company/alarm-rules");

    fireEvent.click(await screen.findByRole("button", { name: "Create rule" }));
    await chooseOption("Building", "Company A / 성수동 A-15");
    await chooseOption("Node type", "Gangform Node");
    await chooseOption("Severity", "DANGER");

    const dialog = await screen.findByRole("dialog", { name: "Create rule" });
    const nameInput = within(dialog).getByRole("textbox", { name: "Name" });
    fireEvent.change(nameInput, { target: { value: "G" } });
    fireEvent.change(nameInput, { target: { value: "성수동 A-15 Gangform Danger" } });
    fireEvent.change(nameInput, { target: { value: "성수동 A-15 Gangform Danger Rule" } });
    fireEvent.change(nameInput, { target: { value: "성수동 A-15 Gangform Danger" } });

    expect((nameInput as HTMLInputElement).value).toBe("성수동 A-15 Gangform Danger");
    expect(
      (within(dialog).getByRole("combobox", { name: "Building" }) as HTMLInputElement).value,
    ).toBe("Company A / 성수동 A-15");
    expect(
      (within(dialog).getByRole("combobox", { name: "Node type" }) as HTMLInputElement).value,
    ).toBe("Gangform Node");
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          String(input).endsWith("/company/alarm-rules") && init?.method === "POST",
      ),
    ).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          return String(input).endsWith("/company/alarm-rules") && init?.method === "POST";
        }),
      ).toBe(true),
    );
    const createCall = fetchMock.mock.calls.find(([input, init]) => {
      return String(input).endsWith("/company/alarm-rules") && init?.method === "POST";
    });
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      buildingId: building.id,
      name: "성수동 A-15 Gangform Danger",
      nodeTypeId: gangformNodeType.id,
      severity: "DANGER",
    });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Create rule" })).toBeNull());
    expect(await screen.findByText("성수동 A-15 Gangform Danger")).toBeTruthy();
  });

  it("keeps API validation failure inside the modal and resets the draft after close", async () => {
    storeSession(companySession);
    mockAlarmRulesFetch({ createStatus: 400 });
    renderApp("/company/alarm-rules");

    fireEvent.click(await screen.findByRole("button", { name: "Create rule" }));
    await chooseOption("Building", "Company A / 성수동 A-15");
    await chooseOption("Node type", "Gangform Node");
    const dialog = await screen.findByRole("dialog", { name: "Create rule" });
    const nameInput = within(dialog).getByRole("textbox", { name: "Name" });
    fireEvent.change(nameInput, { target: { value: " " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByText("Name is required.")).toBeTruthy();
    expect(screen.getByText("No records found")).toBeTruthy();

    fireEvent.change(nameInput, { target: { value: "Gangform Danger Rule" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("Unable to save alarm rule.")).toBeTruthy();
    expect(screen.getByText("No records found")).toBeTruthy();

    const closeButton = within(dialog).getAllByRole("button")[0];
    if (!closeButton) throw new Error("Create rule dialog close button is missing");
    fireEvent.click(closeButton);
    fireEvent.click(screen.getByRole("button", { name: "Create rule" }));
    const reopened = await screen.findByRole("dialog", { name: "Create rule" });
    expect(
      (within(reopened).getByRole("textbox", { name: "Name" }) as HTMLInputElement).value,
    ).toBe("");
  });

  it("uses the same stable rule form on the Admin Alarm Rules page", async () => {
    storeSession(adminSession);
    const fetchMock = mockAlarmRulesFetch({ session: adminSession });
    renderApp("/admin/alarm-rules");

    fireEvent.click(await screen.findByRole("button", { name: "Create rule" }));
    await chooseOption("Building", "Company A / 성수동 A-15");
    await chooseOption("Node type", "Gangform Node");
    const dialog = await screen.findByRole("dialog", { name: "Create rule" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Name" }), {
      target: { value: "Gangform Danger Rule" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          return (
            String(input).endsWith("/admin/alarm-rules") &&
            init?.method === "POST" &&
            String(init.body).includes("Gangform Danger Rule")
          );
        }),
      ).toBe(true),
    );
  });
});
