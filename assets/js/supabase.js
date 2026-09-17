/* ── shared Supabase client ──────────────────────────────────────
   One client, imported by auth.html, district.html and index.html's
   header sign-in. Reads the project URL/anon key from Vite env vars
   (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) — both are meant to be
   public: the anon key only grants what the project's Row Level
   Security policies allow, same as any client-side Supabase app.

   Until those two vars are set (in .env.local for dev, or in the
   host's environment variables for the deployed site), `configured`
   is false and every helper below rejects with a clear message
   instead of throwing on a missing client — so the rest of the page
   can show "sign-in isn't set up yet" instead of a blank crash. */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && anonKey);

export const supabase = configured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

const NOT_CONFIGURED = new Error(
  "Sign-in isn't connected yet — VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set."
);

export async function getSession() {
  if (!configured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signUpWithPassword(email, password, name, org) {
  if (!configured) throw NOT_CONFIGURED;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name: name || "", org: org || "" } },
  });
  if (error) throw error;
  return data;
}

export async function signInWithPassword(email, password) {
  if (!configured) throw NOT_CONFIGURED;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle(redirectTo) {
  if (!configured) throw NOT_CONFIGURED;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!configured) return;
  await supabase.auth.signOut();
}

/* Human-readable copy for Supabase's own error messages, which are
   accurate but not written for an end user. */
export function friendlyAuthError(err) {
  const m = (err && err.message) || String(err);
  if (/already registered|already exists/i.test(m)) return "An account with that email already exists — sign in instead.";
  if (/invalid login credentials/i.test(m)) return "That email or password doesn't match our records.";
  if (/email not confirmed/i.test(m)) return "Confirm your email first — check your inbox for the link we sent.";
  if (/password should be at least/i.test(m)) return "Password must be at least 8 characters.";
  if (/not connected yet/i.test(m)) return m;
  return m;
}
