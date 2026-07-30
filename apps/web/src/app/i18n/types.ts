import type { en } from "./locales/en";

export const supportedLocales = ["ko", "en"] as const;

export type Locale = (typeof supportedLocales)[number];
export type TranslationKey = keyof typeof en;
export type TranslationCatalog = { readonly [Key in TranslationKey]: string };
export type TranslationValues = Readonly<Record<string, string | number>>;

export const defaultLocale: Locale = "ko";
export const intlLocaleByLocale: Readonly<Record<Locale, string>> = {
  en: "en-US",
  ko: "ko-KR",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && supportedLocales.includes(value as Locale);
}
