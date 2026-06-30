import { useCallback, useEffect, useState } from "react";
import {
  daysInMonth,
  isValidTimeValue,
  localTimeToIso,
  minutesBetween,
  parseFlexibleTime,
  toDateKey,
  DAY_TYPE_ORDER,
  type AttendanceRecord,
  type DayType,
} from "@att/shared";
import { supabase } from "@/lib/supabase/client";

export type AttendanceRow = Pick<
  AttendanceRecord,
  | "id"
  | "user_id"
  | "work_date"
  | "clock_in"
  | "clock_out"
  | "day_type"
  | "note"
  | "is_edited"
  | "source"
  | "created_at"
  | "updated_at"
>;

export type DayView = {
  date: string;
  records: AttendanceRow[];
  totalMinutes: number;
};

const ATTENDANCE_COLUMNS =
  "id, user_id, work_date, clock_in, clock_out, day_type, note, is_edited, source, created_at, updated_at";

/** Fetches attendance records for one calendar month and groups them by day. */
export function useAttendance(userId: string | undefined, month: string) {
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const monthDays = daysInMonth(month);
    const { data } = await supabase
      .from("attendance_records")
      .select(ATTENDANCE_COLUMNS)
      .eq("user_id", userId)
      .gte("work_date", monthDays[0])
      .lte("work_date", monthDays[monthDays.length - 1])
      .order("work_date", { ascending: true })
      .order("created_at", { ascending: true });
    setRecords((data as AttendanceRow[] | null) ?? []);
    setLoading(false);
  }, [userId, month]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { records, loading, refresh };
}

/** Groups a month's records by day and totals each day's minutes. */
export function buildDayViews(records: AttendanceRow[], month: string): DayView[] {
  const byDate = new Map<string, AttendanceRow[]>();
  for (const record of records) {
    const list = byDate.get(record.work_date) ?? [];
    list.push(record);
    byDate.set(record.work_date, list);
  }
  return daysInMonth(month).map((date) => {
    const dayRecords = byDate.get(date) ?? [];
    return {
      date,
      records: dayRecords,
      totalMinutes: dayRecords.reduce(
        (sum, record) => sum + minutesBetween(record.clock_in, record.clock_out),
        0,
      ),
    };
  });
}

type ActionResult = { error?: string };

/** Clocks in to "now": reuses an empty work placeholder row if one exists for today. */
export async function clockIn(userId: string, timezone: string): Promise<ActionResult> {
  const today = toDateKey(new Date(), timezone);
  const now = new Date().toISOString();

  const { data: todays } = await supabase
    .from("attendance_records")
    .select("id, clock_in, clock_out, day_type")
    .eq("user_id", userId)
    .eq("work_date", today);

  const rows =
    (todays as Pick<AttendanceRow, "id" | "clock_in" | "clock_out" | "day_type">[] | null) ?? [];
  const open = rows.find((record) => record.clock_in && !record.clock_out);
  if (open) return { error: "כבר רשומה משמרת פתוחה להיום" };

  const placeholder = rows.find(
    (record) => !record.clock_in && !record.clock_out && record.day_type === "work",
  );

  const { error } = placeholder
    ? await supabase
        .from("attendance_records")
        .update({ clock_in: now, source: "realtime" })
        .eq("id", placeholder.id)
    : await supabase.from("attendance_records").insert({
        user_id: userId,
        work_date: today,
        clock_in: now,
        day_type: "work",
        source: "realtime",
      });

  return error ? { error: "החתמת הכניסה נכשלה, נסו שוב" } : {};
}

/**
 * Clocks in retroactively for a time earlier today (e.g. "forgot to clock in
 * this morning"). Same open-shift guard and placeholder-row reuse as
 * `clockIn`, but the clock_in timestamp comes from a user-supplied "HH:MM"
 * instead of `now`, and the row is marked as a manual edit.
 */
