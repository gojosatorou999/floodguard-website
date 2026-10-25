/* ── webinar registration: the gate in front of the join link ─────
   Every webinar link (data-webinar) opens this form instead of Zoom.
   Submitting inserts one row into public.webinar_registrations (see
   supabase/webinar.sql); only a successful insert reveals the join link.

   • Same Supabase client as the lead forms (enquiry.js), anonymous, insert-only
   • Honeypot field: bots fill it, people never see it
   • On this device a visitor who has registered gets the join step directly
     (localStorage — a convenience, not a record: the database row is the record)
   • Nothing is sent to Zoom; the join link is the configured WEBINAR_URL      */
import { configured, supabase } from "/assets/js/supabase.js";
import { getLead } from "/assets/js/lead.js";
import { WEBINAR_URL } from "/assets/js/webinar.js";

const DONE_KEY = "fg_webinar_registered";
const SECTORS = ["Insurance & Reinsurance", "Banking & Finance", "Agriculture", "Infrastructure", "Government", "Research", "Other"];
const ARROW = '<svg class="ar" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4"/></svg>';
const mailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const registered = () => { try { return localStorage.getItem(DONE_KEY) === "1"; } catch (_) { return false; } };
const markRegistered = () => { try { localStorage.setItem(DONE_KEY, "1"); } catch (_) { } };

let dlg = null, opener = null, source = "";

function joinStep(name) {
  return `<div class="wrDone">
      <div class="wrTick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <h2 id="wrT">${name ? `You’re registered, ${esc(name.split(" ")[0])}.` : "You’re registered."}</h2>
      <p>Join the live webinar below. We’ll also follow up by email about the pilot.</p>
      <a class="wbGo" href="${WEBINAR_URL}">Join the webinar ${ARROW}</a>
      <button class="wbLater" type="button" data-close>Close</button>
    </div>`;
}

function formStep(prev) {
  const v = k => esc(prev[k] || "");
  return `<h2 id="wrT">Reserve your spot</h2>
    <p class="wrSub">Tell us a little about you first. Then you can join the webinar.</p>
    <form novalidate class="wrForm">
      <div class="wrRow">
        <label class="wrF"><span>Name</span><input name="name" autocomplete="name" required value="${v("name")}"><em class="wrE">Enter your name</em></label>
        <label class="wrF"><span>Work email</span><input name="email" type="email" autocomplete="email" required placeholder="you@organisation.in" value="${v("email")}"><em class="wrE">Enter a valid email</em></label>
      </div>
      <div class="wrRow">
        <label class="wrF"><span>Organisation</span><input name="organisation" autocomplete="organization" required value="${v("organisation")}"><em class="wrE">Enter your organisation</em></label>
        <label class="wrF"><span>Role <small>optional</small></span><input name="role" autocomplete="organization-title" value="${v("role")}"></label>
      </div>
      <label class="wrF"><span>Sector</span><select name="sector" required><option value="">Select one</option>${SECTORS.map(s => `<option${s === prev.sector ? " selected" : ""}>${esc(s)}</option>`).join("")}</select><em class="wrE">Choose a sector</em></label>
      <label class="wrF"><span>What would you like to learn or pilot? <small>optional</small></span><textarea name="interest" rows="3" placeholder="The decision you’re working on, the areas or assets involved…"></textarea></label>
      <label class="wrCheck"><input type="checkbox" name="consent" required><i aria-hidden="true"></i><span>I agree that FloodGuard may contact me about the webinar and pilot programme.</span><em class="wrE">Please tick to continue</em></label>
      <input class="wrHp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p class="wrErr" role="alert" hidden></p>
      <button class="wbGo wrGo" type="submit"><span class="wrLbl">Reserve your spot</span> ${ARROW}</button>
      <p class="wrFine">Your details are stored securely and used only for this webinar and the pilot.</p>
    </form>`;
}

function ensure() {
  if (dlg) return dlg;
  dlg = document.createElement("dialog");
  dlg.className = "wbDlg wbReg";
  dlg.setAttribute("aria-labelledby", "wrT");
  dlg.innerHTML = `<button class="wbX" type="button" aria-label="Close"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8"/></svg></button><div class="wbBody wrBody"></div>`;
  document.body.append(dlg);
  dlg.querySelector(".wbX").addEventListener("click", () => dlg.close());
  dlg.querySelector(".wrBody").addEventListener("click", e => { if (e.target.closest("[data-close]")) dlg.close(); });
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("close", () => {
    document.documentElement.classList.remove("wbLock");
    document.documentElement.style.removeProperty("--wbSb");
    if (opener && document.contains(opener)) opener.focus?.();
  });
  return dlg;
}

function wireForm(body) {
  const form = body.querySelector("form");
  if (!form) return;
  const err = body.querySelector(".wrErr"), go = body.querySelector(".wrGo"), lbl = body.querySelector(".wrLbl");
  const fields = [...form.querySelectorAll("input[required],select[required]")];
  const show = (el, bad) => el.closest(".wrF, .wrCheck").classList.toggle("bad", bad);
  fields.forEach(el => el.addEventListener("input", () => show(el, false)));

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    let bad = null;
    for (const el of fields) {
      const ok = el.type === "checkbox" ? el.checked : (el.name === "email" ? mailRe.test(el.value.trim()) : el.value.trim().length > 0);
      show(el, !ok); if (!ok && !bad) bad = el;
    }
    if (bad) { err.hidden = true; bad.focus(); return; }
    // honeypot: pretend it worked, store nothing
    if (d.website) { body.innerHTML = joinStep(d.name); return; }
    if (!configured || !supabase) {
      err.textContent = "Registration isn’t connected yet on this site. Please try again later.";
      err.hidden = false; return;
    }
    go.disabled = true; lbl.textContent = "Reserving…";
    const clip = (v, n) => (v ?? "").toString().trim().slice(0, n) || null;
    const row = {
      name: clip(d.name, 120), email: clip(d.email, 200), organisation: clip(d.organisation, 200),
      role: clip(d.role, 120), sector: clip(d.sector, 80), interest: clip(d.interest, 1000),
      source: clip(source, 160), consent: true,
    };
    const { error } = await supabase.from("webinar_registrations").insert(row);
    if (error) {
      const missing = /relation .* does not exist|could not find the table/i.test(error.message);
      err.textContent = missing ? "Registration isn’t switched on yet. Please try again later."
        : "We couldn’t save your registration. Please check your details and try again.";
      err.hidden = false; go.disabled = false; lbl.textContent = "Reserve your spot";
      return;
    }
    markRegistered();
    body.innerHTML = joinStep(d.name);
    body.querySelector("h2")?.focus?.();
  });
}

/** open the registration gate; `from` is a short label stored with the row */
export function openRegister(from = "") {
  source = (location.pathname + (from ? " · " + from : "")).slice(0, 160);
  const d = ensure();
  if (d.open) return;
  opener = document.activeElement;
  // a popup open over the page gives way to the form
  document.querySelector("dialog.wbPop[open]")?.close();
  const body = d.querySelector(".wrBody");
  if (registered()) {
    body.innerHTML = joinStep(getLead()?.name || "");
  } else {
    const prev = { ...(getLead() || {}) };
    body.innerHTML = formStep(prev);
    wireForm(body);
  }
  document.documentElement.style.setProperty("--wbSb", Math.max(0, innerWidth - document.documentElement.clientWidth) + "px");
  document.documentElement.classList.add("wbLock");
  d.showModal();
  (body.querySelector("input:not(.wrHp), .wbGo") || body.querySelector("a")).focus();
}
