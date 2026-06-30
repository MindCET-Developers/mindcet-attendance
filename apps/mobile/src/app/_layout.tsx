import { Stack } from "expo-router";
import { I18nManager, LogBox } from "react-native";
import { SessionProvider } from "@/lib/session-provider";

// Only takes effect after a JS reload, so it must run as early as possible.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// Expected noise under Expo Go: push tokens require a dev/standalone build since SDK 53.
LogBox.ignoreLogs(["expo-notifications: Android Push notifications"]);

export default function RootLayout() {
  return (
    <SessionProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SessionProvider>
  );
}
