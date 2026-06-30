import type { DayType } from "./types";

/** Hebrew labels for each day type (RTL UI + export). */
export const DAY_TYPE_LABELS: Record<DayType, string> = {
  work: "עבודה",
  vacation: "חופש",
  sick: "מחלה",
  holiday: "חג",
  absence: "היעדרות",
};

export const DAY_TYPE_ORDER: DayType[] = [
  "work",
  "vacation",
  "sick",
  "holiday",
  "absence",
];

/** Short Hebrew weekday labels, indexed by JS getDay() (0 = Sunday). */
export const HEBREW_WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"] as const;

/** Hebrew month names, indexed 0-11. */
export const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
] as const;

/** Column headers for the exported monthly report (Excel / CSV / Sheets). */
/** Matches the field order required by HR's month-end submission template. */
export const REPORT_COLUMNS = [
  "יום",
  "תאריך",
  "שעת התחלה",
  "שעת סיום",
  "השתלמות",
  "תפקיד",
  "חופשה",
  "מחלה",
  "נסיעות",
  "הערות",
] as const;

export const DEFAULT_TIMEZONE = "Asia/Jerusalem";
export const DEFAULT_EXPECTED_DAILY_HOURS = 8;
