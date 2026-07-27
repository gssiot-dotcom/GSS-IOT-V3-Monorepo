import { Logger, type ArgumentsHost } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DatabaseExceptionFilter } from "../src/common/filters/database-exception.filter";

describe("DatabaseExceptionFilter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs request and Prisma context while returning a generic response", () => {
    const log = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ method: "GET", originalUrl: "/company/notifications", url: "" }),
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;
    const exception = new Prisma.PrismaClientKnownRequestError("raw database detail", {
      clientVersion: "6.19.0",
      code: "P2022",
      meta: { column: "deletedAt" },
    });

    new DatabaseExceptionFilter().catch(exception, host);

    expect(log).toHaveBeenCalledWith(expect.stringContaining('"code":"P2022"'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"path":"/company/notifications"'));
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      message: "A database operation failed. Please try again.",
      statusCode: 500,
    });
    expect(JSON.stringify(json.mock.calls)).not.toContain("raw database detail");
  });
});
