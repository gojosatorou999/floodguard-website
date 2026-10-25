/* ── smooth scrolling, site-wide ──────────────────────────────────
   Lenis (MIT, darkroomengineering/lenis) eases mouse-wheel and trackpad
   scrolling on desktop. It scrolls the real document — no transforms, no
   fixed wrapper — so sticky / pinned sections and every existing scroll
   listener keep working unchanged.

   • Touch devices keep native momentum scrolling (syncTouch off): it is
     already smooth there and the OS handles it better than any library
   • prefers-reduced-motion: Lenis is not started at all
   • #hash links glide to their target, clear of the fixed header
   • Open dialogs (lead form, webinar) stop it; anything marked
     data-lenis-prevent (the map stage, the 3D stack) keeps its own wheel
   • The CSS `scroll-behavior: smooth` some pages set is turned off while it
     runs, so the two never fight                                           */
import Lenis from "lenis";

if (!matchMedia("(prefers-reduced-motion: reduce)").matches && !window.__lenis) {
  const style = document.createElement("style");
  style.textContent = `
    html.lenis, html.lenis body { height: auto }
    html.lenis, html.lenis.lenis-smooth { scroll-behavior: auto !important }
    html.lenis.lenis-smooth [data-lenis-prevent] { overscroll-behavior: contain }
    html.lenis.lenis-stopped { overflow: hidden }`;
  document.head.append(style);

  const root = document.documentElement;
  const headerOffset = () => -(parseInt(getComputedStyle(root).scrollPaddingTop, 10) || 0);

  const lenis = new Lenis({
    autoRaf: true,
    lerp: 0.085,              // eased, but never laggy
    wheelMultiplier: 1,
    smoothWheel: true,
    syncTouch: false,
    gestureOrientation: "vertical",
    anchors: { offset: headerOffset(), duration: 1.2 },
    // scrollable widgets and dialogs scroll natively
    prevent: node => !!node.closest?.("dialog[open], [data-lenis-prevent], .maplibregl-map, .stk"),
  });
  window.__lenis = lenis;

  /* a locked page (modal open) must not be scrolled by the wheel */
  const sync = () => {
    const locked = root.classList.contains("lfLock") || root.classList.contains("wbLock") || document.querySelector("dialog[open]");
    locked ? lenis.stop() : lenis.start();
  };
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(sync).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });

  /* images and late layout change the page height; let Lenis re-measure */
  addEventListener("load", () => lenis.resize());
}
