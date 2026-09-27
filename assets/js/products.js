/* ── /products: mounts the mock-interface maps ───────────────────
   Every value drawn here is sample data, and each panel says so. */
import "/assets/js/page.js";
import { drawIndia, addPoints, addRain, RAMPS, riskClass, loadIndia, flattenMap } from "/assets/js/fg-map.js";

const BAND = v => (v < .34 ? "Low" : v < .64 ? "Moderate" : v < .87 ? "High" : "Very high");
const chip = (v, ramp) => `<i style="background:${ramp[riskClass(v)]}"></i>${BAND(v)}`;
const $ = (sel, root = document) => root.querySelector(sel);
const fill = (el, ramp) => { if (el) el.innerHTML = ramp.map(c => `<i style="background:${c}"></i>`).join(""); };

// deterministic pseudo-random, so sample content is stable between visits
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const MOUNTS = {
  "explorer-mini": el => drawIndia(el, { theme: "light", mode: "history", label: "India district map, historical flood risk (illustrative)" }),

  "atlas-mini": el => drawIndia(el, { theme: "dark", mode: "future", terrain: true, label: "India district map, projected flood risk (illustrative)" }),

  "live-mini": async el => {
    const m = await drawIndia(el, { theme: "dark", mode: "history", label: "India map with sample rainfall (illustrative)" });
    m.svg.querySelector(".fgRisk").style.opacity = ".55";
    addRain(m, [[78.49, 17.39, 1.2, 190, .7, -30], [72.9, 19.3, 1, 170, .45, 15], [91.9, 26.3, .9, 230, .55, -15], [77.2, 28.6, .7, 150, .65], [86.8, 20.2, .8, 230, .5, -40]]);
  },

  "explorer-ui": async el => {
    const NAME = "Patna";
    const m = await drawIndia(el, { theme: "light", mode: "history", crop: [81.5, 22.8, 89.5, 27.8], highlight: [NAME], label: "Bihar and neighbouring states, historical flood risk, Patna selected (illustrative)" });
    const d = m.D.districts.find(x => x[0] === NAME);
    const fig = el.closest("figure");
    if (d) {
      fig.querySelectorAll('[data-x="band"]').forEach(b => (b.innerHTML = chip(d[7] / 100, RAMPS.light)));
      // 75 years of illustrative "flood year" stripes, a little more frequent later on
      const r = rng(97), stripes = [];
      for (let yr = 1951; yr <= 2025; yr++) {
        const t = (yr - 1951) / 74, v = r() * .8 + t * .25;
        stripes.push(v > .82 ? "#d9803f" : v > .7 ? "#dcb54f" : v > .56 ? "#7fbcc4" : "#dbe9e9");
      }
      $('[data-x="stripes"]', fig).innerHTML = stripes.map(c => `<i style="background:${c}"></i>`).join("");
    }
    fill($('[data-x="ramp"]', fig), RAMPS.light);
  },

  "atlas-ui": async el => {
    const NAME = "Kamrup", K = .11;
    const m = await drawIndia(el, { theme: "dark", mode: "future", k: K, terrain: true, crop: [84, 21.2, 96.6, 29.2], highlight: [NAME], label: "Eastern and north-eastern India, projected flood risk with sample asset locations (illustrative)" });
    const r = rng(31), sites = [];
    for (const [lon, lat, n, spread] of [[91.74, 26.14, 9, .45], [88.36, 22.57, 8, .5], [85.14, 25.59, 6, .5], [92.8, 26.6, 4, .5]])
      for (let i = 0; i < n; i++) sites.push([lon + (r() - .5) * spread * 2, lat + (r() - .5) * spread * 1.4, 5.5, r() > .72 ? "hot" : ""]);
    addPoints(m, sites, "fgAsset");
    const fig = el.closest("figure"), d = m.D.districts.find(x => x[0] === NAME);
    if (d) {
      const h = d[7] / 100, dl = d[8] / 100;
      $('[data-x="aHist"]', fig).innerHTML = chip(h, RAMPS.dark);
      $('[data-x="aFut"]', fig).innerHTML = chip(Math.min(1, h + dl * K), RAMPS.dark);
      // the projected uplift by horizon, relative to the largest (2100) — a trend, not a value
      const rows = [["2030", .5], ["2050", 1], ["2100", 1.6]];
      $('[data-x="aBars"]', fig).innerHTML = rows.map(([l, m]) => `<div class="fut"><span>${l}</span><i style="width:${Math.max(4, Math.round(dl * m / 1.6 * 100))}%"></i></div>`).join("");
    }
    $('[data-x="aSites"]', fig).textContent = sites.length + " sample";
    fill($('[data-x="rampD"]', fig), RAMPS.dark);
  },

  "live-ui": async el => {
    const m = await drawIndia(el, { theme: "dark", mode: "history", crop: [71.6, 15.2, 81.8, 21.6], label: "Western and central India with sample rainfall radar and monitoring locations (illustrative)" });
    m.svg.querySelector(".fgRisk").style.opacity = ".5";
    addRain(m, [[78.49, 17.39, 1.3, 95, .7, -30], [72.95, 19.2, 1.1, 85, .45, 15], [73.9, 18.4, .6, 70, .6], [79.3, 18.9, .55, 80, .6, -20], [76.2, 20.6, .45, 90, .5]]);
    const mons = [[72.88, 19.08, 7, "alert"], [78.49, 17.39, 7, "alert"], [73.86, 18.52, 6], [73.79, 20.0, 6], [75.9, 17.67, 6], [79.59, 17.97, 6], [79.09, 21.15, 6], [74.24, 16.7, 6]];
    addPoints(m, mons, "fgMon");
    const fig = el.closest("figure");
    $('[data-x="mons"]', fig).textContent = mons.length + " sample";
    const r = rng(5);
    $('[data-x="spark"]', fig).innerHTML = Array.from({ length: 12 }, (_, i) => {
      const v = Math.min(1, .15 + i * .06 + r() * .25);
      return `<i class="${v > .75 ? "hi" : ""}" style="height:${Math.round(v * 100)}%"></i>`;
    }).join("");
  },
};

/* draw each map when it first comes near the viewport */
const els = document.querySelectorAll("[data-fgmap]");
loadIndia(); // start the geometry fetch straight away
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  io.unobserve(e.target);
  const el = e.target;
  Promise.resolve(MOUNTS[el.dataset.fgmap]?.(el)).then(() => flattenMap(el)).catch(err => console.warn("map", err));
}), { rootMargin: "300px 0px" });
els.forEach(el => io.observe(el));
