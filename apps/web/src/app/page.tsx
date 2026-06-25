import Link from "next/link";
import { Clock, FileSpreadsheet, BellRing, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Clock,
    title: "החתמה בלחיצה",
    body: "כניסה ויציאה בכפתור אחד, עם תיקון רטרואקטיבי חופשי.",
  },
  {
    icon: CalendarDays,
    title: "יומן חודשי",
    body: "עבודה, חופש, מחלה או חג — לכל יום, עם סיכום שעות אוטומטי.",
  },
  {
    icon: BellRing,
    title: "תזכורות חכמות",
    body: "תזכורת כניסה/יציאה, שכחת להחתים, וסוף חודש — הכול רשות.",
  },
  {
    icon: FileSpreadsheet,
    title: "ייצוא מסודר",
    body: "דו״ח חודשי מוכן להגשה — Excel, CSV או Google Sheets.",
  },
];

export default function HomePage() {
  return (
    <main className="surface-glow min-h-screen">
      <div className="container flex flex-col items-center py-16 text-center md:py-24">
        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-semibold text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success" />
          נוכחות אישית · MindCET
        </span>

        <h1 className="mt-6 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
          עוקבים אחרי השעות,
          <br />
          ומפיקים דו״ח חודשי בלחיצה.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          כלי דיווח נוכחות אישי — החתמה בזמן אמת, תזכורות, וייצוא מסודר להגשה
          למעסיק. בלי גיליונות מעיקים.
        </p>

        <div className="mt-8">
          <Button asChild size="lg">
            <Link href="/login">התחברות עם Google</Link>
          </Button>
        </div>

        <div className="mt-16 grid w-full max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="text-right">
              <CardContent className="p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
