export type LocalDateTimeValue = {
  date: string | null;
  time: string;
};

export type DateTimeRangeBoundary = "inclusive" | "exclusive";

export type NormalizedDateTimeRange = {
  from: string;
  to: string;
};

export type DateTimeRangeError = "invalid" | "max-range" | "required" | "reversed";

export type DateTimeRangeResult =
  { error: DateTimeRangeError; value?: never } | { error?: never; value: NormalizedDateTimeRange };

export type OptionalDateTimeRangeResult =
  | { error: Exclude<DateTimeRangeError, "max-range" | "required">; value?: never }
  | { error?: never; value: Partial<NormalizedDateTimeRange> };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

function localDate(value: LocalDateTimeValue, endBoundary?: DateTimeRangeBoundary): Date | null {
  if (!value.date) return null;
  const dateMatch = DATE_PATTERN.exec(value.date);
  if (!dateMatch) return null;
  const [, yearValue, monthValue, dayValue] = dateMatch;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);

  let hour = 0;
  let minute = 0;
  if (value.time) {
    const timeMatch = TIME_PATTERN.exec(value.time);
    if (!timeMatch) return null;
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2]);
    if (hour > 23 || minute > 59) return null;
  }

  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  if (!value.time && endBoundary === "exclusive") {
    return new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  }
  if (!value.time && endBoundary === "inclusive") {
    return new Date(year, month - 1, day + 1, 0, 0, 0, -1);
  }
  return date;
}

export function localDateTimeValue(date: Date): LocalDateTimeValue {
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export function normalizeRequiredDateTimeRange(
  from: LocalDateTimeValue,
  to: LocalDateTimeValue,
  options: { maxRangeMs?: number; toBoundary: DateTimeRangeBoundary },
): DateTimeRangeResult {
  if (!from.date || !to.date) return { error: "required" };
  const fromDate = localDate(from);
  const toDate = localDate(to, options.toBoundary);
  if (!fromDate || !toDate) return { error: "invalid" };
  const duration = toDate.getTime() - fromDate.getTime();
  if (duration <= 0) return { error: "reversed" };
  if (options.maxRangeMs !== undefined && duration > options.maxRangeMs) {
    return { error: "max-range" };
  }
  return { value: { from: fromDate.toISOString(), to: toDate.toISOString() } };
}

export function normalizeOptionalDateTimeRange(
  from: LocalDateTimeValue,
  to: LocalDateTimeValue,
  options: { toBoundary: DateTimeRangeBoundary },
): OptionalDateTimeRangeResult {
  if ((!from.date && from.time) || (!to.date && to.time)) return { error: "invalid" };
  const fromDate = from.date ? localDate(from) : null;
  const toDate = to.date ? localDate(to, options.toBoundary) : null;
  if ((from.date && !fromDate) || (to.date && !toDate)) return { error: "invalid" };
  if (fromDate && toDate && toDate.getTime() < fromDate.getTime()) return { error: "reversed" };
  return {
    value: {
      ...(fromDate ? { from: fromDate.toISOString() } : {}),
      ...(toDate ? { to: toDate.toISOString() } : {}),
    },
  };
}
