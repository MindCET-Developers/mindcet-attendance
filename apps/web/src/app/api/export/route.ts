import ExcelJS from "exceljs";
import {
  buildMonthlyReport,
  daysInMonth,
  exportFileName,
  matrixToCsv,
  reportToMatrix,
  type AttendanceRecord,
} from "@att/shared";
import { getCurrentUser } from "@/lib/get-current-user";

function isValidMonth(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

export async function GET(request: Request) {
  let auth: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    auth = await getCurrentUser();
  } catch {
    return new Response("לא מחובר", { status: 401 });
  }
  const { supabase, user } = auth;
  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  if (!isValidMonth(month)) {
    return new Response("חודש לא תקין", { status: 400 });
  }

  const monthDays = daysInMonth(month);
  const monthStart = monthDays[0];
  const monthEnd = monthDays[monthDays.length - 1];

  const { data: profile } = await supabase
    .from("profiles")
    .select("report_display_name, timezone")
    .eq("id", user.id)
    .single<{ report_display_name: string | null; timezone: string | null }>();

  const { data: records } = await supabase
    .from("attendance_records")
    .select(
      "id, user_id, work_date, clock_in, clock_out, day_type, note, is_edited, source, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .gte("work_date", monthStart)
    .lte("work_date", monthEnd)
    .returns<AttendanceRecord[]>();

  const report = buildMonthlyReport(records ?? [], {
    month,
    displayName: profile?.report_display_name ?? user.email ?? "",
    timezone: profile?.timezone ?? undefined,
  });

  const matrix = reportToMatrix(report);

  if (format === "csv") {
    const csv = `﻿${matrixToCsv(matrix)}`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName(month, "csv")}"`,
      },
    });
  }

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
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${exportFileName(month, "xlsx")}"`,
    },
  });
}
