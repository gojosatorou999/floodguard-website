/* ── DERIVED · terrain analysis ───────────────────────────────────
   Everything here is computed in the browser from the real height grid —
   no model weights, no remote service:

     fill / flow   priority-flood depression filling (Barnes et al. 2014 idea)
                   that records, for every cell, the neighbour it drains to
     accumulation  upstream cell count along those flow paths
     channels      cells draining ≥ `minCells` upstream
     HAND          height above the nearest drainage, measured along the
                   flow path (Rennó et al. 2008): the standard terrain
                   proxy for "how high above the river is this cell?"
     sky view      horizon-based openness, baked as ambient occlusion
     depth(T)      a screening bathtub-on-HAND model — a stage that grows
                   with return period and stream size is laid over HAND

   It is a screening model on real terrain, not hydrodynamics, and the page
   says so. Written for this project from the published method
   descriptions; no third-party code reused.                              */
import { clamp } from "/assets/js/studio/geo.js";

const NB = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];

/* binary min-heap keyed by Float32 */
class Heap {
  constructor(n) { this.k = new Float32Array(n); this.v = new Int32Array(n); this.n = 0; }
  push(key, val) {
    let i = this.n++;
    while (i > 0) { const p = (i - 1) >> 1; if (this.k[p] <= key) break; this.k[i] = this.k[p]; this.v[i] = this.v[p]; i = p; }
    this.k[i] = key; this.v[i] = val;
  }
  pop() {
    const out = this.v[0], key = this.k[--this.n], val = this.v[this.n];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1; if (c >= this.n) break;
      if (c + 1 < this.n && this.k[c + 1] < this.k[c]) c++;
      if (this.k[c] >= key) break;
      this.k[i] = this.k[c]; this.v[i] = this.v[c]; i = c;
    }
    this.k[i] = key; this.v[i] = val;
    return out;
  }
}

/**
 * analyse(dem, {minCells}) → dem plus
 *   sea Uint8, fill Float32, recv Int32, order Int32, acc Float32,
 *   channel Uint8, tgt Int32, hand Float32, slope Float32 (deg),
 *   sky Uint8 (255 = open), zmin, zmax, accMax, chanMin
 */
