import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

/** Secondary "I forgot to clock in" affordance: reveals a single arrival-time field. */
export function RetroClockIn({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (timeValue: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [timeValue, setTimeValue] = useState("");

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={styles.toggle}>
        <Text style={styles.toggleText}>שכחתי להחתים</Text>
      </Pressable>
    );
  }

  function handleSubmit() {
    onSubmit(timeValue);
  }

  function handleCancel() {
    setOpen(false);
    setTimeValue("");
  }

  return (
    <View style={styles.card}>
      <Text style={styles.fieldLabel}>שעת כניסה</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={timeValue}
          onChangeText={setTimeValue}
          placeholder="למשל 745 או 7:45"
          placeholderTextColor="#b7bdcc"
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          textAlign="center"
          autoFocus
        />
        <Pressable
          onPress={handleSubmit}
          disabled={busy || !timeValue}
          style={[styles.saveBtn, (busy || !timeValue) && styles.saveBtnDisabled]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>שמור</Text>
          )}
        </Pressable>
        <Pressable onPress={handleCancel} disabled={busy} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>ביטול</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { alignSelf: "flex-end", marginTop: 2, paddingVertical: 6, paddingHorizontal: 2 },
  toggleText: { fontSize: 13, fontWeight: "600", color: "#4f46e5", textAlign: "right" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#4b5468", textAlign: "right", marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e4e7f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#11151f",
    backgroundColor: "#fff",
  },
  saveBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  cancelBtnText: { color: "#8a92a6", fontSize: 13, fontWeight: "600" },
});
