import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { en } from "./locales/en";
import { ko } from "./locales/ko";
import {
  defaultLocale,
  isLocale,
  type Locale,
  type TranslationCatalog,
  type TranslationKey,
  type TranslationValues,
} from "./types";

export const localeStorageKey = "gss-iot.locale.v1";

const catalogs: Readonly<Record<Locale, TranslationCatalog>> = { en, ko };
let activeLocale: Locale = defaultLocale;

export function readStoredLocale(storage?: Pick<Storage, "getItem">): Locale {
  if (!storage) return defaultLocale;
  try {
    const stored = storage.getItem(localeStorageKey);
    return isLocale(stored) ? stored : defaultLocale;
  } catch {
    return defaultLocale;
  }
}

function interpolate(message: string, values?: TranslationValues): string {
  if (!values) return message;
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}

export function translate(locale: Locale, key: TranslationKey, values?: TranslationValues): string {
  const selected = catalogs[locale][key];
  const fallback = en[key];
  return interpolate(selected || fallback || en["common.translationUnavailable"], values);
}

export function getActiveLocale(): Locale {
  return activeLocale;
}

export function setActiveLocale(locale: Locale): void {
  activeLocale = isLocale(locale) ? locale : defaultLocale;
  if (typeof document !== "undefined") document.documentElement.lang = activeLocale;
}

export function hasTranslationKey(key: string): key is TranslationKey {
  return Object.prototype.hasOwnProperty.call(en, key);
}

export function t(key: TranslationKey): string {
  return translate(activeLocale, key);
}

export function tf(key: TranslationKey, values: TranslationValues): string {
  return translate(activeLocale, key, values);
}

export function tx(key: string, fallback?: string): string {
  return hasTranslationKey(key) ? t(key) : (fallback ?? key.split(".").at(-1) ?? key);
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  tf: (key: TranslationKey, values: TranslationValues) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }): ReactElement {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = readStoredLocale(
      typeof window === "undefined" ? undefined : window.localStorage,
    );
    activeLocale = initial;
    if (typeof document !== "undefined") document.documentElement.lang = initial;
    return initial;
  });

  const setLocale = useCallback((nextLocale: Locale) => {
    const safeLocale = isLocale(nextLocale) ? nextLocale : defaultLocale;
    activeLocale = safeLocale;
    try {
      window.localStorage.setItem(localeStorageKey, safeLocale);
    } catch {
      // The runtime locale still changes when browser storage is unavailable.
    }
    document.documentElement.lang = safeLocale;
    setLocaleState(safeLocale);
  }, []);

  useEffect(() => {
    activeLocale = locale;
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => translate(locale, key),
      tf: (key, values) => translate(locale, key, values),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): LocaleContextValue {
  const value = useContext(LocaleContext);
  return (
    value ?? {
      locale: activeLocale,
      setLocale: setActiveLocale,
      t: (key) => translate(activeLocale, key),
      tf: (key, values) => translate(activeLocale, key, values),
    }
  );
}
