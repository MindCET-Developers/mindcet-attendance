import { revalidatePath } from "next/cache";
import Link from "next/link";
import {
  DAY_TYPE_LABELS,
  DAY_TYPE_ORDER,
  DEFAULT_TIMEZONE,
  daysInMonth,
  formatClockTime,
  formatMinutes,
  formatMonthHebrew,
  monthKey,
  minutesBetween,
  toDateKey,
  weekdayLabel,
  type AttendanceRecord,
  type DayType,
} from "@att/shared";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PageProps = {
  searchParams?: Promise<{ month?: string; day?: string }>;
};

type ProfileRow = {
  report_display_name: string | null;
  timezone: string | null;
  expected_daily_hours: number | null;
};

type AttendanceRow = Pick<
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

type DayView = {
  date: string;
  weekday: string;
  record: AttendanceRow | null;
  clockInValue: string;
  clockOutValue: string;
  totalMinutes: number;
};

function isValidMonth(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

function isValidDateKey(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function monthOffset(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dateOffset(dateKey: string, delta: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function weekDates(selectedDate: string): string[] {
  const date = new Date(`${selectedDate}T12:00:00Z`);
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

function isoToTimeValue(iso: string | null, timezone: string): string {
  return formatClockTime(iso, timezone).replace(/^24:/, "00:");
}

function timezoneOffset(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  }).formatToParts(date);
  const value = parts.find((part) => part.type === "timeZoneName")?.value;
  const match = value?.match(/GMT([+-]\d{2}):?(\d{2})?/);
  if (!match) return "Z";
  return `${match[1]}:${match[2] ?? "00"}`;
}

function normalizeTimezone(value: string | null | undefined): string {
  if (!value) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function isValidTimeValue(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function localTimeToIso(
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

async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  return { supabase, user };
}

async function clockIn() {
  "use server";

  const { supabase, user } = await getCurrentUser();
  const today = toDateKey(new Date());
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("attendance_records")
    .select("id, clock_in")
    .eq("user_id", user.id)
    .eq("work_date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("attendance_records")
      .update({
        clock_in: existing.clock_in ?? now,
        clock_out: null,
        day_type: "work",
        source: "realtime",
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("attendance_records").insert({
      user_id: user.id,
      work_date: today,
      clock_in: now,
      day_type: "work",
      source: "realtime",
    });
  }

  revalidatePath("/app");
}

async function clockOut() {
  "use server";

  const { supabase, user } = await getCurrentUser();
  const today = toDateKey(new Date());
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("user_id", user.id)
    .eq("work_date", today)
    .is("clock_out", null)
    .not("clock_in", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("attendance_records")
      .update({ clock_out: now })
      .eq("id", existing.id);
  }

  revalidatePath("/app");
}

async function saveDay(formData: FormData) {
  "use server";

  const { supabase, user } = await getCurrentUser();
  const workDate = String(formData.get("work_date") ?? "");
  const recordId = String(formData.get("record_id") ?? "");
  const clockInValue = String(formData.get("clock_in") ?? "");
  const clockOutValue = String(formData.get("clock_out") ?? "");
  const dayType = String(formData.get("day_type") ?? "work") as DayType;
  const note = String(formData.get("note") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return;
  if (!DAY_TYPE_ORDER.includes(dayType)) return;
  if (clockInValue && !isValidTimeValue(clockInValue)) return;
  if (clockOutValue && !isValidTimeValue(clockOutValue)) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single<Pick<ProfileRow, "timezone">>();
  const timezone = normalizeTimezone(profile?.timezone);

  const clockIn = localTimeToIso(workDate, clockInValue, timezone);
  const clockOut = localTimeToIso(workDate, clockOutValue, timezone);
  const isEmptyWorkDay = !clockIn && !clockOut && dayType === "work" && !note;

  if (recordId && isEmptyWorkDay) {
    await supabase
      .from("attendance_records")
      .delete()
      .eq("id", recordId)
      .eq("user_id", user.id);
    revalidatePath("/app");
    return;
  }

  const payload = {
    user_id: user.id,
    work_date: workDate,
    clock_in: clockIn,
    clock_out: clockOut,
    day_type: dayType,
    note: note || null,
    is_edited: true,
    source: "manual",
  };

  if (recordId) {
    await supabase
      .from("attendance_records")
      .update(payload)
      .eq("id", recordId)
      .eq("user_id", user.id);
  } else if (!isEmptyWorkDay) {
    await supabase.from("attendance_records").insert(payload);
  }

  revalidatePath("/app");
}

export default async function AppHomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { supabase, user } = await getCurrentUser();
  const today = toDateKey(new Date());
  const selectedMonth = isValidMonth(params?.month)
    ? params.month
    : monthKey(today);

  const { data: profile } = await supabase
    .from("profiles")
    .select("report_display_name, timezone, expected_daily_hours")
    .eq("id", user.id)
    .single<ProfileRow>();

  const timezone = normalizeTimezone(profile?.timezone);
  const displayName = profile?.report_display_name ?? user.email ?? "";

  const monthDays = daysInMonth(selectedMonth);
  const monthStart = monthDays[0];
  const monthEnd = monthDays[monthDays.length - 1];

  const { data: records } = await supabase
    .from("attendance_records")
    .select(
      "id, user_id, work_date, clock_in, clock_out, day_type, note, is_edited, source, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .gte("work_date", monthStart)
    .lte("work_date", monthEnd)
    .order("work_date", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<AttendanceRow[]>();

  const recordByDate = new Map<string, AttendanceRow>();
  for (const record of records ?? []) recordByDate.set(record.work_date, record);

  const days: DayView[] = monthDays.map((date) => {
    const record = recordByDate.get(date) ?? null;
    return {
      date,
      weekday: weekdayLabel(date),
      record,
      clockInValue: isoToTimeValue(record?.clock_in ?? null, timezone),
      clockOutValue: isoToTimeValue(record?.clock_out ?? null, timezone),
      totalMinutes: minutesBetween(record?.clock_in ?? null, record?.clock_out ?? null),
    };
  });

  const todayRecord = recordByDate.get(today) ?? null;
  const isClockedIn = Boolean(todayRecord?.clock_in && !todayRecord.clock_out);
  const monthTotal = days.reduce((sum, day) => sum + day.totalMinutes, 0);
  const completedDays = days.filter((day) => day.totalMinutes > 0).length;
  const missingWorkDays = days.filter((day) => {
    if (day.date > today) return false;
    const record = day.record;
    return !record || (record.day_type === "work" && day.totalMinutes === 0);
  }).length;
  const todayMinutes = minutesBetween(
    todayRecord?.clock_in ?? null,
    todayRecord?.clock_out ?? null,
  );
  const todayClockIn = isoToTimeValue(todayRecord?.clock_in ?? null, timezone);
  const todayClockOut = isoToTimeValue(todayRecord?.clock_out ?? null, timezone);
  const requestedDay = isValidDateKey(params?.day) ? params.day : undefined;
  const selectedDate =
    requestedDay && monthKey(requestedDay) === selectedMonth
      ? requestedDay
      : selectedMonth === monthKey(today)
        ? today
        : monthStart;
  const selectedDay =
    days.find((day) => day.date === selectedDate) ?? days[0];
  const selectedRecord = selectedDay?.record ?? null;
  const selectedWeek = weekDates(selectedDate).map((date) => {
    const inSelectedMonth = monthKey(date) === selectedMonth;
    const record = inSelectedMonth ? recordByDate.get(date) ?? null : null;
    return {
      date,
      inSelectedMonth,
      record,
      totalMinutes: minutesBetween(record?.clock_in ?? null, record?.clock_out ?? null),
    };
  });
  const attentionDays = days
    .filter((day) => {
      if (day.date > today) return false;
      if (!day.record) return true;
      return day.record.day_type === "work" && !day.record.clock_out;
    })
    .slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">שלום,</p>
          <h1 className="text-3xl font-extrabold tracking-normal">
            {displayName || "ברוך הבא"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatMonthHebrew(selectedMonth)} · עריכת שבוע ויום נבחר
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Button asChild variant="outline" size="sm">
            <Link href={`/app?month=${monthOffset(selectedMonth, -1)}`}>
              חודש קודם
            </Link>
          </Button>
          <span className="min-w-28 text-center font-bold">
            {formatMonthHebrew(selectedMonth)}
          </span>
          <Button asChild variant="outline" size="sm">
            <Link href={`/app?month=${monthOffset(selectedMonth, 1)}`}>
              חודש הבא
            </Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                היום · {today}
              </p>
              <p className="mt-2 text-5xl font-extrabold tabular-nums">
                {formatMinutes(todayMinutes)}
              </p>
            </div>
            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-bold",
                isClockedIn
                  ? "bg-success/10 text-success"
                  : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {isClockedIn ? "משמרת פתוחה" : "לא מחובר"}
            </span>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            כניסה {todayClockIn || "--:--"} · יציאה {todayClockOut || "--:--"}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <form action={clockIn}>
              <Button className="h-14 w-full text-base" disabled={isClockedIn}>
                כניסה
              </Button>
            </form>
            <form action={clockOut}>
              <Button
                className="h-14 w-full text-base"
                variant="success"
                disabled={!isClockedIn}
              >
                יציאה
              </Button>
            </form>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-secondary p-3">
              <div className="font-extrabold">{formatMinutes(monthTotal)}</div>
              <div className="text-xs text-muted-foreground">חודש</div>
            </div>
            <div className="rounded-lg bg-secondary p-3">
              <div className="font-extrabold">{completedDays}</div>
              <div className="text-xs text-muted-foreground">ימים</div>
            </div>
            <div className="rounded-lg bg-secondary p-3">
              <div className="font-extrabold">{missingWorkDays}</div>
              <div className="text-xs text-muted-foreground">לטיפול</div>
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">השבוע</h2>
                <p className="text-sm text-muted-foreground">
                  בחר יום אחד לעריכה. שאר הימים נשארים לסריקה בלבד.
                </p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/app?month=${monthKey(dateOffset(selectedDate, -7))}&day=${dateOffset(selectedDate, -7)}`}
                  >
                    שבוע קודם
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/app?month=${monthKey(dateOffset(selectedDate, 7))}&day=${dateOffset(selectedDate, 7)}`}
                  >
                    שבוע הבא
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
              {selectedWeek.map((day) => {
                const isSelected = day.date === selectedDate;
                const isToday = day.date === today;
                const hasIssue =
                  day.inSelectedMonth &&
                  day.date <= today &&
                  (!day.record ||
                    (day.record.day_type === "work" && !day.record.clock_out));

                return (
                  <Link
                    key={day.date}
                    href={`/app?month=${monthKey(day.date)}&day=${day.date}`}
                    className={[
                      "min-h-28 rounded-xl border bg-background p-3 text-foreground no-underline transition-colors",
                      isSelected ? "border-primary ring-2 ring-primary/10" : "",
                      !day.inSelectedMonth ? "opacity-45" : "",
                      hasIssue ? "bg-destructive/5" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-extrabold">{day.date.slice(8)}</div>
                        <div className="text-xs text-muted-foreground">
                          {weekdayLabel(day.date)}
                        </div>
                      </div>
                      {isToday ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                          היום
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-5 text-sm">
                      <div className="font-bold">
                        {day.totalMinutes > 0 ? formatMinutes(day.totalMinutes) : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {day.record
                          ? DAY_TYPE_LABELS[day.record.day_type]
                          : hasIssue
                            ? "חסר דיווח"
                            : "אין דיווח"}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {selectedDay ? (
            <form action={saveDay} className="rounded-xl border bg-card p-5 shadow-sm">
              <input type="hidden" name="work_date" value={selectedDay.date} />
              <input type="hidden" name="record_id" value={selectedRecord?.id ?? ""} />

              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">יום נבחר</p>
                  <h2 className="text-2xl font-extrabold">
                    {selectedDay.date} · {selectedDay.weekday}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedRecord?.is_edited
                      ? "נערך ידנית"
                      : "אפשר להשלים או לתקן את היום הזה בלבד"}
                  </p>
                </div>
                <div className="rounded-lg bg-secondary px-4 py-3 text-center">
                  <div className="text-2xl font-extrabold">
                    {selectedDay.totalMinutes > 0
                      ? formatMinutes(selectedDay.totalMinutes)
                      : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">סה״כ</div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.1fr_1.6fr_auto] md:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="selected-clock-in">כניסה</Label>
                  <Input
                    id="selected-clock-in"
                    name="clock_in"
                    type="time"
                    defaultValue={selectedDay.clockInValue}
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="selected-clock-out">יציאה</Label>
                  <Input
                    id="selected-clock-out"
                    name="clock_out"
                    type="time"
                    defaultValue={selectedDay.clockOutValue}
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="selected-day-type">סוג יום</Label>
                  <select
                    id="selected-day-type"
                    name="day_type"
                    defaultValue={selectedRecord?.day_type ?? "work"}
                    className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm"
                  >
                    {DAY_TYPE_ORDER.map((type) => (
                      <option key={type} value={type}>
                        {DAY_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="selected-note">הערה</Label>
                  <Input
                    id="selected-note"
                    name="note"
                    defaultValue={selectedRecord?.note ?? ""}
                    placeholder="אופציונלי"
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="h-11">
                  שמור
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-[1fr_2fr]">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-extrabold">דורש טיפול</h2>
          <div className="mt-3 space-y-2">
            {attentionDays.length ? (
              attentionDays.map((day) => (
                <Link
                  key={day.date}
                  href={`/app?month=${monthKey(day.date)}&day=${day.date}`}
                  className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm text-foreground no-underline"
                >
                  <span className="font-bold">{day.date}</span>
                  <span className="text-muted-foreground">
                    {day.record ? "משמרת פתוחה" : "חסר דיווח"}
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">אין חריגים פתוחים כרגע.</p>
            )}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-extrabold">מבט חודשי מהיר</h2>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {days.map((day) => {
              const hasIssue =
                day.date <= today &&
                (!day.record ||
                  (day.record.day_type === "work" && !day.record.clock_out));
              return (
                <Link
                  key={day.date}
                  href={`/app?month=${selectedMonth}&day=${day.date}`}
                  title={day.date}
                  className={[
                    "flex h-9 items-center justify-center rounded-md border text-xs font-bold no-underline",
                    day.date === selectedDate
                      ? "border-primary bg-primary text-primary-foreground"
                      : hasIssue
                        ? "border-destructive/20 bg-destructive/10 text-destructive"
                        : day.record
                          ? "border-success/20 bg-success/10 text-success"
                          : "border-border bg-background text-muted-foreground",
                  ].join(" ")}
                >
                  {day.date.slice(8)}
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
