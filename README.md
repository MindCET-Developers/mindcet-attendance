# נוכחות אישית · MindCET

אפליקציית **דיווח נוכחות עצמי**: מעקב כניסה/יציאה, יומן חודשי עם סוג יום,
תזכורות, וייצוא דו״ח חודשי ל-Excel / CSV / Google Sheets.
שני לקוחות (Web + Mobile) מעל backend אחד של Supabase.

> תוכנית מלאה: ראו את קובץ התכנון (`attendance-app-plan.html`) והעיצובים תחת `designs/`.

## מבנה (monorepo · pnpm + Turborepo)

```
apps/web/          Next.js 15 (App Router, RTL) + Tailwind + shadcn-style
apps/mobile/       Expo / React Native  (בהמשך — P6)
packages/shared/   טיפוסים + חישוב שעות + בניית דו״ח + שורות ייצוא
supabase/          מיגרציות SQL + RLS + Views  (ראו supabase/README.md)
```

## הרצה מקומית

```bash
pnpm install

# 1) הקימו פרויקט Supabase והחילו את הסכמה — ראו supabase/README.md
# 2) צרו apps/web/.env.local לפי apps/web/.env.example
pnpm dev:web        # http://localhost:3000
```

### משתני סביבה (apps/web/.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
התחברות Google + scopes ל-Google Sheets — ראו `supabase/README.md`.

## דרישות
- Node ≥ 20, pnpm 10
- פרויקט Supabase + ספק Google OAuth (לבדיקת התחברות חיה)

## סטטוס (roadmap)
- [x] **P0** — Scaffold monorepo + web (נבנה בהצלחה)
- [x] **P1** — אימות Google + onboarding (web)
- [x] **P2** — סכמת Supabase + RLS + Views
- [ ] **P3** — החתמה ויומן חודשי (web)
- [ ] **P4** — דו״ח חודשי + ייצוא Excel/CSV
- [ ] **P5** — ייצוא Google Sheets
- [ ] **P6** — אפליקציית Expo (mobile)
- [ ] **P7** — התראות ותזכורות
- [ ] **P8** — ליטוש + builds

## פקודות שימושיות
```bash
pnpm build:web          # production build
pnpm --filter @att/shared typecheck
pnpm --filter @att/web typecheck
```
