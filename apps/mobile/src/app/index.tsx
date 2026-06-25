import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useSession } from "@/lib/session-provider";
import { useProfile } from "@/lib/use-profile";

export default function Index() {
  const { session, loading: sessionLoading } = useSession();
  const { profile, loading: profileLoading } = useProfile();

  if (sessionLoading || (session && profileLoading)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;
  if (!profile?.onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(app)" />;
}
