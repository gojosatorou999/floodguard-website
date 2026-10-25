/* ── shared behaviour for the content pages ──────────────────────
   Reveal-on-scroll, the sticky secondary nav's active state, and the
   footer year. Imported by products.js, solutions.js and contact.js. */
import "/assets/js/webinar.js";
import "/assets/js/smooth-scroll.js";
const y = document.getElementById("fgYear");
if (y) y.textContent = new Date().getFullYear();

const reveal = document.querySelectorAll("[data-reveal]");
if ("IntersectionObserver" in window) {
  const left = new Set(reveal);
  const show = el => { el.classList.add("in"); io.unobserve(el); left.delete(el); };
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) show(e.target); }),
    { threshold: .12, rootMargin: "0px 0px -6% 0px" });
  reveal.forEach(el => io.observe(el));
  /* a fast fling (iOS momentum scroll especially) can carry a short element
     from below the screen to above it between two observer checks — it never
     "intersects", and would stay invisible. Anything the reader has scrolled
     past is shown, whatever the observer saw. */
  let queued = false;
  addEventListener("scroll", () => {
    if (queued || !left.size) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      for (const el of left) if (el.getBoundingClientRect().top < innerHeight * .94) show(el);
    });
  }, { passive: true });
} else reveal.forEach(el => el.classList.add("in"));

/* a jump to a section (sub-nav, in-page link, or a #hash from another page)
   lands on it finished: its content is shown at once, without the fade-in */
function revealNow(target) {
  const sec = target.closest("section") || target;
  sec.classList.add("rvNow");
  sec.querySelectorAll("[data-reveal]").forEach(el => el.classList.add("in"));
  clearTimeout(sec._rvT);
  sec._rvT = setTimeout(() => sec.classList.remove("rvNow"), 2500);
}
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute("href").length < 2) return;
  try { const t = document.querySelector(a.getAttribute("href")); if (t) revealNow(t); } catch (_) { }
});
if (location.hash.length > 1) {
  try { const t = document.querySelector(decodeURIComponent(location.hash)); if (t) revealNow(t); } catch (_) { }
}

/* the secondary nav marks the section currently under the header */
const sub = document.querySelector(".subnav");
if (sub) {
  const links = [...sub.querySelectorAll('a[href^="#"]')];
  const secs = links.map(a => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  let cur = null;
  const mark = () => {
    const line = 170;
    let best = null;
    for (const s of secs) if (s.getBoundingClientRect().top <= line) best = s;
    if (best === cur) return;
    cur = best;
    links.forEach(a => a.setAttribute("aria-current", String(!!best && a.getAttribute("href") === "#" + best.id)));
    const on = links.find(a => a.getAttribute("aria-current") === "true");
    if (on && sub.scrollWidth > sub.clientWidth) sub.scrollTo({ left: on.offsetLeft - 16, behavior: "smooth" });
  };
  addEventListener("scroll", mark, { passive: true });
  mark();
}
