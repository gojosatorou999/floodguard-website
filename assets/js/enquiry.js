/* ── enquiries → Supabase ────────────────────────────────────────
   One submit path for every demo / contact form on the site. Rows land in
   public.enquiries (see supabase/schema.sql), which the public API can
   insert into but never read back. Goes through the same /sb proxy as
   sign-in, so it works on networks that block *.supabase.co. */
import { configured, supabase } from "/assets/js/supabase.js";

const FIELDS = ["name", "email", "organisation", "role", "product", "sector", "geography", "message", "intent", "source"];
const MAX = { name: 120, email: 200, organisation: 200, role: 120, product: 60, sector: 80, geography: 200, message: 4000, intent: 80, source: 80 };

export async function sendEnquiry(data) {
  if (!configured) throw new Error("Enquiries aren't connected yet on this site — please try again later.");
  const row = {};
  for (const k of FIELDS) {
    const v = (data[k] ?? "").toString().trim();
    if (v) row[k] = v.slice(0, MAX[k]);
  }
  const { error } = await supabase.from("enquiries").insert(row);
  if (error) {
    if (/relation .* does not exist|could not find the table/i.test(error.message))
      throw new Error("Enquiries aren't switched on yet — please try again later.");
    throw new Error("Your enquiry couldn't be sent. Please try again in a moment.");
  }
}
