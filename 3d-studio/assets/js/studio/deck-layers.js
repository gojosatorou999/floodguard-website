/* ── deck.gl analytical layers ────────────────────────────────────
   Factories only: each takes the studio context and returns deck.gl layers.
   Window layers (hazard, exposure, depth, drainage) draw on the Three.js
   terrain, so every position carries the terrain's *visual* elevation
   (real metres × the current exaggeration). Attributes are handed to deck
   as binary typed arrays — no per-object accessors — so tens of thousands
   of extruded cells stay on the GPU.

   India-scale layers (recorded floods, climate columns) sit on the
   MapLibre district extrusion.                                            */
import { GridCellLayer, ColumnLayer, PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import { ASSET_COLORS } from "/assets/js/studio/simulated/exposure.js";

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const RAMP = ["#0f2b33", "#133f4f", "#175a73", "#1f7d98", "#36a6b8", "#7cc4a0", "#e0c062", "#e38c4a"].map(hex);
function lerpRamp(stops, t) {
  const x = Math.min(0.9999, Math.max(0, t)) * (stops.length - 1), i = Math.floor(x), f = x - i;
  const a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
export const HAZARD_STOPS = ["#1f7d98", "#36a6b8", "#7cc4a0", "#e0c062", "#e38c4a", "#d4552b"].map(hex);
export const DEPTH_STOPS = ["#6dd5e3", "#2fb0c8", "#1688ad", "#0e5f94", "#133f7a", "#241d5e"].map(hex);
export const POP_STOPS = ["#4a3a2a", "#8f6a34", "#d49a3e", "#f0b84e", "#ffd98a"].map(hex);
export const CLIMATE_STOPS = ["#e0c062", "#e38c4a", "#d4552b", "#a82a22"].map(hex);

const cellLonLat = (A, i) => {
  const F = A.frame, x = i % A.nx, y = (i / A.nx) | 0;
  return [F.lon0 + (x + .5) / A.nx * (F.lon1 - F.lon0), F.lat0 + (y + .5) / A.ny * (F.lat1 - F.lat0)];
};
/* district extrusion height (m) for a historical risk value — must match the MapLibre style */
export const HIST_H = r => 80000 * Math.pow(r, 1.6);
const MATERIAL = { ambient: .55, diffuse: .65, shininess: 38, specularColor: [150, 210, 225] };

/** pack a list of cells into deck binary attributes */
function pack(A, cells, zOf, elev, color, lift = 2) {
  const n = cells.length, P = new Float64Array(n * 3), E = new Float32Array(n), C = new Uint8ClampedArray(n * 4);
  for (let k = 0; k < n; k++) {
    const i = cells[k], [lon, lat] = cellLonLat(A, i);
    P[k * 3] = lon; P[k * 3 + 1] = lat; P[k * 3 + 2] = zOf(i) + lift;
    E[k] = elev(i);
    const c = color(i); C[k * 4] = c[0]; C[k * 4 + 1] = c[1]; C[k * 4 + 2] = c[2]; C[k * 4 + 3] = c[3] ?? 255;
  }
  return { length: n, attributes: { getPosition: { value: P, size: 3 }, getElevation: { value: E, size: 1 }, getFillColor: { value: C, size: 4, normalized: true } } };
}

export function hazardLayer(ctx, { opacity }) {
  const { A, hazard, terr } = ctx;
  const cells = ctx.memo("hazard-cells", ctx.floodStamp, () => { const c = []; for (let i = 0; i < hazard.length; i++) if (hazard[i] > 0.012 && !A.sea[i]) c.push(i); return c; });
  const data = ctx.memo("hazard", ctx.stampKey, () => pack(A, cells, terr.zOf, i => 50 + hazard[i] * 1500, i => [...lerpRamp(HAZARD_STOPS, Math.sqrt(hazard[i] / 0.5)), 230]));
  return new GridCellLayer({ id: "hazard", data, cellSize: A.dx, coverage: .8, extruded: true, material: MATERIAL, opacity, pickable: false, updateTriggers: {} });
}

export function exposureLayers(ctx, { opacity }) {
  const { A, E, flood, terr } = ctx;
  const cells = []; const thr = E.pmax * 0.06;
  for (let i = 0; i < E.pop.length; i++) if (E.pop[i] > thr && !A.sea[i]) cells.push(i);
  const data = ctx.memo("pop", ctx.stampKey, () => pack(A, cells, terr.zOf,
    i => 40 + Math.sqrt(E.pop[i] / E.pmax) * 2200,
    i => flood.depth[i] > 0.1 ? [255, 106, 61, 245] : [...lerpRamp(POP_STOPS, Math.sqrt(E.pop[i] / E.pmax)), 225]));
  const cols = new GridCellLayer({ id: "exposure-pop", data, cellSize: A.dx, coverage: .5, extruded: true, material: MATERIAL, opacity });
  const assets = new ColumnLayer({
    id: "exposure-assets", data: E.assets, diskResolution: 12, radius: A.dx * .22, extruded: true, opacity, material: MATERIAL, pickable: true,
    getPosition: d => [d.pos[0], d.pos[1], terr.zOf(d.i) + 2],
    getElevation: d => 1500 + (d.type === "Substation" ? 1400 : 0),
    getFillColor: d => flood.depth[d.i] > 0.1 ? [255, 106, 61, 255] : [...hex(ASSET_COLORS[d.type] || "#9edad9"), 255],
    updateTriggers: { getFillColor: ctx.floodStamp, getPosition: ctx.exStamp },
  });
  const rings = new ScatterplotLayer({
    id: "exposure-rings", data: E.assets.filter(d => flood.depth[d.i] > 0.1), stroked: true, filled: false, radiusUnits: "meters", lineWidthUnits: "pixels", lineWidthMinPixels: 1.6,
    getPosition: d => [d.pos[0], d.pos[1], terr.zOf(d.i) + 6], getRadius: A.dx * (.7 + .25 * Math.sin(ctx.time * 3)), getLineColor: [255, 140, 80, 220], opacity,
    updateTriggers: { getRadius: ctx.time, getPosition: ctx.exStamp },
  });
  return [cols, assets, rings];
}

export function depthLayer(ctx, { opacity }) {
  const { A, flood, terr } = ctx;
  const cells = []; for (let i = 0; i < flood.depth.length; i++) if (flood.depth[i] > 0.1) cells.push(i);
  const ex = terr.ex;
  const data = ctx.memo("depth", ctx.stampKey, () => pack(A, cells, terr.zOf, i => flood.depth[i] * ex, i => [...lerpRamp(DEPTH_STOPS, Math.min(1, flood.depth[i] / 6)), 235], 0));
  return new GridCellLayer({ id: "depth-bars", data, cellSize: A.dx, coverage: .94, extruded: true, material: { ...MATERIAL, ambient: .7 }, opacity });
}

/* drainage lines + pulses ─────────────────────────────────────── */
export function drainageLayers(ctx, { opacity }) {
  const { A, paths, terr, time } = ctx;
  const lift = 10;
  const data = ctx.memo("drain", String(ctx.exStamp), () => paths.map(p => ({ acc: p.acc, path: p.cells.map(c => { const [lo, la] = cellLonLat(A, c); return [lo, la, terr.zOf(c) + lift]; }), ts: p.ts })));
  const lines = new PathLayer({
    id: "drainage-lines", data, getPath: d => d.path, getColor: [86, 200, 220, 215], getWidth: d => 1 + Math.log2(d.acc / A.chanMin + 1) * 0.9,
    widthUnits: "pixels", widthMinPixels: 1, widthMaxPixels: 7, capRounded: true, jointRounded: true, opacity, updateTriggers: { getPath: ctx.exStamp },
  });
  const glow = new PathLayer({
    id: "drainage-glow", data, getPath: d => d.path, getColor: [60, 170, 200, 70], getWidth: d => 4 + Math.log2(d.acc / A.chanMin + 1) * 2.2,
    widthUnits: "pixels", widthMaxPixels: 18, capRounded: true, jointRounded: true, opacity, updateTriggers: { getPath: ctx.exStamp },
  });
  const flow = new TripsLayer({
    id: "drainage-flow", data, getPath: d => d.path, getTimestamps: d => d.ts, getColor: [210, 250, 255, 255], widthUnits: "pixels", getWidth: d => 1.6 + Math.log2(d.acc / A.chanMin + 1) * 1.1,
    widthMaxPixels: 8, fadeTrail: true, trailLength: 26, currentTime: time * 28 % (ctx.pathLoop || 400), capRounded: true, jointRounded: true, opacity,
    updateTriggers: { getPath: ctx.exStamp },
  });
  return [glow, lines, flow];
}

/* India overview ──────────────────────────────────────────────── */
export function eventLayers(ctx, { opacity }) {
  const ev = ctx.events, t = ctx.time;
  const rings = new ScatterplotLayer({
    id: "events-rings", data: ev, stroked: true, filled: true, radiusUnits: "meters", lineWidthUnits: "pixels", lineWidthMinPixels: 1.4,
    getPosition: d => [...d.pos, d.h + 500], getRadius: d => 34000 + 20000 * ((t * .6 + d.year * .13) % 1), getFillColor: [227, 140, 74, 40],
    getLineColor: d => [255, 190, 120, 255 * (1 - ((t * .6 + d.year * .13) % 1))], opacity, updateTriggers: { getRadius: t, getLineColor: t },
  });
  const core = new ColumnLayer({
    id: "events-core", data: ev, diskResolution: 14, radius: 14000, extruded: true, getPosition: d => [...d.pos, d.h], getElevation: 70000, getFillColor: [255, 170, 90, 255],
    opacity, material: MATERIAL, pickable: true,
  });
  const text = new TextLayer({
    id: "events-text", data: ev, getPosition: d => [...d.pos, d.h + 80000], getText: d => `${d.name.split(",")[0]} ${d.year}`, getSize: 12, getColor: [230, 245, 245, 255],
    fontFamily: "Manrope, Segoe UI, sans-serif", fontWeight: 600, outlineWidth: 3, outlineColor: [4, 20, 29, 230], background: false, billboard: true, getPixelOffset: [0, -6], fontSettings: { sdf: true },
    opacity,
  });
  return [rings, core, text];
}

export function climateLayer(ctx, { opacity }) {
  const rows = ctx.projection.filter(d => d.delta > 0.012);
  return new ColumnLayer({
    id: "climate-columns", data: rows, diskResolution: 6, radius: 15000, extruded: true, material: MATERIAL, opacity, pickable: true,
    getPosition: d => [...d.pos, HIST_H(d.base)], getElevation: d => d.delta * 1.4e6,
    getFillColor: d => [...lerpRamp(CLIMATE_STOPS, d.delta / 0.22), 240],
    updateTriggers: { getElevation: ctx.climateStamp, getFillColor: ctx.climateStamp },
  });
}
