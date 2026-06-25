import { HEBREW_WEEKDAYS, HEBREW_MONTHS, DEFAULT_TIMEZONE } from "./constants";

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Minutes worked between two ISO timestamps.
 * Returns 0 when either side is missing. Handles a clock-out past midnight
 * by adding 24h when the raw difference is negative.
 */
export function minutesBetween(
  clockIn: string | null,
  clockOut: string | null,
): number {
  if (!clockIn || !clockOut) return 0;
  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  let diff = end - start;
  if (diff < 0) diff += 24 * 60 * 60 * 1000; // crossed midnight
  return Math.round(diff / 60000);
}

/** Format a minute count as "H:MM" (e.g. 535 -> "8:55", 9825 -> "163:45"). */
export function formatMinutes(total: number): string {
  if (!total || total <= 0) return "0:00";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours}:${pad2(minutes)}`;
}

/** Format an ISO timestamp as "HH:MM" in the given timezone. */
export function formatClockTime(
  iso: string | null,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Date key "YYYY-MM-DD" for a Date in the given timezone. */
export function toDateKey(
  date: Date,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  // en-CA yields the YYYY-MM-DD ordering.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Month key "YYYY-MM" from a date key or Date. */
export function monthKey(value: string | Date, timezone?: string): string {
  const key = typeof value === "string" ? value : toDateKey(value, timezone);
  return key.slice(0, 7);
}

/** Hebrew short weekday label for a "YYYY-MM-DD" key. */
export function weekdayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  return HEBREW_WEEKDAYS[d.getUTCDay()] ?? "";
}

/** "יוני 2026" from a "YYYY-MM" month key. */
export function formatMonthHebrew(month: string): string {
  const [yearStr, monthStr] = month.split("-");
  const monthIndex = Number(monthStr) - 1;
  const name = HEBREW_MONTHS[monthIndex] ?? monthStr ?? "";
  return `${name} ${yearStr ?? ""}`.trim();
}

/** All "YYYY-MM-DD" keys in a given month, in order. */
export function daysInMonth(month: string): string[] {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  if (!year || !monthNum) return [];
  const count = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const keys: string[] = [];
  for (let day = 1; day <= count; day++) {
    keys.push(`${yearStr}-${monthStr}-${pad2(day)}`);
  }
  return keys;
}
