import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { HEBREW_WEEKDAYS, dayNeedsAttention, weekdayIndex } from "@att/shared";
import type { DayView } from "@/lib/use-attendance";

const SCREEN_PADDING = 20;
const CELL_GAP = 6;
const COLUMNS = 7;

export function MonthGrid({
  days,
  selectedDate,
  today,
  onSelect,
}: {
  days: DayView[];
  selectedDate: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  const { width } = useWindowDimensions();
  const cellSize = (width - SCREEN_PADDING * 2 - CELL_GAP * (COLUMNS - 1)) / COLUMNS;
  // RTL layout renders the first cell rightmost, so Sunday (index 0) ends up
  // in the rightmost column; pad so day 1 lands under its actual weekday.
  const leadingBlanks = days.length ? weekdayIndex(days[0].date) : 0;

  return (
    <View style={styles.grid}>
      {HEBREW_WEEKDAYS.map((label) => (
        <View key={label} style={{ width: cellSize }}>
          <Text style={styles.weekdayLabel}>{label}</Text>
        </View>
      ))}
      {Array.from({ length: leadingBlanks }, (_, index) => (
        <View key={`pad-${index}`} style={{ width: cellSize, height: cellSize }} />
      ))}
      {days.map((day) => {
        const isSelected = day.date === selectedDate;
        const isToday = day.date === today;
        const hasIssue = dayNeedsAttention(day, today);

        return (
          <Pressable
            key={day.date}
            onPress={() => onSelect(day.date)}
            style={[
              styles.cell,
              { width: cellSize, height: cellSize },
              isSelected
                ? styles.cellSelected
                : hasIssue
                  ? styles.cellIssue
                  : day.records.length
                    ? styles.cellDone
                    : styles.cellEmpty,
            ]}
          >
            <Text style={[styles.cellText, isSelected && styles.cellTextSelected]}>
              {Number(day.date.slice(8))}
            </Text>
            {isToday ? <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: CELL_GAP },
  weekdayLabel: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: "#7a8194",
  },
  cell: {
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cellEmpty: { backgroundColor: "#fff", borderColor: "#eef0f6" },
  cellDone: { backgroundColor: "#e6f7f0", borderColor: "#bdebd6" },
  cellIssue: { backgroundColor: "#fdecef", borderColor: "#f5c2cd" },
  cellSelected: { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
  cellText: { fontSize: 13, fontWeight: "700", color: "#11151f" },
  cellTextSelected: { color: "#fff" },
  todayDot: {
    position: "absolute",
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4f46e5",
  },
  todayDotSelected: { backgroundColor: "#fff" },
});
