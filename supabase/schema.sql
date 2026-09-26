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

-- ...but only the display fields. Without this column grant the policy
-- above would let anyone promote their own `tier` to 'live' straight
-- from the browser console; tier changes go through the service role.
revoke update on public.profiles from anon, authenticated;
grant update (name, org) on public.profiles to authenticated;

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

-- ── Dashboard settings (not SQL — do these by hand) ───────────
-- Several Indian ISPs block *.supabase.co, so the site never sends a
-- visitor there: the browser calls /sb/* on our own domain (proxied by
-- vercel.json / vite.config.ts), and both of the flows below are set up
-- to stay on our domain too.
--
-- 1. Authentication → URL Configuration → Site URL: the production URL
--    (e.g. https://floodguard.in). Add http://localhost:5173 under
--    Redirect URLs for dev.
--
-- 2. Confirmation email. The default template links to supabase.co's
--    /verify endpoint, which blocked visitors can't open. Authentication
--    → Emails → "Confirm signup", replace the link with:
--      <a href="{{ .SiteURL }}/auth.html?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
--    auth.html verifies the token itself. (Or turn off "Confirm email"
--    under Authentication → Providers → Email, and sign-ups log straight in.)
--
-- 3. Google sign-in. console.cloud.google.com → APIs & Services →
--    Credentials → Create OAuth client ID → Web application:
--      Authorized JavaScript origins: https://<your production domain>,
--                                     http://localhost:5173, http://localhost
--      Authorized redirect URIs:      (none needed — we use ID tokens)
--    Then in Supabase: Authentication → Providers → Google → enable, and
--    put that Client ID in "Client IDs" (the secret isn't used by this
--    flow but the form may ask for it). Put the same Client ID in
--    VITE_GOOGLE_CLIENT_ID.
