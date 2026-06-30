import { useCallback, useEffect, useState } from "react";
import type { NotificationSettings } from "@att/shared";
import { supabase } from "@/lib/supabase/client";
import { syncDailyReminders } from "@/lib/notifications";

export function useNotificationSettings(userId: string | undefined) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("notification_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    const row = (data as NotificationSettings | null) ?? null;
    setSettings(row);
    setLoading(false);
    if (row) await syncDailyReminders(row);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function update(patch: Partial<NotificationSettings>): Promise<{ error?: string }> {
    if (!userId) return { error: "אין משתמש מחובר" };
    const { error } = await supabase
      .from("notification_settings")
      .update(patch)
      .eq("user_id", userId);
    if (error) return { error: "שמירת ההגדרות נכשלה" };
    await refresh();
    return {};
  }

  return { settings, loading, update, refresh };
}
