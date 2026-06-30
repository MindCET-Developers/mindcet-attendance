import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { dayNeedsAttention } from "@att/shared";
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

  return (
    <View style={styles.grid}>
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
