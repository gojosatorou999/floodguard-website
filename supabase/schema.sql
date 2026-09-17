-- FloodGuard — profiles table + auto-provisioning
-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run).
--
-- Supabase already has a built-in `auth.users` table that stores every
-- account (email, hashed password, Google identity, etc.) the moment
-- someone signs up — you don't create that one yourself. This adds one
-- `profiles` row per user for the app-facing bits auth.users shouldn't
-- carry: display name, organisation, and which product tier
-- (explorer / atlas / live) they're on.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  org text,
  tier text not null default 'explorer' check (tier in ('explorer','atlas','live')),
  created_at timestamptz not null default now()
);

-- Row Level Security: everyone's profile is private to them.
alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- A new profiles row is created automatically the moment someone signs
-- up (email/password or Google) — the app never inserts into this
-- table directly.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, org)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'org', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Google sign-in ──────────────────────────────────────────────
-- This file only creates the database side. To turn on the Google
-- button, in the Supabase dashboard: Authentication → Providers →
-- Google → enable it, and paste in a Client ID + Client Secret from
-- a Google Cloud OAuth consent screen (console.cloud.google.com →
-- APIs & Services → Credentials → Create OAuth client ID → Web
-- application). Add these two Authorized redirect URIs there:
--   https://<your-project-ref>.supabase.co/auth/v1/callback
--   http://localhost:5173  (and your production URL, for local dev)
