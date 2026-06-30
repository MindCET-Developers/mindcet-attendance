import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { DEFAULT_EXPECTED_DAILY_HOURS, HEBREW_WEEKDAYS, normalizeTimezone, type Profile } from "@att/shared";
import { supabase } from "@/lib/supabase/client";

type Banner = { type: "success" | "error"; message: string };

export function ProfileForm({
  profile,
  userId,
  onMessage,
  onSaved,
}: {
  profile: Profile | null;
  userId: string | undefined;
  onMessage: (banner: Banner) => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(profile?.report_display_name ?? "");
  const [expectedHours, setExpectedHours] = useState(
    String(profile?.expected_daily_hours ?? DEFAULT_EXPECTED_DAILY_HOURS),
  );
  const [timezone, setTimezone] = useState(normalizeTimezone(profile?.timezone));
  const [weekStart, setWeekStart] = useState(profile?.week_start ?? 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.report_display_name ?? "");
    setExpectedHours(String(profile?.expected_daily_hours ?? DEFAULT_EXPECTED_DAILY_HOURS));
    setTimezone(normalizeTimezone(profile?.timezone));
    setWeekStart(profile?.week_start ?? 0);
  }, [profile?.report_display_name, profile?.expected_daily_hours, profile?.timezone, profile?.week_start]);

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    const hours = Number(expectedHours);
    const validHours = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_EXPECTED_DAILY_HOURS;
    const { error } = await supabase
      .from("profiles")
      .update({
        report_display_name: displayName.trim() || null,
        expected_daily_hours: validHours,
        timezone: timezone.trim() || normalizeTimezone(undefined),
        week_start: weekStart,
      })
      .eq("id", userId);
    setSaving(false);
    onMessage(
      error ? { type: "error", message: "שמירת הפרופיל נכשלה" } : { type: "success", message: "הפרופיל נשמר" },
    );
    if (!error) onSaved();
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>פרופיל</Text>

      <Text style={styles.fieldLabel}>שם לתצוגה בדו״ח</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="לדוגמה: דנה כהן"
        placeholderTextColor="#b7bdcc"
        textAlign="right"
      />

      <Text style={styles.fieldLabel}>שעות עבודה יומיות צפויות</Text>
      <TextInput
        style={styles.input}
        value={expectedHours}
        onChangeText={setExpectedHours}
        keyboardType="numeric"
        textAlign="right"
      />

      <Text style={styles.fieldLabel}>אזור זמן</Text>
      <TextInput
        style={styles.input}
        value={timezone}
        onChangeText={setTimezone}
        placeholder="Asia/Jerusalem"
        placeholderTextColor="#b7bdcc"
        textAlign="right"
      />

      <Text style={styles.fieldLabel}>יום תחילת שבוע</Text>
      <View style={styles.chipRow}>
        {HEBREW_WEEKDAYS.map((label, index) => {
          const active = index === weekStart;
          return (
            <Pressable
              key={label}
              onPress={() => setWeekStart(index)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && styles.saveBtnDisabled]}>
        {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>שמור פרופיל</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#11151f", textAlign: "right", marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#4b5468", textAlign: "right", marginTop: 10, marginBottom: 5 },
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
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#f3f4f8" },
  chipActive: { backgroundColor: "#4f46e5" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#4b5468" },
  chipTextActive: { color: "#fff" },
  saveBtn: { backgroundColor: "#4f46e5", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 16 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
