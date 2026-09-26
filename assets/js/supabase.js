/* ── shared Supabase client ──────────────────────────────────────
   One client, imported by auth.html, district.html and index.html's
   header sign-in. Reads the project URL/anon key from Vite env vars
   (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) — both are meant to be
   public: the anon key only grants what the project's Row Level
   Security policies allow, same as any client-side Supabase app.

   The browser never talks to *.supabase.co directly: several Indian
   ISPs block that domain, so every call goes to /sb/* on our own
   origin and is forwarded server-side — by the rewrite in vercel.json
   in production, and by the proxy in vite.config.ts in dev. Google
   sign-in follows the same rule: Google Identity Services (served from
   accounts.google.com) hands us an ID token, which we exchange with
   Supabase through /sb instead of redirecting through supabase.co.

   Until the env vars are set (in .env.local for dev, or in the host's
   environment variables for the deployed site), `configured` is false
   and every helper below rejects with a clear message instead of
   throwing on a missing client — so the rest of the page can show
   "sign-in isn't set up yet" instead of a blank crash. */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export const configured = Boolean(url && anonKey);

export const supabase = configured
  ? createClient(location.origin + "/sb", anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        /* fixed key, so dev (localhost) and prod don't depend on the
           proxy hostname supabase-js would otherwise derive it from */
        storageKey: "fg-auth",
      },
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

/* The confirmation email links back to /auth.html?token_hash=…&type=…
   (see the email-template note in supabase/schema.sql) rather than to
   supabase.co's own /verify endpoint, which blocked visitors can't open. */
export async function verifyEmailToken(tokenHash, type) {
  if (!configured) throw NOT_CONFIGURED;
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) throw error;
  return data;
}

/* ── Google ─────────────────────────────────────────────────────
   Renders Google's own button into `container`. On success it calls
   onSignedIn(session); on failure onError(err). A nonce ties the ID
   token to this page load: Google embeds its SHA-256 in the token and
   Supabase checks the raw value against it, so a token lifted from
   elsewhere can't be replayed here. */
let gsiLoad;
function loadGsi() {
  gsiLoad ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { gsiLoad = null; reject(new Error("Couldn't load Google sign-in — check your connection and try again.")); };
    document.head.append(s);
  });
  return gsiLoad;
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function renderGoogleButton(container, { onSignedIn, onError, dark = false }) {
  if (!configured) throw NOT_CONFIGURED;
  if (!googleClientId) throw new Error("Google sign-in isn't set up yet — VITE_GOOGLE_CLIENT_ID is not set.");
  await loadGsi();
  const nonce = crypto.randomUUID();
  const hashed = await sha256Hex(nonce);
  google.accounts.id.initialize({
    client_id: googleClientId,
    nonce: hashed,
    use_fedcm_for_prompt: true,
    callback: async ({ credential }) => {
      try {
        const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: credential, nonce });
        if (error) throw error;
        onSignedIn(data.session);
      } catch (err) {
        onError(err);
      }
    },
  });
  container.replaceChildren();
  google.accounts.id.renderButton(container, {
    type: "standard",
    theme: dark ? "filled_black" : "outline",
    size: "large",
    shape: "pill",
    text: "continue_with",
    logo_alignment: "center",
    width: Math.min(400, Math.max(200, Math.round(container.getBoundingClientRect().width))),
  });
}

export async function signOut() {
  if (!configured) return;
  await supabase.auth.signOut();
  if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
}

/* Human-readable copy for Supabase's own error messages, which are
   accurate but not written for an end user. */
export function friendlyAuthError(err) {
  const m = (err && err.message) || String(err);
  if (/already registered|already exists/i.test(m)) return "An account with that email already exists — sign in instead.";
  if (/invalid login credentials/i.test(m)) return "That email or password doesn't match our records.";
  if (/email not confirmed/i.test(m)) return "Confirm your email first — check your inbox for the link we sent.";
  if (/password should be at least/i.test(m)) return "Password must be at least 8 characters.";
  if (/expired|invalid.*(otp|token)|otp.*(expired|invalid)/i.test(m)) return "That confirmation link has expired or was already used — sign in, or create your account again to get a new one.";
  if (/failed to fetch|networkerror|load failed|internal server error|bad gateway|service unavailable|gateway time-?out/i.test(m)) return "Couldn't reach FloodGuard's servers — check your connection and try again.";
  return m;
}
