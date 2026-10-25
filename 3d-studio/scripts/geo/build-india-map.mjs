/* ── build assets/geo/india-map.json ─────────────────────────────
   Turns public boundary, river and elevation data into one compact,
   pre-projected file the homepage hero map (assets/js/hero-map.js)
   draws from. Nothing here runs in the browser.

   usage:  node scripts/geo/build-india-map.mjs <source-dir>

   <source-dir> must contain:
     2011_Dist.{shp,dbf,shx,prj}   DataMeet India districts, Census 2011
                                   github.com/datameet/maps (CC BY 2.5 IN).
                                   Its outer edge follows the official
                                   Survey of India boundary.
     ne_rivers.geojson             Natural Earth 10m rivers + lake
                                   centerlines (public domain)
     dem.json                      ETOPO1 elevation on a 0.25° grid, from
                                   api.opentopodata.org (public domain),
                                   shape { step, lon0, lat0, nx, ny, z[] }

   The per-district risk values it writes are ILLUSTRATIVE: a heuristic
   of low-lying terrain, river proximity, coast and monsoon climatology,
   good enough to make the demo map read like real geography. They are
   not FloodGuard model output and the hero labels them as such. */
import fs from "node:fs";
import path from "node:path";
import mapshaper from "mapshaper";

const SRC = process.argv[2];
if (!SRC) { console.error("usage: node scripts/geo/build-india-map.mjs <source-dir>"); process.exit(1); }
const OUT = "assets/geo/india-map.json";
const src = f => path.join(SRC, f).replace(/\\/g, "/");

async function ms(cmd) {
  const out = await mapshaper.applyCommands(cmd);
  return JSON.parse(Object.values(out)[0].toString());
}

/* ── geometry ── one simplification level for both, so the dissolved
   outline shares its arcs exactly with the district edges */
const SIMPLIFY = "2.5%";
const districts = await ms(`-i "${src("2011_Dist.shp")}" -simplify ${SIMPLIFY} keep-shapes -filter-fields DISTRICT,ST_NM -o d.json format=geojson geojson-type=FeatureCollection precision=0.0001`);
const outline = await ms(`-i "${src("2011_Dist.shp")}" -simplify ${SIMPLIFY} keep-shapes -dissolve -o o.json format=geojson geojson-type=FeatureCollection precision=0.0001`);
fs.writeFileSync(src("_outline.json"), JSON.stringify(outline));
const rivers = await ms(`-i "${src("ne_rivers.geojson")}" -filter "scalerank <= 8" -clip bbox=67,5,99,38 -clip "${src("_outline.json")}" -simplify 25% -filter-fields name,scalerank -o r.json format=geojson geojson-type=FeatureCollection precision=0.0001`);
const dem = JSON.parse(fs.readFileSync(src("dem.json"), "utf8"));

/* ── projection: Lambert conformal conic, the usual one for India maps
   (standard parallels 12.47°N / 35.17°N, centred 80°E 24°N) ── */
const R = Math.PI / 180, P1 = 12.47 * R, P2 = 35.17 * R, PHI0 = 24 * R, LAM0 = 80 * R;
const t = p => Math.tan(Math.PI / 4 + p / 2);
const n = Math.log(Math.cos(P1) / Math.cos(P2)) / Math.log(t(P2) / t(P1));
const F = Math.cos(P1) * Math.pow(t(P1), n) / n;
const rho0 = F / Math.pow(t(PHI0), n);
function lcc(lon, lat) {
  const rho = F / Math.pow(t(lat * R), n), th = n * (lon * R - LAM0);
  return [rho * Math.sin(th), rho0 - rho * Math.cos(th)];
}

