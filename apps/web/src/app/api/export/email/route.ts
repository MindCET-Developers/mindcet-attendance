import ExcelJS from "exceljs";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import {
  buildMonthlyReport,
  daysInMonth,
  exportFileName,
  reportToMatrix,
  type AttendanceRecord,
} from "@att/shared";

function isValidMonth(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return new Response("לא מחובר", { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return new Response("לא מחובר", { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("בקשה לא תקינה", { status: 400 });
  }

  const month = (body as Record<string, unknown>)?.month;
  if (!isValidMonth(month)) {
    return new Response("חודש לא תקין", { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("report_display_name, timezone")
    .eq("id", user.id)
    .single<{ report_display_name: string | null; timezone: string | null }>();

  const monthDays = daysInMonth(month);
  const { data: records } = await supabase
    .from("attendance_records")
    .select(
      "id, user_id, work_date, clock_in, clock_out, day_type, note, is_edited, source, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .gte("work_date", monthDays[0])
    .lte("work_date", monthDays[monthDays.length - 1])
    .order("work_date", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<AttendanceRecord[]>();

  const report = buildMonthlyReport(records ?? [], {
    month,
    displayName: profile?.report_display_name ?? user.email ?? "",
    timezone: profile?.timezone ?? undefined,
  });

  const matrix = reportToMatrix(report);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("דו״ח נוכחות", {
    views: [{ rightToLeft: true }],
  });
  matrix.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 16;
  });
  const buffer = await workbook.xlsx.writeBuffer();

  const toEmail = user.email;
  if (!toEmail) {
    return new Response("אין כתובת מייל למשתמש", { status: 422 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return new Response("שירות המייל לא מוגדר בשרת", { status: 503 });
  }

  const resend = new Resend(apiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const fileName = exportFileName(month, "xlsx");

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: [toEmail],
    subject: `דו״ח נוכחות – ${month}`,
    text: `שלום,\n\nמצורף קובץ האקסל של דו״ח הנוכחות לחודש ${month}.\n\nMindCET Attendance`,
    attachments: [
      {
        filename: fileName,
        content: Buffer.from(buffer).toString("base64"),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  });

  if (error) {
    console.error("Resend error", error);
    return new Response("שליחת המייל נכשלה", { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true, to: toEmail }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
