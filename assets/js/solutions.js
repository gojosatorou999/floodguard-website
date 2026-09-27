/* ── /solutions: sector maps, the shared layer map, use-case PDFs ──
   Every map value is sample data (the illustrative heuristic in
   assets/geo/india-map.json), and each panel says so. */
import "/assets/js/page.js";
import { drawIndia, addPoints, addLine, addRain, FLOOD_BANDS, RAMPS, riskClass, loadIndia, svgEl, flattenMap, FLAT } from "/assets/js/fg-map.js";

const $ = (sel, root = document) => root.querySelector(sel);
const BAND = v => (v < .34 ? "Low" : v < .64 ? "Moderate" : v < .87 ? "High" : "Very high");
const chip = (v, ramp) => `<i style="background:${ramp[riskClass(v)]}"></i>${BAND(v)}`;
// deterministic pseudo-random, so sample content is stable between visits
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const setX = (fig, key, html) => fig.querySelectorAll(`[data-x="${key}"]`).forEach(e => (e.innerHTML = html));

/* the district a lon/lat falls nearest to — good enough for sample stats */
function nearest(D, lon, lat) {
  let best = null, bd = Infinity;
  for (const d of D.districts) {
    const k = (d[5] - lon) ** 2 + (d[6] - lat) ** 2;
    if (k < bd) { bd = k; best = d; }
  }
  return best;
}
/* sample sites scattered around a few centres: [lon, lat, count, spread] */
function scatter(seed, centres) {
  const r = rng(seed), out = [];
  for (const [lon, lat, n, s] of centres)
    for (let i = 0; i < n; i++) out.push([lon + (r() - .5) * s * 2, lat + (r() - .5) * s * 1.4]);
  return out;
}
/* agricultural zones: the listed states' districts under a hatch */
function addZones(map, states, filter) {
  const id = map.uid + "h";
  const pat = svgEl("pattern", { id, width: 7, height: 7, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, map.svg.querySelector("defs"));
  svgEl("rect", { width: 7, height: 7, fill: "rgba(124,196,160,.16)" }, pat);
  svgEl("line", { x1: 0, y1: 0, x2: 0, y2: 7, stroke: "rgba(151,207,150,.55)", "stroke-width": 2 }, pat);
  const g = svgEl("g", { class: "fgZones" }, map.svg);
  for (const d of map.D.districts)
    if (states.includes(d[1]) && (!filter || filter(d))) svgEl("path", { d: d[2], class: "fgZone", fill: `url(#${id})` }, g);
  return g;
}
/* exposure concentration: one soft ring per cluster, sized by count */
function addHeat(map, clusters, unit = 1) {
  const g = svgEl("g", { class: "fgHeat" }, map.svg);
  for (const [lon, lat, n] of clusters) {
    const [x, y] = map.P(lon, lat);
    svgEl("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: (Math.sqrt(n) * 6 * unit).toFixed(1) }, g);
  }
  return g;
}
const onTop = (map, g) => map.svg.append(g);

/* ───────────────────────── map mounts ───────────────────────── */
const MOUNTS = {
  /* hero: one intelligence layer, the sectors as overlays on it */
  "sol-hero": async el => {
    // framed wider than India so the sector labels sit in open water, in view
    const m = await drawIndia(el, { theme: "dark", mode: "history", terrain: true, crop: [62.5, 6.2, 99.2, 36.8], label: "India with flood-risk zones, rivers, agricultural areas, infrastructure corridors, urban areas and sample asset points, labelled by the sectors that use them (illustrative)" });
    m.svg.querySelector(".fgRisk").style.opacity = ".8";
    addZones(m, ["Punjab", "Haryana", "Uttar Pradesh", "Bihar", "West Bengal"], d => d[7] > 50);
    addLine(m, [[77.2, 28.6], [75.8, 26.9], [72.57, 23.02], [72.83, 21.17], [72.88, 19.08]]);
    addLine(m, [[77.2, 28.6], [80.33, 26.45], [82.97, 25.32], [85.14, 25.59], [88.36, 22.57]]);
    const cities = m.D.cities.map(([, x, y, w]) => [x, y, w]);
    const cg = svgEl("g", { class: "fgMon" }, m.svg);
    cities.forEach(([x, y, w]) => svgEl("circle", { cx: x, cy: y, r: (5 + w * 7).toFixed(1) }, cg));
    addPoints(m, scatter(11, [[72.88, 19.08, 8, .6], [77.2, 28.6, 7, .6], [88.36, 22.57, 6, .5], [80.27, 13.08, 5, .5], [91.74, 26.14, 4, .5], [77.59, 12.97, 5, .5]]).map(p => [...p, 5]), "fgAsset");
    // sector overlays: anchor on the map, label out in open water / off-map
    const TAGS = [
      ["INSURANCE", [72.88, 19.08], [63.6, 15.2]],
      ["BANKING", [77.2, 28.6], [64.6, 31.4]],
      ["AGRICULTURE", [84.2, 26.4], [83.6, 32.6]],
      ["INFRASTRUCTURE", [79.09, 21.15], [83.2, 14.6]],
      ["GOVERNMENT", [91.74, 26.14], [88.6, 20.4]],
    ];
    for (const [t, a, l] of TAGS) {
      const g = svgEl("g", { class: "solTag" }, m.svg);
      const [ax, ay] = m.P(...a), [lx, ly] = m.P(...l), w = t.length * 19 + 40;
      svgEl("line", { x1: ax, y1: ay, x2: lx + w / 2, y2: ly }, g);
      svgEl("circle", { cx: ax, cy: ay, r: 7 }, g);
      svgEl("rect", { x: lx, y: ly - 24, width: w, height: 48, rx: 24 }, g);
      svgEl("text", { x: lx + 20, y: ly + 8 }, g).textContent = t;
    }
  },

  /* insurance: insured locations, exposure concentration, risk panel */
  "sol-ins": async el => {
    const m = await drawIndia(el, { theme: "dark", mode: "history", crop: [68, 15.4, 81.2, 24.9], label: "Gujarat and Maharashtra, district flood risk with sample insured locations and exposure concentration (illustrative)" });
    const C = [[72.88, 19.08, 16, .35], [73.86, 18.52, 9, .3], [72.57, 23.02, 10, .3], [72.83, 21.17, 8, .25], [79.09, 21.15, 5, .3], [73.18, 22.3, 5, .25]];
    const pts = scatter(23, C), fig = el.closest("figure");
    addHeat(m, C.map(([a, b, n]) => [a, b, n]), 1.7);
    let high = 0;
    const marked = pts.map(([lon, lat]) => { const v = nearest(m.D, lon, lat)[7] / 100; if (v >= .64) high++; return [lon, lat, 6, v >= .77 ? "hot" : ""]; });
    addPoints(m, marked, "fgAsset");
    setX(fig, "iLoc", pts.length + " sample");
    setX(fig, "iHigh", `${high} <span style="color:var(--inst-ink3);font-weight:600">(${Math.round(high / pts.length * 100)}%)</span>`);
    setX(fig, "iTop", "Mumbai metro · " + Math.round(16 / pts.length * 100) + "%");
    const d = nearest(m.D, 72.88, 19.08);
    setX(fig, "iBand", chip(d[7] / 100, RAMPS.dark));
    setX(fig, "iBars", [["Very high", "#e38c4a"], ["High", "#e0c062"], ["Moderate", "#36a6b8"], ["Low", "#175a73"]].map(([l, c]) => {
      const n = marked.filter(([lon, lat]) => BAND(nearest(m.D, lon, lat)[7] / 100) === l).length;
      return `<div><span>${l}</span><i style="width:${Math.max(3, Math.round(n / pts.length * 100))}%;background:${c}"></i></div>`;
    }).join(""));
  },

  /* banking: collateral / property points across a lending footprint */
  "sol-bank": async el => {
    const m = await drawIndia(el, { theme: "light", mode: "future", k: .11, crop: [74, 8, 80.6, 15.6], label: "Karnataka, Kerala and Tamil Nadu, projected district flood risk with sample collateral locations (illustrative)" });
    const C = [[77.59, 12.97, 12, .3], [80.27, 13.08, 10, .25], [76.27, 9.93, 8, .25], [76.96, 11.0, 6, .25], [78.12, 9.93, 5, .25], [76.64, 12.3, 4, .2], [76.94, 8.52, 5, .2]];
    const pts = scatter(41, C), fig = el.closest("figure");
    addHeat(m, C.map(([a, b, n]) => [a, b, n]), 1.1);
    const ds = new Set();
    let high = 0;
    addPoints(m, pts.map(([lon, lat]) => {
      const d = nearest(m.D, lon, lat), v = Math.min(1, d[7] / 100 + d[8] / 100 * .11);
      ds.add(d[0]); if (v >= .64) high++;
      return [lon, lat, 5, v >= .77 ? "hot" : ""];
    }), "fgAsset");
    setX(fig, "bLoc", pts.length + " sample");
    setX(fig, "bDist", String(ds.size));
    setX(fig, "bHigh", `${high} <span style="color:var(--inst-ink3);font-weight:600">(${Math.round(high / pts.length * 100)}%)</span>`);
  },

  /* agriculture: agricultural land, flood extent, historical risk */
  "sol-agri": async el => {
    const m = await drawIndia(el, { theme: "dark", mode: "history", crop: [83.2, 24.3, 89.2, 27.5], highlight: ["Khagaria"], label: "North Bihar and north Bengal, agricultural districts with a sample flood extent over historical flood risk (illustrative)" });
    m.svg.querySelector(".fgRisk").style.opacity = ".75";
    addZones(m, ["Bihar", "West Bengal", "Uttar Pradesh"]);
    addRain(m, [[86.55, 25.85, 1.15, 55, .45, -25], [85.35, 26.35, .8, 45, .6, 10], [87.55, 25.55, .85, 50, .5, 20], [85.95, 25.45, .6, 38, .7], [88.4, 26.3, .55, 40, .6]], 3, FLOOD_BANDS);
    onTop(m, m.svg.querySelector(".fgRivers"));
    onTop(m, m.svg.querySelector(".fgHi"));
    const fig = el.closest("figure"), d = m.D.districts.find(x => x[0] === "Khagaria");
    if (d) setX(fig, "gBand", chip(d[7] / 100, RAMPS.dark));
    setX(fig, "gAgri", m.D.districts.filter(x => x[1] === "Bihar").length + " districts");
    const r = rng(19), stripes = [];
    for (let yr = 1951; yr <= 2025; yr++) { const v = r() * .85 + (yr - 1951) / 74 * .2; stripes.push(v > .8 ? "#e38c4a" : v > .66 ? "#e0c062" : v > .5 ? "#36a6b8" : "#133f4f"); }
    setX(fig, "gStripes", stripes.map(c => `<i style="background:${c}"></i>`).join(""));
  },

  /* infrastructure: a corridor across present and projected risk */
  "sol-infra": async el => {
    const m = await drawIndia(el, { theme: "dark", mode: "future", k: .11, terrain: true, crop: [72.4, 18.2, 80.2, 22.3], label: "Maharashtra, a sample road corridor and rail line across projected flood risk, with sample assets along the route (illustrative)" });
    const route = [[72.95, 19.2], [73.79, 19.99], [75.34, 19.88], [76.2, 20.35], [77.75, 20.93], [79.09, 21.15]];
    addLine(m, [[72.88, 19.08], [73.86, 18.52], [75.9, 17.67]], "fgRail");
    addLine(m, [[72.88, 19.08], [72.83, 21.17]], "fgRail");
    addLine(m, route);
    // assets every so often along the route
    const assets = [];
    for (let i = 0; i < route.length - 1; i++) for (const t of [0, .5]) assets.push([route[i][0] + (route[i + 1][0] - route[i][0]) * t, route[i][1] + (route[i + 1][1] - route[i][1]) * t]);
    assets.push(route.at(-1));
    let hot = 0;
    addPoints(m, assets.map(([lon, lat]) => {
      const d = nearest(m.D, lon, lat), v = Math.min(1, d[7] / 100 + d[8] / 100 * .11);
      if (v >= .64) hot++;
      return [lon, lat, 7, v >= .64 ? "hot" : ""];
    }), "fgAsset");
    const fig = el.closest("figure");
    setX(fig, "fAssets", assets.length + " sample");
    setX(fig, "fHot", `${hot} of ${assets.length}`);
  },

  /* government: current conditions over the historical layer, alert areas */
  "sol-gov": async el => {
    const ALERT = ["Dhemaji", "Lakhimpur", "Barpeta", "Marigaon"];
    const m = await drawIndia(el, { theme: "dark", mode: "history", crop: [89.6, 24.2, 96.1, 28.1], label: "Assam, historical flood risk with sample rainfall, alert areas, monitoring points and critical infrastructure (illustrative)" });
    m.svg.querySelector(".fgRisk").style.opacity = ".6";
    addRain(m, [[94.3, 27.3, 1.1, 70, .5, -20], [91.1, 26.4, .9, 60, .55, 15], [92.4, 26.35, .7, 55, .6]], 9);
    const ag = svgEl("g", {}, m.svg);
    for (const n of ALERT) { const d = m.D.districts.find(x => x[0] === n); if (d) svgEl("path", { d: d[2], class: "fgAlertA" }, ag); }
    const crit = svgEl("g", { class: "fgCrit" }, m.svg);
    for (const [lon, lat] of [[91.74, 26.14], [94.21, 26.75], [92.8, 26.62], [90.98, 26.32], [94.9, 27.48], [93.0, 26.35]]) {
      const [x, y] = m.P(lon, lat); svgEl("rect", { x: x - 5, y: y - 5, width: 10, height: 10, rx: 1.5 }, crit);
    }
    addPoints(m, [[94.55, 27.48, 8, "alert"], [94.1, 27.25, 8, "alert"], [91.0, 26.33, 7], [92.3, 26.25, 7], [93.9, 26.75, 7]], "fgMon");
  },

  /* small covers for placeholder PDFs */
  "doc-mini": el => {
    const [w, s, e, n] = (el.dataset.crop || "").split(",").map(Number);
    return drawIndia(el, { theme: "dark", mode: el.dataset.mode || "history", graticule: false, rivers: true, crop: w ? [w, s, e, n] : undefined, label: "Map preview (illustrative)" });
  },

  /* one platform: the same map, seven layers, five sector lenses */
  "one-map": async el => {
    const m = await drawIndia(el, { theme: "dark", mode: "history", label: "India with switchable layers: flood hazard, exposure, assets, agriculture, infrastructure, climate scenario and real-time conditions (illustrative)" });
    // by index, not name: district names repeat across states (Aurangabad…)
    const hist = m.D.districts.map(d => RAMPS.dark[riskClass(d[7] / 100)]);
    const fut = m.D.districts.map(d => RAMPS.dark[riskClass(Math.min(1, d[7] / 100 + d[8] / 100 * .14))]);
    const L = { hazard: m.svg.querySelector(".fgRisk") };
    const cells = [...L.hazard.children];
    L.agriculture = addZones(m, ["Punjab", "Haryana", "Uttar Pradesh", "Bihar", "West Bengal", "Assam"], d => d[7] > 45);
    const cities = [[72.88, 19.08, 18], [77.2, 28.6, 18], [88.36, 22.57, 14], [80.27, 13.08, 12], [77.59, 12.97, 12], [78.49, 17.39, 11], [72.57, 23.02, 8], [85.14, 25.59, 7], [91.74, 26.14, 6], [85.82, 20.3, 6]];
    L.exposure = addHeat(m, cities, 2.2);
    L.assets = addPoints(m, scatter(7, cities.map(([a, b, n]) => [a, b, Math.round(n / 3), .7])).map(p => [...p, 5, ""]), "fgAsset");
    L.infrastructure = svgEl("g", {}, m.svg);
    for (const r of [[[77.2, 28.6], [75.8, 26.9], [72.57, 23.02], [72.88, 19.08]], [[77.2, 28.6], [80.33, 26.45], [82.97, 25.32], [85.14, 25.59], [88.36, 22.57]], [[72.88, 19.08], [73.86, 18.52], [78.49, 17.39], [80.27, 13.08]], [[88.36, 22.57], [85.82, 20.3], [83.3, 17.7], [80.27, 13.08], [77.59, 12.97]]])
      L.infrastructure.append(addLine(m, r));
    L.realtime = addRain(m, [[91.9, 26.3, 1, 230, .55, -15], [72.9, 19.3, 1, 170, .45, 15], [86.8, 20.2, .8, 230, .5, -40], [76.2, 10.2, .7, 160, .6]], 5);
    onTop(m, m.svg.querySelector(".fgOutline"));
    for (const k in L) L[k].classList.add("fgLayer");

    const root = el.closest(".oneMap");
    const chips = [...root.querySelectorAll("[data-layer]")], lenses = [...root.querySelectorAll("[data-lens]")];
    const on = new Set();
    const apply = () => {
      for (const k in L) L[k].classList.toggle("off", !on.has(k));
      const f = on.has("climate") ? fut : hist;
      cells.forEach((p, i) => p.setAttribute("fill", f[i]));
      chips.forEach(c => c.setAttribute("aria-pressed", String(on.has(c.dataset.layer))));
      $("[data-x=\"oneState\"]", root).textContent = [...on].length ? chips.filter(c => on.has(c.dataset.layer)).map(c => c.textContent.trim()).join(" · ") : "No layers";
      // touch devices show a flat picture of the map: redraw it once the
      // layer fade has finished (the live SVG is hidden behind it)
      if (FLAT) { clearTimeout(reflat); reflat = setTimeout(() => flattenMap(el), 80); }
    };
    let reflat = 0;
    const setLens = btn => {
      lenses.forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
      on.clear(); (btn ? btn.dataset.lens.split(" ") : Object.keys(L).concat("climate")).forEach(k => on.add(k));
      apply();
    };
    chips.forEach(c => c.addEventListener("click", () => {
      const k = c.dataset.layer; on.has(k) ? on.delete(k) : on.add(k);
      lenses.forEach(b => b.setAttribute("aria-pressed", "false"));
      apply();
    }));
    lenses.forEach(b => b.addEventListener("click", () => setLens(b.getAttribute("aria-pressed") === "true" ? null : b)));

    // scroll-triggered build-up: hazard first, then each layer joins in
    const order = ["hazard", "exposure", "assets", "agriculture", "infrastructure", "climate", "realtime"];
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) { order.forEach(k => on.add(k)); apply(); return; }
    on.add("hazard"); apply();
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      order.slice(1).forEach((k, i) => setTimeout(() => { if (!lenses.some(b => b.getAttribute("aria-pressed") === "true")) { on.add(k); apply(); } }, 450 * (i + 1)));
    }, { threshold: .45 });
    io.observe(el);
  },
};

