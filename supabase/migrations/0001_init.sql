-- ============================================================================
-- Personal attendance app — initial schema
-- Lean, single-user (personal) model. RLS: every row is owned by auth.uid().
-- ============================================================================

-- ---------- Enums ----------
create type public.day_type as enum ('work', 'vacation', 'sick', 'holiday', 'absence');
create type public.attendance_source as enum ('realtime', 'manual');

-- ---------- updated_at helper ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles ----------
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  full_name             text,
  email                 text,
  avatar_url            text,
  report_display_name   text,
  expected_daily_hours  numeric(4, 2) not null default 8,
  week_start            smallint not null default 0,        -- 0 = Sunday
  timezone              text not null default 'Asia/Jerusalem',
  onboarded             boolean not null default false,
  created_at            timestamptz not null default now()
);

-- ---------- attendance_records ----------
create table public.attendance_records (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  work_date   date not null,
  clock_in    timestamptz,
  clock_out   timestamptz,
  day_type    public.day_type not null default 'work',
  note        text,
  is_edited   boolean not null default false,
  source      public.attendance_source not null default 'manual',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index attendance_user_date_idx
  on public.attendance_records (user_id, work_date);

create trigger attendance_set_updated_at
  before update on public.attendance_records
  for each row execute function public.set_updated_at();

-- ---------- notification_settings ----------
create table public.notification_settings (
  user_id                       uuid primary key references public.profiles (id) on delete cascade,
  daily_reminder_enabled        boolean not null default false,
  daily_in_time                 time,
  daily_out_time                time,
  forgot_clockout_enabled       boolean not null default false,
  forgot_clockout_after_hours   integer not null default 10,
  month_end_enabled             boolean not null default false,
  missing_days_enabled          boolean not null default false
);

-- ---------- push_tokens ----------
create table public.push_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null,
  platform        text,
  created_at      timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

-- ---------- export_targets ----------
create table public.export_targets (
  user_id          uuid primary key references public.profiles (id) on delete cascade,
  google_sheet_id  text,
  last_exported_at timestamptz
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles               enable row level security;
alter table public.attendance_records     enable row level security;
alter table public.notification_settings  enable row level security;
alter table public.push_tokens            enable row level security;
alter table public.export_targets         enable row level security;

-- profiles: owner = id
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- attendance_records: owner = user_id
create policy "attendance_select_own" on public.attendance_records
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "attendance_insert_own" on public.attendance_records
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "attendance_update_own" on public.attendance_records
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "attendance_delete_own" on public.attendance_records
  for delete to authenticated using ((select auth.uid()) = user_id);

-- notification_settings: owner = user_id
create policy "notif_select_own" on public.notification_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notif_insert_own" on public.notification_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "notif_update_own" on public.notification_settings
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- push_tokens: owner = user_id
create policy "push_select_own" on public.push_tokens
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "push_insert_own" on public.push_tokens
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "push_delete_own" on public.push_tokens
  for delete to authenticated using ((select auth.uid()) = user_id);

-- export_targets: owner = user_id
create policy "export_select_own" on public.export_targets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "export_insert_own" on public.export_targets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "export_update_own" on public.export_targets
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ============================================================================
-- Auto-provision profile + notification settings on signup
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, report_display_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;

  insert into public.notification_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Reporting views (security_invoker => respect the querying user's RLS)
-- ============================================================================
create view public.daily_hours_view
with (security_invoker = true) as
select
  user_id,
  work_date,
  coalesce(sum(
    case
      when clock_in is not null and clock_out is not null
      then greatest(extract(epoch from (clock_out - clock_in)) / 60, 0)
      else 0
    end
  ), 0)::int as total_minutes,
  min(clock_in) as first_clock_in,
  max(clock_out) as last_clock_out,
  (array_agg(day_type order by (day_type <> 'work') desc, created_at))[1] as day_type
from public.attendance_records
group by user_id, work_date;

create view public.monthly_summary_view
with (security_invoker = true) as
select
  user_id,
  to_char(work_date, 'YYYY-MM') as month,
  sum(total_minutes)::int as total_minutes,
  count(*) filter (where day_type = 'work' and total_minutes > 0) as work_days,
  count(*) filter (where day_type = 'vacation') as vacation_days,
  count(*) filter (where day_type = 'sick') as sick_days,
  count(*) filter (where day_type = 'holiday') as holiday_days,
  count(*) filter (where day_type = 'absence') as absence_days
from public.daily_hours_view
group by user_id, to_char(work_date, 'YYYY-MM');

-- ============================================================================
-- Grants (RLS still applies)
-- ============================================================================
grant select, insert, update, delete on
  public.profiles,
  public.attendance_records,
  public.notification_settings,
  public.push_tokens,
  public.export_targets
to authenticated;

grant select on public.daily_hours_view, public.monthly_summary_view to authenticated;
