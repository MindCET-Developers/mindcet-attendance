import { useCallback, useEffect, useState } from "react";
import type { Profile } from "@att/shared";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-provider";

export function useProfile() {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile((data as Profile | null) ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, loading, refresh };
}
