import type { AuthSession } from "@gss-iot/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "../shared/api/api-client";
import { authSessionExpiredEvent, ensureCsrfToken } from "../shared/auth/auth-api";

vi.mock("../app/env", () => ({
  readWebEnv: () => ({ apiBaseUrl: "http://api.test", csrfCookieName: "gss_csrf" }),
}));

const session: AuthSession = {
  context: "gss-admin",
  user: {
    email: "admin@example.com",
    id: "admin-1",
    isActive: true,
    isSuperAdmin: true,
    name: "Admin",
    permissions: [],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("cookie API authentication", () => {
  it("uses credentials and CSRF without exposing an Authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest(session, "/admin/settings", {
      body: JSON.stringify({ enabled: true }),
      method: "PATCH",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: "include" });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "x-csrf-token": "test-csrf-token",
    });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty("authorization");
  });

  it("coalesces concurrent 401 responses into one refresh and retries each request once", async () => {
    const attempts = new Map<string, number>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      attempts.set(path, (attempts.get(path) ?? 0) + 1);
      if (path === "/auth/refresh") {
        return new Response(JSON.stringify(session), {
          headers: { "content-type": "application/json" },
          status: 201,
        });
      }
      if ((attempts.get(path) ?? 0) === 1) return new Response(null, { status: 401 });
      return new Response(JSON.stringify({ path }), {
        headers: { "content-type": "application/json" },
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      apiRequest<{ path: string }>(session, "/admin/one"),
      apiRequest<{ path: string }>(session, "/admin/two"),
    ]);

    expect(first.path).toBe("/admin/one");
    expect(second.path).toBe("/admin/two");
    expect(attempts.get("/auth/refresh")).toBe(1);
    expect(attempts.get("/admin/one")).toBe(2);
    expect(attempts.get("/admin/two")).toBe(2);
  });

  it("does not loop when refresh fails and emits session-expired", async () => {
    const expired = vi.fn();
    window.addEventListener(authSessionExpiredEvent, expired);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      return new Response(null, { status: path === "/auth/refresh" ? 401 : 401 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest(session, "/admin/protected")).rejects.toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(expired).toHaveBeenCalledTimes(1);
    window.removeEventListener(authSessionExpiredEvent, expired);
  });

  it("bootstraps CSRF from the API response when the cookie is host-only", async () => {
    document.cookie = "gss_csrf=; Max-Age=0; Path=/";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ csrfToken: "host-only-api-csrf" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureCsrfToken()).resolves.toBe("host-only-api-csrf");
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/auth/csrf", {
      credentials: "include",
      headers: { "accept-language": "en-US" },
    });

    document.cookie = "gss_csrf=test-csrf-token; Path=/; SameSite=Lax";
  });
});
