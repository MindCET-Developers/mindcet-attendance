import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AuthCodeErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4 text-center">
      <div className="max-w-sm">
        <h1 className="text-2xl font-bold">ההתחברות נכשלה</h1>
        <p className="mt-2 text-muted-foreground">
          לא הצלחנו להשלים את ההתחברות. נסו שוב.
        </p>
        <Button asChild className="mt-6">
          <Link href="/login">חזרה להתחברות</Link>
        </Button>
      </div>
    </main>
  );
}
