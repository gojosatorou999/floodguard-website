/* ── /insights: the deck ─────────────────────────────────────────
   A stack that advances on a button, not on scroll — scrolling passes
   straight by. "Next card" deals the next card onto the stack; the cards
   beneath step back and dim, as they did when the stack was scroll-driven.
   Only the top card is interactive; the ones under it and the ones still
   to come are inert. */
import "/assets/js/page.js";

const deck = document.getElementById("insightDeck");
const nav = document.getElementById("deckNav");

if (deck && nav) {
  const cards = [...deck.querySelectorAll(".deckCard")].map(el => ({
    el, inner: el.querySelector(".deckInner"), dim: el.querySelector(".deckDim")
  }));
  const n = cards.length;
  const prev = nav.querySelector('[data-dir="-1"]'), next = nav.querySelector('[data-dir="1"]');
  const count = document.getElementById("deckCount");
  let cur = 0;

  function show(i) {
    cur = Math.max(0, Math.min(n - 1, i));
    cards.forEach((c, k) => {
      const dealt = k <= cur;
      c.el.dataset.state = dealt ? "in" : "ahead";
      c.el.inert = k !== cur;
      /* the veil scales with its card, so it never shows past the card's edges */
      const scale = dealt ? `scale(${(1 - (cur - k) * .05).toFixed(3)})` : "";
      c.inner.style.transform = c.dim.style.transform = scale;
      c.dim.style.opacity = k < cur ? .25 : 0;
    });
    prev.disabled = cur === 0;
    next.querySelector("span").textContent = cur === n - 1 ? "Back to first" : "Next card";
    count.textContent = `${cur + 1} / ${n}`;
  }

  prev.addEventListener("click", () => show(cur - 1));
  next.addEventListener("click", () => show(cur === n - 1 ? 0 : cur + 1));
  /* a jump to a card (e.g. /insights#ins-data-stories) deals up to it */
  const fromHash = () => {
    const k = cards.findIndex(c => c.el.id && "#" + c.el.id === location.hash);
    if (k >= 0) { show(k); deck.scrollIntoView({ block: "center" }); }
  };
  addEventListener("hashchange", fromHash);
  show(0);
  fromHash();
}
