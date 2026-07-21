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
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.mindcet.attendance",
    icon: "./assets/icon.png",
  },
  android: {
    package: "com.mindcet.attendance",
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#ffffff",
    },
  },
  updates: {
    url: "https://u.expo.dev/2ce91b67-5ec8-4a4f-b45d-afb1570ccefb",
  },
  // OTA updates apply only to builds whose app version matches; bump `version`
  // whenever native modules change so stale binaries don't receive new JS.
  runtimeVersion: {
    policy: "appVersion",
  },
  plugins: ["expo-router", "expo-notifications"],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: "2ce91b67-5ec8-4a4f-b45d-afb1570ccefb",
    },
  },
};

export default config;
