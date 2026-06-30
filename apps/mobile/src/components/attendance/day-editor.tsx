import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  DAY_TYPE_LABELS,
  DAY_TYPE_ORDER,
  formatMinutes,
  isoToTimeValue,
  weekdayLabel,
  type DayType,
} from "@att/shared";
import { saveDay, deleteRecord, type AttendanceRow, type DayView } from "@/lib/use-attendance";

type Banner = { type: "success" | "error"; message: string };

export function DayEditor({
  day,
  timezone,
  userId,
  onMessage,
  onSaved,
}: {
  day: DayView;
  timezone: string;
  userId: string | undefined;
  onMessage: (banner: Banner) => void;
  onSaved: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>יום נבחר</Text>
          <Text style={styles.title}>
            {day.date} · {weekdayLabel(day.date)}
          </Text>
          <Text style={styles.sub}>
            {day.records.length > 1
              ? `${day.records.length} משמרות ביום זה`
              : "אפשר להשלים או לתקן את היום הזה בלבד"}
          </Text>
        </View>
        <View style={styles.totalBox}>
          <Text style={styles.totalValue}>
            {day.totalMinutes > 0 ? formatMinutes(day.totalMinutes) : "—"}
          </Text>
          <Text style={styles.totalLabel}>סה״כ</Text>
        </View>
      </View>

      <View style={styles.segmentList}>
        {day.records.map((record, index) => (
          <SegmentEditor
            key={record.id}
            workDate={day.date}
            record={record}
            timezone={timezone}
            userId={userId}
            label={day.records.length > 1 ? `משמרת ${index + 1}` : "פרטי היום"}
            showDelete
            onMessage={onMessage}
            onSaved={onSaved}
          />
        ))}
        <SegmentEditor
          workDate={day.date}
          record={null}
          timezone={timezone}
          userId={userId}
          label={day.records.length ? "הוספת משמרת נוספת" : "פרטי היום"}
          onMessage={onMessage}
          onSaved={onSaved}
        />
      </View>
    </View>
  );
}

function SegmentEditor({
  workDate,
  record,
  timezone,
  userId,
  label,
  showDelete,
  onMessage,
  onSaved,
}: {
  workDate: string;
  record: AttendanceRow | null;
  timezone: string;
  userId: string | undefined;
  label: string;
  showDelete?: boolean;
  onMessage: (banner: Banner) => void;
  onSaved: () => void;
}) {
  const [clockInValue, setClockInValue] = useState(isoToTimeValue(record?.clock_in ?? null, timezone));
  const [clockOutValue, setClockOutValue] = useState(isoToTimeValue(record?.clock_out ?? null, timezone));
  const [dayType, setDayType] = useState<DayType>(record?.day_type ?? "work");
  const [note, setNote] = useState(record?.note ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setClockInValue(isoToTimeValue(record?.clock_in ?? null, timezone));
    setClockOutValue(isoToTimeValue(record?.clock_out ?? null, timezone));
    setDayType(record?.day_type ?? "work");
    setNote(record?.note ?? "");
  }, [record?.id, record?.clock_in, record?.clock_out, record?.day_type, record?.note, timezone]);

  async function handleSave() {
    if (!userId) return;
    setBusy(true);
    const { error } = await saveDay({
      userId,
      recordId: record?.id,
      workDate,
      clockInValue,
      clockOutValue,
      dayType,
      note,
      timezone,
    });
    setBusy(false);
    onMessage(error ? { type: "error", message: error } : { type: "success", message: "היום נשמר" });
    if (!error) onSaved();
  }

  async function handleDelete() {
    if (!userId || !record) return;
    setBusy(true);
    const { error } = await deleteRecord(userId, record.id);
    setBusy(false);
    onMessage(error ? { type: "error", message: error } : { type: "success", message: "המשמרת הוסרה" });
    if (!error) onSaved();
  }

  return (
    <View style={styles.segment}>
      <View style={styles.segmentHeader}>
        {record?.is_edited ? (
          <View style={styles.editedBadge}>
            <Text style={styles.editedBadgeText}>נערך ידנית</Text>
          </View>
        ) : (
          <View />
        )}
        <Text style={styles.segmentLabel}>{label}</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>כניסה</Text>
          <TextInput
            style={styles.input}
            value={clockInValue}
            onChangeText={setClockInValue}
            placeholder="HH:MM"
            placeholderTextColor="#b7bdcc"
            maxLength={5}
            textAlign="center"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>יציאה</Text>
          <TextInput
            style={styles.input}
            value={clockOutValue}
            onChangeText={setClockOutValue}
            placeholder="HH:MM"
            placeholderTextColor="#b7bdcc"
            maxLength={5}
            textAlign="center"
          />
        </View>
      </View>

      <Text style={styles.fieldLabel}>סוג יום</Text>
      <View style={styles.chipRow}>
        {DAY_TYPE_ORDER.map((type) => {
          const active = type === dayType;
          return (
            <Pressable
              key={type}
              onPress={() => setDayType(type)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {DAY_TYPE_LABELS[type]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>הערה</Text>
      <TextInput
        style={[styles.input, styles.noteInput]}
        value={note}
        onChangeText={setNote}
        placeholder="אופציונלי"
        placeholderTextColor="#b7bdcc"
        textAlign="right"
      />

      <View style={styles.footerRow}>
        {showDelete && record ? (
          <Pressable onPress={handleDelete} disabled={busy} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>הסר משמרת זו</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable
          onPress={handleSave}
          disabled={busy}
          style={[styles.saveBtn, busy && styles.saveBtnDisabled]}
        >
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>שמור</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20 },
  headerRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  label: { fontSize: 13, color: "#8a92a6", textAlign: "right" },
  title: { fontSize: 19, fontWeight: "800", color: "#11151f", textAlign: "right", marginTop: 2 },
  sub: { fontSize: 12, color: "#8a92a6", textAlign: "right", marginTop: 2 },
  totalBox: { backgroundColor: "#f3f4f8", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignItems: "center" },
  totalValue: { fontSize: 18, fontWeight: "800", color: "#11151f" },
  totalLabel: { fontSize: 11, color: "#8a92a6", marginTop: 1 },
  segmentList: { gap: 12, marginTop: 16 },
  segment: { borderWidth: 1, borderColor: "#e4e7f0", borderStyle: "dashed", borderRadius: 12, padding: 14 },
  segmentHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  segmentLabel: { fontSize: 13, fontWeight: "700", color: "#4b5468" },
  editedBadge: { backgroundColor: "#eef0f6", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  editedBadgeText: { fontSize: 11, fontWeight: "600", color: "#4b5468" },
  row: { flexDirection: "row", gap: 10 },
  field: { flex: 1, marginBottom: 10 },
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
  noteInput: { marginBottom: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#f3f4f8" },
  chipActive: { backgroundColor: "#4f46e5" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#4b5468" },
  chipTextActive: { color: "#fff" },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  deleteBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  deleteBtnText: { color: "#dc2b4b", fontSize: 13, fontWeight: "600" },
  saveBtn: { backgroundColor: "#4f46e5", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 11, minWidth: 84, alignItems: "center" },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
