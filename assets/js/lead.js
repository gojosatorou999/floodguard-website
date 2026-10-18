/* ── lead form ───────────────────────────────────────────────────
   The one form behind every "talk to us" moment, replacing sign-in:

     dashboard   gates the district dashboard — a short form, once
     demo        Request a Demo
     sales       Contact Sales
     message     Send a Message (the contact page)

   Same fields, same look, same submit path (public.enquiries, through
   sendEnquiry); the dashboard variant just asks for less.

   Used three ways:
     mountLead(host, opts)   render inline (contact page, dashboard gate)
     openLead(opts)          render in a modal <dialog>
     <a href="/contact.html?intent=demo" data-lead="demo">   any link —
       opens the modal instead of navigating. The href is the fallback,
       so the link still works if this module never loads.

   Once someone has sent the form, their details are remembered in this
   browser (fg_lead) so the dashboard opens straight away next time and
   later forms come pre-filled. Storage is a convenience only: if it's
   blocked, the visitor just sees the form again. */
import "/assets/lead.css";
// the Supabase client is ~240 kB, so it loads on first submit, not with the page

const KEY = "fg_lead";
export function getLead() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && v.email ? v : null; } catch { return null; }
}
export const hasLead = () => !!getLead();
function saveLead(v) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...v, at: new Date().toISOString() })); } catch { }
}

const PRODUCTS = ["Explorer", "Atlas", "Live", "Atlas + Live", "Enterprise / Custom", "General enquiry"];
const SECTORS = ["Insurance & Reinsurance", "Banking & Finance", "Agriculture", "Infrastructure", "Government", "Research", "Other"];

