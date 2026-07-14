import { describe, expect, it } from "vitest";

import { HealthController } from "../src/health.controller";

describe("HealthController", () => {
  it("returns the API health contract", () => {
    expect(new HealthController().getHealth()).toEqual({
      service: "api",
      status: "ok",
    });
  });
});
