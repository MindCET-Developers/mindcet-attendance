import type { MonthlyReport } from "./types";
import { REPORT_COLUMNS } from "./constants";

/**
 * Convert a monthly report into a 2D string matrix:
 * header row + one row per day + a summary row.
 * Shared by the Excel, CSV and Google Sheets exporters.
 */
export function reportToMatrix(report: MonthlyReport): string[][] {
  const header = [...REPORT_COLUMNS];
  const dataRows = report.rows.map((row) => [
    row.weekdayLabel,
    row.workDate,
    row.firstClockIn ?? "—",
    row.lastClockOut ?? "—",
    "",
    "",
    row.dayType === "vacation" ? "X" : "",
    row.dayType === "sick" ? "X" : "",
    "",
    row.note ?? "",
  ]);

  const summaryRow = [
    `סיכום · ${report.summary.workDays} ימי עבודה`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ];

  return [header, ...dataRows, summaryRow];
}

/** Serialize a matrix to CSV (RFC-4180 quoting). Caller adds a BOM if needed. */
export function matrixToCsv(matrix: string[][]): string {
  return matrix
    .map((row) => row.map(escapeCsvField).join(","))
    .join("\r\n");
}

function escapeCsvField(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/** Suggested file name, e.g. "attendance-2026-06.xlsx". */
export function exportFileName(month: string, ext: string): string {
  return `attendance-${month}.${ext}`;
}
