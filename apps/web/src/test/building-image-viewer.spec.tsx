import type { AuthSession } from "@gss-iot/contracts";
import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen } from "./render";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiBlob: vi.fn(),
  apiRequest: vi.fn(),
  session: undefined as AuthSession | undefined,
}));

vi.mock("../shared/api/api-client", () => ({
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  },
  apiBlob: mocks.apiBlob,
  apiRequest: mocks.apiRequest,
}));

vi.mock("../shared/auth/auth-context", () => ({
  useAuth: () => ({ session: mocks.session }),
}));

import {
  BuildingImageViewerPanel,
  InteractiveImageViewer,
  clampImageTransform,
  zoomImageAroundPoint,
} from "../features/monitoring/components/BuildingImageViewer";

describe("building image viewer", () => {
  afterEach(() => {
    cleanup();
    mocks.apiBlob.mockReset();
    mocks.apiRequest.mockReset();
    mocks.session = undefined;
  });

  it("fits, clamps zoom and keeps a usable portion of the image in the viewport", () => {
    expect(
      clampImageTransform(
        { panX: 10_000, panY: -10_000, zoom: 20 },
        { height: 600, width: 800 },
        { height: 400, width: 800 },
      ),
    ).toEqual({ panX: 2000, panY: -900, zoom: 6 });
    expect(
      clampImageTransform(
        { panX: 100, panY: 100, zoom: 0.1 },
        { height: 600, width: 800 },
        { height: 400, width: 800 },
      ),
    ).toEqual({ panX: 0, panY: 0, zoom: 1 });
  });

  it("zooms around the pointer and supports visible controls, wheel zoom and reset", () => {
    const pointerZoom = zoomImageAroundPoint(
      { panX: 0, panY: 0, zoom: 1 },
      2,
      { x: 600, y: 300 },
      { height: 600, width: 800 },
      { height: 400, width: 800 },
    );
    expect(pointerZoom).toEqual({ panX: -200, panY: 0, zoom: 2 });

    render(
      <MantineProvider theme={gssTheme}>
        <InteractiveImageViewer src="blob:test" />
      </MantineProvider>,
    );
    const viewport = screen.getByRole("img", { name: "Interactive building image viewer" });
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 600 },
      clientWidth: { configurable: true, value: 800 },
    });
    const image = screen.getByAltText("Private building image");
    Object.defineProperties(image, {
      naturalHeight: { configurable: true, value: 600 },
      naturalWidth: { configurable: true, value: 1200 },
    });
    fireEvent.load(image);
    expect(screen.getByText("100%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("125%")).toBeTruthy();
    fireEvent.wheel(viewport, { clientX: 600, clientY: 300, deltaY: -100 });
    expect(screen.getByText("140%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset image view" }));
    expect(screen.getByText("100%")).toBeTruthy();
    expect(image.style.transform).toBe("scale(1)");
  });

  it("does not request private image metadata without building-plans.view", () => {
    mocks.session = {
      context: "company-user",
      user: {
        companyId: "company-1",
        email: "viewer@example.com",
        id: "viewer-1",
        isActive: true,
        isSuperAdmin: false,
        name: "Viewer",
        permissions: ["monitoring.view"],
      },
    };
    render(
      <MantineProvider theme={gssTheme}>
        <BuildingImageViewerPanel basePath="/company" buildingId="building-1" kind="PLAN" />
      </MantineProvider>,
    );
    expect(screen.queryByRole("img", { name: "Interactive building image viewer" })).toBeNull();
    expect(mocks.apiRequest).not.toHaveBeenCalled();
    expect(mocks.apiBlob).not.toHaveBeenCalled();
  });
});
