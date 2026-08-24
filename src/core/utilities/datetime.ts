export const DISPLAY_TIME_ZONE = "Asia/Jakarta";

type DateInput = Date | string | number;

function toDate(input: DateInput): Date {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error("INVALID_DATE");
  return d;
}

export function formatDate(input: DateInput): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(toDate(input));
}

export function formatDateTime(input: DateInput): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(toDate(input));
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
