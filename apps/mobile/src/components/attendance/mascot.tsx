import { useEffect, useRef } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

export type MascotPhase = "idle" | "checkingIn" | "working" | "checkingOut";

const SOURCES = {
  idle: require("../../../assets/mascot/sleeping.mp4"),
  checkingIn: require("../../../assets/mascot/checking-in.mp4"),
  working: require("../../../assets/mascot/working.mp4"),
  coffee: require("../../../assets/mascot/coffee.mp4"),
};

/**
 * Small looping character animation reflecting attendance state: resting
 * before/after the work day, a one-shot clock-in clip on entering or leaving
 * a shift, and a working loop that occasionally takes a coffee break.
 */
export function Mascot({
  phase,
  onTransientEnd,
  style,
}: {
  phase: MascotPhase;
  onTransientEnd?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const onTransientEndRef = useRef(onTransientEnd);
  onTransientEndRef.current = onTransientEnd;

  const player = useVideoPlayer(SOURCES.idle, (p) => {
    p.muted = true;
    p.loop = true;
    p.play();
  });

  useEffect(() => {
    if (phase === "checkingIn" || phase === "checkingOut") {
      player.loop = false;
      player.replace(SOURCES.checkingIn);
    } else if (phase === "working") {
      player.loop = false;
      player.replace(SOURCES.working);
    } else {
      player.loop = true;
      player.replace(SOURCES.idle);
    }
    player.play();
  }, [phase, player]);

  useEffect(() => {
    const subscription = player.addListener("playToEnd", () => {
      const current = phaseRef.current;
      if (current === "checkingIn" || current === "checkingOut") {
        onTransientEndRef.current?.();
      } else if (current === "working") {
        player.replace(Math.random() < 0.3 ? SOURCES.coffee : SOURCES.working);
        player.play();
      }
    });
    return () => subscription.remove();
  }, [player]);

  return (
    <VideoView player={player} style={style} contentFit="contain" nativeControls={false} />
  );
}
