-- ============================================================================
-- VFR NAVLOG Trainer — Stage 2 schema
-- Run this once in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run: uses "if not exists" / "or replace" throughout.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. pilots — one row per signed-up student, keyed to Supabase Auth's user id.
-- ----------------------------------------------------------------------------
create table if not exists public.pilots (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  home_base text,
  created_at timestamptz not null default now()
);

alter table public.pilots enable row level security;

drop policy if exists "pilots read own" on public.pilots;
create policy "pilots read own" on public.pilots
  for select using (auth.uid() = id);

drop policy if exists "pilots update own" on public.pilots;
create policy "pilots update own" on public.pilots
  for update using (auth.uid() = id);

-- No insert policy: rows are created automatically by the trigger below, not
-- directly by client code. No delete policy: pilots can't self-delete their
-- profile from the client (fine for a training app — out of scope for now).

-- ----------------------------------------------------------------------------
-- 2. flights — the in-app logbook (Stage 13). Created now so the schema is
--    in place from the start; the UI for it isn't built until Stage 13.
-- ----------------------------------------------------------------------------
create table if not exists public.flights (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references public.pilots(id) on delete cascade,
  flown_on date not null,
  aircraft_type text not null,
  route jsonb not null,
  flight_time_minutes int not null check (flight_time_minutes > 0),
  created_at timestamptz not null default now()
);

alter table public.flights enable row level security;

drop policy if exists "flights read own" on public.flights;
create policy "flights read own" on public.flights
  for select using (auth.uid() = pilot_id);

drop policy if exists "flights insert own" on public.flights;
create policy "flights insert own" on public.flights
  for insert with check (auth.uid() = pilot_id);

drop policy if exists "flights update own" on public.flights;
create policy "flights update own" on public.flights
  for update using (auth.uid() = pilot_id);

drop policy if exists "flights delete own" on public.flights;
create policy "flights delete own" on public.flights
  for delete using (auth.uid() = pilot_id);

-- ----------------------------------------------------------------------------
-- 3. Auto-provisioning: when someone signs up via supabase.auth.signUp(),
--    automatically create their matching public.pilots row. display_name and
--    home_base come from the "data" object passed at sign-up time
--    (auth.users.raw_user_meta_data) — see js/auth.js.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_pilot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pilots (id, display_name, home_base)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'home_base'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_pilot();

-- ============================================================================
-- Done. Verify in Table Editor: you should see "pilots" and "flights" tables,
-- both with the RLS padlock icon showing as enabled.
-- ============================================================================
