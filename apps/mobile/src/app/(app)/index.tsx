import { Text, View, StyleSheet } from "react-native";
import { useProfile } from "@/lib/use-profile";

export default function AppHomeScreen() {
  const { profile } = useProfile();
  const name = profile?.report_display_name ?? "";

  return (
    <View style={styles.screen}>
      <Text style={styles.greeting}>שלום,</Text>
      <Text style={styles.name}>{name || "ברוך הבא"}</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>כרטיס ההחתמה</Text>
        <Text style={styles.cardTitle}>בקרוב — שלב P3</Text>
        <Text style={styles.cardBody}>כאן יופיע כפתור כניסה/יציאה, שעון רץ וסיכום היום.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, paddingTop: 64, backgroundColor: "#f6f7fb", gap: 4 },
  greeting: { fontSize: 14, textAlign: "right", color: "#8a92a6" },
  name: { fontSize: 24, fontWeight: "800", textAlign: "right", color: "#11151f", marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 32, alignItems: "center", gap: 6 },
  cardLabel: { fontSize: 13, color: "#8a92a6" },
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#11151f" },
  cardBody: { fontSize: 13, color: "#8a92a6", textAlign: "center" },
});
