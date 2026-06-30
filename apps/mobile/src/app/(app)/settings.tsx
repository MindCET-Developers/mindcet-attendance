import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSession } from "@/lib/session-provider";
import { useProfile } from "@/lib/use-profile";
import { useNotificationSettings } from "@/lib/use-notification-settings";
import { requestNotificationPermissions } from "@/lib/notifications";
import { supabase } from "@/lib/supabase/client";
import { ProfileForm } from "@/components/settings/profile-form";

type Banner = { type: "success" | "error"; message: string };

export default function SettingsScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;
  const { profile, refresh: refreshProfile } = useProfile();
  const { settings, loading, update } = useNotificationSettings(userId);

  const [dailyInTime, setDailyInTime] = useState("");
  const [dailyOutTime, setDailyOutTime] = useState("");
  const [forgotHours, setForgotHours] = useState("");
  const [banner, setBanner] = useState<Banner | null>(null);
  const [savingTimes, setSavingTimes] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setDailyInTime(settings?.daily_in_time ?? "");
    setDailyOutTime(settings?.daily_out_time ?? "");
    setForgotHours(String(settings?.forgot_clockout_after_hours ?? ""));
  }, [settings?.daily_in_time, settings?.daily_out_time, settings?.forgot_clockout_after_hours]);

  async function handleToggle(patch: Record<string, boolean>) {
    setBanner(null);
    if (Object.values(patch).some(Boolean)) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        setBanner({ type: "error", message: "יש לאשר התראות בהגדרות המכשיר כדי להפעיל תזכורות" });
        return;
      }
    }
    const { error } = await update(patch);
    setBanner(error ? { type: "error", message: error } : null);
  }

  async function handleSaveTimes() {
    setSavingTimes(true);
    setBanner(null);
    const hours = Number(forgotHours);
    const { error } = await update({
      daily_in_time: dailyInTime || null,
      daily_out_time: dailyOutTime || null,
      forgot_clockout_after_hours: Number.isFinite(hours) && hours > 0 ? hours : 10,
    });
    setSavingTimes(false);
    setBanner(
      error ? { type: "error", message: error } : { type: "success", message: "ההגדרות נשמרו" },
    );
  }

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    setLoggingOut(false);
  }

  if (loading || !settings) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>הגדרות</Text>

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

        <ProfileForm profile={profile} userId={userId} onMessage={setBanner} onSaved={refreshProfile} />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>התראות ותזכורות</Text>

          <View style={styles.switchRow}>
            <Switch
              value={settings.daily_reminder_enabled}
              onValueChange={(value) => handleToggle({ daily_reminder_enabled: value })}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>תזכורת כניסה/יציאה יומית</Text>
              <Text style={styles.switchSub}>תזכורת חוזרת בשעות שתגדירו למטה</Text>
            </View>
          </View>

          <View style={styles.switchRow}>
            <Switch
              value={settings.forgot_clockout_enabled}
              onValueChange={(value) => handleToggle({ forgot_clockout_enabled: value })}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>תזכורת שכחתי לצאת</Text>
              <Text style={styles.switchSub}>תזכורת מקומית אם נשארה משמרת פתוחה</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>שעת כניסה</Text>
              <TextInput
                style={styles.input}
                value={dailyInTime}
                onChangeText={setDailyInTime}
                placeholder="HH:MM"
                placeholderTextColor="#b7bdcc"
                maxLength={5}
                textAlign="center"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>שעת יציאה</Text>
              <TextInput
                style={styles.input}
                value={dailyOutTime}
                onChangeText={setDailyOutTime}
                placeholder="HH:MM"
                placeholderTextColor="#b7bdcc"
                maxLength={5}
                textAlign="center"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>שכחתי לצאת (שעות)</Text>
              <TextInput
                style={styles.input}
                value={forgotHours}
                onChangeText={setForgotHours}
                placeholder="10"
                placeholderTextColor="#b7bdcc"
                keyboardType="numeric"
                maxLength={3}
                textAlign="center"
              />
            </View>
          </View>

          <Pressable
            onPress={handleSaveTimes}
            disabled={savingTimes}
            style={[styles.saveBtn, savingTimes && styles.saveBtnDisabled]}
          >
            {savingTimes ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>שמור שעות</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>התראות שרת</Text>
          <Text style={styles.cardSub}>
            נשלחות דרך Expo Push — דורשות build עצמאי (לא Expo Go).
          </Text>

          <View style={styles.switchRow}>
            <Switch
              value={settings.missing_days_enabled}
              onValueChange={(value) => handleToggle({ missing_days_enabled: value })}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>תזכורת על ימים חסרים</Text>
              <Text style={styles.switchSub}>בדיקה יומית של ימי עבודה ללא דיווח</Text>
            </View>
          </View>

          <View style={styles.switchRow}>
            <Switch
              value={settings.month_end_enabled}
              onValueChange={(value) => handleToggle({ month_end_enabled: value })}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>תזכורת סוף חודש</Text>
              <Text style={styles.switchSub}>תזכורת ב-28 לחודש לבדוק את הדו״ח</Text>
            </View>
          </View>
        </View>

        <Pressable onPress={handleLogout} disabled={loggingOut} style={styles.logoutBtn}>
          {loggingOut ? (
            <ActivityIndicator color="#dc2b4b" size="small" />
          ) : (
            <Text style={styles.logoutBtnText}>התנתקות</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f6f7fb" },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f6f7fb" },
  content: { padding: 20, paddingTop: 64, paddingBottom: 40, gap: 14 },
  title: { fontSize: 20, fontWeight: "800", textAlign: "right", color: "#11151f" },
  banner: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  bannerSuccess: { backgroundColor: "#e6f7f0" },
  bannerError: { backgroundColor: "#fdecef" },
  bannerText: { fontSize: 13, fontWeight: "600", textAlign: "right" },
  bannerTextSuccess: { color: "#0f6e4d" },
  bannerTextError: { color: "#dc2b4b" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20, gap: 14 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#11151f", textAlign: "right" },
  cardSub: { fontSize: 12, color: "#8a92a6", textAlign: "right" },
  switchRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  switchLabel: { fontSize: 14, fontWeight: "700", color: "#11151f", textAlign: "right" },
  switchSub: { fontSize: 12, color: "#8a92a6", textAlign: "right", marginTop: 2 },
  row: { flexDirection: "row", gap: 10 },
  field: { flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#4b5468", textAlign: "right", marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: "#e4e7f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#11151f",
    backgroundColor: "#fff",
  },
  saveBtn: { backgroundColor: "#4f46e5", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  logoutBtn: { alignItems: "center", paddingVertical: 14 },
  logoutBtnText: { color: "#dc2b4b", fontWeight: "700", fontSize: 14 },
});
