"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Secondary "I forgot to clock in" affordance: reveals a single arrival-time field. */
export function RetroClockIn({
  action,
  month,
  day,
  defaultOpen,
}: {
  action: (formData: FormData) => void;
  month: string;
  day: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 block text-sm font-semibold text-primary hover:underline"
      >
        שכחתי להחתים
      </button>
    );
  }

  return (
    <form action={action} className="mt-3 flex items-end gap-2">
      <input type="hidden" name="redirect_month" value={month} />
      <input type="hidden" name="redirect_day" value={day} />
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="clock_in_time">באיזו שעה הגעת?</Label>
        <Input id="clock_in_time" name="clock_in_time" type="time" required className="h-10" />
      </div>
      <Button type="submit" size="sm" className="h-10">
        שמור
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-10" onClick={() => setOpen(false)}>
        ביטול
      </Button>
    </form>
  );
}
