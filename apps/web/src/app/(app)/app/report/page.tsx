import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  buildMonthlyReport,
  daysInMonth,
  formatMinutes,
  formatMonthHebrew,
  monthKey,
  monthOffset,
  reportToMatrix,
  toDateKey,
  type AttendanceRecord,
} from "@att/shared";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  createSpreadsheet,
  ensureSheetTab,
  getAccessToken,
  GoogleSheetsError,
  spreadsheetExists,
  spreadsheetUrl,
  writeSheetValues,
} from "@/lib/google-sheets";
import { Button } from "@/components/ui/button";
import { EditableReportTable } from "@/components/report-table";

type PageProps = {
  searchParams?: Promise<{ month?: string; status?: string; message?: string }>;
};

type ProfileRow = {
  report_display_name: string | null;
  timezone: string | null;
};

type ExportTargetRow = {
  google_sheet_id: string | null;
  google_refresh_token: string | null;
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
  return `/app/report?${usp.toString()}`;
}

async function exportToGoogleSheets(formData: FormData) {
  "use server";

  const { supabase, user } = await getCurrentUser();
  const month = String(formData.get("month") ?? "");
  if (!isValidMonth(month)) {
    redirect(buildUrl(monthKey(toDateKey(new Date())), "error", "חודש לא תקין"));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("report_display_name, timezone")
    .eq("id", user.id)
    .single<ProfileRow>();

  const { data: target } = await supabase
    .from("export_targets")
    .select("google_sheet_id, google_refresh_token")
    .eq("user_id", user.id)
    .maybeSingle<ExportTargetRow>();

  if (!target?.google_refresh_token) {
    redirect(
      buildUrl(
        month,
        "error",
        "אין הרשאת Google Sheets שמורה — התנתקו והתחברו מחדש עם Google",
      ),
    );
  }

  const monthDays = daysInMonth(month);
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
    .returns<AttendanceRecord[]>();

  const displayName = profile?.report_display_name ?? user.email ?? "";
  const report = buildMonthlyReport(records ?? [], {
    month,
    displayName,
    timezone: profile?.timezone ?? undefined,
  });
  const matrix = reportToMatrix(report);

  try {
    const accessToken = await getAccessToken(target.google_refresh_token);

    let spreadsheetId = target.google_sheet_id;
    if (!spreadsheetId || !(await spreadsheetExists(accessToken, spreadsheetId))) {
      spreadsheetId = await createSpreadsheet(
        accessToken,
        `נוכחות – ${displayName || "MindCET"}`,
        month,
      );
    } else {
      await ensureSheetTab(accessToken, spreadsheetId, month);
    }

    await writeSheetValues(accessToken, spreadsheetId, month, matrix);

    await supabase.from("export_targets").upsert(
      {
        user_id: user.id,
        google_sheet_id: spreadsheetId,
        last_exported_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  } catch (error) {
    const message =
      error instanceof GoogleSheetsError
        ? error.message
        : "ייצוא ל-Google Sheets נכשל, נסו שוב";
    redirect(buildUrl(month, "error", message));
  }

  revalidatePath("/app/report");
  redirect(buildUrl(month, "success", "יוצא בהצלחה ל-Google Sheets"));
}

export default async function MonthlyReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { supabase, user } = await getCurrentUser();
  const today = toDateKey(new Date());
  const selectedMonth = isValidMonth(params?.month)
    ? params.month
    : monthKey(today);

  const { data: profile } = await supabase
    .from("profiles")
    .select("report_display_name, timezone")
    .eq("id", user.id)
    .single<ProfileRow>();

  const { data: target } = await supabase
    .from("export_targets")
    .select("google_sheet_id, google_refresh_token")
    .eq("user_id", user.id)
    .maybeSingle<ExportTargetRow>();

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
    .returns<AttendanceRecord[]>();

  const report = buildMonthlyReport(records ?? [], {
    month: selectedMonth,
    displayName: profile?.report_display_name ?? user.email ?? "",
    timezone: profile?.timezone ?? undefined,
  });

  const exportHref = (format: "csv" | "xlsx") =>
    `/api/export?month=${selectedMonth}&format=${format}`;
  const statusType =
    params?.status === "error" ? "error" : params?.status === "success" ? "success" : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">דו״ח חודשי</p>
          <h1 className="text-3xl font-extrabold tracking-normal">
            {formatMonthHebrew(selectedMonth)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{report.displayName}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/report?month=${monthOffset(selectedMonth, -1)}`}>
              חודש קודם
            </Link>
          </Button>
          <span className="min-w-28 text-center font-bold">
            {formatMonthHebrew(selectedMonth)}
          </span>
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/report?month=${monthOffset(selectedMonth, 1)}`}>
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

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <div className="text-2xl font-extrabold tabular-nums">
            {formatMinutes(report.summary.totalMinutes)}
          </div>
          <div className="text-xs text-muted-foreground">סה״כ שעות</div>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <div className="text-2xl font-extrabold">{report.summary.workDays}</div>
          <div className="text-xs text-muted-foreground">ימי עבודה</div>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <div className="text-2xl font-extrabold">{report.summary.vacationDays}</div>
          <div className="text-xs text-muted-foreground">ימי חופש</div>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <div className="text-2xl font-extrabold">{report.summary.sickDays}</div>
          <div className="text-xs text-muted-foreground">ימי מחלה</div>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <div className="text-2xl font-extrabold">
            {report.summary.holidayDays + report.summary.absenceDays}
          </div>
          <div className="text-xs text-muted-foreground">חג / היעדרות</div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">תצוגה מקדימה</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <a href={exportHref("xlsx")}>הורדת Excel</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={exportHref("csv")}>הורדת CSV</a>
            </Button>
            <form action={exportToGoogleSheets}>
              <input type="hidden" name="month" value={selectedMonth} />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={!target?.google_refresh_token}
                title={
                  target?.google_refresh_token
                    ? undefined
                    : "התחברו מחדש עם Google כדי לאשר גישה ל-Sheets"
                }
              >
                ייצוא ל-Google Sheets
              </Button>
            </form>
            {target?.google_sheet_id ? (
              <a
                href={spreadsheetUrl(target.google_sheet_id)}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                פתח ב-Google Sheets
              </a>
            ) : null}
          </div>
        </div>

        <EditableReportTable
          rows={report.rows}
          records={records ?? []}
          timezone={profile?.timezone ?? undefined}
        />
      </section>
    </div>
  );
}
