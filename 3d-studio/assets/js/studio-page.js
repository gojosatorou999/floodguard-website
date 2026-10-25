/* ── /studio entry ────────────────────────────────────────────────
   Keeps the first paint light: the studio's libraries (MapLibre, deck.gl,
   Three.js — several hundred KB) are only fetched once the section nears
   the viewport, and only if the browser can create a WebGL2 context.
   Anything that fails falls back to the site's flat SVG map.            */
const root = document.getElementById("studio");

function webgl2() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2")); } catch (_) { return false; }
}

async function fallback(why) {
  const box = document.getElementById("stuFail"); if (!box) return;
  box.hidden = false;
  box.innerHTML = `<div class="msg"><b>The 3D view isn't available.</b> ${why} Here is the flat district map instead; the layer data below still applies.</div>`;
  try {
    const { drawIndia } = await import("/assets/js/fg-map.js");
    await drawIndia(box, { theme: "dark", mode: "history", terrain: true, label: "India with illustrative historical flood-risk by district" });
  } catch (_) { /* the message alone is fine */ }
  document.getElementById("stuLayers")?.closest("aside")?.setAttribute("hidden", "");
}

if (root) {
  const start = async () => {
    if (!webgl2()) { fallback("This browser or device has no WebGL 2 support."); return; }
    try {
      const { bootStudio } = await import("/assets/js/studio/studio.js");
      const api = await bootStudio(root, { onFail: why => fallback(why) });
      window.__studio = api;
      const q = new URLSearchParams(location.search).get("region");
      const first = q || "konkan";
      const go = () => api.selectRegion(first);
      // fly in once the studio is properly on screen; honour a deep link at once
      if (q) go();
      else {
        const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); setTimeout(go, 700); } }, { threshold: 0.45 });
        io.observe(document.getElementById("stuStage"));
      }
      import("/assets/js/studio/stack3d.js").then(m => m.bootStack(api)).catch(e => { console.warn("[studio] stack", e); const f = document.getElementById("stkFail"); if (f) f.hidden = false; });
    } catch (e) {
      console.error("[studio]", e);
      fallback("Something went wrong starting the 3D engine.");
    }
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); start(); } }, { rootMargin: "400px 0px" });
    io.observe(root);
  } else start();
}
