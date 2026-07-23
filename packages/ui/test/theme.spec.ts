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
    expect(gssBlue[5]).toBe("#2f91f1");
    expect(gssTheme.primaryColor).toBe("gss");
  });

  it("exposes the required monitoring status colors", () => {
    expect(gssStatusColors.safe).toBe("#1685b8");
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
    expect(gssSemanticTokens.background.light).toBe("#f4f7fb");
    expect(gssSemanticTokens.surface.dark).toBe("#122137");
    expect(gssSemanticTokens.primary.light).toBe("#176fca");
    expect(gssSemanticTokens.primary.dark).toBe("#5eacff");
    for (const token of Object.values(gssSemanticTokens)) {
      expect(token.light).toBeTruthy();
      expect(token.dark).toBeTruthy();
    }
    expect(gssLayoutTokens.sectionGap).toContain("1.25rem");
    expect(gssTypographyScale.pageTitle).toContain("1.875rem");
    expect(gssTheme.other.gssSemanticTokens).toBe(gssSemanticTokens);
  });

  it("uses cool layered dark surfaces for shared interaction states", () => {
    expect(gssSemanticTokens.elevatedSurface.dark).toBe("#1b3049");
    expect(gssSemanticTokens.disabledSurface.dark).toBe("#1a2d44");
    expect(gssSemanticTokens.popoverSurface.dark).toBe("#1b3049");
    expect(gssSemanticTokens.tableStripe.dark).toBe("#14283e");
    expect(gssSemanticTokens.tableHover.dark).toBe("#1d3855");
    expect(gssSemanticTokens.tableSelected.dark).toBe("#20486c");
    expect(gssSemanticTokens.tableStripe.dark).not.toBe("#2e2e2e");
    expect(gssSemanticTokens.tableHover.dark).not.toBe("#3b3b3b");
    expect(gssSemanticTokens.background.light).toBe("#f4f7fb");
    expect(gssStatusColors).toEqual({
      caution: "#2fa84f",
      danger: "#dc2626",
      offline: "#7c8797",
      safe: "#1685b8",
      unconfigured: "#64748b",
      warning: "#d18a00",
    });
  });
});
