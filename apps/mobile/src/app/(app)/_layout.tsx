import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useSession } from "@/lib/session-provider";

export default function AppLayout() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
