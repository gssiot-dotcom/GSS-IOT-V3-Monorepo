import { configure } from "@testing-library/react";
import { afterEach } from "vitest";

import { setActiveLocale } from "../app/i18n";

setActiveLocale("en");
document.cookie = "gss_csrf=test-csrf-token; path=/";

afterEach(() => setActiveLocale("en"));

configure({ asyncUtilTimeout: 15_000 });

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string): MediaQueryList =>
    ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }) as MediaQueryList,
});

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  value: () => undefined,
});
