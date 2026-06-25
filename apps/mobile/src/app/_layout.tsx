import { Stack } from "expo-router";
import { I18nManager } from "react-native";
import { SessionProvider } from "@/lib/session-provider";

// Only takes effect after a JS reload, so it must run as early as possible.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function RootLayout() {
  return (
    <SessionProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SessionProvider>
  );
}
