import type { AuthSession } from "@gss-iot/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setActiveLocale } from "../app/i18n";
import { ApiError, apiRequest } from "../shared/api/api-client";

vi.mock("../app/env", () => ({ readWebEnv: () => ({ apiBaseUrl: "http://api.test" }) }));

const session = { accessToken: "token" } as AuthSession;

afterEach(() => vi.unstubAllGlobals());

describe("localized API errors", () => {
  it("maps a stable backend code and keeps technical text out of the primary message", async () => {
    setActiveLocale("ko");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "PURGE_CONFIRMATION_MISMATCH",
          message: "Confirmation phrase does not match.",
        }),
        { headers: { "content-type": "application/json" }, status: 409 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await apiRequest(session, "/admin/archive").catch((caught) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: "PURGE_CONFIRMATION_MISMATCH",
      message: "확인 문구가 일치하지 않습니다.",
      technicalMessage: "Confirmation phrase does not match.",
    });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "accept-language": "ko-KR",
    });
  });

  it("uses a localized status fallback for an unknown code", async () => {
    setActiveLocale("en");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "UNKNOWN" }), {
          headers: { "content-type": "application/json" },
          status: 403,
        }),
      ),
    );
    const error = await apiRequest(session, "/company/protected").catch((caught) => caught);
    expect(error).toMatchObject({ message: "You do not have permission to perform this action." });
  });
});