export function analyse(dem, { minCells } = {}) {
  const { nx, ny, z } = dem, N = nx * ny;
  const sea = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (z[i] <= 0.5) sea[i] = 1;

  /* ── priority flood ── */
  const fill = new Float32Array(N), recv = new Int32Array(N).fill(-1), seen = new Uint8Array(N), order = new Int32Array(N);
  const heap = new Heap(N + 8);
  const seed = i => { if (!seen[i]) { seen[i] = 1; fill[i] = Math.max(z[i], 0); heap.push(fill[i], i); } };
  for (let x = 0; x < nx; x++) { seed(x); seed((ny - 1) * nx + x); }
  for (let y = 0; y < ny; y++) { seed(y * nx); seed(y * nx + nx - 1); }
  for (let i = 0; i < N; i++) if (sea[i]) seed(i);
  const EPS = 0.002;
  let k = 0;
  while (heap.n) {
    const c = heap.pop(); order[k++] = c;
    const cx = c % nx, cy = (c / nx) | 0;
    for (let d = 0; d < 8; d++) {
      const x = cx + NB[d][0], y = cy + NB[d][1];
      if (x < 0 || y < 0 || x >= nx || y >= ny) continue;
      const n = y * nx + x;
      if (seen[n]) continue;
      seen[n] = 1; recv[n] = c;
      fill[n] = Math.max(z[n], fill[c] + EPS * (d < 4 ? 1 : 1.4));
      heap.push(fill[n], n);
    }
  }

  /* ── accumulation: push each cell's catchment to its receiver, high → low ── */
  const acc = new Float32Array(N).fill(1);
  for (let i = N - 1; i >= 0; i--) { const c = order[i], r = recv[c]; if (r >= 0) acc[r] += acc[c]; }
  let accMax = 0;
  for (let i = 0; i < N; i++) if (!sea[i] && acc[i] > accMax) accMax = acc[i];

  const chanMin = minCells || Math.max(40, Math.round(N * 0.0006));
  const channel = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (!sea[i] && acc[i] >= chanMin) channel[i] = 1;

  /* ── HAND along the flow path ── */
  const tgt = new Int32Array(N), hand = new Float32Array(N);
  for (let j = 0; j < N; j++) {
    const c = order[j];
    tgt[c] = (channel[c] || sea[c] || recv[c] < 0) ? c : tgt[recv[c]];
    hand[c] = Math.max(0, z[c] - fill[tgt[c]]);
  }

  /* ── slope (deg) and sky-view openness ── */
  const slope = new Float32Array(N);
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const a = z[y * nx + Math.max(0, x - 1)], b = z[y * nx + Math.min(nx - 1, x + 1)];
    const c = z[Math.max(0, y - 1) * nx + x], d = z[Math.min(ny - 1, y + 1) * nx + x];
    slope[y * nx + x] = Math.atan(Math.hypot((b - a) / (2 * dem.dx), (d - c) / (2 * dem.dy))) * 180 / Math.PI;
  }
  const sky = new Uint8Array(N), STRIDES = [1, 2, 3, 5, 8, 12, 17, 24, 32];
  const dirs = [[1, 0], [.7071, .7071], [0, 1], [-.7071, .7071], [-1, 0], [-.7071, -.7071], [0, -1], [.7071, -.7071]];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const z0 = z[y * nx + x];
    let open = 0;
    for (const [ux, uy] of dirs) {
      let tanMax = 0;
      for (const s of STRIDES) {
        const sx = Math.round(x + ux * s), sy = Math.round(y + uy * s);
        if (sx < 0 || sy < 0 || sx >= nx || sy >= ny) break;
        const t = (z[sy * nx + sx] - z0) / (s * dem.dx);
        if (t > tanMax) tanMax = t;
      }
      open += 1 - Math.atan(tanMax) / (Math.PI / 2);
    }
    sky[y * nx + x] = Math.round(open / 8 * 255);
  }

  let zmin = Infinity, zmax = -Infinity;
  for (let i = 0; i < N; i++) { const v = Math.max(z[i], 0); if (v < zmin) zmin = v; if (v > zmax) zmax = v; }
  return Object.assign(dem, { sea, fill, recv, order, acc, channel, tgt, hand, slope, sky, zmin, zmax, accMax, chanMin });
}

/* ── scenarios ──────────────────────────────────────────────────── */
export const SSP = {
  none: { label: "Today", dT2100: 0 },
  ssp126: { label: "SSP1-2.6", dT2100: 0.9 },
  ssp245: { label: "SSP2-4.5", dT2100: 2.0 },
  ssp585: { label: "SSP5-8.5", dT2100: 3.9 },
};
/* Clausius–Clapeyron-style scaling: ~7 % more extreme rainfall per °C of
   additional warming. A transparent placeholder — not a downscaled CMIP6 run. */
export function climateFactor(ssp, year) {
  const dT = (SSP[ssp]?.dT2100 || 0) * Math.pow(clamp((year - 2025) / 75, 0, 1), 0.9);
  return { dT, rain: 1 + 0.07 * dT };
}

const T0 = 2, S_BASE = 1.3, K = 0.5;
/** river stage (m above the channel bed) for a return period, for the biggest rivers */
export const stageFor = (T, cf) => S_BASE * Math.pow(cf, 1.5) * (1 + K * Math.log(Math.max(T, T0) / T0));
/** 24 h design rainfall (mm) for the readout and the rain overlay */
export const rainFor = (T, cf) => 95 * (1 + 0.28 * Math.log(Math.max(T, 1))) * cf;

/** how much of the headline stage a cell's receiving stream carries (0.25…1) */
function streamWeights(A) {
  const w = new Float32Array(A.nx * A.ny), lo = Math.log(A.chanMin), span = Math.max(1e-3, Math.log(A.accMax) - lo);
  for (let i = 0; i < w.length; i++) {
    const t = A.tgt[i];
    w[i] = A.sea[t] ? 0.5 : 0.1 + 0.9 * Math.pow(clamp((Math.log(Math.max(A.acc[t], A.chanMin)) - lo) / span, 0, 1), 1.5);
  }
  return w;
}