const MODES = {
  dashboard: {
    title: "Open the district dashboard",
    sub: "Tell us a little about yourself and the dashboard opens straight away. You'll only be asked once on this device.",
    go: "View dashboard", intent: "Dashboard access", full: false,
  },
  demo: {
    title: "Request a demo",
    sub: "Tell us about your organisation and what you're working on. Someone who knows your sector will set up a demo around it.",
    go: "Request a demo", intent: "Request a demo", full: true,
  },
  sales: {
    title: "Contact sales",
    sub: "For professional and enterprise access — tell us your geography, use case and data needs, and we'll get back to you.",
    go: "Contact sales", intent: "Contact sales", full: true,
  },
  message: {
    title: "Send us a message",
    sub: "",
    go: "Send message", intent: "Contact us", full: true,
  },
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ERR = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5" stroke-linecap="round"/></svg>';
const ARROW = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4"/></svg>';
const mailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
let uid = 0;

function field(id, label, input, msg, optional) {
  return `<div class="lfF"><label for="${id}">${label}${optional ? ' <span class="opt">(optional)</span>' : ""}</label>${input}` +
    (msg ? `<span class="lfE">${ERR}${msg}</span>` : "") + `</div>`;
}
const options = (list, pick) => `<option value="">Select one</option>` +
  list.map(o => `<option${o === pick ? " selected" : ""}>${esc(o)}</option>`).join("");

/**
 * Render the form into `host`.
 *   mode     dashboard | demo | sales | message
 *   product  pre-selects "Interested in"
 *   sector   pre-selects "Sector"
 *   dest     dashboard only: the district being opened, for the copy
 *   heading  false to leave the title to the page around it
 *   source   stored with the enquiry (defaults to the current path)
 *   onDone   called with the submitted details; for the dashboard the
 *            caller decides what happens next (usually: open it)
 */
export function mountLead(host, opts = {}) {
  const mode = MODES[opts.mode] ? opts.mode : "message";
  const M = MODES[mode], k = "lf" + (++uid), prev = getLead() || {};
  const sub = mode === "dashboard" && opts.dest
    ? `You're opening flood-risk data for <b>${esc(opts.dest)}</b>. Tell us a little about yourself and it opens straight away — you'll only be asked once on this device.`
    : M.sub;
  const val = v => (v ? ` value="${esc(v)}"` : "");

  host.innerHTML = `<div class="lf">
    ${opts.heading === false ? "" : `<h2 id="${k}T">${M.title}</h2>`}
    ${sub && opts.heading !== false ? `<p class="lfSub">${sub}</p>` : ""}
    <form novalidate>
      <div class="lfTwo">
        ${field(k + "n", "Name", `<input class="lfI" id="${k}n" name="name" autocomplete="name" required${val(prev.name)}>`, "Enter your name")}
        ${field(k + "e", "Work email", `<input class="lfI" id="${k}e" name="email" type="email" autocomplete="email" required placeholder="you@organisation.in"${val(prev.email)}>`, "Enter a valid email address")}
      </div>
      <div class="lfTwo">
        ${field(k + "o", "Organisation", `<input class="lfI" id="${k}o" name="organisation" autocomplete="organization" required${val(prev.organisation)}>`, "Enter your organisation")}
        ${field(k + "r", "Role", `<input class="lfI" id="${k}r" name="role" autocomplete="organization-title"${val(prev.role)}>`, "", true)}
      </div>
      <div class="lfTwo">
        ${M.full ? field(k + "p", "Interested in", `<select class="lfI" id="${k}p" name="product" required>${options(PRODUCTS, opts.product)}</select>`, "Choose one") : ""}
        ${field(k + "s", "Sector", `<select class="lfI" id="${k}s" name="sector" required>${options(SECTORS, opts.sector || prev.sector)}</select>`, "Choose a sector")}
      </div>
      ${M.full ? field(k + "g", "Geography of interest", `<input class="lfI" id="${k}g" name="geography" placeholder="State, district, region or portfolio footprint">`, "", true) : ""}
      ${M.full ? field(k + "m", "How can we help?", `<textarea class="lfI" id="${k}m" name="message" placeholder="The decision you're working on, the assets or areas involved, timelines…"></textarea>`, "", true) : ""}
      <div class="lfHp" aria-hidden="true"><label for="${k}w">Website</label><input id="${k}w" name="website" tabindex="-1" autocomplete="off"></div>
      <button class="lfGo" type="submit"><span class="lfSpin"></span><span class="lbl">${M.go}</span> ${ARROW}</button>
      <p class="lfErr" role="alert"></p>
      <p class="lfFine">We use these details only to respond to you. No spam, no sharing.</p>
    </form>
    <div class="lfDone" role="status" aria-live="polite" hidden></div>
  </div>`;

  const form = host.querySelector("form"), go = form.querySelector(".lfGo"), lbl = go.querySelector(".lbl"), err = form.querySelector(".lfErr");
  const $ = n => form.elements[n];
  const checks = [["name", v => v.trim().length >= 2], ["email", v => mailRe.test(v.trim())], ["organisation", v => v.trim().length >= 2],
    ["sector", v => !!v], ...(M.full ? [["product", v => !!v]] : [])];
  form.addEventListener("input", e => e.target.closest(".lfF")?.classList.remove("err"));

  form.addEventListener("submit", async e => {
    e.preventDefault();
    err.classList.remove("on");
    const ok = checks.map(([n, test]) => {
      const bad = !test($(n).value);
      $(n).closest(".lfF").classList.toggle("err", bad);
      $(n).setAttribute("aria-invalid", String(bad));
      return !bad;
    }).every(Boolean);
    if (!ok) { form.querySelector(".lfF.err .lfI").focus(); return; }

    const data = {};
    for (const n of ["name", "email", "organisation", "role", "product", "sector", "geography", "message"]) if ($(n)) data[n] = $(n).value.trim();
    if (mode === "dashboard" && opts.dest) data.geography = opts.dest;
    go.classList.add("loading"); go.disabled = true; lbl.textContent = "Sending…";
    try {
      // bots fill every field, people never see the honeypot: pretend it worked
      if (!$("website").value) await (await import("/assets/js/enquiry.js")).sendEnquiry({ ...data, intent: M.intent, source: opts.source || location.pathname });
      saveLead({ name: data.name, email: data.email, organisation: data.organisation, role: data.role, sector: data.sector });
      if (mode === "dashboard") { opts.onDone?.(data); return; }
      form.hidden = true;
      const done = host.querySelector(".lfDone");
      done.innerHTML = `<div class="tick"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <h2>Thank you — we've got it.</h2>
        <p>Your ${mode === "message" ? "message" : "request"} has reached the FloodGuard team. We'll reply to <b>${esc(data.email)}</b>.</p>
        <div class="row"><a class="p" href="/index.html#hmap">Explore Free Data</a><a href="/products.html">See products</a></div>`;
      done.hidden = false;
      opts.onDone?.(data);
    } catch (ex) {
      err.textContent = ex.message; err.classList.add("on");
    } finally {
      go.classList.remove("loading"); go.disabled = false; lbl.textContent = M.go;
    }
  });
  return host;
}

/* ── modal ── */
let dlg = null, opener = null;
function close() {
  if (!dlg?.open) return;
  dlg.close();
}
export function openLead(opts = {}) {
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.className = "lfDlg";
    dlg.innerHTML = `<button class="lfX" type="button" aria-label="Close"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8"/></svg></button><div class="lfBody"></div>`;
    document.body.append(dlg);
    dlg.querySelector(".lfX").addEventListener("click", close);
    // a click on the backdrop lands on the dialog element itself
    dlg.addEventListener("click", e => { if (e.target === dlg) close(); });
    dlg.addEventListener("close", () => {
      document.documentElement.classList.remove("lfLock");
      opener?.focus?.();
    });
  }
  opener = document.activeElement;
  const body = dlg.querySelector(".lfBody");
  mountLead(body, {
    ...opts,
    onDone: data => {
      if (opts.mode === "dashboard") close();
      opts.onDone?.(data);
    },
  });
  const t = body.querySelector("h2");
  if (t) dlg.setAttribute("aria-labelledby", t.id);
  document.documentElement.classList.add("lfLock");
  dlg.showModal();
  body.querySelector(".lfI")?.focus();
}

/* ── links: [data-lead="demo|sales|message"] open the modal ──
   Not on the contact page itself — the form is already on screen there. */
if (!/\/contact(\.html)?$/.test(location.pathname)) {
  document.addEventListener("click", e => {
    const a = e.target.closest?.("[data-lead]");
    if (!a || e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    let q = new URLSearchParams();
    try { q = new URL(a.href, location.href).searchParams; } catch { }
    openLead({
      mode: a.dataset.lead || "demo",
      product: a.dataset.product || q.get("product") || "",
      sector: a.dataset.sector || q.get("sector") || "",
      source: location.pathname + " · " + (a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
    });
  });
}