const els = document.querySelectorAll("[data-fgmap]");
loadIndia();
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  io.unobserve(e.target);
  const el = e.target;
  Promise.resolve(MOUNTS[el.dataset.fgmap]?.(el)).then(() => flattenMap(el)).catch(err => console.warn("map", err));
}), { rootMargin: "300px 0px" });
els.forEach(el => io.observe(el));

/* ───────────────────── use-case documents ─────────────────────
   One component, reused everywhere: <article class="doc" data-pdf=…>.
   Drop the real file into public/use-cases/ under the name in data-pdf
   (and, optionally, a first-page image under data-preview) and the card
   switches itself on — no markup change needed. Until then it shows a
   clearly labelled placeholder and the buttons stay disabled: nothing
   here pretends a document exists when it doesn't. */
const dlg = document.getElementById("pdfDlg");
const frame = dlg && dlg.querySelector("iframe");

/* one request per file, however many cards point at it */
const probed = new Map();
const probe = (url, type) => {
  if (!probed.has(url)) probed.set(url, fetch(url, { method: "HEAD", cache: "no-store" })
    .then(r => r.ok && (r.headers.get("content-type") || "").includes(type))
    .catch(() => false));
  return probed.get(url);
};

function openPdf(url, title) {
  // phones and browsers without a built-in viewer get the file in a new tab
  if (!dlg || !dlg.showModal || matchMedia("(max-width: 760px)").matches || navigator.pdfViewerEnabled === false) {
    window.open(url, "_blank", "noopener"); return;
  }
  $("[data-pdf-title]", dlg).textContent = title;
  $("[data-pdf-dl]", dlg).href = url;
  $("[data-pdf-tab]", dlg).href = url;
  frame.src = url + "#view=FitH";
  dlg.showModal();
}
if (dlg) {
  dlg.addEventListener("close", () => { frame.src = "about:blank"; });
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
  $("[data-pdf-close]", dlg).addEventListener("click", () => dlg.close());
}

