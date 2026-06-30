import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "MindCET Attendance",
  slug: "mindcet-attendance",
  scheme: "mindcet-attendance",
  version: "0.1.0",
  platforms: ["ios", "android"],
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.mindcet.attendance",
  },
  android: {
    package: "com.mindcet.attendance",
  },
  plugins: ["expo-router", "expo-notifications"],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default config;