export async function clockInAt(
  userId: string,
  timeValue: string,
  timezone: string,
): Promise<ActionResult> {
  const parsedTime = parseFlexibleTime(timeValue);
  if (!parsedTime) return { error: "שעה לא תקינה" };

  const today = toDateKey(new Date(), timezone);
  const clockInIso = localTimeToIso(today, parsedTime, timezone);
  if (!clockInIso || new Date(clockInIso).getTime() > Date.now()) {
    return { error: "לא ניתן לרשום שעה עתידית" };
  }

  const { data: todays } = await supabase
    .from("attendance_records")
    .select("id, clock_in, clock_out, day_type")
    .eq("user_id", userId)
    .eq("work_date", today);

  const rows =
    (todays as Pick<AttendanceRow, "id" | "clock_in" | "clock_out" | "day_type">[] | null) ?? [];
  const open = rows.find((record) => record.clock_in && !record.clock_out);
  if (open) return { error: "כבר רשומה משמרת פתוחה להיום" };

  const placeholder = rows.find(
    (record) => !record.clock_in && !record.clock_out && record.day_type === "work",
  );

  const { error } = placeholder
    ? await supabase
        .from("attendance_records")
        .update({ clock_in: clockInIso, source: "manual", is_edited: true })
        .eq("id", placeholder.id)
    : await supabase.from("attendance_records").insert({
        user_id: userId,
        work_date: today,
        clock_in: clockInIso,
        day_type: "work",
        source: "manual",
        is_edited: true,
      });

  return error ? { error: "החתמת הכניסה נכשלה, נסו שוב" } : {};
}

/** Clocks out of today's most recently opened shift. */
export async function clockOut(userId: string, timezone: string): Promise<ActionResult> {
  const today = toDateKey(new Date(), timezone);
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("user_id", userId)
    .eq("work_date", today)
    .is("clock_out", null)
    .not("clock_in", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) return { error: "לא נמצאה משמרת פתוחה" };

  const { error } = await supabase
    .from("attendance_records")
    .update({ clock_out: now })
    .eq("id", existing.id);

  return error ? { error: "החתמת היציאה נכשלה, נסו שוב" } : {};
}

/** Creates, updates, or (if left blank) deletes a single shift segment. */
export async function saveDay(params: {
  userId: string;
  recordId?: string;
  workDate: string;
  clockInValue: string;
  clockOutValue: string;
  dayType: DayType;
  note: string;
  timezone: string;
}): Promise<ActionResult> {
  const { userId, recordId, workDate, clockInValue, clockOutValue, dayType, timezone } = params;
  const note = params.note.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return { error: "תאריך לא תקין" };
  if (!DAY_TYPE_ORDER.includes(dayType)) return { error: "סוג יום לא תקין" };
  if (clockInValue && !isValidTimeValue(clockInValue)) return { error: "שעת כניסה לא תקינה" };
  if (clockOutValue && !isValidTimeValue(clockOutValue)) return { error: "שעת יציאה לא תקינה" };

  const clockInIso = localTimeToIso(workDate, clockInValue, timezone);
  const clockOutIso = localTimeToIso(workDate, clockOutValue, timezone);
  const isEmptyWorkDay = !clockInIso && !clockOutIso && dayType === "work" && !note;

  if (!recordId && isEmptyWorkDay) return {};

  if (recordId && isEmptyWorkDay) {
    const { error } = await supabase
      .from("attendance_records")
      .delete()
      .eq("id", recordId)
      .eq("user_id", userId);
    return error ? { error: "מחיקת הרשומה נכשלה" } : {};
  }

  const payload = {
    user_id: userId,
    work_date: workDate,
    clock_in: clockInIso,
    clock_out: clockOutIso,
    day_type: dayType,
    note: note || null,
    is_edited: true,
    source: "manual" as const,
  };

  const { error } = recordId
    ? await supabase.from("attendance_records").update(payload).eq("id", recordId).eq("user_id", userId)
    : await supabase.from("attendance_records").insert(payload);

  return error ? { error: "שמירת היום נכשלה" } : {};
}

/** Removes a single shift segment outright. */
export async function deleteRecord(userId: string, recordId: string): Promise<ActionResult> {
  const { error } = await supabase
    .from("attendance_records")
    .delete()
    .eq("id", recordId)
    .eq("user_id", userId);
  return error ? { error: "מחיקת המשמרת נכשלה" } : {};
}
