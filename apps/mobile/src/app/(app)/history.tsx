import { useMemo, useState, useCallback } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Constants from "expo-constants";
import {
  formatMonthHebrew,
  monthKey,
  monthOffset,
  normalizeTimezone,
  toDateKey,
} from "@att/shared";
import { useProfile } from "@/lib/use-profile";
import { useSession } from "@/lib/session-provider";
import { buildDayViews, useAttendance } from "@/lib/use-attendance";
import { MonthGrid } from "@/components/attendance/month-grid";
import { DayEditor } from "@/components/attendance/day-editor";

type Banner = { type: "success" | "error"; message: string };

export default function HistoryScreen() {
  const { session } = useSession();
  const { profile } = useProfile();
  const userId = session?.user?.id;
  const timezone = normalizeTimezone(profile?.timezone);
  const today = toDateKey(new Date(), timezone);

  const [selectedMonth, setSelectedMonth] = useState(() => monthKey(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const { records, loading, refresh } = useAttendance(userId, selectedMonth);
  const days = useMemo(() => buildDayViews(records, selectedMonth), [records, selectedMonth]);
  const selectedDay = days.find((day) => day.date === selectedDate) ?? days[0];

  const handleSendEmail = useCallback(async () => {
    const accessToken = session?.access_token;
    const baseUrl = Constants.expoConfig?.extra?.webBaseUrl;
    if (!accessToken || !baseUrl) {
      setBanner({ type: "error", message: "שירות המייל לא מוגדר — פנה למנהל המערכת" });
      return;
    }
    setSendingEmail(true);
    setBanner(null);
    try {
      const res = await fetch(`${baseUrl}/api/export/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ month: selectedMonth }),
      });
      if (!res.ok) {
        const text = await res.text();
        setBanner({ type: "error", message: text || "שליחת המייל נכשלה" });
      } else {
        setBanner({ type: "success", message: `הדו״ח נשלח למייל שלך` });
      }
    } catch {
      setBanner({ type: "error", message: "שגיאת רשת — בדוק חיבור לאינטרנט" });
    } finally {
      setSendingEmail(false);
    }
  }, [session?.access_token, selectedMonth]);

  function goToMonth(delta: number) {
    const nextMonth = monthOffset(selectedMonth, delta);
    setSelectedMonth(nextMonth);
    setSelectedDate(nextMonth === monthKey(today) ? today : `${nextMonth}-01`);
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>היסטוריה</Text>

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

        <View style={styles.monthNav}>
          <Pressable onPress={() => goToMonth(-1)} style={styles.monthNavBtn}>
            <Text style={styles.monthNavText}>‹ קודם</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{formatMonthHebrew(selectedMonth)}</Text>
          <Pressable onPress={() => goToMonth(1)} style={styles.monthNavBtn}>
            <Text style={styles.monthNavText}>הבא ›</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={handleSendEmail}
          disabled={sendingEmail}
          style={[styles.emailBtn, sendingEmail && styles.emailBtnDisabled]}
        >
          {sendingEmail ? (
            <ActivityIndicator color="#4f46e5" size="small" />
          ) : (
            <Text style={styles.emailBtnText}>שלח לי אקסל למייל</Text>
          )}
        </Pressable>

        {loading && days.every((day) => day.records.length === 0) ? (
          <ActivityIndicator style={{ marginVertical: 12 }} />
        ) : days.every((day) => day.records.length === 0) ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>אין רשומות לחודש זה</Text>
            <Text style={styles.emptyBody}>החתמות שתבצע יופיעו כאן</Text>
          </View>
        ) : (
          <MonthGrid days={days} selectedDate={selectedDate} today={today} onSelect={setSelectedDate} />
        )}

        {selectedDay ? (
          <DayEditor
            day={selectedDay}
            timezone={timezone}
            userId={userId}
            onMessage={setBanner}
            onSaved={refresh}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f6f7fb" },
  content: { padding: 20, paddingTop: 64, paddingBottom: 40, gap: 14 },
  title: { fontSize: 20, fontWeight: "800", textAlign: "right", color: "#11151f" },
  banner: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  bannerSuccess: { backgroundColor: "#e6f7f0" },
  bannerError: { backgroundColor: "#fdecef" },
  bannerText: { fontSize: 13, fontWeight: "600", textAlign: "right" },
  bannerTextSuccess: { color: "#0f6e4d" },
  bannerTextError: { color: "#dc2b4b" },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  monthNavBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  monthNavText: { color: "#4f46e5", fontWeight: "700", fontSize: 14 },
  monthLabel: { fontSize: 15, fontWeight: "800", color: "#11151f" },
  emailBtn: {
    borderWidth: 1.5,
    borderColor: "#4f46e5",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  emailBtnDisabled: { opacity: 0.5 },
  emailBtnText: { color: "#4f46e5", fontWeight: "700", fontSize: 14 },
  emptyState: { alignItems: "center", paddingVertical: 32, gap: 6 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#11151f" },
  emptyBody: { fontSize: 13, color: "#8a92a6" },
});
