import type { AuthSession } from "@gss-iot/contracts";
import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";

const storageKey = "gss-iot-v3-auth-context";
const apiBaseUrl = "http://localhost:3000";

const companySession: AuthSession = {
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
  window.sessionStorage.setItem(storageKey, JSON.stringify({ context: session.context }));
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

async function chooseMantineValue(control: HTMLElement, value: string) {
  fireEvent.click(control);
  let option: HTMLElement | null = null;
  await waitFor(() => {
    option = document.querySelector<HTMLElement>(`[data-combobox-option][value="${value}"]`);
    expect(option).toBeTruthy();
  });
  fireEvent.click(option!);
}

function mockAlarmRulesFetch(
  options: { createStatus?: number; existingPolicy?: boolean; session?: AuthSession } = {},
) {
  const session = options.session ?? companySession;
  let createdRule: unknown = options.existingPolicy
    ? {
        building,
        buildingId: building.id,
        createdAt: "2026-07-21T00:00:00.000Z",
        id: "rule-1",
        isActive: true,
        name: "Existing Rule",
        nodeType: gangformNodeType,
        nodeTypeId: gangformNodeType.id,
        recipientPolicies: [
          {
            channel: "IN_APP",
            countIntervalSeconds: 10,
            id: "policy-1",
            isActive: true,
            positionId: "position-1",
            requiredOccurrenceCount: 2,
            ruleId: "rule-1",
            specificUserId: null,
            targetType: "POSITION",
          },
        ],
        severity: "DANGER",
        updatedAt: "2026-07-21T00:00:00.000Z",
      }
    : undefined;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    if (url.href === `${apiBaseUrl}/auth/company/me`) return jsonResponse(session);
    if (url.href === `${apiBaseUrl}/auth/gss/me`) return jsonResponse(session);
    if (url.pathname.endsWith("/alarm-rules/options")) {
      return jsonResponse({
        buildings: [building],
        nodeTypes: [gangformNodeType],
        positions: [
          {
            companyId: "company-1",
            id: "position-1",
            isActive: true,
            key: "site_manager",
            name: "Site Manager",
          },
          {
            companyId: "company-1",
            id: "position-archived",
            isActive: false,
            key: "archived",
            name: "Archived Position",
          },
        ],
        users: [
          {
            companyId: "company-1",
            email: "manager@example.com",
            id: "user-manager",
            isActive: true,
            name: "Manager",
          },
        ],
      });
    }
    if (url.pathname.endsWith("/notifications/providers/status")) {
      return jsonResponse({
        providers: [{ channel: "IN_APP", configured: true, providerKey: "in_app" }],
      });
    }
    if (url.pathname.endsWith("/alarm-rules") && init.method === "POST") {
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
    if (url.pathname.endsWith("/alarm-rules")) {
      return jsonResponse({
        items: createdRule ? [createdRule] : [],
        page: 1,
        pageSize: 50,
        total: createdRule ? 1 : 0,
      });
    }
    if (url.pathname.endsWith("/alarm-policies/policy-1") && init.method === "PATCH") {
      return jsonResponse({
        ...(JSON.parse(String(init.body)) as object),
        id: "policy-1",
        isActive: true,
        ruleId: "rule-1",
      });
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

  it("edits a policy target and occurrence settings through the existing PATCH endpoint", async () => {
    storeSession(companySession);
    const fetchMock = mockAlarmRulesFetch({ existingPolicy: true });
    renderApp("/company/alarm-rules");

    fireEvent.click(await screen.findByRole("row", { name: "Open: Existing Rule" }));
    const details = await screen.findByRole("dialog", { name: "Recipient policy details" });
    fireEvent.click(within(details).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit recipient policy" });
    expect(within(dialog).queryByText("Archived Position")).toBeNull();

    await chooseMantineValue(
      within(dialog).getByRole("combobox", { name: "Recipient target" }),
      "SPECIFIC_USER",
    );
    await chooseMantineValue(
      within(dialog).getByRole("combobox", { name: "Specific user" }),
      "user-manager",
    );
    await chooseMantineValue(within(dialog).getByRole("combobox", { name: "Channel" }), "EMAIL");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Required occurrences" }), {
      target: { value: "3" },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Count interval seconds" }), {
      target: { value: "30" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          if (
            String(input) !== `${apiBaseUrl}/company/alarm-policies/policy-1` ||
            init?.method !== "PATCH"
          ) {
            return false;
          }
          const body = JSON.parse(String(init.body));
          return (
            body.targetType === "SPECIFIC_USER" &&
            body.specificUserId === "user-manager" &&
            body.channel === "EMAIL" &&
            body.requiredOccurrenceCount === 3 &&
            body.countIntervalSeconds === 30
          );
        }),
      ).toBe(true),
    );
  }, 30_000);

  it("shows occurrence columns and opens a complete policy detail workspace", async () => {
    storeSession(companySession);
    mockAlarmRulesFetch({ existingPolicy: true });
    renderApp("/company/alarm-rules");

    expect(await screen.findByRole("columnheader", { name: "Required occurrences" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Count interval seconds" })).toBeTruthy();
    expect(screen.getByText("10 seconds")).toBeTruthy();

    const policyTable = screen.getAllByRole("table").at(-1)!;
    expect(within(policyTable).queryByRole("columnheader", { name: "Actions" })).toBeNull();
    const row = screen.getByRole("row", { name: "Open: Existing Rule" });
    row.focus();
    fireEvent.keyDown(row, { key: "Enter" });

    const detail = await screen.findByRole("dialog", { name: "Recipient policy details" });
    expect(within(detail).getByText("Site Manager")).toBeTruthy();
    expect(within(detail).getByText("Gangform Node")).toBeTruthy();
    expect(within(detail).getByText("2")).toBeTruthy();
    expect(within(detail).getByText("10 seconds")).toBeTruthy();
    expect(within(detail).getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(within(detail).getByRole("button", { name: "Delete" })).toBeTruthy();
  });

  it("keeps the Policy Drawer readable but mutation-free with view-only permission", async () => {
    const viewOnlySession: AuthSession = {
      ...companySession,
      user: { ...companySession.user, permissions: ["alarm-rules.view"] },
    };
    storeSession(viewOnlySession);
    mockAlarmRulesFetch({ existingPolicy: true, session: viewOnlySession });
    renderApp("/company/alarm-rules");

    const row = await screen.findByRole("row", { name: "Open: Existing Rule" });
    row.focus();
    fireEvent.keyDown(row, { key: " " });
    const detail = await screen.findByRole("dialog", { name: "Recipient policy details" });
    expect(within(detail).getByText("Site Manager")).toBeTruthy();
    expect(within(detail).queryByRole("button", { name: "Edit" })).toBeNull();
    expect(within(detail).queryByRole("button", { name: "Deactivate" })).toBeNull();
    expect(within(detail).queryByRole("button", { name: "Delete" })).toBeNull();
  });
});
