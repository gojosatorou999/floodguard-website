/* ── homepage hero map: India, across History · Now · Future ─────
   Draws assets/geo/india-map.json (built by scripts/geo/build-india-map.mjs)
   into the #hmap panel. Every value on it is ILLUSTRATIVE — district risk
   comes from a terrain/river/coast heuristic, the rainfall field is a
   drifting synthetic pattern — and the panel says so. The real FloodGuard
   data layer replaces `riskOf` and `rainAt` when it is wired up; nothing
   else here needs to change.

   Layers, bottom to top:
     svg.hmBase   graticule · land · hillshade · district risk · terrain · rivers
     canvas       rainfall (Now only, animated)
     svg.hmTop    outline · recorded floods · exposure · signal rings
     html         callouts, tooltip                                      */
import mapUrl from "/assets/geo/india-map.json?url";

const root = document.getElementById("hmap");
if (root) boot();

async function boot() {
  const data = await fetch(mapUrl).then(r => r.json()).catch(() => null);
  if (!data) { root.classList.add("hmFailed"); return; }
  init(data);
}

const NS = "http://www.w3.org/2000/svg";
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.append(e);
  return e;
}

/* eight classes, low → high: navy and deep green through water blue and
   cyan to a restrained green; yellow and orange only for the top bands */
const RAMP = ["#0f2b33", "#133f4f", "#175a73", "#1f7d98", "#36a6b8", "#7cc4a0", "#e0c062", "#e38c4a"];
const BREAKS = [.18, .34, .5, .64, .77, .87, .95];
const cls = v => { let i = 0; while (i < BREAKS.length && v >= BREAKS[i]) i++; return i; };
const bandName = v => (v < .34 ? "Low" : v < .64 ? "Moderate" : v < .87 ? "High" : "Very high");
const SCEN = { low: .06, mid: .11, high: .18 };

