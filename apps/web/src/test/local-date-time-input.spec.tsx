import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocalDateTimeInput } from "../shared/date-time/LocalDateTimeInput";

describe("LocalDateTimeInput", () => {
  it("opens the calendar from the input body and can clear only the optional time", async () => {
    const onChange = vi.fn();
    render(
      <MantineProvider>
        <LocalDateTimeInput
          label="From"
          onChange={onChange}
          value={{ date: null, time: "10:30" }}
        />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByLabelText("From — Date"));
    expect(await screen.findByRole("button", { name: "Choose month" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear time" }));
    expect(onChange).toHaveBeenCalledWith({ date: null, time: "" });
  });
});
