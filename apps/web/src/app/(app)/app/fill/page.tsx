import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  DAY_TYPE_ORDER,
  daysInMonth,
  formatMonthHebrew,
  localTimeToIso,
  monthKey,
  monthOffset,
  normalizeTimezone,
  parseFlexibleTime,
  toDateKey,
  weekdayIndex,
  weekdayLabel,
  type DayType,
} from "@att/shared";
import { getCurrentUser } from "@/lib/get-current-user";
import { Button } from "@/components/ui/button";
import { BulkFillTable, type BulkFillDay } from "@/components/bulk-fill-table";

type PageProps = {
  searchParams?: Promise<{ month?: string; status?: string; message?: string }>;
};

function isValidMonth(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

function buildUrl(month: string, status?: "success" | "error", message?: string) {
  const usp = new URLSearchParams({ month });
  if (status) usp.set("status", status);
  if (message) usp.set("message", message);
  return `/app/fill?${usp.toString()}`;
}

async function saveMissingDays(formData: FormData) {
  "use server";

  const { supabase, user } = await getCurrentUser();
  const month = String(formData.get("month") ?? "");
  if (!isValidMonth(month)) {
    redirect(buildUrl(monthKey(toDateKey(new Date())), "error", "חודש לא תקין"));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single<{ timezone: string | null }>();
  const timezone = normalizeTimezone(profile?.timezone);

  const monthDays = daysInMonth(month);
  const { data: existing } = await supabase
    .from("attendance_records")
    .select("work_date")
    .eq("user_id", user.id)
    .gte("work_date", monthDays[0])
    .lte("work_date", monthDays[monthDays.length - 1])
    .returns<{ work_date: string }[]>();
  const taken = new Set((existing ?? []).map((r) => r.work_date));

  const payload = [];
  const invalid: string[] = [];
  for (const workDate of monthDays) {
    if (taken.has(workDate)) continue;
    const rawIn = String(formData.get(`in_${workDate}`) ?? "").trim();
    const rawOut = String(formData.get(`out_${workDate}`) ?? "").trim();
    const rawType = String(formData.get(`type_${workDate}`) ?? "work");
    const note = String(formData.get(`note_${workDate}`) ?? "").trim();
    const dayType: DayType = DAY_TYPE_ORDER.includes(rawType as DayType)
      ? (rawType as DayType)
      : "work";

    if (!rawIn && !rawOut && !note && dayType === "work") continue;

    const inValue = rawIn ? parseFlexibleTime(rawIn) : null;
    const outValue = rawOut ? parseFlexibleTime(rawOut) : null;
    if ((rawIn && !inValue) || (rawOut && !outValue)) {
      invalid.push(workDate.slice(8));
      continue;
    }

    payload.push({
      user_id: user.id,
      work_date: workDate,
      clock_in: inValue ? localTimeToIso(workDate, inValue, timezone) : null,
      clock_out: outValue ? localTimeToIso(workDate, outValue, timezone) : null,
      day_type: dayType,
      note: note || null,
      is_edited: true,
      source: "manual" as const,
    });
  }

  if (invalid.length) {
    redirect(buildUrl(month, "error", `שעה לא תקינה בימים: ${invalid.join(", ")} — לא נשמר דבר`));
  }
  if (!payload.length) {
    redirect(buildUrl(month, "error", "לא מולאו ימים לשמירה"));
  }

  const { error } = await supabase.from("attendance_records").insert(payload);
  revalidatePath("/app");
  revalidatePath("/app/report");
  revalidatePath("/app/fill");
  redirect(
    error
      ? buildUrl(month, "error", "השמירה נכשלה, נסו שוב")
      : buildUrl(month, "success", `נשמרו ${payload.length} ימים`),
  );
}

export default async function FillMissingDaysPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { supabase, user } = await getCurrentUser();
  const today = toDateKey(new Date());
  const selectedMonth = isValidMonth(params?.month) ? params.month : monthKey(today);

  const monthDays = daysInMonth(selectedMonth);
  const { data: existing } = await supabase
    .from("attendance_records")
    .select("work_date")
    .eq("user_id", user.id)
    .gte("work_date", monthDays[0])
    .lte("work_date", monthDays[monthDays.length - 1])
    .returns<{ work_date: string }[]>();
  const taken = new Set((existing ?? []).map((r) => r.work_date));

  const missing: BulkFillDay[] = monthDays
    .filter((d) => d <= today && !taken.has(d))
    .map((d) => ({
      workDate: d,
      weekdayLabel: weekdayLabel(d),
      isWeekend: weekdayIndex(d) === 5 || weekdayIndex(d) === 6,
    }));

  const statusType =
    params?.status === "error" ? "error" : params?.status === "success" ? "success" : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">השלמת ימים חסרים</p>
          <h1 className="text-3xl font-extrabold tracking-normal">
            {formatMonthHebrew(selectedMonth)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            מלאו רק את הימים הרלוונטיים — שורות ריקות לא יישמרו. אפשר להקליד שעות בקיצור (830, 17).
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/fill?month=${monthOffset(selectedMonth, -1)}`}>חודש קודם</Link>
          </Button>
          <span className="min-w-28 text-center font-bold">
            {formatMonthHebrew(selectedMonth)}
          </span>
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/fill?month=${monthOffset(selectedMonth, 1)}`}>חודש הבא</Link>
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

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        {missing.length ? (
          <form action={saveMissingDays}>
            <input type="hidden" name="month" value={selectedMonth} />
            <BulkFillTable days={missing} />
          </form>
        ) : (
          <p className="py-6 text-center text-muted-foreground">
            אין ימים חסרים בחודש זה 🎉
          </p>
        )}
      </section>
    </div>
  );
}