/* how far (m) a flood on a stream of weight w can spread across the floodplain */
/* the stage a stream carries inside its banks before it spills onto the floodplain */
const bankfull = w => 0.3 + 0.9 * w;
const reachM = (w, T) => 1500 + 18000 * Math.pow(w, 1.2) * Math.pow(T / 100, 0.35);
/* …and the return period at which it first reaches distance d */
const reachT = (w, d) => d <= 1500 ? 0 : 100 * Math.pow((d - 1500) / (18000 * Math.pow(w, 1.2)), 1 / 0.35);
function distToStream(A) {
  const d = new Float32Array(A.nx * A.ny);
  for (let i = 0; i < d.length; i++) { const t = A.tgt[i]; d[i] = Math.hypot(((i % A.nx) - (t % A.nx)) * A.dx, (((i / A.nx) | 0) - ((t / A.nx) | 0)) * A.dy); }
  return d;
}

/**
 * floodField(A, T, cf) → { depth Float32 (m), water Float32 (absolute level m), stats }
 * depth = max(0, stage·w − HAND) on land; sea cells keep their still-water level.
 */
export function floodField(A, T, cf) {
  const w = (A.w ||= streamWeights(A)), dist = (A.dist ||= distToStream(A)), S = stageFor(T, cf);
  const N = A.nx * A.ny, depth = new Float32Array(N), water = new Float32Array(N);
  const cellKm2 = A.dx * A.dy / 1e6;
  let flooded = 0, dmax = 0, vol = 0;
  for (let i = 0; i < N; i++) {
    if (A.sea[i]) { water[i] = 0; continue; }
    const d = dist[i] > reachM(w[i], T) ? 0 : S * w[i] - bankfull(w[i]) - A.hand[i];
    if (d > 0.03) { depth[i] = d; water[i] = A.z[i] + d; flooded++; vol += d * cellKm2; if (d > dmax) dmax = d; }
    else water[i] = A.z[i] - 1;
  }
  return { depth, water, stage: S, stats: { floodedKm2: flooded * cellKm2, maxDepth: dmax, volumeKm3: vol / 1000 } };
}

/**
 * hazard probability (annual) per cell under a climate factor: the inverse of
 * the return period at which the cell first floods, capped at 50 %.
 */
export function hazardField(A, cf) {
  const w = (A.w ||= streamWeights(A)), dist = (A.dist ||= distToStream(A)), N = A.nx * A.ny, p = new Float32Array(N), sBase = S_BASE * Math.pow(cf, 1.5);
  for (let i = 0; i < N; i++) {
    if (A.sea[i]) continue;
    const need = (A.hand[i] + bankfull(w[i])) / w[i] / sBase;              // stage needed, in units of the 2-year stage
    const Th = need <= 1 ? T0 : T0 * Math.exp((need - 1) / K), Tc = Math.max(Th, reachT(w[i], dist[i]));
    p[i] = Tc > 2000 ? 0 : Math.min(0.5, 1 / Tc);
  }
  return p;
}

/**
 * channelPaths(A) → [{ cells:number[], acc, ts:number[] }]
 * Channel cells chained from each head or confluence down to the next
 * confluence / the sea. `ts` is the running length in cells plus a random
 * start phase, for the flow-pulse animation. Also sets A.pathLoop.
 */
export function channelPaths(A, maxPaths = 5000) {
  const { nx, ny, channel, recv, acc, sea } = A, N = nx * ny;
  const inflow = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (channel[i] && recv[i] >= 0 && channel[recv[i]]) inflow[recv[i]]++;
  const out = [];
  let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < N; i++) {
    if (!channel[i] || inflow[i] === 1) continue;
    const cells = [i]; let cur = i;
    for (let guard = 0; guard < N; guard++) {
      const r = recv[cur]; if (r < 0) break;
      cells.push(r);
      if (!channel[r] || sea[r] || inflow[r] !== 1) break;
      cur = r;
    }
    if (cells.length < 3) continue;
    out.push({ cells, acc: acc[cells[cells.length - 1]] > A.accMax ? A.accMax : Math.max(acc[cells[0]], acc[cells[cells.length - 2]]) });
  }
  out.sort((a, b) => b.acc - a.acc);
  out.length = Math.min(out.length, maxPaths);
  let Lmax = 0;
  for (const p of out) Lmax = Math.max(Lmax, p.cells.length);
  A.pathLoop = Lmax + 60;
  for (const p of out) {
    const phase = rnd() * (A.pathLoop - p.cells.length);
    p.ts = p.cells.map((_, k) => k + phase);
  }
  return out;
}
