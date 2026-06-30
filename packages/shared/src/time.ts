import { HEBREW_WEEKDAYS, HEBREW_MONTHS, DEFAULT_TIMEZONE } from "./constants";
import type { AttendanceRecord } from "./types";

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

/** Seconds elapsed since an ISO instant (e.g. an open shift's clock_in), relative to `nowMs`. */
export function elapsedSeconds(startIso: string, nowMs: number = Date.now()): number {
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((nowMs - start) / 1000));
}

/** Format a second count as "H:MM:SS" (e.g. 3661 -> "1:01:01"). */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
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

/** Shift a "YYYY-MM" month key by `delta` months. */
export function monthOffset(month: string, delta: number): string {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthNumber = Number(monthStr);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Shift a "YYYY-MM-DD" date key by `delta` days. */
export function dateOffset(dateKey: string, delta: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/** Validate a timezone IANA name, falling back to DEFAULT_TIMEZONE. */
export function normalizeTimezone(value: string | null | undefined): string {
  if (!value) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** Validate a "HH:MM" 24h time-of-day string. */
export function isValidTimeValue(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hoursStr, minutesStr] = value.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Parse a loosely-typed time entry into a strict "HH:MM" string, or null if
 * it can't be interpreted. Accepts a colon/dot/dash/space separator ("7:45",
 * "7.45"), or plain digits grouped by length: 1-2 digits = hour only ("8" ->
 * "08:00"), 3 digits = hour + 2-digit minutes ("830" -> "08:30"), 4 digits =
 * 2-digit hour + 2-digit minutes ("0745" -> "07:45").
 */
export function parseFlexibleTime(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const separated = trimmed.match(/^(\d{1,2})[:.\- ](\d{1,2})$/);
  let hours: number;
  let minutes: number;
  if (separated) {
    hours = Number(separated[1]);
    minutes = Number(separated[2]);
  } else if (/^\d+$/.test(trimmed)) {
    if (trimmed.length <= 2) {
      hours = Number(trimmed);
      minutes = 0;
    } else if (trimmed.length === 3) {
      hours = Number(trimmed.slice(0, 1));
      minutes = Number(trimmed.slice(1));
    } else if (trimmed.length === 4) {
      hours = Number(trimmed.slice(0, 2));
      minutes = Number(trimmed.slice(2));
    } else {
      return null;
    }
  } else {
    return null;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${pad2(hours)}:${pad2(minutes)}`;
}

/** UTC offset string (e.g. "+03:00") for a timezone at a given instant. */
export function timezoneOffset(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  }).formatToParts(date);
  const value = parts.find((part) => part.type === "timeZoneName")?.value;
  const match = value?.match(/GMT([+-]\d{2}):?(\d{2})?/);
  if (!match) return "Z";
  return `${match[1]}:${match[2] ?? "00"}`;
}

/** Combine a "YYYY-MM-DD" date key + "HH:MM" local time into an ISO instant. */
export function localTimeToIso(
  dateKey: string,
  timeValue: string,
  timezone: string,
): string | null {
  if (!timeValue) return null;
  if (!isValidTimeValue(timeValue)) return null;
  const probe = new Date(`${dateKey}T${timeValue}:00Z`);
  const offset = timezoneOffset(probe, timezone);
  return new Date(`${dateKey}T${timeValue}:00${offset}`).toISOString();
}

/** Inverse of localTimeToIso: an ISO instant as "HH:MM" in the given timezone. */
export function isoToTimeValue(iso: string | null, timezone: string): string {
  return formatClockTime(iso, timezone).replace(/^24:/, "00:");
}

/** Earliest clock_in/clock_out (whichever `field`) among a set of records. */
export function earliestIso(
  records: Array<Pick<AttendanceRecord, "clock_in" | "clock_out">>,
  field: "clock_in" | "clock_out",
): string | null {
  const values = records
    .map((record) => record[field])
    .filter((value): value is string => Boolean(value));
  if (!values.length) return null;
  return values.reduce((min, value) => (value < min ? value : min));
}

/** Latest clock_in/clock_out (whichever `field`) among a set of records. */
export function latestIso(
  records: Array<Pick<AttendanceRecord, "clock_in" | "clock_out">>,
  field: "clock_in" | "clock_out",
): string | null {
  const values = records
    .map((record) => record[field])
    .filter((value): value is string => Boolean(value));
  if (!values.length) return null;
  return values.reduce((max, value) => (value > max ? value : max));
}

/**
 * A day needs attention if: it has no record yet, every record is marked
 * "work" but no hours were logged at all, or there's an open (unfinished)
 * work shift.
 */
export function dayNeedsAttention(
  day: {
    date: string;
    records: Array<Pick<AttendanceRecord, "day_type" | "clock_in" | "clock_out">>;
    totalMinutes: number;
  },
  today: string,
): boolean {
  if (day.date > today) return false;
  if (day.records.length === 0) return true;
  if (
    day.totalMinutes === 0 &&
    day.records.every((record) => record.day_type === "work")
  ) {
    return true;
  }
  return day.records.some(
    (record) => record.day_type === "work" && record.clock_in && !record.clock_out,
  );
}
