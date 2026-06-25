import { useState } from "react";
import { Text, View, Pressable, StyleSheet } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase/client";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
].join(" ");

const redirectTo = Linking.createURL("auth/callback");

async function createSessionFromUrl(url: string) {
  const { queryParams } = Linking.parse(url);
  const code = queryParams?.code;
  if (typeof code !== "string") return;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          scopes: GOOGLE_SCOPES,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) throw error;

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type === "success" && res.url) {
        await createSessionFromUrl(res.url);
      }
    } catch {
      setError("ההתחברות נכשלה. ודא שהגדרות Supabase ו-Google מוגדרות נכון.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>⏱</Text>
        </View>
        <Text style={styles.title}>ברוכים הבאים</Text>
        <Text style={styles.subtitle}>
          התחברו כדי לעקוב אחרי הנוכחות שלכם ולהפיק דו״ח חודשי.
        </Text>

        <Pressable style={styles.button} onPress={signInWithGoogle} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "מתחבר…" : "התחברות עם Google"}</Text>
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.fine}>בהתחברות אתם מאשרים שמירת נתוני הנוכחות שלכם בלבד.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "#f6f7fb" },
  card: { width: "100%", maxWidth: 360, backgroundColor: "#fff", borderRadius: 16, padding: 24, gap: 8 },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#4f46e5", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  logoText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  title: { fontSize: 20, fontWeight: "800", textAlign: "right", color: "#11151f" },
  subtitle: { fontSize: 14, textAlign: "right", color: "#4b5468", marginBottom: 16 },
  button: { backgroundColor: "#4f46e5", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  error: { color: "#dc2b4b", fontSize: 13, textAlign: "right", marginTop: 8 },
  fine: { color: "#8a92a6", fontSize: 12, textAlign: "center", marginTop: 12 },
});
