import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

async function completeOnboarding(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const displayName = String(formData.get("display_name") ?? "").trim();
  const expectedHours = Number(formData.get("expected_hours"));
  const validExpectedHours =
    Number.isFinite(expectedHours) && expectedHours > 0 ? expectedHours : 8;

  await supabase
    .from("profiles")
    .update({
      report_display_name: displayName || null,
      expected_daily_hours: validExpectedHours,
      onboarded: true,
    })
    .eq("id", user.id);

  redirect("/app");
}

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("report_display_name, expected_daily_hours, onboarded")
    .eq("id", user.id)
    .single();

  if (profile?.onboarded) redirect("/app");

  return (
    <main className="surface-glow flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-right">
        <CardHeader>
          <CardTitle className="text-xl">כמעט שם 👋</CardTitle>
          <CardDescription>
            כמה פרטים אחרונים שיופיעו בדו״ח החודשי שלכם.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={completeOnboarding} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="display_name">שם לתצוגה בדו״ח</Label>
              <Input
                id="display_name"
                name="display_name"
                defaultValue={profile?.report_display_name ?? ""}
                placeholder="לדוגמה: דנה כהן"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expected_hours">שעות עבודה יומיות צפויות</Label>
              <Input
                id="expected_hours"
                name="expected_hours"
                type="number"
                step="0.5"
                min="0"
                max="24"
                defaultValue={profile?.expected_daily_hours ?? 8}
              />
            </div>
            <Button type="submit" className="w-full" size="lg">
              סיום והתחלה
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
