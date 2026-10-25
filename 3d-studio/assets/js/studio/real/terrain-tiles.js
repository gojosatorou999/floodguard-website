/* ── REAL DATA · elevation ────────────────────────────────────────
   Samples a regular lon/lat height grid for an analysis window from the
   public "Terrarium" DEM tiles (Mapzen / AWS Open Data Terrain Tiles —
   SRTM, ASTER, GMTED and others, no key, CORS open). If tiles are
   unreachable the grid falls back, cell by cell, to the ETOPO1 0.25° model
   that already ships inside assets/geo/india-map.json: coarse, but still
   measured elevation, and the badge on the stage says which one you got.

   Terrarium: elevation_m = R·256 + G + B/256 − 32768                     */
import { loadIndia, windowFrame } from "/assets/js/studio/geo.js";

export const TERRARIUM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
export const TERRARIUM_ATTRIBUTION = "Terrain: Mapzen / AWS Terrain Tiles (SRTM, ASTER, GMTED) · ETOPO1";

const TS = 256;
const tileUrl = (z, x, y) => TERRARIUM_URL.replace("{z}", z).replace("{x}", x).replace("{y}", y);
const merc = (lon, lat, z) => {
  const n = TS * 2 ** z, s = Math.sin(lat * Math.PI / 180);
  return [(lon + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
};

async function fetchTile(z, x, y, signal) {
  const r = await fetch(tileUrl(z, x, y), { mode: "cors", signal });
  if (!r.ok) throw new Error("tile " + r.status);
  const bmp = await createImageBitmap(await r.blob());
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(TS, TS) : Object.assign(document.createElement("canvas"), { width: TS, height: TS });
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  bmp.close?.();
  return g.getImageData(0, 0, TS, TS).data;
}

/* ETOPO1 as bundled: q = round(sqrt(z / zmax) · 255), ocean forced to 0 */
function bundledSampler(D) {
  const { nx, ny, lon0, lat0, step, zmax, q } = D.dem;
  const bin = atob(q), Zq = new Float32Array(nx * ny);
  for (let i = 0; i < Zq.length; i++) { const v = bin.charCodeAt(i) / 255; Zq[i] = v * v * zmax; }
  const at = (ix, iy) => Zq[Math.max(0, Math.min(ny - 1, iy)) * nx + Math.max(0, Math.min(nx - 1, ix))];
  return (lon, lat) => {
    const fx = (lon - lon0) / step, fy = (lat - lat0) / step, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
    return (at(ix, iy) * (1 - u) + at(ix + 1, iy) * u) * (1 - v) + (at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u) * v;
  };
}

/**
 * loadWindowDEM(region, {nx, zoom, signal}) →
 *   { nx, ny, z: Float32Array (row 0 = south edge), dx, dy (metres per cell),
 *     source: "terrarium" | "mixed" | "etopo1", missing: 0..1, tiles: [ok, total] }
 */
export async function loadWindowDEM(region, { nx = 256, zoom = 9, signal } = {}) {
  const F = windowFrame(region);
  const ny = Math.round(nx * F.heightM / F.widthM);
  const dx = F.widthM / nx, dy = F.heightM / ny;
  const [pxW, pyN] = merc(F.lon0, F.lat1, zoom), [pxE, pyS] = merc(F.lon1, F.lat0, zoom);
  const tx0 = Math.floor(pxW / TS), tx1 = Math.floor(pxE / TS), ty0 = Math.floor(pyN / TS), ty1 = Math.floor(pyS / TS);
  const jobs = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) jobs.push({ tx, ty });
  await Promise.all(jobs.map(j => fetchTile(zoom, j.tx, j.ty, signal).then(d => { j.data = d; }, () => { j.data = null; })));
  const ok = jobs.filter(j => j.data).length;

  const D = await loadIndia().catch(() => null);
  const fallback = D ? bundledSampler(D) : () => 0;
  const byKey = new Map(jobs.map(j => [j.tx + "," + j.ty, j.data]));
  const px = (X, Y) => {                       // elevation at a mosaic pixel, NaN if its tile is missing
    const d = byKey.get(Math.floor(X / TS) + "," + Math.floor(Y / TS));
    if (!d) return NaN;
    const o = ((Math.floor(Y) % TS) * TS + (Math.floor(X) % TS)) * 4;
    return d[o] * 256 + d[o + 1] + d[o + 2] / 256 - 32768;
  };
  const z = new Float32Array(nx * ny);
  let miss = 0;
  for (let iy = 0; iy < ny; iy++) {
    const lat = F.lat0 + (iy + .5) / ny * (F.lat1 - F.lat0);
    for (let ix = 0; ix < nx; ix++) {
      const lon = F.lon0 + (ix + .5) / nx * (F.lon1 - F.lon0);
      const [X, Y] = merc(lon, lat, zoom);
      const fx = X - .5, fy = Y - .5, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
      const a = px(i, j), b = px(i + 1, j), c = px(i, j + 1), d = px(i + 1, j + 1);
      let h = (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
      if (Number.isNaN(h)) { h = fallback(lon, lat); miss++; }
      z[iy * nx + ix] = h;
    }
  }
  const missing = miss / z.length;
  return { nx, ny, z, dx, dy, frame: F, missing, tiles: [ok, jobs.length], source: missing === 0 ? "terrarium" : missing >= .999 ? "etopo1" : "mixed" };
}
