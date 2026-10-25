-- FloodGuard — webinar registrations
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- (Safe to re-run: everything is "if not exists" / "drop policy if exists".)
--
-- Every "Explore" / "Reserve your spot" button on the site opens a short
-- registration form first. The form inserts one row here; only after that
-- does the visitor see the join link. Anyone can insert; nobody can read,
-- edit or delete through the public API. You read the rows in the dashboard
-- (Table Editor → webinar_registrations) or with the service role.

create table if not exists public.webinar_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 200 and email like '%@%'),
  organisation text not null check (char_length(organisation) between 2 and 200),
  role text check (char_length(role) <= 120),
  sector text check (char_length(sector) <= 80),
  interest text check (char_length(interest) <= 1000),
  source text check (char_length(source) <= 160),
  consent boolean not null default false check (consent = true)
);

alter table public.webinar_registrations enable row level security;

drop policy if exists "webinar: anyone can register" on public.webinar_registrations;
create policy "webinar: anyone can register" on public.webinar_registrations
  for insert to anon, authenticated with check (true);

-- insert only, and only the form's own columns (no reads, no updates)
revoke all on public.webinar_registrations from anon, authenticated;
grant insert (name, email, organisation, role, sector, interest, source, consent)
  on public.webinar_registrations to anon, authenticated;

-- Handy for the team: newest registrations first.
create index if not exists webinar_registrations_created_idx
  on public.webinar_registrations (created_at desc);
