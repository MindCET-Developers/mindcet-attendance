"use client";

import { useEffect, useState } from "react";
import { elapsedSeconds, formatDuration } from "@att/shared";

/** Live total for today: closed-shift minutes plus a per-second ticking open shift. */
export function ShiftClock({
  baseMinutes,
  openClockIn,
}: {
  baseMinutes: number;
  openClockIn: string | null;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!openClockIn) return;
    const id = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [openClockIn]);

  const liveSeconds = baseMinutes * 60 + (openClockIn ? elapsedSeconds(openClockIn) : 0);

  return (
    <p className="mt-2 text-5xl font-extrabold tabular-nums">
      {formatDuration(liveSeconds)}
    </p>
  );
}
