/* ── SIMULATED DATA · population and infrastructure exposure ──────
   PLACEHOLDER. Nothing in this file is a census figure or a surveyed asset.
   Population is a seeded settlement model over the real terrain (people
   cluster on gentle slopes close to drainage, plus the larger cities from
   the site map); the "assets" are random draws weighted by that population.

   It exists so the exposure layer, the stats panel and the 3D columns can
   be built end to end. Replace `simulateExposure` with WorldPop / GHSL
   population and OSM or client asset registers and nothing else changes:
   the layer only needs { pop: Float32Array(cells), assets: [...] }.      */
import { clamp, rng, hashStr, smooth } from "/assets/js/studio/geo.js";

const DENSITY = { konkan: 330, kosi: 900, assam: 380, chennai: 1400, kerala: 880, mahanadi: 640 }; // people / km², order of magnitude only
const ASSET_TYPES = [
  ["School", .38, "#6dc0c6"], ["Primary health centre", .2, "#9edad9"], ["Substation", .12, "#e0c062"],
  ["Bridge", .12, "#e38c4a"], ["Water works", .08, "#3fa6b2"], ["Road junction", .1, "#c4ebe6"],
];
export const ASSET_COLORS = Object.fromEntries(ASSET_TYPES.map(([n, , c]) => [n, c]));

function noise2(seed) {
  const h = (a, b) => { let x = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ seed; x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967295; };
  return (x, y) => {
    const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, s = u * u * (3 - 2 * u), t = v * v * (3 - 2 * v);
    return (h(i, j) * (1 - s) + h(i + 1, j) * s) * (1 - t) + (h(i, j + 1) * (1 - s) + h(i + 1, j + 1) * s) * t;
  };
}

export function simulateExposure(A, region, cities = []) {
  const { nx, ny } = A, N = nx * ny, F = A.frame, rand = rng(hashStr(region.id) ^ 0x51ed), nz = noise2(hashStr(region.id));
  const cellKm2 = A.dx * A.dy / 1e6, d0 = DENSITY[region.id] || 500;
  const pop = new Float32Array(N), suit = new Float32Array(N);
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const i = y * nx + x;
    if (A.sea[i]) continue;
    const s = Math.exp(-A.hand[i] / 7) * (1 - smooth(2, 9, A.slope[i])) * (1 - smooth(900, 1800, A.z[i]));
    suit[i] = s;
    const n = nz(x / 14, y / 14) * .6 + nz(x / 5, y / 5) * .4;
    pop[i] = d0 * cellKm2 * s * (.25 + 1.5 * n * n);
  }
  /* settlements: real cities inside the window, then synthetic towns on the best ground */
  const blobs = [];
  for (const c of cities) {
    const gx = (c.pos[0] - F.lon0) / (F.lon1 - F.lon0) * nx, gy = (c.pos[1] - F.lat0) / (F.lat1 - F.lat0) * ny;
    if (gx > 4 && gy > 4 && gx < nx - 4 && gy < ny - 4) blobs.push({ gx, gy, amp: 14000 * (.3 + c.w), r: 3.2 + 4 * c.w, name: c.name });
  }
  for (let t = 0, tries = 0; t < 14 && tries < 400; tries++) {
    const x = Math.floor(rand() * nx), y = Math.floor(rand() * ny);
    if (suit[y * nx + x] > .55 && !A.sea[y * nx + x]) { blobs.push({ gx: x, gy: y, amp: 800 + rand() * 4200, r: 1.6 + rand() * 2.2 }); t++; }
  }
  for (const b of blobs) {
    const r = Math.ceil(b.r * 3);
    for (let y = Math.max(0, b.gy - r | 0); y <= Math.min(ny - 1, b.gy + r); y++) for (let x = Math.max(0, b.gx - r | 0); x <= Math.min(nx - 1, b.gx + r); x++) {
      const i = y * nx + x; if (A.sea[i]) continue;
      const d2 = ((x - b.gx) ** 2 + (y - b.gy) ** 2) / (b.r * b.r);
      pop[i] += b.amp * Math.exp(-d2) * (.4 + .6 * clamp(suit[i] * 2, 0, 1)) * cellKm2;
    }
  }
  let total = 0, pmax = 0; for (let i = 0; i < N; i++) { total += pop[i]; if (pop[i] > pmax) pmax = pop[i]; }

  /* assets: draw cells by population */
  const cum = new Float64Array(N); let acc = 0; for (let i = 0; i < N; i++) cum[i] = (acc += pop[i]);
  const pick = () => { const r = rand() * acc; let lo = 0, hi = N - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; } return lo; };
  const assets = [], counts = {};
  for (let k = 0; k < 120; k++) {
    let r = rand(), type = ASSET_TYPES[0][0];
    for (const [n, w] of ASSET_TYPES) { if ((r -= w) <= 0) { type = n; break; } }
    let i = pick();
    if (type === "Bridge") { for (let q = 0; q < 40 && !A.channel[i]; q++) i = pick(); if (!A.channel[i]) continue; }
    const x = i % nx, y = (i / nx) | 0;
    counts[type] = (counts[type] || 0) + 1;
    assets.push({ i, type, name: `${type} ${String(counts[type]).padStart(2, "0")}`, pos: [F.lon0 + (x + .5) / nx * (F.lon1 - F.lon0), F.lat0 + (y + .5) / ny * (F.lat1 - F.lat0)], z: A.z[i], hand: A.hand[i], sim: true });
  }
  return { pop, total, pmax, assets, blobs, simulated: true };
}

/* people and assets inside the current flood, for the readout */
export function exposureUnder(E, depth, thresh = 0.1) {
  let people = 0, assets = 0;
  for (let i = 0; i < depth.length; i++) if (depth[i] > thresh) people += E.pop[i];
  for (const a of E.assets) if (depth[a.i] > thresh) assets++;
  return { people, assets };
}
