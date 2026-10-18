/* ── shared Supabase client ──────────────────────────────────────
   One client, used by enquiry.js to write lead-form submissions into
   public.enquiries. There is no sign-in on the site: the client is
   anonymous, and Row Level Security lets it insert enquiries and
   nothing else. Reads the project URL/anon key from Vite env vars
   (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) — both are meant to be
   public.

   The browser never talks to *.supabase.co directly: several Indian
   ISPs block that domain, so every call goes to /sb/* on our own
   origin and is forwarded server-side — by the rewrite in vercel.json
   in production, and by the proxy in vite.config.ts in dev.

   Until the env vars are set (in .env.local for dev, or in the host's
   environment variables for the deployed site), `configured` is false
   and sendEnquiry rejects with a clear message instead of throwing on a
   missing client. */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && anonKey);

export const supabase = configured
  ? createClient(location.origin + "/sb", anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;
