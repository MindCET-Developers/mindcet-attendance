import type {
  AttendanceRecord,
  DayType,
  MonthlyReport,
  MonthlyReportRow,
  MonthlyReportSummary,
} from "./types";
import { DEFAULT_TIMEZONE } from "./constants";
import {
  formatClockTime,
  minutesBetween,
  monthKey,
  weekdayLabel,
} from "./time";

export interface BuildReportOptions {
  month: string; // 'YYYY-MM'
  displayName: string;
  timezone?: string;
}

/**
 * Aggregate raw attendance records into a monthly report grouped by calendar
 * day. Multiple records on the same date are summed; the representative day
 * type is the first non-"work" type found, otherwise "work".
 */
export function buildMonthlyReport(
  records: AttendanceRecord[],
  options: BuildReportOptions,
): MonthlyReport {
  const timezone = options.timezone ?? DEFAULT_TIMEZONE;
  const inMonth = records.filter((r) => monthKey(r.work_date) === options.month);

  const byDate = new Map<string, AttendanceRecord[]>();
  for (const record of inMonth) {
    const list = byDate.get(record.work_date) ?? [];
    list.push(record);
    byDate.set(record.work_date, list);
  }

  const rows: MonthlyReportRow[] = [];
  for (const [workDate, dayRecords] of [...byDate.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : 1,
  )) {
    let totalMinutes = 0;
    let minStart = Number.POSITIVE_INFINITY;
    let maxEnd = Number.NEGATIVE_INFINITY;
    let firstClockIn: string | null = null;
    let lastClockOut: string | null = null;
    const notes: string[] = [];

    for (const r of dayRecords) {
      totalMinutes += minutesBetween(r.clock_in, r.clock_out);
      if (r.clock_in) {
        const t = new Date(r.clock_in).getTime();
        if (!Number.isNaN(t) && t < minStart) {
          minStart = t;
          firstClockIn = r.clock_in;
        }
      }
      if (r.clock_out) {
        const t = new Date(r.clock_out).getTime();
        if (!Number.isNaN(t) && t > maxEnd) {
          maxEnd = t;
          lastClockOut = r.clock_out;
        }
      }
      if (r.note) notes.push(r.note);
    }

    const nonWork = dayRecords.find((r) => r.day_type !== "work");
    const dayType: DayType = nonWork ? nonWork.day_type : "work";

    rows.push({
      workDate,
      weekdayLabel: weekdayLabel(workDate),
      dayType,
      firstClockIn: formatClockTime(firstClockIn, timezone) || null,
      lastClockOut: formatClockTime(lastClockOut, timezone) || null,
      totalMinutes,
      note: notes.length ? notes.join(" · ") : null,
    });
  }

  return {
    month: options.month,
    displayName: options.displayName,
    rows,
    summary: summarize(rows),
  };
}

function summarize(rows: MonthlyReportRow[]): MonthlyReportSummary {
  const summary: MonthlyReportSummary = {
    workDays: 0,
    totalMinutes: 0,
    vacationDays: 0,
    sickDays: 0,
    holidayDays: 0,
    absenceDays: 0,
  };
  for (const row of rows) {
    summary.totalMinutes += row.totalMinutes;
    switch (row.dayType) {
      case "work":
        if (row.totalMinutes > 0) summary.workDays += 1;
        break;
      case "vacation":
        summary.vacationDays += 1;
        break;
      case "sick":
        summary.sickDays += 1;
        break;
      case "holiday":
        summary.holidayDays += 1;
        break;
      case "absence":
        summary.absenceDays += 1;
        break;
    }
  }
  return summary;
}
