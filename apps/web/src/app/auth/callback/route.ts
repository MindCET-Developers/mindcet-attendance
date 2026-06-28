import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the OAuth redirect: exchanges the code for a session, then
// sends the user into the app (or onboarding, decided by the app layout).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Google only returns a refresh token when prompt=consent forces it
      // (see the login page) — persist it so server actions can write to
      // the user's own Sheets later, outside of this OAuth round-trip.
      const refreshToken = data.session?.provider_refresh_token;
      if (refreshToken && data.user) {
        await supabase
          .from("export_targets")
          .upsert(
            { user_id: data.user.id, google_refresh_token: refreshToken },
            { onConflict: "user_id" },
          );
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
