/* ── first-visit webinar invitation (homepage only) ───────────────
   A native <dialog> — the same approach as the lead form in lead.js — so
   focus trapping, Escape, and the top layer come from the browser.

   • appears ~2.6 s after the page has loaded, once per browsing session
     (sessionStorage; the key is written the moment it is shown, so a
     dismissed popup never comes back until a new session)
   • never over another open dialog, and never while the tab is hidden
   • closes on ×, "Maybe later", Escape or a click on the backdrop; focus
     returns to whatever had it
   • the page behind is locked while it is open, without a scrollbar jump
   The banner stays on the page whatever happens here.                      */
import { WEBINAR_URL } from "/assets/js/webinar.js";

const KEY = "fg_webinar_invite";
const DELAY = 2600;
let seen = false;
try { seen = sessionStorage.getItem(KEY) === "1"; } catch (_) { /* storage blocked: fall back to once per page view */ }

const ARROW = '<svg class="ar" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4"/></svg>';

function build() {
  const d = document.createElement("dialog");
  d.className = "wbDlg wbPop";
  d.setAttribute("aria-labelledby", "wbT");
  d.setAttribute("aria-describedby", "wbD");
  d.innerHTML = `
    <button class="wbX" type="button" aria-label="Close"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8"/></svg></button>
    <div class="wbBody">
      <p class="wbEye"><i class="wbLive" aria-hidden="true"></i>Exclusive invitation for pilot partners</p>
      <h2 id="wbT">Get a closer look at what we’re building</h2>
      <p id="wbD">Join our webinar to understand our solution, see how it works, and learn how you can participate as a pilot.</p>
      <div class="wbAct">
        <a class="wbGo" href="${WEBINAR_URL}" data-webinar>Reserve Your Spot ${ARROW}</a>
        <button class="wbLater" type="button">Maybe later</button>
      </div>
    </div>`;
  return d;
}

function show() {
  if (seen || document.querySelector("dialog[open]")) return;
  if (document.hidden) { document.addEventListener("visibilitychange", () => { if (!document.hidden) show(); }, { once: true }); return; }
  seen = true;
  try { sessionStorage.setItem(KEY, "1"); } catch (_) { }

  const dlg = build(), opener = document.activeElement;
  document.body.append(dlg);
  const root = document.documentElement;
  const close = () => dlg.open && dlg.close();
  dlg.querySelector(".wbX").addEventListener("click", close);
  dlg.querySelector(".wbLater").addEventListener("click", close);
  dlg.addEventListener("click", e => { if (e.target === dlg) close(); });      // a backdrop click lands on the dialog itself
  dlg.addEventListener("close", () => {
    root.classList.remove("wbLock"); root.style.removeProperty("--wbSb");
    dlg.remove();
    if (opener && opener !== document.body && document.contains(opener)) opener.focus?.();
  });
  root.style.setProperty("--wbSb", Math.max(0, innerWidth - root.clientWidth) + "px");
  root.classList.add("wbLock");
  dlg.showModal();
  dlg.querySelector(".wbGo").focus();
}

if (!seen) {
  const arm = () => setTimeout(show, DELAY);
  if (document.readyState === "complete") arm(); else addEventListener("load", arm, { once: true });
}
