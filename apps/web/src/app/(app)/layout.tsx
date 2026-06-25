import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded, report_display_name, avatar_url")
    .eq("id", user.id)
    .single();

  if (profile && !profile.onboarded) redirect("/onboarding");

  const displayName: string =
    profile?.report_display_name ?? user.email ?? "משתמש";
  const initials = displayName.trim().slice(0, 2);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/app" className="flex items-center gap-2 font-extrabold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              ⏱
            </span>
            נוכחות
          </Link>
          <div className="flex items-center gap-3">
            <SignOutButton />
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
              {initials}
            </span>
          </div>
        </div>
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
}
