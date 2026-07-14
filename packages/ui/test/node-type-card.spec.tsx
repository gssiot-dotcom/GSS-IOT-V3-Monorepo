import { describe, expect, it } from "vitest";

import { NodeTypeSelectionCard } from "../src";

describe("NodeTypeSelectionCard", () => {
  it("keeps the legacy image-first card contract in props", () => {
    const element = NodeTypeSelectionCard({
      countLabel: "12 nodes",
      description: "Door and hatch monitoring",
      imageAlt: "Door node",
      imageSrc: "/assets/legacy-node-types/door-node.png",
      title: "Door Node",
      type: "door_node",
    });

    expect(element.props["data-testid"]).toBe("node-type-card-door_node");
    expect(element.props["data-node-type"]).toBe("door_node");
    expect(element.props.style.minHeight).toBe(260);
  });

  it("marks disabled cards as non-interactive", () => {
    const element = NodeTypeSelectionCard({
      countLabel: "3 nodes",
      description: "Gangform monitoring",
      disabled: true,
      disabledLabel: "Locked",
      imageAlt: "Gangform node",
      imageSrc: "/assets/legacy-node-types/gangform.png",
      onSelect: () => undefined,
      title: "Gangform Node",
      type: "gangform_node",
    });

    expect(element.props["aria-disabled"]).toBe(true);
    expect(element.props.role).toBe("group");
    expect(element.props.tabIndex).toBe(-1);
  });
});
