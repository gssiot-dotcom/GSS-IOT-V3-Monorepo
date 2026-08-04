import type { AuthSession } from "@gss-iot/contracts";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../shared/api/api-client";
import { createQueryClient, shouldRetryQuery } from "../shared/query/query-client";
import { portalQueryKey, queryKeys } from "../shared/query/query-keys";

const adminSession: AuthSession = {
  context: "gss-admin",
  user: {
    email: "admin@example.com",
    id: "admin-1",
    isActive: true,
    isSuperAdmin: false,
    name: "Admin",
    permissions: [],
  },
};

function companySession(userId: string, companyId: string): AuthSession {
  return {
    context: "company-user",
    user: {
      companyId,
      email: `${userId}@example.com`,
      id: userId,
      isActive: true,
      isSuperAdmin: false,
      name: userId,
      permissions: [],
    },
  };
}

describe("TanStack Query architecture", () => {
  it("isolates Admin, Company, user, and company cache identities", () => {
    const firstCompany = companySession("user-1", "company-1");
    const secondCompany = companySession("user-1", "company-2");
    const otherUser = companySession("user-2", "company-1");
    const adminKey = portalQueryKey(adminSession, "monitoring", "node-states");
    const firstKey = portalQueryKey(firstCompany, "monitoring", "node-states");
    const secondKey = portalQueryKey(secondCompany, "monitoring", "node-states");
    const otherUserKey = portalQueryKey(otherUser, "monitoring", "node-states");

    expect(
      new Set([adminKey, firstKey, secondKey, otherUserKey].map((value) => JSON.stringify(value))),
    ).toHaveLength(4);

    const client = createQueryClient({ test: true });
    client.setQueryData(firstKey, { company: "first" });
    client.setQueryData(secondKey, { company: "second" });
    expect(client.getQueryData(firstKey)).toEqual({ company: "first" });
    expect(client.getQueryData(secondKey)).toEqual({ company: "second" });
  });

  it("keeps filters stable and inside the typed key", () => {
    const left = queryKeys.admin.companies("admin-1", {
      page: 2,
      search: "tower",
      status: "ACTIVE",
    });
    const right = queryKeys.admin.companies("admin-1", {
      status: "ACTIVE",
      search: "tower",
      page: 2,
    });
    expect(left).toEqual(right);
  });

  it.each([400, 401, 403, 404, 409, 422])("does not retry non-retryable HTTP %s", (status) => {
    expect(shouldRetryQuery(0, new ApiError("request failed", status))).toBe(false);
  });

  it("bounds network and retryable server failures", () => {
    expect(shouldRetryQuery(0, new Error("network"))).toBe(true);
    expect(shouldRetryQuery(1, new Error("network"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError("server", 503))).toBe(true);
    expect(shouldRetryQuery(1, new ApiError("server", 503))).toBe(true);
    expect(shouldRetryQuery(2, new ApiError("server", 503))).toBe(false);
  });
});

describe("portal UI preference persistence", () => {
  it("migrates legacy monitoring preferences and persists no sensitive state", async () => {
    window.localStorage.clear();
    window.localStorage.setItem("gss.monitoring.admin.view", "CARD");
    window.localStorage.setItem("gss.monitoring.view", "TABLE");
    vi.resetModules();

    const { usePortalUiStore } = await import("../shared/state/portal-ui-store");
    expect(usePortalUiStore.getState().adminMonitoringView).toBe("CARD");
    expect(usePortalUiStore.getState().companyMonitoringView).toBe("TABLE");

    usePortalUiStore.getState().setCompanyMonitoringView("CARD");
    const persisted = window.localStorage.getItem("gss.portal-ui.v1") ?? "";
    expect(persisted).toContain('"adminMonitoringView":"CARD"');
    expect(persisted).toContain('"companyMonitoringView":"CARD"');
    expect(persisted).not.toMatch(/token|permission|session|sensor|mqtt/i);
    expect(window.localStorage.getItem("gss.monitoring.admin.view")).toBeNull();
    expect(window.localStorage.getItem("gss.monitoring.view")).toBeNull();
  });
});
