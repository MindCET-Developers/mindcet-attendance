// Edge Function: notify-month-end
// Recommended cron: daily at 09:00 UTC, "0 9 * * *"
// Set up in Supabase Dashboard → Edge Functions → Cron, or via pg_cron.
// The function itself gates on day-of-month so running it daily is safe.
//
// Required env vars (auto-provided by Supabase runtime):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// On the 28th of each month, sends a push notification to users who have
// month_end_enabled=true reminding them to review their monthly report.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

Deno.serve(async () => {
  const today = new Date();
  const dayOfMonth = today.getUTCDate();

  if (dayOfMonth !== 28) {
    return new Response(JSON.stringify({ skipped: `day ${dayOfMonth} is not 28` }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: users, error: usersErr } = await supabase
    .from("notification_settings")
    .select("user_id")
    .eq("month_end_enabled", true);

  if (usersErr || !users?.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  for (const { user_id } of users) {
    const { data: tokenRow } = await supabase
      .from("push_tokens")
      .select("expo_push_token")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tokenRow?.expo_push_token) continue;

    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        to: tokenRow.expo_push_token,
        title: "סוף חודש מתקרב",
        body: "זמן טוב לבדוק את הדו״ח החודשי לפני ההגשה",
        sound: "default",
      }),
    });
    sent++;
  }

  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
