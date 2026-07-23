import { describe, expect, it } from "vitest";

import { GssButton, GssIconButton } from "../src";

describe("shared button primitives", () => {
  it("maps semantic button variants to quiet Mantine variants", () => {
    const primary = GssButton({ children: "Save", variant: "primary" });
    const secondary = GssButton({ children: "Cancel", variant: "secondary" });
    const outline = GssButton({ children: "Filter", variant: "outline" });
    const danger = GssButton({ children: "Delete", variant: "danger" });

    expect(primary.props.variant).toBe("filled");
    expect(primary.props.className).toContain("gss-button-primary");
    expect(secondary.props.variant).toBe("light");
    expect(outline.props.variant).toBe("outline");
    expect(danger.props.color).toBe("red");
  });

  it("keeps icon buttons accessible and touch-sized", () => {
    const button = GssIconButton({ "aria-label": "Open notifications", children: "icon" });

    expect(button.props["aria-label"]).toBe("Open notifications");
    expect(button.props.variant).toBe("subtle");
    expect(button.props.className).toBe("gss-icon-button");
  });
});
