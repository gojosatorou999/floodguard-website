/* ── /insights: the depth deck ───────────────────────────────────
   Sticky does the stacking; this only adds depth. Each card scales down
   and dims as the cards after it arrive, so the stack reads as receding
   rather than as a pile of equal rectangles. Same effect as it had on the
   home page; short screens and reduced motion get a plain list (CSS). */
import "/assets/js/page.js";

const deck = document.getElementById("insightDeck");
const PIN = matchMedia("(min-height: 560px)");
const RM = matchMedia("(prefers-reduced-motion: reduce)");

if (deck) {
  const cards = [...deck.querySelectorAll(".deckCard")].map(card => ({
    inner: card.querySelector(".deckInner"), dim: card.querySelector(".deckDim")
  }));
  const n = cards.length;
  const clamp01 = v => Math.min(1, Math.max(0, v));
  let last = -1, raf = 0;

  function paint() {
    raf = 0;
    if (!PIN.matches || RM.matches) {
      cards.forEach(c => { c.inner.style.transform = ""; c.dim.style.opacity = 0; });
      last = -1;
      return;
    }
    const r = deck.getBoundingClientRect();
    /* progress across the whole deck, 'start start' → 'end end' */
    const p = clamp01(-r.top / Math.max(1, r.height - innerHeight));
    if (Math.abs(p - last) < .0015) return;
    last = p;
    cards.forEach((c, i) => {
      const target = 1 - (n - 1 - i) * .05;
      const t = clamp01((p - i / n) / (1 - i / n));
      c.inner.style.transform = `scale(${(1 + (target - 1) * t).toFixed(4)})`;
      c.dim.style.opacity = ((i === n - 1 ? 0 : .25) * t).toFixed(3);
    });
  }
  const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", () => { last = -1; queue(); });
  PIN.addEventListener("change", () => { last = -1; queue(); });
  RM.addEventListener("change", () => { last = -1; queue(); });
  paint();
}
