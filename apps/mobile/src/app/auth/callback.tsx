import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallbackScreen() {
  const { code, error_description } = useLocalSearchParams<{
    code?: string;
    error_description?: string;
  }>();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    if (error_description) {
      setError(error_description);
      return;
    }
    if (!code) {
      router.replace("/login");
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) {
        setError("ההתחברות נכשלה. נסו שוב.");
        return;
      }
      router.replace("/");
    });
  }, [code, error_description]);

  return (
    <View style={styles.screen}>
      {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f6f7fb" },
  error: { color: "#dc2b4b", fontSize: 14, textAlign: "center", padding: 24 },
});
