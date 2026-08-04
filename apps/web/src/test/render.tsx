import { QueryClientProvider } from "@tanstack/react-query";
import { render as testingLibraryRender, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import { createTestQueryClient } from "../shared/query/test-query-client";

export * from "@testing-library/react";

type GssRenderOptions = RenderOptions & { router?: boolean };

export function render(
  ui: ReactElement,
  options?: GssRenderOptions,
): ReturnType<typeof testingLibraryRender> {
  const queryClient = createTestQueryClient();
  const { router = true, wrapper: TestWrapper, ...renderOptions } = options ?? {};
  const content = (children: ReactNode) =>
    TestWrapper ? <TestWrapper>{children}</TestWrapper> : children;
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {router ? <MemoryRouter>{content(children)}</MemoryRouter> : content(children)}
    </QueryClientProvider>
  );

  return testingLibraryRender(ui, { ...renderOptions, wrapper: Wrapper });
}
