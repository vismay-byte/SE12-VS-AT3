-- Source: supabase/schema.sql
-- Purpose: even if a malicious script ever ran in the browser (e.g. via a
-- theoretical XSS the escaping above is meant to prevent) and tried to call
-- the Supabase client directly, Postgres Row Level Security (RLS) still
-- blocks it from reading or writing another pilot's rows, because every
-- policy is scoped to auth.uid() (the id of whoever is currently logged in).

alter table public.flights enable row level security;

create policy "flights read own" on public.flights
  for select using (auth.uid() = pilot_id);

create policy "flights insert own" on public.flights
  for insert with check (auth.uid() = pilot_id);

create policy "flights update own" on public.flights
  for update using (auth.uid() = pilot_id);

create policy "flights delete own" on public.flights
  for delete using (auth.uid() = pilot_id);

-- Same pattern on public.pilots (read/update own row only). There is no
-- client-side equivalent of this check anywhere in the JS. It is enforced
-- entirely by the database, which is what makes it trustworthy, it cannot
-- be bypassed by editing or replaying a request from the browser.
