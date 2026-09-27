/* ── shared behaviour for the content pages ──────────────────────
   Reveal-on-scroll, the sticky secondary nav's active state, and the
   footer year. Imported by products.js, solutions.js and contact.js. */
const y = document.getElementById("fgYear");
if (y) y.textContent = new Date().getFullYear();

const reveal = document.querySelectorAll("[data-reveal]");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { threshold: .12, rootMargin: "0px 0px -6% 0px" });
  reveal.forEach(el => io.observe(el));
} else reveal.forEach(el => el.classList.add("in"));

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
