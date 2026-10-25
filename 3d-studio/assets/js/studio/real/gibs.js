/* ── REAL DATA · NASA GIBS ────────────────────────────────────────
   Satellite imagery and satellite rainfall straight from NASA Worldview's
   public tile service (no key, CORS open, "default" = latest available):

     VIIRS_SNPP_CorrectedReflectance_TrueColor   daily true-colour, ~250 m
     IMERG_Precipitation_Rate                    GPM IMERG, mm/h, 30 min

   NASA data are free to use; credit "NASA GIBS / ESDIS" is shown on the stage. */
import { windowFrame } from "/assets/js/studio/geo.js";

const BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
export const GIBS = {
  sat: { layer: "VIIRS_SNPP_CorrectedReflectance_TrueColor", set: "GoogleMapsCompatible_Level9", ext: "jpg", maxzoom: 9 },
  rain: { layer: "IMERG_Precipitation_Rate", set: "GoogleMapsCompatible_Level6", ext: "png", maxzoom: 6 },
};
export const gibsTemplate = (k, time = "default") => {
  const g = GIBS[k];
  return `${BASE}/${g.layer}/default/${time}/${g.set}/{z}/{y}/{x}.${g.ext}`;
};
export const GIBS_ATTRIBUTION = "Imagery & rainfall: NASA GIBS / ESDIS (VIIRS, GPM IMERG)";

const TS = 256;
const loadImg = url => new Promise(res => {
  const im = new Image(); im.crossOrigin = "anonymous";
  im.onload = () => res(im); im.onerror = () => res(null); im.src = url;
});

/**
 * Satellite picture of an analysis window on a regular lon/lat canvas, so it
 * can be draped over the terrain mesh. Resolves to { canvas, ok, total } —
 * `ok` is how many tiles arrived; 0 means "no imagery", never an exception.
 */
export async function windowMosaic(region, k = "sat", zoom = 8, outW = 1024) {
  const F = windowFrame(region), g = GIBS[k], z = Math.min(zoom, g.maxzoom);
  const n = TS * 2 ** z;
  const X = lon => (lon + 180) / 360 * n;
  const Y = lat => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n; };
  const x0 = X(F.lon0), x1 = X(F.lon1), y0 = Y(F.lat1), y1 = Y(F.lat0);
  const tx0 = Math.floor(x0 / TS), tx1 = Math.floor(x1 / TS), ty0 = Math.floor(y0 / TS), ty1 = Math.floor(y1 / TS);
  const mos = document.createElement("canvas");
  mos.width = (tx1 - tx0 + 1) * TS; mos.height = (ty1 - ty0 + 1) * TS;
  const mg = mos.getContext("2d");
  const jobs = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    jobs.push(loadImg(gibsTemplate(k).replace("{z}", z).replace("{y}", ty).replace("{x}", tx)).then(im => { if (im) mg.drawImage(im, (tx - tx0) * TS, (ty - ty0) * TS); return !!im; }));
  }
  const ok = (await Promise.all(jobs)).filter(Boolean).length;
  const outH = Math.round(outW * F.heightM / F.widthM);
  const out = document.createElement("canvas"); out.width = outW; out.height = outH;
  const og = out.getContext("2d");
  /* mercator rows → equal-latitude rows: one thin strip per output row (row 0 = south) */
  const sx = x0 - tx0 * TS, sw = x1 - x0;
  for (let r = 0; r < outH; r++) {
    const lat = F.lat0 + (r + .5) / outH * (F.lat1 - F.lat0), py = Y(lat) - ty0 * TS;
    og.drawImage(mos, sx, py - .5, sw, 1, 0, r, outW, 1);
  }
  return { canvas: out, ok, total: jobs.length };
}
