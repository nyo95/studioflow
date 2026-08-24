export const DISPLAY_TIME_ZONE = "Asia/Jakarta";

type DateInput = Date | string | number;
type DateFormatOptions = Intl.DateTimeFormatOptions & {
  locale?: Intl.LocalesArgument;
};

function toDate(input: DateInput): Date {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error("INVALID_DATE");
  return d;
}

export function formatDateWithOptions(
  input: DateInput,
  options: DateFormatOptions
): string {
  const { locale = "en-GB", timeZone = DISPLAY_TIME_ZONE, ...formatOptions } = options;
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    ...formatOptions,
  }).format(toDate(input));
}

export function formatDate(input: DateInput): string {
  return formatDateWithOptions(input, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(input: DateInput): string {
  return formatDateWithOptions(input, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function toJakartaDateBoundary(
  dateStr: string,
  endOfDay: boolean
): Date {
  const time = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  return toDate(`${dateStr}${time}+07:00`);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayJakarta(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return Date.parse(`${parts}T00:00:00+07:00`);
}

export function formatRelativeDate(
  input: DateInput,
  now: DateInput = new Date()
): string {
  const target = startOfDayJakarta(toDate(input));
  const today = startOfDayJakarta(toDate(now));
  const diffDays = Math.round((target - today) / DAY_MS);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays < 0) return `${-diffDays} days ago`;
  return `in ${diffDays} days`;
}
