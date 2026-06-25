// Shared domain types for the personal attendance app.
// Mirrors the Supabase schema in /supabase/migrations.

export type DayType = "work" | "vacation" | "sick" | "holiday" | "absence";

export type AttendanceSource = "realtime" | "manual";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  report_display_name: string | null;
  expected_daily_hours: number;
  week_start: number; // 0 = Sunday
  timezone: string;
  onboarded: boolean;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  work_date: string; // 'YYYY-MM-DD'
  clock_in: string | null; // ISO timestamptz
  clock_out: string | null; // ISO timestamptz
  day_type: DayType;
  note: string | null;
  is_edited: boolean;
  source: AttendanceSource;
  created_at: string;
  updated_at: string;
}

export interface NotificationSettings {
  user_id: string;
  daily_reminder_enabled: boolean;
  daily_in_time: string | null; // 'HH:MM'
  daily_out_time: string | null; // 'HH:MM'
  forgot_clockout_enabled: boolean;
  forgot_clockout_after_hours: number;
  month_end_enabled: boolean;
  missing_days_enabled: boolean;
}

/** One aggregated row in the monthly report (one calendar day). */
export interface MonthlyReportRow {
  workDate: string; // 'YYYY-MM-DD'
  weekdayLabel: string; // 'א׳' .. 'ש׳'
  dayType: DayType;
  firstClockIn: string | null; // 'HH:MM'
  lastClockOut: string | null; // 'HH:MM'
  totalMinutes: number;
  note: string | null;
}

export interface MonthlyReportSummary {
  workDays: number;
  totalMinutes: number;
  vacationDays: number;
  sickDays: number;
  holidayDays: number;
  absenceDays: number;
}

export interface MonthlyReport {
  month: string; // 'YYYY-MM'
  displayName: string;
  rows: MonthlyReportRow[];
  summary: MonthlyReportSummary;
}
