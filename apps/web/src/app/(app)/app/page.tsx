import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

export default async function AppHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("report_display_name")
    .eq("id", user!.id)
    .single();

  const name = profile?.report_display_name ?? "";

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">שלום,</p>
        <h1 className="text-2xl font-extrabold">{name || "ברוך הבא"}</h1>
      </div>

      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground">כרטיס ההחתמה</p>
          <p className="mt-2 text-lg font-semibold">בקרוב — שלב P3</p>
          <p className="mt-1 text-sm text-muted-foreground">
            כאן יופיע כפתור כניסה/יציאה, שעון רץ וסיכום היום.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
