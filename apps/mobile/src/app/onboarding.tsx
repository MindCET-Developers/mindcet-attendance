import { useState } from "react";
import { Text, View, TextInput, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { DEFAULT_EXPECTED_DAILY_HOURS } from "@att/shared";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-provider";
import { useProfile } from "@/lib/use-profile";

export default function OnboardingPage() {
  const { session } = useSession();
  const { profile, refresh } = useProfile();
  const [displayName, setDisplayName] = useState(profile?.report_display_name ?? "");
  const [expectedHours, setExpectedHours] = useState(
    String(profile?.expected_daily_hours ?? DEFAULT_EXPECTED_DAILY_HOURS),
  );
  const [saving, setSaving] = useState(false);

  async function completeOnboarding() {
    if (!session?.user) return;
    setSaving(true);
    const hours = Number(expectedHours);
    await supabase
      .from("profiles")
      .update({
        report_display_name: displayName.trim() || null,
        expected_daily_hours: Number.isFinite(hours) ? hours : DEFAULT_EXPECTED_DAILY_HOURS,
        onboarded: true,
      })
      .eq("id", session.user.id);
    await refresh();
    setSaving(false);
    router.replace("/(app)");
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>כמעט שם 👋</Text>
        <Text style={styles.subtitle}>כמה פרטים אחרונים שיופיעו בדו״ח החודשי שלכם.</Text>

        <Text style={styles.label}>שם לתצוגה בדו״ח</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="לדוגמה: דנה כהן"
          textAlign="right"
        />

        <Text style={styles.label}>שעות עבודה יומיות צפויות</Text>
        <TextInput
          style={styles.input}
          value={expectedHours}
          onChangeText={setExpectedHours}
          keyboardType="numeric"
          textAlign="right"
        />

        <Pressable style={styles.button} onPress={completeOnboarding} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? "שומר…" : "סיום והתחלה"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "#f6f7fb" },
  card: { width: "100%", maxWidth: 400, backgroundColor: "#fff", borderRadius: 16, padding: 24, gap: 4 },
  title: { fontSize: 20, fontWeight: "800", textAlign: "right", color: "#11151f" },
  subtitle: { fontSize: 14, textAlign: "right", color: "#4b5468", marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", textAlign: "right", color: "#4b5468", marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#e4e7f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  button: { backgroundColor: "#4f46e5", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
