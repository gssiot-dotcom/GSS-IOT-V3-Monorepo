import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { render, screen } from "./render";
import { describe, expect, it } from "vitest";

import { App } from "../App";

describe("App", () => {
  it("renders the bootstrap shell", () => {
    render(
      <MantineProvider theme={gssTheme}>
        <App />
      </MantineProvider>,
      { router: false },
    );

    expect(screen.getByTestId("app-root")).toBeTruthy();
    expect(screen.getByText("GSS IoT V3")).toBeTruthy();
  });

  it("renders the Phase 2 design system demo route", () => {
    window.history.pushState({}, "", "/phase-2/demo");

    render(
      <MantineProvider theme={gssTheme}>
        <App />
      </MantineProvider>,
      { router: false },
    );

    expect(screen.getByTestId("phase-2-demo")).toBeTruthy();
    expect(screen.getByText("Design system demo")).toBeTruthy();
    expect(screen.getByAltText("Door Node")).toBeTruthy();
    expect(screen.getByAltText("Angle Node")).toBeTruthy();
    expect(screen.getByAltText("Gangform Node")).toBeTruthy();
  });
});
