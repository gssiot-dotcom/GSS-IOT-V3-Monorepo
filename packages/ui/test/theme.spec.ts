import { describe, expect, it } from "vitest";

import {
  gssBlue,
  gssLayoutTokens,
  gssSemanticTokens,
  gssStatusColors,
  gssTheme,
  gssTypographyScale,
} from "../src";

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

  it("freezes semantic, layout and typography tokens for shared pages", () => {
    expect(gssSemanticTokens.background.light).toBe("#f5f8fb");
    expect(gssSemanticTokens.surface.dark).toBe("#131e30");
    expect(gssLayoutTokens.sectionGap).toContain("1.25rem");
    expect(gssTypographyScale.pageTitle).toContain("1.875rem");
    expect(gssTheme.other.gssSemanticTokens).toBe(gssSemanticTokens);
  });
});
