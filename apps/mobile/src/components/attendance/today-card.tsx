import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDuration, formatMinutes } from "@att/shared";
import { Mascot, type MascotPhase } from "./mascot";

export function TodayCard({
  today,
  totalSeconds,
  isClockedIn,
  todayClockIn,
  todayClockOut,
  shiftsCount,
  monthTotal,
  completedDays,
  missingWorkDays,
  busy,
  onClockIn,
  onClockOut,
  mascotPhase,
  onMascotTransientEnd,
}: {
  today: string;
  totalSeconds: number;
  isClockedIn: boolean;
  todayClockIn: string;
  todayClockOut: string;
  shiftsCount: number;
  monthTotal: number;
  completedDays: number;
  missingWorkDays: number;
  busy: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  mascotPhase: MascotPhase;
  onMascotTransientEnd: () => void;
}) {
  return (
    <View style={styles.card}>
      <Mascot phase={mascotPhase} onTransientEnd={onMascotTransientEnd} style={styles.mascot} />
      <View style={styles.body}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.label}>היום · {today}</Text>
          <Text style={styles.total}>{formatDuration(totalSeconds)}</Text>
        </View>
        <View style={[styles.badge, isClockedIn ? styles.badgeOpen : styles.badgeClosed]}>
          <Text style={[styles.badgeText, isClockedIn ? styles.badgeTextOpen : styles.badgeTextClosed]}>
            {isClockedIn ? "משמרת פתוחה" : "לא מחובר"}
          </Text>
        </View>
      </View>

      <Text style={styles.sub}>
        כניסה {todayClockIn || "--:--"} · יציאה {todayClockOut || "--:--"}
        {shiftsCount > 1 ? ` · ${shiftsCount} משמרות` : ""}
      </Text>

      <View style={styles.actionsRow}>
        <Pressable
          onPress={onClockIn}
          disabled={isClockedIn || busy}
          style={[styles.actionBtn, (isClockedIn || busy) && styles.actionBtnDisabled]}
        >
          <Text style={styles.actionBtnText}>כניסה</Text>
        </Pressable>
        <Pressable
          onPress={onClockOut}
          disabled={!isClockedIn || busy}
          style={[
            styles.actionBtn,
            styles.actionBtnSuccess,
            (!isClockedIn || busy) && styles.actionBtnDisabled,
          ]}
        >
          <Text style={styles.actionBtnText}>יציאה</Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatMinutes(monthTotal)}</Text>
          <Text style={styles.statLabel}>חודש</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{completedDays}</Text>
          <Text style={styles.statLabel}>ימים</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{missingWorkDays}</Text>
          <Text style={styles.statLabel}>לטיפול</Text>
        </View>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, overflow: "hidden", backgroundColor: "#fff" },
  mascot: { height: 220 },
  body: { padding: 20, gap: 4 },
  headerRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start" },
  label: { fontSize: 13, color: "#8a92a6", textAlign: "right" },
  total: { fontSize: 36, fontWeight: "800", color: "#11151f", marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  badgeOpen: { backgroundColor: "#e6f7f0" },
  badgeClosed: { backgroundColor: "#eef0f6" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  badgeTextOpen: { color: "#0f6e4d" },
  badgeTextClosed: { color: "#8a92a6" },
  sub: { fontSize: 13, color: "#4b5468", textAlign: "right", marginTop: 10 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnSuccess: { backgroundColor: "#0f9d6b" },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  statBox: { flex: 1, backgroundColor: "#f3f4f8", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  statValue: { fontSize: 16, fontWeight: "800", color: "#11151f" },
  statLabel: { fontSize: 11, color: "#8a92a6", marginTop: 2 },
});
