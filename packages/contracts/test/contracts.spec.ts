import { describe, expect, it } from "vitest";

import { HEALTH_STATUS } from "../src";

describe("contracts", () => {
  it("exports the health status contract", () => {
    expect(HEALTH_STATUS.ok).toBe("ok");
  });
});
