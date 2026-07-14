import { describe, expect, it } from "vitest";

import { gssBlue, gssTheme } from "../src";

describe("gssTheme", () => {
  it("uses the normalized GSS primary color scale", () => {
    expect(gssBlue[5]).toBe("#159fde");
    expect(gssTheme.primaryColor).toBe("gss");
  });
});
