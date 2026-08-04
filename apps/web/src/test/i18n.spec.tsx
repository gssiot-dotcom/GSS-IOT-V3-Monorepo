import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen } from "./render";
import { afterEach, describe, expect, it } from "vitest";

import {
  formatDateTime,
  formatNumber,
  LanguageSelector,
  LocaleProvider,
  localeStorageKey,
  readStoredLocale,
  tf,
  useI18n,
} from "../app/i18n";

function Harness() {
  const { locale, t } = useI18n();
  return (
    <>
      <span data-testid="locale">{locale}</span>
      <span data-testid="title">{t("nav.adminDashboard")}</span>
      <LanguageSelector />
    </>
  );
}

function renderHarness() {
  return render(
    <MantineProvider theme={gssTheme}>
      <LocaleProvider>
        <Harness />
      </LocaleProvider>
    </MantineProvider>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("KO/EN locale runtime", () => {
  it("defaults to Korean without using the browser language", () => {
    Object.defineProperty(window.navigator, "language", { configurable: true, value: "en-US" });
    expect(readStoredLocale(window.localStorage)).toBe("ko");
    renderHarness();
    expect(screen.getByTestId("locale").textContent).toBe("ko");
    expect(document.documentElement.lang).toBe("ko");
    expect(screen.getByTestId("title").textContent).toBe("대시보드");
  });

  it("switches immediately, persists English, and updates html lang", async () => {
    renderHarness();
    fireEvent.click(screen.getByTestId("language-selector"));
    fireEvent.click(await screen.findByText("English"));
    expect(screen.getByTestId("locale").textContent).toBe("en");
    expect(screen.getByTestId("title").textContent).toBe("Dashboard");
    expect(window.localStorage.getItem(localeStorageKey)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("restores a valid stored choice and falls back from invalid storage", () => {
    window.localStorage.setItem(localeStorageKey, "en");
    expect(readStoredLocale(window.localStorage)).toBe("en");
    window.localStorage.setItem(localeStorageKey, "fr");
    expect(readStoredLocale(window.localStorage)).toBe("ko");
  });

  it("interpolates every repeated placeholder and formats with explicit locales", () => {
    expect(tf("table.range", { from: 1, to: 2, total: 3 })).toContain("1");
    expect(formatNumber(1234.5, "ko")).toBe(new Intl.NumberFormat("ko-KR").format(1234.5));
    const value = "2026-07-30T12:30:00.000Z";
    expect(formatDateTime(value, "en")).toBe(
      new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      ),
    );
  });
});