// fit the outline into a W-wide viewBox, y pointing down
const W = 1200, PAD = 24;
let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
eachCoord(outline, ([lon, lat]) => { const [x, y] = lcc(lon, lat); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
const S = (W - 2 * PAD) / (x1 - x0), H = Math.round((y1 - y0) * S + 2 * PAD);
const TX = PAD - x0 * S, TY = PAD + y1 * S;
const proj = (lon, lat) => { const [x, y] = lcc(lon, lat); return [TX + x * S, TY - y * S]; };

function eachCoord(gj, fn) {
  const walk = c => (typeof c[0] === "number" ? fn(c) : c.forEach(walk));
  (gj.features || [gj]).forEach(f => f.geometry && walk(f.geometry.coordinates));
}

/* compact SVG path: absolute M, then relative l on a whole-unit grid.
   Deltas come from rounded absolutes, so rounding never drifts. */
const num = v => String(v);
function encodeLine(pts, close) {
  let s = "", px = null, py = null, first = true;
  for (const [lon, lat] of pts) {
    const [fx, fy] = proj(lon, lat), x = Math.round(fx), y = Math.round(fy);
    if (first) { s += `M${x} ${y}l`; first = false; px = x; py = y; continue; }
    const dx = x - px, dy = y - py;
    if (!dx && !dy) continue;
    const pair = num(dx) + (dy < 0 ? "" : " ") + num(dy);
    s += (s.endsWith("l") || pair.startsWith("-") ? "" : " ") + pair;
    px = x; py = y;
  }
  if (s.endsWith("l")) s = s.slice(0, -1);
  return close ? s + "z" : s;
}
function encodeGeom(g, close = true) {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates
    : g.type === "LineString" ? [[g.coordinates]] : g.type === "MultiLineString" ? [g.coordinates] : [];
  return polys.flatMap(rings => rings.map(r => encodeLine(r, close))).filter(d => d.includes("l")).join("");
}

/* ── elevation helpers ── */
const Z = (ix, iy) => dem.z[Math.max(0, Math.min(dem.ny - 1, iy)) * dem.nx + Math.max(0, Math.min(dem.nx - 1, ix))];
function elev(lon, lat) {
  const fx = (lon - dem.lon0) / dem.step, fy = (lat - dem.lat0) / dem.step;
  const ix = Math.floor(fx), iy = Math.floor(fy), ax = fx - ix, ay = fy - iy;
  return (Z(ix, iy) * (1 - ax) + Z(ix + 1, iy) * ax) * (1 - ay) + (Z(ix, iy + 1) * (1 - ax) + Z(ix + 1, iy + 1) * ax) * ay;
}
function inRing(x, y, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const polysOf = g => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
const inGeom = (g, x, y) => polysOf(g).some(p => inRing(x, y, p[0]) && !p.slice(1).some(h => inRing(x, y, h)));

/* distance in km on a local equirectangular plane — plenty for weights */
const km = (a, b, c, d) => Math.hypot((c - a) * 111.3 * Math.cos(((b + d) / 2) * R), (d - b) * 110.6);
function segDist(px, py, ax, ay, bx, by) {
  const kx = 111.3 * Math.cos(py * R), ky = 110.6;
  const X = (px - ax) * kx, Y = (py - ay) * ky, DX = (bx - ax) * kx, DY = (by - ay) * ky;
  const L = DX * DX + DY * DY, u = L ? Math.max(0, Math.min(1, (X * DX + Y * DY) / L)) : 0;
  return Math.hypot(X - u * DX, Y - u * DY);
}
const riverSegs = [];
for (const f of rivers.features) {
  const rk = f.properties.scalerank, w = rk <= 3 ? 1 : rk <= 5 ? .85 : rk <= 6 ? .7 : .5;
  const lines = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const l of lines) for (let i = 1; i < l.length; i++) riverSegs.push([...l[i - 1], ...l[i], w]);
}
const ocean = [];
for (let iy = 0; iy < dem.ny; iy++) for (let ix = 0; ix < dem.nx; ix++) if (Z(ix, iy) <= 0) ocean.push([dem.lon0 + ix * dem.step, dem.lat0 + iy * dem.step]);

/* stable per-name jitter, so reruns produce the same map */
const hash = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };

/* ── districts ── Census 2011 predates Telangana (2014) and Ladakh (2019);
   fix the state names a visitor would otherwise see as wrong */
const TELANGANA = new Set(["adilabad", "nizamabad", "karimnagar", "medak", "hyderabad", "rangareddy", "ranga reddy", "mahbubnagar", "mahabubnagar", "nalgonda", "warangal", "khammam"]);
const titleCase = s => s.toLowerCase().replace(/(^|[\s(-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
function stateOf(dist, st) {
  const d = dist.toLowerCase(), s = titleCase(st.trim());
  if (/andhra/i.test(s) && TELANGANA.has(d)) return "Telangana";
  if (/jammu/i.test(s) && /^(leh|kargil)/.test(d)) return "Ladakh";
  if (/dadar?a|daman/i.test(s)) return "Dadra and Nagar Haveli and Daman and Diu";
  if (/arunanchal/i.test(s)) return "Arunachal Pradesh";
  if (/^nct|delhi/i.test(s)) return "Delhi";
  return s.replace(/&/g, "and");
}

const rows = [];
for (const f of districts.features) {
  const g = f.geometry; if (!g) continue;
  const name = titleCase(String(f.properties.DISTRICT).trim()), state = stateOf(String(f.properties.DISTRICT), String(f.properties.ST_NM));
  // centroid of the largest ring
  let best = null, bestA = 0;
  for (const p of polysOf(g)) {
    const r = p[0]; let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const k = r[j][0] * r[i][1] - r[i][0] * r[j][1]; a += k; cx += (r[j][0] + r[i][0]) * k; cy += (r[j][1] + r[i][1]) * k; }
    if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; }
  }
  const [clon, clat] = best;
  // elevation samples inside the district
  let bx0 = 180, bx1 = -180, by0 = 90, by1 = -90;
  eachCoord({ features: [f] }, ([x, y]) => { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); });
  const zs = [];
  for (let lat = Math.ceil(by0 / dem.step) * dem.step; lat <= by1; lat += dem.step)
    for (let lon = Math.ceil(bx0 / dem.step) * dem.step; lon <= bx1; lon += dem.step)
      if (inGeom(g, lon, lat)) zs.push(Math.max(0, elev(lon, lat)));
  if (!zs.length) zs.push(Math.max(0, elev(clon, clat)));
  zs.sort((a, b) => a - b);
  const zLow = zs[Math.floor(zs.length * .25)], zMean = zs.reduce((a, b) => a + b, 0) / zs.length;

  const lowland = Math.pow(Math.max(0, 1 - zLow / 500), 1.2);
  let river = 0;
  for (const [ax, ay, bx, by, w] of riverSegs) {
    if (Math.abs(ax - clon) > 2.5 || Math.abs(ay - clat) > 2.5) continue;
    river = Math.max(river, w * Math.exp(-segDist(clon, clat, ax, ay, bx, by) / 30));
  }
  let dc = Infinity;
  for (const [ox, oy] of ocean) if (Math.abs(ox - clon) < 3 && Math.abs(oy - clat) < 3) dc = Math.min(dc, km(clon, clat, ox, oy));
  const coast = Math.exp(-dc / 35) * (.5 + .5 * lowland);
  // monsoon climatology, qualitatively: the north-east, the Western Ghats
  // coast, Bengal–Odisha and the Himalayan foothills run wettest
  const rain = Math.max(
    clon > 89.5 && clat < 28.8 ? .95 : 0,
    clon < 77 && clat < 21.5 && dc < 90 ? .9 : 0,
    clon > 84 && clon < 89.5 && clat > 19 && clat < 24 ? .75 : 0,
    clat > 26 && zMean > 150 && zMean < 1600 ? .6 : 0,
    clon < 73.5 && clat > 23.5 && clat < 30 ? -.4 : 0);
  const foothill = clat > 26 && zMean > 150 && zMean < 2500 ? 1 : 0;
  const raw = .34 * lowland + .3 * river + .14 * coast + .16 * rain + .06 * foothill + (hash(name + state) - .5) * .08;
  const delta = .06 + .1 * coast + .08 * foothill + .06 * Math.max(0, rain) + .04 * river + (hash(state + name) - .5) * .03;

  const [cx, cy] = proj(clon, clat);
  rows.push({ name, state, d: encodeGeom(g), cx: Math.round(cx), cy: Math.round(cy), lon: +clon.toFixed(2), lat: +clat.toFixed(2), raw, delta });
}
// percentile-rank the raw score: an even spread of colour across India
const order = rows.map(r => r.raw).sort((a, b) => a - b);
const pct = v => order.findIndex(x => x >= v) / (order.length - 1);
const dMax = Math.max(...rows.map(r => r.delta));

/* ── terrain contours from the DEM (marching squares, joined by edge) ── */
const LEVELS = [150, 400, 800, 1500, 2500, 4000, 5500];
function contours(level) {
  const segs = new Map(); // edge key → [otherKey, point]
  const pt = (k, ax, ay, av, bx, by, bv) => { const u = (level - av) / (bv - av); return [k, [dem.lon0 + (ax + (bx - ax) * u) * dem.step, dem.lat0 + (ay + (by - ay) * u) * dem.step]]; };
  const lines = [], adj = new Map();
  for (let iy = 0; iy < dem.ny - 1; iy++) for (let ix = 0; ix < dem.nx - 1; ix++) {
    const a = Z(ix, iy), b = Z(ix + 1, iy), c = Z(ix + 1, iy + 1), d = Z(ix, iy + 1);
    const code = (a > level) | ((b > level) << 1) | ((c > level) << 2) | ((d > level) << 3);
    if (code === 0 || code === 15) continue;
    const e = {
      B: () => pt(`h${ix},${iy}`, ix, iy, a, ix + 1, iy, b),
      Rt: () => pt(`v${ix + 1},${iy}`, ix + 1, iy, b, ix + 1, iy + 1, c),
      T: () => pt(`h${ix},${iy + 1}`, ix, iy + 1, d, ix + 1, iy + 1, c),
      L: () => pt(`v${ix},${iy}`, ix, iy, a, ix, iy + 1, d),
    };
    const pairs = { 1: ["L", "B"], 2: ["B", "Rt"], 3: ["L", "Rt"], 4: ["Rt", "T"], 5: ["L", "T", "B", "Rt"], 6: ["B", "T"], 7: ["L", "T"],
      8: ["T", "L"], 9: ["T", "B"], 10: ["T", "Rt", "B", "L"], 11: ["T", "Rt"], 12: ["Rt", "L"], 13: ["Rt", "B"], 14: ["B", "L"] }[code];
    for (let i = 0; i < pairs.length; i += 2) {
      const [k1, p1] = e[pairs[i]](), [k2, p2] = e[pairs[i + 1]]();
      segs.set(k1, p1); segs.set(k2, p2);
      (adj.get(k1) || adj.set(k1, []).get(k1)).push(k2);
      (adj.get(k2) || adj.set(k2, []).get(k2)).push(k1);
    }
  }
  const seen = new Set();
  const start = [...adj.keys()].sort((p, q) => adj.get(p).length - adj.get(q).length); // open ends first
  for (const s of start) {
    if (seen.has(s)) continue;
    const line = [s]; seen.add(s);
    let cur = s;
    for (;;) { const nx = (adj.get(cur) || []).find(k => !seen.has(k)); if (!nx) break; line.push(nx); seen.add(nx); cur = nx; }
    if (line.length >= 5) lines.push(line.map(k => segs.get(k)));
  }
  return lines;
}
function chaikin(pts, it = 2) {
  for (let k = 0; k < it; k++) {
    const o = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      o.push([ax * .75 + bx * .25, ay * .75 + by * .25], [ax * .25 + bx * .75, ay * .25 + by * .75]);
    }
    o.push(pts[pts.length - 1]); pts = o;
  }
  return pts;
}
const contourPaths = LEVELS.map(l => [l, contours(l).map(line => encodeLine(chaikin(line), false)).filter(d => d.length > 12).join("")]);

/* ── graticule every 5° ── */
let grat = "";
for (let lon = 50; lon <= 110; lon += 5) { const pts = []; for (let lat = -2; lat <= 42; lat += .5) pts.push([lon, lat]); grat += encodeLine(pts, false); }
for (let lat = 0; lat <= 40; lat += 5) { const pts = []; for (let lon = 48; lon <= 112; lon += .5) pts.push([lon, lat]); grat += encodeLine(pts, false); }

/* ── places ── real cities; exposure weight is a coarse metro-size tier */
const CITIES = [["Delhi", 77.21, 28.61, 1], ["Mumbai", 72.88, 19.08, 1], ["Kolkata", 88.36, 22.57, 1], ["Chennai", 80.27, 13.08, 1],
  ["Bengaluru", 77.59, 12.97, 1], ["Hyderabad", 78.49, 17.39, 1], ["Ahmedabad", 72.57, 23.02, .7], ["Pune", 73.86, 18.52, .7],
  ["Surat", 72.83, 21.17, .7], ["Jaipur", 75.79, 26.91, .55], ["Lucknow", 80.95, 26.85, .55], ["Patna", 85.14, 25.59, .55],
  ["Guwahati", 91.74, 26.14, .45], ["Bhubaneswar", 85.82, 20.3, .45], ["Kochi", 76.27, 9.93, .45], ["Srinagar", 74.8, 34.08, .45],
  ["Visakhapatnam", 83.22, 17.69, .5], ["Nagpur", 79.09, 21.15, .5], ["Bhopal", 77.41, 23.26, .45], ["Varanasi", 82.97, 25.32, .45]];
/* major recorded floods — real events, placed at their best-known location */
const EVENTS = [["Mumbai", 2005, 72.88, 19.08], ["Surat", 2006, 72.83, 21.17], ["Kosi, Bihar", 2008, 86.9, 26.1], ["Leh", 2010, 77.58, 34.16],
  ["Uttarakhand", 2013, 79.07, 30.73], ["Srinagar", 2014, 74.8, 34.08], ["Chennai", 2015, 80.27, 13.08], ["Kerala", 2018, 76.3, 10],
  ["Hyderabad", 2020, 78.49, 17.39], ["Assam", 2022, 92.5, 26.3], ["Himachal Pradesh", 2023, 77.17, 31.1]];
const P = (lon, lat) => proj(lon, lat).map(Math.round);

/* ── DEM for the client-side hillshade: √-scaled to one byte ── */
const ZMAX = 8800;
const q = Buffer.from(dem.z.map(z => z <= 0 ? 0 : Math.max(1, Math.min(255, Math.round(Math.sqrt(z / ZMAX) * 255)))));

const out = {
  v: 1,
  vb: [W, H],
  // inverse-projection constants, for the hillshade raster
  proj: { n, F, rho0, lam0: 80, s: S, tx: TX, ty: TY },
  credit: "Boundaries: DataMeet India (CC BY 2.5 IN), Census 2011 districts, Survey of India outer boundary · Rivers: Natural Earth · Elevation: ETOPO1 via OpenTopoData",
  outline: encodeGeom(outline.features ? outline.features[0].geometry : outline.geometry),
  // [name, state, path, cx, cy, lon, lat, historical risk 0-100, projected change 0-100]
  districts: rows.map(r => [r.name, r.state, r.d, r.cx, r.cy, r.lon, r.lat, Math.round(Math.pow(pct(r.raw), 1.1) * 100), Math.round(r.delta / dMax * 100)]),
  rivers: rivers.features.map(f => [f.properties.scalerank, encodeGeom(f.geometry, false)]).filter(r => r[1]),
  contours: contourPaths,
  graticule: grat,
  cities: CITIES.map(([nm, lon, lat, w]) => [nm, ...P(lon, lat), w]),
  events: EVENTS.map(([nm, yr, lon, lat]) => [nm, yr, ...P(lon, lat)]),
  dem: { nx: dem.nx, ny: dem.ny, lon0: dem.lon0, lat0: dem.lat0, step: dem.step, zmax: ZMAX, q: q.toString("base64") },
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
fs.rmSync(src("_outline.json"));
const kb = f => (fs.statSync(f).size / 1024).toFixed(0) + " KB";
console.log(`${OUT}: ${kb(OUT)} · ${rows.length} districts · ${out.rivers.length} rivers · viewBox ${W}×${H}`);
