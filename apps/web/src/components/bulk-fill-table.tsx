"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { DAY_TYPE_LABELS, DAY_TYPE_ORDER, type DayType } from "@att/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface BulkFillDay {
  workDate: string;
  weekdayLabel: string;
  isWeekend: boolean;
}

interface RowState {
  clockIn: string;
  clockOut: string;
  dayType: DayType;
  note: string;
}

const EMPTY_ROW: RowState = { clockIn: "", clockOut: "", dayType: "work", note: "" };

function SubmitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || count === 0}>
      {pending ? "שומר..." : `שמירת ${count} ימים`}
    </Button>
  );
}

export function BulkFillTable({ days }: { days: BulkFillDay[] }) {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [defaultIn, setDefaultIn] = useState("09:00");
  const [defaultOut, setDefaultOut] = useState("17:00");

  const get = (d: string) => rows[d] ?? EMPTY_ROW;
  const update = (d: string, patch: Partial<RowState>) =>
    setRows((prev) => ({ ...prev, [d]: { ...(prev[d] ?? EMPTY_ROW), ...patch } }));

  const fillWeekdays = () =>
    setRows((prev) => {
      const next = { ...prev };
      for (const day of days) {
        const row = next[day.workDate] ?? EMPTY_ROW;
        if (day.isWeekend || row.dayType !== "work" || row.clockIn || row.clockOut) continue;
        next[day.workDate] = { ...row, clockIn: defaultIn, clockOut: defaultOut };
      }
      return next;
    });

  const filledCount = days.filter((d) => {
    const r = get(d.workDate);
    return r.clockIn || r.clockOut || r.note || r.dayType !== "work";
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/40 p-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">כניסה</span>
          <Input
            value={defaultIn}
            onChange={(e) => setDefaultIn(e.target.value)}
            className="h-8 w-20 text-center tabular-nums"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">יציאה</span>
          <Input
            value={defaultOut}
            onChange={(e) => setDefaultOut(e.target.value)}
            className="h-8 w-20 text-center tabular-nums"
          />
        </label>
        <Button type="button" variant="outline" size="sm" onClick={fillWeekdays}>
          מלא בכל ימי א׳–ה׳ הריקים
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setRows({})}>
          נקה הכל
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-right text-muted-foreground">
              <th className="py-2 pr-2 font-semibold">יום</th>
              <th className="py-2 pr-2 font-semibold">תאריך</th>
              <th className="py-2 pr-2 font-semibold">כניסה</th>
              <th className="py-2 pr-2 font-semibold">יציאה</th>
              <th className="py-2 pr-2 font-semibold">סוג</th>
              <th className="py-2 pr-2 font-semibold">הערה</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const row = get(day.workDate);
              const d = day.workDate;
              return (
                <tr
                  key={d}
                  className={["border-b last:border-0", day.isWeekend ? "opacity-60" : ""].join(" ")}
                >
                  <td className="py-1.5 pr-2 text-muted-foreground">{day.weekdayLabel}</td>
                  <td className="py-1.5 pr-2 font-medium tabular-nums">
                    {d.slice(8)}/{d.slice(5, 7)}
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      name={`in_${d}`}
                      inputMode="numeric"
                      value={row.clockIn}
                      onChange={(e) => update(d, { clockIn: e.target.value })}
                      className="h-8 w-20 text-center tabular-nums"
                      placeholder="--:--"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      name={`out_${d}`}
                      inputMode="numeric"
                      value={row.clockOut}
                      onChange={(e) => update(d, { clockOut: e.target.value })}
                      className="h-8 w-20 text-center tabular-nums"
                      placeholder="--:--"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <select
                      name={`type_${d}`}
                      value={row.dayType}
                      onChange={(e) => update(d, { dayType: e.target.value as DayType })}
                      className="h-8 rounded-md border border-input bg-card px-2 text-sm"
                    >
                      {DAY_TYPE_ORDER.map((t) => (
                        <option key={t} value={t}>
                          {DAY_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      name={`note_${d}`}
                      value={row.note}
                      onChange={(e) => update(d, { note: e.target.value })}
                      className="h-8 min-w-32 text-xs"
                      placeholder="הערה"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <SubmitButton count={filledCount} />
      </div>
    </div>
  );
}
