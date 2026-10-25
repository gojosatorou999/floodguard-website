/* ── webinar funnel · shared bits ─────────────────────────────────
   The registration URL lives in /webinar.config.json and nowhere else.
   HTML carries `href="%WEBINAR_URL%"` which vite.config.ts fills in at
   serve and build time; scripts import WEBINAR_URL from here. Every webinar
   link is marked `data-webinar`, so the funnel can be audited with
   `grep -r data-webinar`.

   Links are plain same-tab anchors: no click handlers, nothing to conflict
   with the lead modal or the nav. The sync below only repairs a link whose
   token was never replaced (a raw file opened without the dev server). */
import cfg from "/webinar.config.json";

export const WEBINAR_URL = cfg.url;
export const WEBINAR_CTA = "Reserve Your Spot";

export function syncWebinarLinks(root = document) {
  root.querySelectorAll("a[data-webinar]").forEach(a => {
    if (a.getAttribute("href") !== WEBINAR_URL) a.setAttribute("href", WEBINAR_URL);
  });
}
syncWebinarLinks();

/* every webinar link opens the registration form first; the Zoom link is
   only revealed by webinar-register.js after the row is saved. The module
   loads on first click, so pages that never click it don't pay for it. */
document.addEventListener("click", e => {
  const a = e.target.closest?.("a[data-webinar]");
  if (!a) return;
  e.preventDefault();
  const from = (a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);
  // never fall back to the Zoom link here: that would skip the registration
  import("/assets/js/webinar-register.js").then(m => m.openRegister(from)).catch(err => console.error("[webinar] registration unavailable", err));
});