for (const doc of document.querySelectorAll(".doc[data-pdf]")) {
  const pdf = doc.dataset.pdf, img = doc.dataset.preview, title = $("h3", doc).textContent.trim();
  const view = $("[data-doc-view]", doc), dl = $("[data-doc-dl]", doc), prev = $(".docPrev", doc), note = $(".docNote", doc);
  const lock = () => [view, dl].forEach(b => { b.setAttribute("aria-disabled", "true"); b.removeAttribute("href"); b.tabIndex = -1; });
  lock();
  probe(pdf, "pdf").then(async ok => {
    if (!ok) return; // placeholder stays
    [view, dl].forEach(b => { b.removeAttribute("aria-disabled"); b.href = pdf; b.tabIndex = 0; });
    dl.setAttribute("download", pdf.split("/").pop());
    view.addEventListener("click", e => { e.preventDefault(); openPdf(pdf, title); });
    if (note) note.remove();
    // first-page preview: an image if one was supplied, else the PDF's own first page
    if (img && await probe(img, "image")) prev.innerHTML = `<img src="${img}" alt="First page of ${title}" loading="lazy">`;
    else if (navigator.pdfViewerEnabled !== false) prev.innerHTML = `<iframe src="${pdf}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH" title="First page of ${title}" tabindex="-1" loading="lazy"></iframe>`;
  });
}
