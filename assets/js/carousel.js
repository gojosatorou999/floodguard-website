/* ── carousel: a scroll-snap track around existing cards ──────────
   Usage: <div data-carousel> …cards… </div>
   The cards' markup is not touched. The element is wrapped, given a scroll
   track, and gets a control row (prev · next) and a pagination
   pill below it. Works at every width: two cards and a peek on desktop, one
   and a peek on phones.

   • Native scroll-snap does the moving and the touch / trackpad work; a mouse
     can also grab and drag the track, and ← → move it while it has focus
   • Prev / next scroll by one card plus the gap; past the last card it
     loops to the first
   • Autoplay advances every 4 s. It pauses on mouse hover, focus, touch and
     while the user is scrolling, resumes when they stop, and is off
     entirely when reduced motion is requested.     */

const INTERVAL = 4000;
const RM = matchMedia("(prefers-reduced-motion: reduce)");

const I = {
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 6l6 6-6 6"/></svg>',
};

export function initCarousel(root) {
  if (root.dataset.carInit) return;
  const cards = [...root.children].filter(el => el.nodeType === 1 && el.tagName !== "NOSCRIPT");
  if (cards.length < 2) return;
  root.dataset.carInit = "1";

  /* wrap: the track keeps the original element (and its cards) as they are */
  const wrap = document.createElement("div");
  wrap.className = "carWrap";
  root.before(wrap);
  wrap.append(root);
  root.classList.add("carTrack");
  root.setAttribute("tabindex", "0");
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", root.dataset.label || "Cards");
  // scroll-reveal must not keep a card hidden just because it is off to the side
  cards.forEach(c => c.classList.add("in"));

  const ctl = document.createElement("div");
  ctl.className = "carCtl";
  ctl.innerHTML = `
    <button type="button" class="carBtn" data-dir="-1" aria-label="Previous card">${I.prev}</button>
    <button type="button" class="carBtn" data-dir="1" aria-label="Next card">${I.next}</button>`;
  const pill = document.createElement("div");
  pill.className = "carPill";
  pill.setAttribute("role", "group");
  pill.setAttribute("aria-label", "Choose a card");
  wrap.append(ctl, pill);

  let playing = true, inView = false, hovered = false, focused = false, scrolling = false, timer = 0, idleT = 0, active = -1;
  let dots = [], positions = [0];

  /* the reachable scroll offsets: one per card, except that the last cards
     cannot go past the end of the track — on desktop (two cards in view) that
     means fewer stops than cards, and the dots show exactly those stops */
  const measure = () => {
    // distance from the screen edge to the page margin: the track bleeds out by this much
    root.style.setProperty("--carGut", Math.max(0, Math.round(wrap.getBoundingClientRect().left)) + "px");
    const max = Math.max(0, root.scrollWidth - root.clientWidth), base = cards[0].offsetLeft;
    const p = [];
    for (const c of cards) { const x = Math.min(c.offsetLeft - base, max); if (!p.length || x - p[p.length - 1] > 4) p.push(x); }
    positions = p;
    if (dots.length !== p.length) {
      pill.innerHTML = p.map((_, i) => `<button type="button" class="carDot" aria-label="Show cards, page ${i + 1} of ${p.length}"></button>`).join("");
      dots = [...pill.children];
      dots.forEach((d, k) => d.addEventListener("click", () => { go(k); schedule(); }));
      active = -1; setActive(indexFromScroll());
    }
    pill.hidden = ctl.hidden = p.length < 2;
  };
  const go = i => {
    const n = positions.length, target = ((i % n) + n) % n;
    root.scrollTo({ left: positions[target], behavior: RM.matches ? "auto" : "smooth" });
  };
  const setActive = i => {
    if (i === active) return;
    active = i;
    dots.forEach((d, k) => d.setAttribute("aria-current", String(k === i)));
  };
  const indexFromScroll = () => {
    let best = 0, bd = Infinity;
    positions.forEach((x, k) => { const d = Math.abs(x - root.scrollLeft); if (d < bd) { bd = d; best = k; } });
    return best;
  };

  /* autoplay */
  const canPlay = () => playing && inView && !hovered && !focused && !scrolling && !RM.matches && !document.hidden;
  const schedule = () => {
    clearTimeout(timer);
    if (!canPlay()) return;
    timer = setTimeout(() => {
      const cur = indexFromScroll();
      go(cur + 1);            // past the last card, go() wraps to the first
      schedule();
    }, INTERVAL);
  };
  const setPlaying = on => {
    playing = on;
    schedule();
  };

  /* events */
  ctl.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    go(indexFromScroll() + Number(b.dataset.dir));
    schedule();
  });

  wrap.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") { hovered = true; schedule(); } });
  wrap.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") { hovered = false; schedule(); } });
  // belt and braces: if a pointerleave is ever missed, any mouse move outside the carousel clears the hover
  addEventListener("pointermove", e => { if (hovered && e.pointerType === "mouse" && !wrap.contains(e.target)) { hovered = false; schedule(); } }, { passive: true });
  // only keyboard focus pauses it: a mouse click on Play/Next would otherwise leave it paused for good
  wrap.addEventListener("focusin", e => { focused = !!e.target.matches?.(":focus-visible"); schedule(); });
  wrap.addEventListener("focusout", e => { if (!wrap.contains(e.relatedTarget)) { focused = false; schedule(); } });

  /* the user touching or dragging the track pauses it until they settle */
  const userScroll = () => {
    scrolling = true; clearTimeout(timer);
    clearTimeout(idleT);
    idleT = setTimeout(() => { scrolling = false; schedule(); }, 900);
  };
  root.addEventListener("pointerdown", userScroll, { passive: true });
  root.addEventListener("touchstart", userScroll, { passive: true });

  let raf = 0;
  root.addEventListener("scroll", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => setActive(indexFromScroll()));
  }, { passive: true });
  root.addEventListener("scrollend", () => { scrolling = false; schedule(); });

  /* mouse: grab and drag. Snapping is off while dragging, then the nearest card is settled on */
  let drag = null, moved = 0;
  root.addEventListener("pointerdown", e => {
    if (e.pointerType !== "mouse" || e.button !== 0 || e.target.closest("button, input, select, textarea")) return;
    drag = { x: e.clientX, left: root.scrollLeft }; moved = 0;
    root.classList.add("grab");
  });
  addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    moved = Math.max(moved, Math.abs(dx));
    if (moved > 4) { root.classList.add("dragging"); root.scrollLeft = drag.left - dx; }
  });
  addEventListener("pointerup", () => {
    if (!drag) return;
    const was = moved > 4;
    drag = null;
    if (was) { swallow = true; setTimeout(() => (swallow = false), 0); }
    root.classList.remove("grab", "dragging");
    if (was) { go(indexFromScroll()); schedule(); }
  });
  root.addEventListener("dragstart", e => e.preventDefault());
  // a drag that starts on a linked card must not also follow the link
  let swallow = false;
  root.addEventListener("click", e => { if (swallow) { e.preventDefault(); e.stopPropagation(); } }, true);
  root.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(indexFromScroll() + 1); schedule(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(indexFromScroll() - 1); schedule(); }
  });

  /* it only plays while it is on screen, and always starts from the first card:
     a reader who has not reached it yet must not find it already moved on */
  let seen = false;
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (inView && !seen) { seen = true; root.scrollTo({ left: 0, behavior: "auto" }); setActive(0); }
    schedule();
  }, { threshold: 0.45 }).observe(wrap);

  /* a card that is partly on screen counts as the active one */
  measure();
  root.scrollLeft = 0;
  new ResizeObserver(measure).observe(wrap);
  addEventListener("load", measure);
  setPlaying(!RM.matches);
  document.addEventListener("visibilitychange", schedule);
}

document.querySelectorAll("[data-carousel]").forEach(initCarousel);
