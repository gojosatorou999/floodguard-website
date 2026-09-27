/* ── static India maps for product / solution visuals ─────────────
   The homepage hero has its own interactive controller (hero-map.js);
   this is the lightweight sibling for the mock interfaces on /products
   and /solutions: one call draws India (or a cropped region of it) from
   the same assets/geo/india-map.json, in a light or dark palette, with
   optional points, corridors, rain and highlighted districts.

   All risk values come from the illustrative heuristic in the map file
   (see scripts/geo/build-india-map.mjs) — the pages label them as sample
   data, and nothing here should be read as FloodGuard model output. */
import mapUrl from "/assets/geo/india-map.json?url";

let dataP;
export const loadIndia = () => (dataP ||= fetch(mapUrl).then(r => r.json()));

const NS = "http://www.w3.org/2000/svg";
export function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.append(e);
  return e;
}

export const RAMPS = {
  // navy/deep green → water blue → cyan → restrained green → yellow → orange
  dark: ["#0f2b33", "#133f4f", "#175a73", "#1f7d98", "#36a6b8", "#7cc4a0", "#e0c062", "#e38c4a"],
  // the same story on paper: pale sea-glass up to the same warm top bands
  light: ["#e3eeee", "#cfe4e3", "#aed5d6", "#7fbcc4", "#4b9fb0", "#7fb996", "#dcb54f", "#d9803f"],
};
const BREAKS = [.18, .34, .5, .64, .77, .87, .95];
export const riskClass = v => { let i = 0; while (i < BREAKS.length && v >= BREAKS[i]) i++; return i; };

/* forward Lambert conformal conic, matching the build script */
export function projector(D) {
  const { n, F, rho0, lam0, s, tx, ty } = D.proj, R = Math.PI / 180;
  return (lon, lat) => {
    const rho = F / Math.pow(Math.tan(Math.PI / 4 + lat * R / 2), n), th = n * (lon - lam0) * R;
    return [tx + rho * Math.sin(th) * s, ty - (rho0 - rho * Math.cos(th)) * s];
  };
}

/**
 * drawIndia(host, opts) → { svg, D, P, paths }
 *  theme      "dark" | "light"
 *  mode       "history" | "future"   (future adds each district's projected change)
 *  k          future uplift (0–.3), default .11
 *  crop       [lonW, latS, lonE, latN] — zoom to a region
 *  rivers, terrain, graticule   booleans
 *  highlight  district names to outline
 *  focus      district names to keep bright; the rest are dimmed
 *  label      aria-label for the map
 */
