import type { AuthSession } from "@gss-iot/contracts";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "../shared/auth/auth-context";
import { createTestQueryClient } from "../shared/query/test-query-client";
import * as authApi from "../shared/auth/auth-api";

vi.mock("../shared/auth/auth-api", () => ({
  authSessionExpiredEvent: "gss-auth-session-expired",
  authSessionRefreshedEvent: "gss-auth-session-refreshed",
  getCurrentSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
}));

const firstSession: AuthSession = {
  context: "company-user",
  user: {
    companyId: "company-1",
    email: "first@example.com",
    id: "user-1",
    isActive: true,
    isSuperAdmin: false,
    name: "First",
    permissions: [],
  },
};

const secondSession: AuthSession = {
  ...firstSession,
  user: { ...firstSession.user, email: "second@example.com", id: "user-2", name: "Second" },
};

function Probe() {
  const { session, status } = useAuth();
  const client = useQueryClient();
  return (
    <div>{`${status}:${session?.user.id ?? "none"}:${client.getQueryCache().getAll().length}`}</div>
  );
}

describe("auth query cache boundary", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/company/dashboard");
    window.sessionStorage.setItem(
      "gss-iot-v3-auth-context",
      JSON.stringify({ context: "company-user" }),
    );
    vi.mocked(authApi.getCurrentSession).mockResolvedValue(firstSession);
  });

  it("clears cached server data on session expiry", async () => {
    const client = createTestQueryClient();
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await screen.findByText("authenticated:user-1:0");
    client.setQueryData(["company", "user-1", "company-1", "private"], { secret: true });
    window.dispatchEvent(new Event(authApi.authSessionExpiredEvent));
    await waitFor(() => expect(screen.getByText("session-expired:none:0")).toBeTruthy());
  });

  it("clears the previous user's cache before accepting another identity", async () => {
    const client = createTestQueryClient();
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await screen.findByText("authenticated:user-1:0");
    client.setQueryData(["company", "user-1", "company-1", "private"], { secret: true });
    window.dispatchEvent(
      new CustomEvent(authApi.authSessionRefreshedEvent, { detail: secondSession }),
    );
    await waitFor(() => expect(screen.getByText("authenticated:user-2:0")).toBeTruthy());
  });
});