function init(D) {
  const [W, H] = D.vb;
  const stage = root.querySelector(".hmStage");
  stage.style.aspectRatio = W + " / " + H;
  const base = root.querySelector(".hmBase"), top = root.querySelector(".hmTop");
  for (const s of [base, top]) s.setAttribute("viewBox", `0 0 ${W} ${H}`);

  /* ── base ── */
  const defs = svgEl("defs", {}, base);
  svgEl("path", { d: D.outline }, svgEl("clipPath", { id: "hmClip" }, defs));
  svgEl("path", { class: "hmGrat", d: D.graticule }, base);
  svgEl("path", { class: "hmLandFill", d: D.outline }, base);
  const shade = svgEl("image", { class: "hmShade", x: 0, y: 0, width: W, height: H, preserveAspectRatio: "none", "clip-path": "url(#hmClip)" }, base);
  const riskG = svgEl("g", { class: "hmRisk" }, base);
  const paths = D.districts.map((d, i) => {
    const p = svgEl("path", { d: d[2], "data-i": i }, riskG);
    return p;
  });
  const terrG = svgEl("g", { class: "hmTerrain", "clip-path": "url(#hmClip)" }, base);
  // the lowest contour just traces the plains' edge in blobs at this grid size
  D.contours.filter(([lvl]) => lvl >= 400).forEach(([, d], i, a) => svgEl("path", { d, class: "hmCt", style: `--k:${(i + 1) / a.length}` }, terrG));
  const rivG = svgEl("g", { class: "hmRivers", "clip-path": "url(#hmClip)" }, base);
  D.rivers.forEach(([rk, d]) => svgEl("path", { d, style: `stroke-width:${rk <= 3 ? 2.2 : rk <= 5 ? 1.7 : rk <= 6 ? 1.3 : .9}` }, rivG));

  /* ── top ── */
  svgEl("path", { class: "hmOutline", d: D.outline }, top);
  const evG = svgEl("g", { class: "hmEvents" }, top);
  D.events.forEach(([, , x, y]) => { svgEl("circle", { cx: x, cy: y, r: 14, class: "hmEvHalo" }, evG); svgEl("circle", { cx: x, cy: y, r: 5.5 }, evG); });
  const expG = svgEl("g", { class: "hmExposure" }, top);
  D.cities.forEach(([, x, y, w]) => svgEl("circle", { cx: x, cy: y, r: (6 + w * 16).toFixed(1) }, expG));
  const sigG = svgEl("g", { class: "hmSignals" }, top);

  const city = Object.fromEntries(D.cities.map(([n, x, y]) => [n, [x, y]]));
  const event = Object.fromEntries(D.events.map(([n, yr, x, y]) => [n, [x, y, yr]]));

  /* ── state ── */
  let mode = "now", scenario = "mid";
  const layers = { risk: true, terrain: true, exposure: false, rain: true, history: true };
  const riskOf = (d, m) => {
    const h = d[7] / 100;
    return m === "future" ? Math.min(1, h + d[8] / 100 * SCEN[scenario]) : h;
  };

  function recolor() {
    D.districts.forEach((d, i) => { paths[i].style.fill = RAMP[cls(riskOf(d, mode))]; });
  }

  /* ── callouts: visual examples only, no values ── */
  const CALLOUTS = {
    history: [["Mumbai", event["Mumbai"], "Recorded flood · 2005"], ["Chennai", event["Chennai"], "Recorded flood · 2015"], ["Kerala", event["Kerala"], "Recorded floods · 2018"]],
    now: [["Hyderabad", city["Hyderabad"], "Heavy rainfall"], ["Mumbai", city["Mumbai"], "Flood risk"], ["Delhi", city["Delhi"], "Moderate rainfall"]],
    future: [["Brahmaputra valley", city["Guwahati"], "Higher projected risk"], ["Kolkata", city["Kolkata"], "Coastal risk rising"], ["Chennai", city["Chennai"], "Coastal risk rising"]],
  };
  const coBox = root.querySelector(".hmCallouts");
  function callouts() {
    coBox.replaceChildren();
    sigG.replaceChildren();
    for (const [name, [x, y], note] of CALLOUTS[mode]) {
      const c = document.createElement("div");
      c.className = "hmCo" + (x > W * .58 ? " l" : "");
      c.style.left = (x / W * 100) + "%"; c.style.top = (y / H * 100) + "%";
      const b = document.createElement("b"); b.textContent = name;
      const s = document.createElement("span"); s.textContent = note;
      const t = document.createElement("div"); t.className = "hmCoT"; t.append(b, s);
      c.append(document.createElement("i"), t);
      coBox.append(c);
      if (mode === "now") svgEl("circle", { cx: x, cy: y, r: 10, class: "hmRing" }, sigG);
    }
  }

  /* ── controls ── */
  const modeBtns = [...root.querySelectorAll("[data-hm-set]")];
  const layerBtns = [...root.querySelectorAll("[data-hm-layer]")];
  const echo = [...document.querySelectorAll("[data-hm-echo]")]; // headline words + micro labels outside the panel
  const scenBtns = [...root.querySelectorAll("[data-hm-scen]")];

  function setMode(m) {
    mode = m;
    root.dataset.mode = m;
    modeBtns.forEach(b => b.setAttribute("aria-checked", String(b.dataset.hmSet === m)));
    modeBtns.forEach(b => (b.tabIndex = b.dataset.hmSet === m ? 0 : -1));
    echo.forEach(e => e.classList.toggle("on", e.dataset.hmEcho === m));
    syncLayers();
    recolor();
    callouts();
    kickRain();
  }
  function syncLayers() {
    const on = {
      risk: layers.risk, terrain: layers.terrain, exposure: layers.exposure,
      rain: mode === "now" && layers.rain, history: mode === "history" && layers.history, scenario: mode === "future",
    };
    layerBtns.forEach(b => b.setAttribute("aria-pressed", String(!!on[b.dataset.hmLayer])));
    for (const k in on) root.classList.toggle("hm-" + k, !!on[k]);
  }
  modeBtns.forEach(b => b.addEventListener("click", () => setMode(b.dataset.hmSet)));
  // radiogroup keys: arrows move and select
  root.querySelector(".hmSeg").addEventListener("keydown", e => {
    const i = modeBtns.findIndex(b => b.dataset.hmSet === mode);
    const k = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!k) return;
    e.preventDefault();
    const nb = modeBtns[(i + k + modeBtns.length) % modeBtns.length];
    setMode(nb.dataset.hmSet); nb.focus();
  });
  echo.forEach(e => e.tagName === "BUTTON" && e.addEventListener("click", () => setMode(e.dataset.hmEcho)));
  layerBtns.forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.hmLayer;
    // the three time layers belong to a mode: switch to it, or toggle it there
    const owner = { rain: "now", history: "history", scenario: "future" }[k];
    if (owner && mode !== owner) { if (k !== "scenario") layers[k] = true; setMode(owner); return; }
    if (k === "scenario") return;
    layers[k] = !layers[k];
    syncLayers();
    kickRain();
  }));
  scenBtns.forEach(b => b.addEventListener("click", () => {
    scenario = b.dataset.hmScen;
    scenBtns.forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    recolor();
  }));

  /* ── tooltip + click through to the (sign-in gated) district page ── */
  const tip = root.querySelector(".hmTip");
  const slug = n => n.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const hrefOf = d => "district.html?place=" + encodeURIComponent(slug(d[0])) + "&name=" + encodeURIComponent(d[0]) +
    "&state=" + encodeURIComponent(d[1]) + "&idx=" + riskOf(d, "history").toFixed(3) + "&lat=" + d[6].toFixed(2) + "&lon=" + d[5].toFixed(2);
  let hot = null;
  riskG.addEventListener("pointermove", e => {
    const p = e.target.closest("path"); if (!p) return;
    if (hot !== p) {
      hot?.classList.remove("hot"); hot = p; p.classList.add("hot");
      riskG.append(p); // lift the outline above its neighbours
      const d = D.districts[+p.dataset.i], v = riskOf(d, mode);
      tip.querySelector("b").textContent = d[0];
      tip.querySelector(".s").textContent = d[1];
      tip.querySelector(".r").textContent = bandName(v) + (mode === "future" ? " projected risk" : " flood risk") + " · illustrative";
      tip.querySelector(".r").style.setProperty("--c", RAMP[cls(v)]);
    }
    const r = stage.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    tip.style.transform = `translate(${Math.min(x + 14, r.width - 190)}px, ${Math.max(8, y - 64)}px)`;
    tip.hidden = false;
  });
  riskG.addEventListener("pointerleave", () => { hot?.classList.remove("hot"); hot = null; tip.hidden = true; });
  riskG.addEventListener("click", e => {
    const p = e.target.closest("path"); if (!p) return;
    location.href = hrefOf(D.districts[+p.dataset.i]);
  });

  /* ── hillshade, drawn once from the elevation grid when the page is idle ── */
  (window.requestIdleCallback || (f => setTimeout(f, 200)))(() => { shade.setAttribute("href", hillshade(D)); root.classList.add("hmShaded"); });

  /* ── rainfall: a few slow storm cells over real places, radar-banded ── */
  const rc = root.querySelector(".hmRain"), rx = rc.getContext("2d");
  const RW = 240, RH = Math.round(240 * H / W);
  rc.width = RW; rc.height = RH;
  const img = rx.createImageData(RW, RH);
  // storm cells: [place, strength, radius, offset x/y, stretch, tilt°]
  const cell = (n, a, r, ox = 0, oy = 0, sx = 1, deg = 0) => ({ x: city[n][0] + ox, y: city[n][1] + oy, a, r, sx, c: Math.cos(deg * Math.PI / 180), s: Math.sin(deg * Math.PI / 180), ph: n.length });
  const CELLS = [
    cell("Hyderabad", 1.25, 62, 0, 0, .7, -30), cell("Mumbai", 1.05, 58, -14, 26, .45, 15), cell("Pune", .55, 46, 0, 36, .6),
    cell("Delhi", .8, 50, 0, 0, .65, -20), cell("Guwahati", .95, 78, 12, 18, .55, -15), cell("Kochi", .7, 50, -16, 0, .5, 20),
    cell("Bhubaneswar", .85, 70, 90, 60, .5, -40), cell("Kolkata", .55, 52, 20, 10, .6, -30),
  ];
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  // radar bands: light → heavy
  const BANDS = [[.2, [79, 182, 201, 70]], [.36, [111, 214, 224, 110]], [.56, [191, 240, 234, 140]], [.78, [233, 210, 124, 165]]];
  function rainFrame(t) {
    const px = img.data, sx = W / RW, sy = H / RH;
    const cs = CELLS.map(c => ({ ...c, cx: c.x + Math.sin(t * .05 + c.ph) * 16 + Math.sin(t * .021) * 10, cy: c.y + Math.cos(t * .043 + c.ph) * 11 }));
    for (let j = 0, o = 0; j < RH; j++) {
      const Y = j * sy;
      for (let i = 0; i < RW; i++, o += 4) {
        const X = i * sx;
        let v = 0;
        for (const c of cs) {
          const ux = X - c.cx, uy = Y - c.cy;
          const dx = (ux * c.c + uy * c.s) * c.sx, dy = -ux * c.s + uy * c.c, d2 = (dx * dx + dy * dy) / (c.r * c.r);
          if (d2 < 5) v += c.a * Math.exp(-d2);
        }
        if (v < .1) { px[o + 3] = 0; continue; }
        // three octaves of drifting noise break each cell into ragged echoes
        const n = noise(X * .014 + t * .035, Y * .014 - t * .012) * .55 + noise(X * .034 - t * .02, Y * .034 + t * .01) * .3 + noise(X * .08, Y * .08 - t * .03) * .15;
        v *= Math.max(0, (n - .3) / .4) * 1.35;
        let k = -1; for (let b = 0; b < BANDS.length; b++) if (v >= BANDS[b][0]) k = b;
        if (k < 0) { px[o + 3] = 0; continue; }
        const [r, g, bl, a] = BANDS[k][1];
        px[o] = r; px[o + 1] = g; px[o + 2] = bl; px[o + 3] = a;
      }
    }
    rx.putImageData(img, 0, 0);
  }
  let visible = true, raf = 0, last = 0, t0 = performance.now() / 1000;
  function loop(now) {
    raf = 0;
    if (!(mode === "now" && layers.rain && visible && !document.hidden)) return;
    if (now - last > 83) { last = now; rainFrame(now / 1000 - t0 + 40); } // ~12 fps is plenty for weather
    raf = requestAnimationFrame(loop);
  }
  function kickRain() {
    if (mode !== "now" || !layers.rain) return;
    if (RM) { rainFrame(40); return; }
    if (!raf) raf = requestAnimationFrame(loop);
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kickRain(); }).observe(root);
  document.addEventListener("visibilitychange", kickRain);

  root.querySelector(".hmCredit").textContent = D.credit;
  setMode("now");
  root.classList.add("hmReady");
}

