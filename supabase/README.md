# Supabase — הקמה

הסכמה למצב הדיווח האישי. 5 טבלאות + 2 Views, עם RLS שכל שורה שייכת ל-`auth.uid()`.

## קבצים
- `migrations/0001_init.sql` — enums, טבלאות, RLS, טריגר יצירת פרופיל אוטומטי בהרשמה, ו-Views לדוחות.

## התקנה (אפשרות א׳ — דרך הדשבורד, הכי מהיר)
1. צרו פרויקט חדש ב-[supabase.com](https://supabase.com).
2. **SQL Editor** → הדביקו את תוכן `migrations/0001_init.sql` → Run.
3. **Project Settings → API**: העתיקו את `Project URL` ואת `anon key` (ואת `service_role`)
   אל `apps/web/.env.local` (ראו `apps/web/.env.example`).

## התקנה (אפשרות ב׳ — דרך ה-CLI)
```bash
npm i -g supabase
supabase link --project-ref <your-ref>
supabase db push        # מחיל את ה-migrations
# או לפיתוח מקומי:
supabase start
supabase db reset
```

## הגדרת התחברות Google
1. **Authentication → Providers → Google** → הפעילו, הזינו Client ID / Secret
   (מ-Google Cloud Console → OAuth consent + Credentials).
2. **Redirect URLs**: הוסיפו `http://localhost:3000/auth/callback` (ולכתובת הפרודקשן).
3. לייצוא Google Sheets — בקשת ה-scopes נעשית בצד הלקוח בעת ההתחברות:
   `https://www.googleapis.com/auth/drive.file` + `https://www.googleapis.com/auth/spreadsheets`.
   ב-Google Cloud Console יש לאשר את ה-scopes הללו ב-OAuth consent screen.

## טיפוסי TypeScript (לאחר הקמת הפרויקט)
```bash
supabase gen types typescript --project-id <ref> > packages/shared/src/database.types.ts
```
מחבר ל-Supabase client כ-`createClient<Database>()`.

## אימות
- הרשמת משתמש → אמורות להיווצר שורות ב-`profiles` וב-`notification_settings` (טריגר).
- בדיקת RLS: משתמש א׳ לא רואה רשומות של משתמש ב׳.
