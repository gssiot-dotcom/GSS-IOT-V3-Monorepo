import { describe, expect, it } from "vitest";

import { gssBlue, gssStatusColors, gssTheme } from "../src";

describe("gssTheme", () => {
  it("uses the normalized GSS primary color scale", () => {
    expect(gssBlue[5]).toBe("#159fde");
    expect(gssTheme.primaryColor).toBe("gss");
  });

  it("exposes the required monitoring status colors", () => {
    expect(gssStatusColors.safe).toBe("#0b80b7");
    expect(gssStatusColors.danger).toBe("#dc2626");
    expect(Object.keys(gssStatusColors).sort()).toEqual([
      "caution",
      "danger",
      "offline",
      "safe",
      "unconfigured",
      "warning",
    ]);
  });
});
