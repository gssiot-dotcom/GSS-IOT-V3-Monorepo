import { getActiveLocale } from "./locale-context";
import { intlLocaleByLocale, type Locale } from "./types";

function intlLocale(locale: Locale = getActiveLocale()): string {
  return intlLocaleByLocale[locale];
}

export function formatDateTime(
  value: string | number | Date,
  locale: Locale = getActiveLocale(),
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDate(
  value: string | number | Date,
  locale: Locale = getActiveLocale(),
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export function formatNumber(
  value: number,
  locale: Locale = getActiveLocale(),
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

export function formatPercent(
  value: number,
  locale: Locale = getActiveLocale(),
  maximumFractionDigits = 1,
): string {
  return formatNumber(value, locale, { maximumFractionDigits, style: "percent" });
}

export function formatFileSize(bytes: number, locale: Locale = getActiveLocale()): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return `0 ${locale === "ko" ? "바이트" : "bytes"}`;
  const units =
    locale === "ko" ? ["바이트", "KB", "MB", "GB", "TB"] : ["bytes", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${formatNumber(value, locale, { maximumFractionDigits: index === 0 ? 0 : 1 })} ${units[index]}`;
}

export function formatDuration(seconds: number, locale: Locale = getActiveLocale()): string {
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) return `${formatNumber(rounded, locale)}${locale === "ko" ? "초" : " s"}`;
  const minutes = Math.round(rounded / 60);
  if (minutes < 60) return `${formatNumber(minutes, locale)}${locale === "ko" ? "분" : " min"}`;
  const hours = Math.round(minutes / 60);
  return `${formatNumber(hours, locale)}${locale === "ko" ? "시간" : " hr"}`;
}

export function formatRelativeTime(
  value: string | number | Date,
  locale: Locale = getActiveLocale(),
  now = Date.now(),
): string {
  const differenceSeconds = Math.round((new Date(value).getTime() - now) / 1_000);
  const absolute = Math.abs(differenceSeconds);
  const formatter = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  if (absolute < 60) return formatter.format(differenceSeconds, "second");
  if (absolute < 3_600) return formatter.format(Math.round(differenceSeconds / 60), "minute");
  if (absolute < 86_400) return formatter.format(Math.round(differenceSeconds / 3_600), "hour");
  return formatter.format(Math.round(differenceSeconds / 86_400), "day");
}
