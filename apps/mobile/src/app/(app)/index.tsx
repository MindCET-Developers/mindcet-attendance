import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  dayNeedsAttention,
  earliestIso,
  elapsedSeconds,
  isoToTimeValue,
  latestIso,
  minutesBetween,
  monthKey,
  normalizeTimezone,
  toDateKey,
} from "@att/shared";
import { useProfile } from "@/lib/use-profile";
import { useSession } from "@/lib/session-provider";
import { buildDayViews, clockIn, clockInAt, clockOut, useAttendance } from "@/lib/use-attendance";
import { TodayCard } from "@/components/attendance/today-card";
import { RetroClockIn } from "@/components/attendance/retro-clock-in";
import type { MascotPhase } from "@/components/attendance/mascot";

type Banner = { type: "success" | "error"; message: string };

export default function AppHomeScreen() {
  const { session } = useSession();
  const { profile } = useProfile();
  const userId = session?.user?.id;
  const timezone = normalizeTimezone(profile?.timezone);
  const today = toDateKey(new Date(), timezone);
  const currentMonth = monthKey(today);

  const [banner, setBanner] = useState<Banner | null>(null);
  const [clockBusy, setClockBusy] = useState(false);

  const { records, refresh } = useAttendance(userId, currentMonth);
  const days = useMemo(() => buildDayViews(records, currentMonth), [records, currentMonth]);

  const todayRecords = days.find((day) => day.date === today)?.records ?? [];
  const isClockedIn = todayRecords.some((record) => record.clock_in && !record.clock_out);
  const openClockIn = todayRecords.find((record) => record.clock_in && !record.clock_out)?.clock_in ?? null;
  const todayMinutes = todayRecords.reduce(
    (sum, record) => sum + minutesBetween(record.clock_in, record.clock_out),
    0,
  );

  const [, setTick] = useState(0);
  useEffect(() => {
    if (!openClockIn) return;
    const id = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [openClockIn]);
  const todayTotalSeconds = todayMinutes * 60 + (openClockIn ? elapsedSeconds(openClockIn) : 0);

  const todayClockIn = isoToTimeValue(earliestIso(todayRecords, "clock_in"), timezone);
  const todayClockOut = isoToTimeValue(latestIso(todayRecords, "clock_out"), timezone);
  const monthTotal = days.reduce((sum, day) => sum + day.totalMinutes, 0);
  const completedDays = days.filter((day) => day.totalMinutes > 0).length;
  const missingWorkDays = days.filter((day) => dayNeedsAttention(day, today)).length;

  const name = profile?.report_display_name ?? "";

  const [mascotPhase, setMascotPhase] = useState<MascotPhase>(isClockedIn ? "working" : "idle");
  useEffect(() => {
    setMascotPhase((prev) => {
      if (prev === "checkingIn" || prev === "checkingOut") return prev;
      return isClockedIn ? "working" : "idle";
    });
  }, [isClockedIn]);

  function handleMascotTransientEnd() {
    setMascotPhase((prev) => (prev === "checkingIn" ? "working" : "idle"));
  }

  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  async function handleClockIn() {
    if (!userId) return;
    setClockBusy(true);
    setBanner(null);
    const { error } = await clockIn(userId, timezone);
    setClockBusy(false);
    setBanner(
      error ? { type: "error", message: error } : { type: "success", message: "כניסה נרשמה בהצלחה" },
    );
    if (!error) {
      setMascotPhase("checkingIn");
      refresh();
    }
  }

  async function handleClockInAt(timeValue: string) {
    if (!userId) return;
    setClockBusy(true);
    setBanner(null);
    const { error } = await clockInAt(userId, timeValue, timezone);
    setClockBusy(false);
    setBanner(
      error ? { type: "error", message: error } : { type: "success", message: "כניסה נרשמה בהצלחה" },
    );
    if (!error) {
      setMascotPhase("checkingIn");
      refresh();
    }
  }

  async function handleClockOut() {
    if (!userId) return;
    setClockBusy(true);
    setBanner(null);
    const { error } = await clockOut(userId, timezone);
    setClockBusy(false);
    setBanner(
      error ? { type: "error", message: error } : { type: "success", message: "יציאה נרשמה בהצלחה" },
    );
    if (!error) {
      setMascotPhase("checkingOut");
      refresh();
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.greeting}>שלום,</Text>
        <Text style={styles.name}>{name || "ברוך הבא"}</Text>

        {banner ? (
          <View style={[styles.banner, banner.type === "success" ? styles.bannerSuccess : styles.bannerError]}>
            <Text
              style={[
                styles.bannerText,
                banner.type === "success" ? styles.bannerTextSuccess : styles.bannerTextError,
              ]}
            >
              {banner.message}
            </Text>
          </View>
        ) : null}

        <TodayCard
          today={today}
          totalSeconds={todayTotalSeconds}
          isClockedIn={isClockedIn}
          todayClockIn={todayClockIn}
          todayClockOut={todayClockOut}
          shiftsCount={todayRecords.length}
          monthTotal={monthTotal}
          completedDays={completedDays}
          missingWorkDays={missingWorkDays}
          busy={clockBusy}
          onClockIn={handleClockIn}
          onClockOut={handleClockOut}
          mascotPhase={mascotPhase}
          onMascotTransientEnd={handleMascotTransientEnd}
        />

        {!isClockedIn ? <RetroClockIn busy={clockBusy} onSubmit={handleClockInAt} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f6f7fb" },
  content: { padding: 20, paddingTop: 48, paddingBottom: 28, gap: 10 },
  greeting: { fontSize: 14, textAlign: "right", color: "#8a92a6" },
  name: { fontSize: 24, fontWeight: "800", textAlign: "right", color: "#11151f", marginBottom: 2 },
  banner: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  bannerSuccess: { backgroundColor: "#e6f7f0" },
  bannerError: { backgroundColor: "#fdecef" },
  bannerText: { fontSize: 13, fontWeight: "600", textAlign: "right" },
  bannerTextSuccess: { color: "#0f6e4d" },
  bannerTextError: { color: "#dc2b4b" },
});