export async function drawIndia(host, opts = {}) {
  const D = await loadIndia();
  const P = projector(D);
  const theme = opts.theme || "dark", ramp = RAMPS[theme];
  const [W, H] = D.vb;
  let vb = [0, 0, W, H];
  if (opts.crop) {
    const [w, s, e, n] = opts.crop;
    const pts = [[w, s], [e, s], [w, n], [e, n], [(w + e) / 2, n], [(w + e) / 2, s]].map(([a, b]) => P(a, b));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    vb = [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  }
  const svg = svgEl("svg", { viewBox: vb.join(" "), class: "fgMap fgMap-" + theme, role: "img", "aria-label": opts.label || "Map of India (illustrative data)", preserveAspectRatio: opts.fit || "xMidYMid meet" });
  const uid = "c" + Math.random().toString(36).slice(2, 8);
  svgEl("path", { d: D.outline }, svgEl("clipPath", { id: uid }, svgEl("defs", {}, svg)));
  if (opts.graticule !== false) svgEl("path", { class: "fgGrat", d: D.graticule }, svg);
  svgEl("path", { class: "fgLand", d: D.outline }, svg);
  const g = svgEl("g", { class: "fgRisk" }, svg);
  const k = opts.k ?? .11;
  const focus = opts.focus && new Set(opts.focus), hi = opts.highlight && new Set(opts.highlight);
  const paths = {};
  for (const d of D.districts) {
    const v = opts.mode === "future" ? Math.min(1, d[7] / 100 + d[8] / 100 * k) : d[7] / 100;
    const p = svgEl("path", { d: d[2], fill: ramp[riskClass(v)] }, g);
    if (focus && !focus.has(d[0])) p.classList.add("fgDim");
    paths[d[0]] = p;
  }
  if (opts.terrain) {
    const t = svgEl("g", { class: "fgTerrain", "clip-path": `url(#${uid})` }, svg);
    D.contours.filter(([l]) => l >= 400).forEach(([, d]) => svgEl("path", { d }, t));
  }
  if (opts.rivers !== false) {
    const r = svgEl("g", { class: "fgRivers", "clip-path": `url(#${uid})` }, svg);
    D.rivers.forEach(([rk, d]) => svgEl("path", { d, style: `stroke-width:${rk <= 3 ? 2 : rk <= 5 ? 1.5 : 1}` }, r));
  }
  svgEl("path", { class: "fgOutline", d: D.outline }, svg);
  if (hi) for (const n of hi) if (paths[n]) { const p = paths[n].cloneNode(); p.setAttribute("class", "fgHi"); p.removeAttribute("fill"); svg.append(p); }
  host.append(svg);
  return { svg, D, P, paths, vb, uid };
}

/* points / corridors in lon-lat, drawn above the map */
export function addPoints(map, pts, cls = "fgPt") {
  const g = svgEl("g", { class: cls }, map.svg);
  for (const p of pts) {
    const [x, y] = map.P(p[0], p[1]);
    svgEl("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: p[2] ?? 6, class: p[3] || "" }, g);
  }
  return g;
}
export function addLine(map, coords, cls = "fgLine") {
  const d = coords.map(([lon, lat], i) => { const [x, y] = map.P(lon, lat); return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1); }).join("");
  return svgEl("path", { d, class: cls }, map.svg);
}

/* one frame of radar-banded rainfall over storm cells given in lon-lat:
   [[lon, lat, strength, radiusKm, stretch, tiltDeg], …] — drawn into an
   <image> so it scales with the map. Pass FLOOD_BANDS to draw flood extent
   instead. Illustrative, never live. */
export const RAIN_BANDS = [[.2, [79, 182, 201, 80]], [.36, [111, 214, 224, 120]], [.56, [191, 240, 234, 150]], [.78, [233, 210, 124, 175]]];
/* the same field read as standing water — flood extent, not rainfall */
export const FLOOD_BANDS = [[.22, [58, 140, 180, 95]], [.4, [63, 166, 196, 140]], [.6, [96, 190, 214, 180]]];
export function addRain(map, cells, seed = 7, BANDS = RAIN_BANDS) {
  const [vx, vy, vw, vh] = map.vb;
  const z = map.D.vb[0] / vw; // >1 when cropped in
  const RW = Math.round(Math.min(420, 220 * Math.sqrt(z))), RH = Math.round(RW * vh / vw);
  const c = document.createElement("canvas"); c.width = RW; c.height = RH;
  const x = c.getContext("2d"), im = x.createImageData(RW, RH), px = im.data;
  const unit = map.D.proj.s / 6371; // viewBox units per km (projection runs on the unit sphere)
  const cs = cells.map(([lon, lat, a, rKm, sx = .6, deg = 0]) => {
    const [cx, cy] = map.P(lon, lat), t = deg * Math.PI / 180;
    return { cx, cy, a, r: rKm * unit, sx, c: Math.cos(t), s: Math.sin(t) };
  });
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7 + seed) * 43758.5453; return s - Math.floor(s); };
  const noise = (a, b) => {
    const i = Math.floor(a), j = Math.floor(b), fa = a - i, fb = b - j, u = fa * fa * (3 - 2 * fa), v = fb * fb * (3 - 2 * fb);
    const h00 = hash(i, j), h10 = hash(i + 1, j), h01 = hash(i, j + 1), h11 = hash(i + 1, j + 1);
    return h00 + (h10 - h00) * u + (h01 - h00) * v + (h00 - h10 - h01 + h11) * u * v;
  };
  for (let j = 0, o = 0; j < RH; j++) for (let i = 0; i < RW; i++, o += 4) {
    const X = vx + i / RW * vw, Y = vy + j / RH * vh;
    let v = 0;
    for (const q of cs) {
      const ux = X - q.cx, uy = Y - q.cy, dx = (ux * q.c + uy * q.s) * q.sx, dy = -ux * q.s + uy * q.c;
      const d2 = (dx * dx + dy * dy) / (q.r * q.r);
      if (d2 < 5) v += q.a * Math.exp(-d2);
    }
    if (v < .1) continue;
    const f = Math.sqrt(z);
    const n = noise(X * .014 * f, Y * .014 * f) * .55 + noise(X * .034 * f, Y * .034 * f) * .3 + noise(X * .08 * f, Y * .08 * f) * .15;
    v *= Math.max(0, (n - .3) / .4) * 1.35;
    let b = -1; for (let q = 0; q < BANDS.length; q++) if (v >= BANDS[q][0]) b = q;
    if (b < 0) continue;
    const [r, gg, bl, a] = BANDS[b][1]; px[o] = r; px[o + 1] = gg; px[o + 2] = bl; px[o + 3] = a;
  }
  x.putImageData(im, 0, 0);
  return svgEl("image", { href: c.toDataURL("image/png"), x: vx, y: vy, width: vw, height: vh, preserveAspectRatio: "none", class: "fgRain" }, map.svg);
}

