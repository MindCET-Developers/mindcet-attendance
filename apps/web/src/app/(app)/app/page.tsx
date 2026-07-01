import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  DAY_TYPE_LABELS,
  DAY_TYPE_ORDER,
  dateOffset,
  dayNeedsAttention,
  daysInMonth,
  earliestIso,
  formatClockTime,
  formatMinutes,
  formatMonthHebrew,
  isoToTimeValue,
  isValidTimeValue,
  latestIso,
  localTimeToIso,
  monthKey,
  monthOffset,
  minutesBetween,
  normalizeTimezone,
  toDateKey,
  weekdayLabel,
  type AttendanceRecord,
  type DayType,
} from "@att/shared";
import { getCurrentUser } from "@/lib/get-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShiftClock } from "@/components/attendance/shift-clock";
import { RetroClockIn } from "@/components/attendance/retro-clock-in";
import { TodayMascot } from "@/components/attendance/today-mascot";

type PageProps = {
  searchParams?: Promise<{
    month?: string;
    day?: string;
    status?: string;
    message?: string;
  }>;
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
  records: AttendanceRow[];
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

function buildUrl(params: {
  month: string;
  day?: string;
  status?: "success" | "error";
  message?: string;
}): string {
  const usp = new URLSearchParams();
  usp.set("month", params.month);
  if (params.day) usp.set("day", params.day);
  if (params.status) usp.set("status", params.status);
  if (params.message) usp.set("message", params.message);
  return `/app?${usp.toString()}`;
}

async function getProfileTimezone(
  supabase: Awaited<ReturnType<typeof getCurrentUser>>["supabase"],
  userId: string,
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .single<Pick<ProfileRow, "timezone">>();
  return normalizeTimezone(profile?.timezone);
}

function redirectTarget(formData: FormData, fallbackDate: string) {
  const month = String(
    formData.get("redirect_month") || monthKey(fallbackDate),
  );
  const day = String(formData.get("redirect_day") || fallbackDate);
  return { month, day };
}

async function clockIn(formData: FormData) {
  "use server";

  const { supabase, user } = await getCurrentUser();
  const timezone = await getProfileTimezone(supabase, user.id);
  const today = toDateKey(new Date(), timezone);
  const now = new Date().toISOString();
  const { month, day } = redirectTarget(formData, today);

  const { data: todays } = await supabase
    .from("attendance_records")
    .select("id, clock_in, clock_out, day_type")
    .eq("user_id", user.id)
    .eq("work_date", today)
    .returns<Pick<AttendanceRow, "id" | "clock_in" | "clock_out" | "day_type">[]>();

  const open = (todays ?? []).find((record) => record.clock_in && !record.clock_out);
  if (open) {
    redirect(
      buildUrl({ month, day, status: "error", message: "כבר רשומה משמרת פתוחה להיום" }),
    );
  }

  // Reuse an empty work-type placeholder row instead of creating a duplicate blank one.
  const placeholder = (todays ?? []).find(
    (record) => !record.clock_in && !record.clock_out && record.day_type === "work",
  );

  const { error } = placeholder
    ? await supabase
        .from("attendance_records")
        .update({ clock_in: now, source: "realtime" })
        .eq("id", placeholder.id)
    : await supabase.from("attendance_records").insert({
        user_id: user.id,
        work_date: today,
        clock_in: now,
        day_type: "work",
        source: "realtime",
      });

  revalidatePath("/app");
  redirect(
    error
      ? buildUrl({ month, day, status: "error", message: "החתמת הכניסה נכשלה, נסו שוב" })
      : buildUrl({ month, day, status: "success", message: "כניסה נרשמה בהצלחה" }),
  );
}

async function clockInAt(formData: FormData) {
  "use server";

  const { supabase, user } = await getCurrentUser();
  const timezone = await getProfileTimezone(supabase, user.id);
  const today = toDateKey(new Date(), timezone);
  const { month, day } = redirectTarget(formData, today);

  const timeValue = String(formData.get("clock_in_time") ?? "");
  if (!isValidTimeValue(timeValue)) {
    redirect(buildUrl({ month, day, status: "error", message: "שעה לא תקינה" }));
  }

  const clockInIso = localTimeToIso(today, timeValue, timezone);
  if (!clockInIso || new Date(clockInIso).getTime() > Date.now()) {
    redirect(buildUrl({ month, day, status: "error", message: "לא ניתן לרשום שעה עתידית" }));
  }

  const { data: todays } = await supabase
    .from("attendance_records")
    .select("id, clock_in, clock_out, day_type")
    .eq("user_id", user.id)
    .eq("work_date", today)
    .returns<Pick<AttendanceRow, "id" | "clock_in" | "clock_out" | "day_type">[]>();

  const open = (todays ?? []).find((record) => record.clock_in && !record.clock_out);
  if (open) {
    redirect(
      buildUrl({ month, day, status: "error", message: "כבר רשומה משמרת פתוחה להיום" }),
    );
  }

  const placeholder = (todays ?? []).find(
    (record) => !record.clock_in && !record.clock_out && record.day_type === "work",
  );

  const { error } = placeholder
    ? await supabase
        .from("attendance_records")
        .update({ clock_in: clockInIso, source: "manual", is_edited: true })
        .eq("id", placeholder.id)
    : await supabase.from("attendance_records").insert({
        user_id: user.id,
        work_date: today,
        clock_in: clockInIso,
        day_type: "work",
        source: "manual",
        is_edited: true,
      });

  revalidatePath("/app");
  redirect(
    error
      ? buildUrl({ month, day, status: "error", message: "החתמת הכניסה נכשלה, נסו שוב" })
      : buildUrl({ month, day, status: "success", message: "כניסה נרשמה בהצלחה" }),
  );
}

async function clockOut(formData: FormData) {
  "use server";

  const { supabase, user } = await getCurrentUser();
  const timezone = await getProfileTimezone(supabase, user.id);
  const today = toDateKey(new Date(), timezone);
  const now = new Date().toISOString();
  const { month, day } = redirectTarget(formData, today);

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

  if (!existing) {
    redirect(buildUrl({ month, day, status: "error", message: "לא נמצאה משמרת פתוחה" }));
  }

  const { error } = await supabase
    .from("attendance_records")
    .update({ clock_out: now })
    .eq("id", existing.id);

  revalidatePath("/app");
  redirect(
    error
      ? buildUrl({ month, day, status: "error", message: "החתמת היציאה נכשלה, נסו שוב" })
      : buildUrl({ month, day, status: "success", message: "יציאה נרשמה בהצלחה" }),
  );
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
  const { month, day } = redirectTarget(formData, workDate || toDateKey(new Date()));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    redirect(buildUrl({ month, day, status: "error", message: "תאריך לא תקין" }));
  }
  if (!DAY_TYPE_ORDER.includes(dayType)) {
    redirect(buildUrl({ month, day, status: "error", message: "סוג יום לא תקין" }));
  }
  if (clockInValue && !isValidTimeValue(clockInValue)) {
    redirect(buildUrl({ month, day, status: "error", message: "שעת כניסה לא תקינה" }));
  }
  if (clockOutValue && !isValidTimeValue(clockOutValue)) {
    redirect(buildUrl({ month, day, status: "error", message: "שעת יציאה לא תקינה" }));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single<Pick<ProfileRow, "timezone">>();
  const timezone = normalizeTimezone(profile?.timezone);

  const clockInIso = localTimeToIso(workDate, clockInValue, timezone);
  const clockOutIso = localTimeToIso(workDate, clockOutValue, timezone);
  const isEmptyWorkDay = !clockInIso && !clockOutIso && dayType === "work" && !note;

  if (!recordId && isEmptyWorkDay) {
    // Blank "add segment" form submitted with nothing filled in — nothing to do.
    redirect(buildUrl({ month, day }));
  }

  if (recordId && isEmptyWorkDay) {
    const { error } = await supabase
      .from("attendance_records")
      .delete()
      .eq("id", recordId)
      .eq("user_id", user.id);
    revalidatePath("/app");
    redirect(
      error
        ? buildUrl({ month, day, status: "error", message: "מחיקת הרשומה נכשלה" })
        : buildUrl({ month, day, status: "success", message: "הרשומה הוסרה" }),
    );
  }

  const payload = {
    user_id: user.id,
    work_date: workDate,
    clock_in: clockInIso,
    clock_out: clockOutIso,
    day_type: dayType,
    note: note || null,
    is_edited: true,
    source: "manual" as const,
  };

  const { error } = recordId
    ? await supabase
        .from("attendance_records")
        .update(payload)
        .eq("id", recordId)
        .eq("user_id", user.id)
    : await supabase.from("attendance_records").insert(payload);

  revalidatePath("/app");
  redirect(
    error
      ? buildUrl({ month, day, status: "error", message: "שמירת היום נכשלה" })
      : buildUrl({ month, day, status: "success", message: "היום נשמר" }),
  );
}

async function deleteRecord(formData: FormData) {
  "use server";

  const { supabase, user } = await getCurrentUser();
  const recordId = String(formData.get("record_id") ?? "");
  const { month, day } = redirectTarget(formData, toDateKey(new Date()));

  if (!recordId) {
    redirect(buildUrl({ month, day, status: "error", message: "לא נמצאה רשומה למחיקה" }));
  }

  const { error } = await supabase
    .from("attendance_records")
    .delete()
    .eq("id", recordId)
    .eq("user_id", user.id);

  revalidatePath("/app");
  redirect(
    error
      ? buildUrl({ month, day, status: "error", message: "מחיקת המשמרת נכשלה" })
      : buildUrl({ month, day, status: "success", message: "המשמרת נמחקה" }),
  );
}

function SegmentForm({
  workDate,
  month,
  day,
  record,
  timezone,
  label,
  showDelete,
}: {
  workDate: string;
  month: string;
  day: string;
  record: AttendanceRow | null;
  timezone: string;
  label: string;
  showDelete?: boolean;
}) {
  const fieldId = record?.id ?? "new";
  const clockInValue = isoToTimeValue(record?.clock_in ?? null, timezone);
  const clockOutValue = isoToTimeValue(record?.clock_out ?? null, timezone);

  return (
    <div className="rounded-lg border border-dashed p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-muted-foreground">{label}</p>
        {record?.is_edited ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
            נערך ידנית
          </span>
        ) : null}
      </div>
      <form
        action={saveDay}
        className="grid gap-3 md:grid-cols-[1fr_1fr_1.1fr_1.6fr_auto] md:items-end"
      >
        <input type="hidden" name="work_date" value={workDate} />
        <input type="hidden" name="record_id" value={record?.id ?? ""} />
        <input type="hidden" name="redirect_month" value={month} />
        <input type="hidden" name="redirect_day" value={day} />
        <div className="space-y-1.5">
          <Label htmlFor={`clock-in-${fieldId}`}>כניסה</Label>
          <Input
            id={`clock-in-${fieldId}`}
            name="clock_in"
            type="time"
            defaultValue={clockInValue}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`clock-out-${fieldId}`}>יציאה</Label>
          <Input
            id={`clock-out-${fieldId}`}
            name="clock_out"
            type="time"
            defaultValue={clockOutValue}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`day-type-${fieldId}`}>סוג יום</Label>
          <select
            id={`day-type-${fieldId}`}
            name="day_type"
            defaultValue={record?.day_type ?? "work"}
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
          <Label htmlFor={`note-${fieldId}`}>הערה</Label>
          <Input
            id={`note-${fieldId}`}
            name="note"
            defaultValue={record?.note ?? ""}
            placeholder="אופציונלי"
            className="h-11"
          />
        </div>
        <Button type="submit" className="h-11">
          שמור
        </Button>
      </form>
      {showDelete && record ? (
        <form action={deleteRecord} className="mt-2 flex justify-end">
          <input type="hidden" name="record_id" value={record.id} />
          <input type="hidden" name="redirect_month" value={month} />
          <input type="hidden" name="redirect_day" value={day} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            הסר משמרת זו
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export default async function AppHomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { supabase, user } = await getCurrentUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("report_display_name, timezone, expected_daily_hours")
    .eq("id", user.id)
    .single<ProfileRow>();

  const timezone = normalizeTimezone(profile?.timezone);
  const today = toDateKey(new Date(), timezone);
  const selectedMonth = isValidMonth(params?.month)
    ? params.month
    : monthKey(today);
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

  const recordsByDate = new Map<string, AttendanceRow[]>();
  for (const record of records ?? []) {
    const list = recordsByDate.get(record.work_date) ?? [];
    list.push(record);
    recordsByDate.set(record.work_date, list);
  }

  const days: DayView[] = monthDays.map((date) => {
    const dayRecords = recordsByDate.get(date) ?? [];
    return {
      date,
      weekday: weekdayLabel(date),
      records: dayRecords,
      totalMinutes: dayRecords.reduce(
        (sum, record) => sum + minutesBetween(record.clock_in, record.clock_out),
        0,
      ),
    };
  });

  const todayRecords = recordsByDate.get(today) ?? [];
  const isClockedIn = todayRecords.some(
    (record) => record.clock_in && !record.clock_out,
  );
  const openClockIn =
    todayRecords.find((record) => record.clock_in && !record.clock_out)?.clock_in ?? null;
  const monthTotal = days.reduce((sum, day) => sum + day.totalMinutes, 0);
  const completedDays = days.filter((day) => day.totalMinutes > 0).length;
  const missingWorkDays = days.filter((day) => dayNeedsAttention(day, today)).length;
  const todayMinutes = todayRecords.reduce(
    (sum, record) => sum + minutesBetween(record.clock_in, record.clock_out),
    0,
  );
  const todayClockIn = isoToTimeValue(earliestIso(todayRecords, "clock_in"), timezone);
  const todayClockOut = isoToTimeValue(latestIso(todayRecords, "clock_out"), timezone);
  const requestedDay = isValidDateKey(params?.day) ? params.day : undefined;
  const selectedDate =
    requestedDay && monthKey(requestedDay) === selectedMonth
      ? requestedDay
      : selectedMonth === monthKey(today)
        ? today
        : monthStart;
  const selectedDay =
    days.find((day) => day.date === selectedDate) ?? days[0];
  const selectedWeek = weekDates(selectedDate).map((date) => {
    const inSelectedMonth = monthKey(date) === selectedMonth;
    const dayRecords = inSelectedMonth ? recordsByDate.get(date) ?? [] : [];
    return {
      date,
      inSelectedMonth,
      records: dayRecords,
      totalMinutes: dayRecords.reduce(
        (sum, record) => sum + minutesBetween(record.clock_in, record.clock_out),
        0,
      ),
    };
  });
  const attentionDays = days.filter((day) => dayNeedsAttention(day, today)).slice(0, 4);

  const statusType =
    params?.status === "error" ? "error" : params?.status === "success" ? "success" : null;

  // Seed the mascot's one-shot clip from the action that just succeeded.
  const justClockedIn =
    statusType === "success" && params?.message?.startsWith("כניסה");
  const justClockedOut =
    statusType === "success" && params?.message?.startsWith("יציאה");

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

      {statusType && params?.message ? (
        <div
          role="status"
          aria-live="polite"
          className={[
            "rounded-lg border px-4 py-3 text-sm font-medium",
            statusType === "success"
              ? "border-success/30 bg-success/10 text-success"
              : "border-destructive/30 bg-destructive/10 text-destructive",
          ].join(" ")}
        >
          {params.message}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex justify-center lg:hidden">
            <TodayMascot
              isClockedIn={isClockedIn}
              justClockedIn={justClockedIn}
              justClockedOut={justClockedOut}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                היום · {today}
              </p>
              <ShiftClock baseMinutes={todayMinutes} openClockIn={openClockIn} />
            </div>
            <span
              role="status"
              aria-label={isClockedIn ? "משמרת פתוחה כרגע" : "אינך מחובר כרגע"}
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
            {todayRecords.length > 1 ? ` · ${todayRecords.length} משמרות` : ""}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <form action={clockIn}>
              <input type="hidden" name="redirect_month" value={selectedMonth} />
              <input type="hidden" name="redirect_day" value={selectedDate} />
              <Button
                className="h-14 w-full text-base"
                disabled={isClockedIn}
                aria-pressed={isClockedIn}
              >
                כניסה
              </Button>
            </form>
            <form action={clockOut}>
              <input type="hidden" name="redirect_month" value={selectedMonth} />
              <input type="hidden" name="redirect_day" value={selectedDate} />
              <Button
                className="h-14 w-full text-base"
                variant="success"
                disabled={!isClockedIn}
              >
                יציאה
              </Button>
            </form>
          </div>

          {!isClockedIn ? (
            <RetroClockIn
              action={clockInAt}
              month={selectedMonth}
              day={selectedDate}
              defaultOpen={statusType === "error" && Boolean(params?.message)}
            />
          ) : null}

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
                const hasIssue = day.inSelectedMonth && dayNeedsAttention(day, today);

                return (
                  <Link
                    key={day.date}
                    href={`/app?month=${monthKey(day.date)}&day=${day.date}`}
                    aria-current={isToday ? "date" : undefined}
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
                        {day.records.length
                          ? day.records.length > 1
                            ? `${day.records.length} משמרות`
                            : DAY_TYPE_LABELS[day.records[0].day_type]
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
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">יום נבחר</p>
                  <h2 className="text-2xl font-extrabold">
                    {selectedDay.date} · {selectedDay.weekday}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedDay.records.length > 1
                      ? `${selectedDay.records.length} משמרות ביום זה`
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

              <div className="space-y-3">
                {selectedDay.records.map((record, index) => (
                  <SegmentForm
                    key={record.id}
                    workDate={selectedDay.date}
                    month={selectedMonth}
                    day={selectedDate}
                    record={record}
                    timezone={timezone}
                    label={
                      selectedDay.records.length > 1
                        ? `משמרת ${index + 1}`
                        : "פרטי היום"
                    }
                    showDelete
                  />
                ))}

                <SegmentForm
                  workDate={selectedDay.date}
                  month={selectedMonth}
                  day={selectedDate}
                  record={null}
                  timezone={timezone}
                  label={
                    selectedDay.records.length ? "הוספת משמרת נוספת" : "פרטי היום"
                  }
                />
              </div>
            </div>
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
                    {day.records.length === 0
                      ? "חסר דיווח"
                      : day.records.some((r) => r.day_type === "work" && r.clock_in && !r.clock_out)
                        ? "משמרת פתוחה"
                        : "אין שעות רשומות"}
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
              const hasIssue = dayNeedsAttention(day, today);
              return (
                <Link
                  key={day.date}
                  href={`/app?month=${selectedMonth}&day=${day.date}`}
                  title={day.date}
                  aria-current={day.date === today ? "date" : undefined}
                  className={[
                    "flex h-9 items-center justify-center rounded-md border text-xs font-bold no-underline",
                    day.date === selectedDate
                      ? "border-primary bg-primary text-primary-foreground"
                      : hasIssue
                        ? "border-destructive/20 bg-destructive/10 text-destructive"
                        : day.records.length
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
