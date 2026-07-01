"use client";

import { useState } from "react";
import { Mascot, type MascotPhase } from "./mascot";

/**
 * Drives the mascot phase from server-rendered attendance state. Because each
 * clock action is a server-action form post that re-renders the page, this
 * component mounts fresh per action: the one-shot "checking in/out" clip is
 * seeded from the just-happened signal, then settles into the idle/working loop.
 */
export function TodayMascot({
  isClockedIn,
  justClockedIn,
  justClockedOut,
}: {
  isClockedIn: boolean;
  justClockedIn?: boolean;
  justClockedOut?: boolean;
}) {
  const [phase, setPhase] = useState<MascotPhase>(() => {
    if (justClockedIn) return "checkingIn";
    if (justClockedOut) return "checkingOut";
    return isClockedIn ? "working" : "idle";
  });

  function handleTransientEnd() {
    setPhase((prev) => (prev === "checkingIn" ? "working" : "idle"));
  }

  return (
    <Mascot
      phase={phase}
      onTransientEnd={handleTransientEnd}
      className="h-40 w-full object-contain"
    />
  );
}