/* soft relief from the √-coded ETOPO1 grid: inverse-project each pixel,
   light from the north-west, keep only the light and shade (flat = clear) */
function hillshade(D) {
  const [W, H] = D.vb, { n, F, rho0, lam0, s, tx, ty } = D.proj, g = D.dem;
  const bin = atob(g.q), Z = new Float32Array(bin.length);
  for (let i = 0; i < bin.length; i++) { const q = bin.charCodeAt(i) / 255; Z[i] = q * q * g.zmax; }
  const at = (lon, lat) => {
    const fx = (lon - g.lon0) / g.step, fy = (lat - g.lat0) / g.step;
    const ix = Math.max(0, Math.min(g.nx - 2, Math.floor(fx))), iy = Math.max(0, Math.min(g.ny - 2, Math.floor(fy)));
    const ax = Math.min(1, Math.max(0, fx - ix)), ay = Math.min(1, Math.max(0, fy - iy)), k = iy * g.nx + ix;
    return (Z[k] * (1 - ax) + Z[k + 1] * ax) * (1 - ay) + (Z[k + g.nx] * (1 - ax) + Z[k + g.nx + 1] * ax) * ay;
  };
  const cw = 420, ch = Math.round(420 * H / W);
  const c = document.createElement("canvas"); c.width = cw; c.height = ch;
  const x = c.getContext("2d"), im = x.createImageData(cw, ch), p = im.data;
  const d = g.step * .6, R = Math.PI / 180;
  const az = 315 * R, alt = 42 * R, Zf = 3.2; // exaggerated: the grid is coarse
  for (let j = 0, o = 0; j < ch; j++) for (let i = 0; i < cw; i++, o += 4) {
    const X = (i + .5) / cw * W, Y = (j + .5) / ch * H;
    const px = (X - tx) / s, py = (ty - Y) / s;
    const rho = Math.sign(n) * Math.hypot(px, rho0 - py), th = Math.atan2(px, rho0 - py);
    const lat = (2 * Math.atan(Math.pow(F / rho, 1 / n)) - Math.PI / 2) / R, lon = lam0 + th / n / R;
    const kx = 111.3 * Math.cos(lat * R) * 1000 * d * 2, ky = 110.6 * 1000 * d * 2;
    const dzdx = (at(lon + d, lat) - at(lon - d, lat)) / kx * Zf, dzdy = (at(lon, lat + d) - at(lon, lat - d)) / ky * Zf;
    // surface normal (x east, y north, z up) against a light from the NW
    const nl = Math.hypot(dzdx, dzdy, 1);
    const sh = (-dzdx * Math.cos(alt) * Math.sin(az) - dzdy * Math.cos(alt) * Math.cos(az) + Math.sin(alt)) / nl;
    const v = sh - Math.sin(alt); // 0 on flat ground
    if (v > 0) { p[o] = 214; p[o + 1] = 238; p[o + 2] = 232; p[o + 3] = Math.min(150, v * 520); }
    else { p[o] = 2; p[o + 1] = 12; p[o + 2] = 18; p[o + 3] = Math.min(190, -v * 640); }
  }
  x.putImageData(im, 0, 0);
  return c.toDataURL("image/png");
}
