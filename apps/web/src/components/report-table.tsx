"use client";

import { useState } from "react";
import type { MonthlyReportRow, AttendanceRecord } from "@att/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DayType = "work" | "vacation" | "sick" | "holiday" | "absence";

interface EditableReportTableProps {
  rows: MonthlyReportRow[];
  records: AttendanceRecord[];
  timezone?: string;
}

interface RowEditState {
  [dateKey: string]: {
    isEditing: boolean;
    clockIn: string | null;
    clockOut: string | null;
    dayType: DayType;
    note: string | null;
    isSaving: boolean;
    error: string | null;
  };
}

const DAY_TYPE_LABELS: Record<DayType, string> = {
  work: "עבודה",
  vacation: "חופשה",
  sick: "מחלה",
  holiday: "חג",
  absence: "היעדרות",
};

export function EditableReportTable({ rows, records, timezone }: EditableReportTableProps) {
  const [editState, setEditState] = useState<RowEditState>({});

  const getRowEditState = (workDate: string, row: MonthlyReportRow) => {
    return (
      editState[workDate] || {
        isEditing: false,
        clockIn: row.firstClockIn,
        clockOut: row.lastClockOut,
        dayType: row.dayType,
        note: row.note,
        isSaving: false,
        error: null,
      }
    );
  };

  const startEdit = (workDate: string, row: MonthlyReportRow) => {
    setEditState((prev) => ({
      ...prev,
      [workDate]: {
        isEditing: true,
        clockIn: row.firstClockIn,
        clockOut: row.lastClockOut,
        dayType: row.dayType,
        note: row.note,
        isSaving: false,
        error: null,
      },
    }));
  };

  const cancelEdit = (workDate: string) => {
    setEditState((prev) => {
      const newState = { ...prev };
      delete newState[workDate];
      return newState;
    });
  };

  const getRecordIdForDate = (workDate: string): string | null => {
    const record = records.find((r: AttendanceRecord) => r.work_date === workDate);
    return record?.id ?? null;
  };

  const saveEdit = async (workDate: string, row: MonthlyReportRow) => {
    const state = editState[workDate];
    if (!state) return;

    const recordId = getRecordIdForDate(workDate);
    if (!recordId) {
      setEditState((prev) => ({
        ...prev,
        [workDate]: {
          ...prev[workDate],
          isSaving: false,
          error: "Record not found",
        },
      }));
      return;
    }

    setEditState((prev) => ({
      ...prev,
      [workDate]: { ...prev[workDate], isSaving: true, error: null },
    }));

    try {
      const response = await fetch(`/api/attendance/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clock_in: state.clockIn,
          clock_out: state.clockOut,
          day_type: state.dayType,
          note: state.note,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      // Success - exit edit mode
      setEditState((prev) => {
        const newState = { ...prev };
        delete newState[workDate];
        return newState;
      });

      // Revalidate the page data
      window.location.reload();
    } catch (error) {
      setEditState((prev) => ({
        ...prev,
        [workDate]: {
          ...prev[workDate],
          isSaving: false,
          error: error instanceof Error ? error.message : "Error saving",
        },
      }));
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-right text-muted-foreground">
            <th className="py-2 pr-2 font-semibold">יום</th>
            <th className="py-2 pr-2 font-semibold">תאריך</th>
            <th className="py-2 pr-2 font-semibold">שעת התחלה</th>
            <th className="py-2 pr-2 font-semibold">שעת סיום</th>
            <th className="py-2 pr-2 font-semibold">השתלמות</th>
            <th className="py-2 pr-2 font-semibold">תפקיד</th>
            <th className="py-2 pr-2 font-semibold">חופשה</th>
            <th className="py-2 pr-2 font-semibold">מחלה</th>
            <th className="py-2 pr-2 font-semibold">נסיעות</th>
            <th className="py-2 pr-2 font-semibold">הערות</th>
            <th className="py-2 pr-2 font-semibold">פעולות</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => {
              const state = getRowEditState(row.workDate, row);

              return (
                <tr key={row.workDate} className="border-b last:border-0">
                  {!state.isEditing ? (
                    <>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {row.weekdayLabel}
                      </td>
                      <td className="py-2 pr-2 font-medium">{row.workDate}</td>
                      <td className="py-2 pr-2 tabular-nums">
                        {row.firstClockIn ?? "—"}
                      </td>
                      <td className="py-2 pr-2 tabular-nums">
                        {row.lastClockOut ?? "—"}
                      </td>
                      <td className="py-2 pr-2"></td>
                      <td className="py-2 pr-2"></td>
                      <td className="py-2 pr-2">
                        {row.dayType === "vacation" ? "X" : ""}
                      </td>
                      <td className="py-2 pr-2">
                        {row.dayType === "sick" ? "X" : ""}
                      </td>
                      <td className="py-2 pr-2"></td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {row.note ?? ""}
                      </td>
                      <td className="py-2 pr-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(row.workDate, row)}
                        >
                          עריכה
                        </Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {row.weekdayLabel}
                      </td>
                      <td className="py-2 pr-2 font-medium">{row.workDate}</td>
                      <td className="py-2 pr-2">
                        <Input
                          type="time"
                          value={state.clockIn || ""}
                          onChange={(e) =>
                            setEditState((prev) => ({
                              ...prev,
                              [row.workDate]: {
                                ...prev[row.workDate],
                                clockIn: e.target.value || null,
                              },
                            }))
                          }
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="time"
                          value={state.clockOut || ""}
                          onChange={(e) =>
                            setEditState((prev) => ({
                              ...prev,
                              [row.workDate]: {
                                ...prev[row.workDate],
                                clockOut: e.target.value || null,
                              },
                            }))
                          }
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="py-2 pr-2"></td>
                      <td className="py-2 pr-2"></td>
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={state.dayType === "vacation"}
                          onChange={(e) =>
                            setEditState((prev) => ({
                              ...prev,
                              [row.workDate]: {
                                ...prev[row.workDate],
                                dayType: e.target.checked ? "vacation" : "work",
                              },
                            }))
                          }
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={state.dayType === "sick"}
                          onChange={(e) =>
                            setEditState((prev) => ({
                              ...prev,
                              [row.workDate]: {
                                ...prev[row.workDate],
                                dayType: e.target.checked ? "sick" : "work",
                              },
                            }))
                          }
                        />
                      </td>
                      <td className="py-2 pr-2"></td>
                      <td className="py-2 pr-2">
                        <Input
                          type="text"
                          value={state.note || ""}
                          onChange={(e) =>
                            setEditState((prev) => ({
                              ...prev,
                              [row.workDate]: {
                                ...prev[row.workDate],
                                note: e.target.value || null,
                              },
                            }))
                          }
                          className="h-8 text-xs"
                          placeholder="הערה"
                        />
                      </td>
                      <td className="py-2 pr-2 space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelEdit(row.workDate)}
                          disabled={state.isSaving}
                        >
                          ביטול
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveEdit(row.workDate, row)}
                          disabled={state.isSaving}
                        >
                          {state.isSaving ? "שמירה..." : "שמור"}
                        </Button>
                        {state.error && (
                          <div className="mt-1 text-xs text-destructive">
                            {state.error}
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={11} className="py-6 text-center text-muted-foreground">
                אין דיווחים בחודש זה
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