/* ── touch devices: maps as flat pictures ──────────────────────────
   A district map is hundreds of detailed shapes. On phones and tablets
   the browser re-rasterises them tile by tile as the page scrolls, and on
   some Android GPUs that ran out of memory and painted garbage strips
   across the screen. So on touch devices each map is drawn once, on the
   CPU, into a plain image at the size it is shown, and the live SVG is
   hidden behind it. Desktop keeps the live vector map. */
export const FLAT = matchMedia("(hover: none), (pointer: coarse)").matches;
let flatCss = null;
function mapStyles() {
  if (flatCss !== null) return flatCss;
  const out = [];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch (_) { continue; }
    for (const r of rules) if (r.selectorText && /\.(fg|sol)[A-Z]/.test(r.selectorText)) out.push(r.cssText);
  }
  return (flatCss = ':root{--fS:"Nunito","Segoe UI",Roboto,system-ui,sans-serif;--fD:var(--fS);--fM:var(--fS);--E:ease}' + out.join("\n"));
}
const flatHosts = new Set();
/* host = the element the map was drawn into; call again after changing the SVG */
export async function flattenMap(host) {
  if (!FLAT || !host) return;
  const svg = host.querySelector("svg.fgMap");
  const r = host.getBoundingClientRect();
  if (!svg || r.width < 2 || r.height < 2) return;
  const seq = (host._flatSeq = (host._flatSeq || 0) + 1);
  if (svg.style.display !== "none") svg.style.visibility = "hidden";
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  const k = Math.min(1, Math.sqrt(4e6 / (W * H))); // cap at ~4 MP
  W = Math.max(1, Math.round(W * k)); H = Math.max(1, Math.round(H * k));
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", NS); clone.setAttribute("width", W); clone.setAttribute("height", H);
  clone.removeAttribute("style");
  const st = document.createElementNS(NS, "style");
  st.textContent = mapStyles();
  clone.insertBefore(st, clone.firstChild);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
  try {
    const im = new Image(); im.src = url; await im.decode();
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    // willReadFrequently keeps this canvas on the CPU rasteriser
    c.getContext("2d", { willReadFrequently: true }).drawImage(im, 0, 0, W, H);
    const blob = await new Promise(res => c.toBlob(res, "image/png"));
    if (!blob || seq !== host._flatSeq) return;
    let img = host.querySelector(":scope > img.fgFlat");
    if (!img) {
      img = document.createElement("img");
      img.className = "fgFlat"; img.decoding = "async";
      img.alt = svg.getAttribute("aria-label") || "";
      host.append(img);
    }
    const old = img.src;
    img.src = URL.createObjectURL(blob);
    await img.decode().catch(() => { });
    if (old.startsWith("blob:")) URL.revokeObjectURL(old);
    svg.style.display = "none";
    flatHosts.add(host);
  } catch (_) {
    // anything unexpected: the live SVG simply stays visible
    if (seq === host._flatSeq) svg.style.visibility = "";
  } finally { URL.revokeObjectURL(url); }
}
/* rotate a phone or tablet and the pictures are redrawn at the new size */
if (FLAT) {
  let t = 0, lastW = innerWidth;
  addEventListener("resize", () => {
    if (innerWidth === lastW) return; // URL-bar show/hide changes height only
    lastW = innerWidth;
    clearTimeout(t);
    t = setTimeout(() => flatHosts.forEach(h => {
      const s = h.querySelector("svg.fgMap"); if (s) { s.style.display = ""; s.style.visibility = "hidden"; }
      flattenMap(h);
    }), 250);
  }, { passive: true });
}
