// Edge Function: notify-missing-days
// Recommended cron: daily at 20:00 UTC (Sun–Thu), e.g. "0 20 * * 0-4"
// Set up in Supabase Dashboard → Edge Functions → Cron, or via pg_cron.
//
// Required env vars (auto-provided by Supabase runtime):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Sends an Expo push notification to users who have missing_days_enabled=true
// and have work-week days (Sun–Thu UTC) in the past 7 days with no attendance
// records.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function isPastWorkday(date: Date, today: Date): boolean {
  if (date >= today) return false;
  const d = date.getUTCDay(); // 0=Sun, 6=Sat
  return d >= 0 && d <= 4; // Sun–Thu
}

function dateToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Build the list of past 7 work-week days to check
  const checkDates: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    if (isPastWorkday(d, today)) checkDates.push(dateToKey(d));
  }

  if (checkDates.length === 0) {
    return new Response(JSON.stringify({ skipped: "no work days to check" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get users who opted in + have a push token
  const { data: users, error: usersErr } = await supabase
    .from("notification_settings")
    .select("user_id")
    .eq("missing_days_enabled", true);

  if (usersErr || !users?.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  for (const { user_id } of users) {
    // Check attendance records for the check dates
    const { data: records } = await supabase
      .from("attendance_records")
      .select("work_date")
      .eq("user_id", user_id)
      .in("work_date", checkDates);

    const coveredDates = new Set((records ?? []).map((r: { work_date: string }) => r.work_date));
    const missingCount = checkDates.filter((d) => !coveredDates.has(d)).length;

    if (missingCount === 0) continue;

    // Get push token
    const { data: tokenRow } = await supabase
      .from("push_tokens")
      .select("expo_push_token")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tokenRow?.expo_push_token) continue;

    const body =
      missingCount === 1
        ? "יש יום עבודה אחד ללא דיווח השבוע"
        : `יש ${missingCount} ימי עבודה ללא דיווח השבוע`;

    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        to: tokenRow.expo_push_token,
        title: "ימים חסרים",
        body,
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
