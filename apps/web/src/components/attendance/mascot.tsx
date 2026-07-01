"use client";

import { useEffect, useRef, useState } from "react";

export type MascotPhase = "idle" | "checkingIn" | "working" | "checkingOut";

const SOURCES = {
  idle: "/mascot/sleeping.mp4",
  checkingIn: "/mascot/checking-in.mp4",
  working: "/mascot/working.mp4",
  coffee: "/mascot/coffee.mp4",
};

/**
 * Small looping character animation reflecting attendance state: resting
 * before/after the work day, a one-shot clock-in clip on entering or leaving
 * a shift, and a working loop that occasionally takes a coffee break.
 *
 * Web port of the native (expo-video) mascot, driven by an HTML5 <video>.
 */
export function Mascot({
  phase,
  onTransientEnd,
  className,
}: {
  phase: MascotPhase;
  onTransientEnd?: () => void;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Which clip the <video> is currently pointed at. The "working" phase toggles
  // between the working and coffee clips as each loop plays to its end.
  const [source, setSource] = useState<string>(SOURCES.idle);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const onTransientEndRef = useRef(onTransientEnd);
  onTransientEndRef.current = onTransientEnd;

  useEffect(() => {
    if (phase === "checkingIn" || phase === "checkingOut") {
      setSource(SOURCES.checkingIn);
    } else if (phase === "working") {
      setSource(SOURCES.working);
    } else {
      setSource(SOURCES.idle);
    }
  }, [phase]);

  // Reload and play whenever the active clip changes.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.load();
    void video.play().catch(() => {
      /* Autoplay can reject until the user interacts; the clip still shows. */
    });
  }, [source]);

  function handleEnded() {
    const current = phaseRef.current;
    if (current === "checkingIn" || current === "checkingOut") {
      onTransientEndRef.current?.();
    } else if (current === "working") {
      // Occasionally break for coffee, then keep working.
      setSource((prev) =>
        prev === SOURCES.working
          ? Math.random() < 0.3
            ? SOURCES.coffee
            : SOURCES.working
          : SOURCES.working,
      );
    }
  }

  const looping = phase === "idle" || phase === "working";

  return (
    <video
      ref={videoRef}
      className={className}
      src={source}
      muted
      autoPlay
      playsInline
      loop={looping}
      onEnded={handleEnded}
    />
  );
}
