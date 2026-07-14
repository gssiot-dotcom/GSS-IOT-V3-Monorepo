import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../App";

describe("App", () => {
  it("renders the bootstrap shell", () => {
    render(
      <MantineProvider theme={gssTheme}>
        <App />
      </MantineProvider>,
    );

    expect(screen.getByTestId("app-root")).toBeTruthy();
    expect(screen.getByText("GSS IoT V3")).toBeTruthy();
  });
});
