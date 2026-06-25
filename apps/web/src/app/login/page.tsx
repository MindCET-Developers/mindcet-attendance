"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
].join(" ");

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: GOOGLE_SCOPES,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) throw error;
    } catch (e) {
      setError(
        "ההתחברות נכשלה. ודא שהגדרות Supabase ו-Google מוגדרות נכון.",
      );
      setLoading(false);
    }
  }

  return (
    <main className="surface-glow flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm text-right">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground">
            ⏱
          </div>
          <CardTitle className="text-xl">ברוכים הבאים</CardTitle>
          <CardDescription>
            התחברו כדי לעקוב אחרי הנוכחות שלכם ולהפיק דו״ח חודשי.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full"
            size="lg"
            onClick={signInWithGoogle}
            disabled={loading}
          >
            {loading ? "מתחבר…" : "התחברות עם Google"}
          </Button>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            בהתחברות אתם מאשרים שמירת נתוני הנוכחות שלכם בלבד.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
