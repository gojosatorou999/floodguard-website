/* Back to top for the content pages — the same control as the home page:
   bottom right, appears once you have scrolled most of a screen, and a ring
   around it fills with how far down the page you are. */
const btn = document.createElement("button");
btn.type = "button";
btn.className = "toTop";
btn.setAttribute("aria-label", "Back to top");
btn.title = "Back to top";
btn.innerHTML =
  '<svg class="ring" viewBox="0 0 44 44" aria-hidden="true"><circle class="ringBg" cx="22" cy="22" r="20"/><circle class="ringFg" cx="22" cy="22" r="20"/></svg>' +
  '<svg class="arw" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 11l6-6 6 6"/></svg>';
document.body.appendChild(btn);

const ring = btn.querySelector(".ringFg");
const RING_C = 125.66; /* 2πr, r=20 */
let on = null, raf = 0;
function update() {
  raf = 0;
  const y = scrollY, vh = innerHeight;
  const show = y > vh * .7;
  if (show !== on) { on = show; btn.classList.toggle("on", show); }
  const max = Math.max(1, document.documentElement.scrollHeight - vh);
  ring.style.strokeDashoffset = (RING_C * (1 - Math.min(1, y / max))).toFixed(2);
}
const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
addEventListener("scroll", queue, { passive: true });
addEventListener("resize", queue);
update();

btn.addEventListener("click", () => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
});
