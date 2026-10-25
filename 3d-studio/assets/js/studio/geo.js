/* ── studio · geography helpers ───────────────────────────────────
   Turns the site's pre-projected India map (assets/geo/india-map.json,
   SVG paths in a Lambert conformal conic) back into lon/lat GeoJSON so
   MapLibre and deck.gl can use the very same boundaries, rivers and
   district values as the SVG maps. Also: the analysis windows, and the
   small mercator/metre helpers the 3D layers share.

   REAL   district boundaries (DataMeet, CC BY 2.5 IN), rivers (Natural Earth)
   MODEL  the per-district risk numbers inside the file are an illustrative
          heuristic (see scripts/geo/build-india-map.mjs), not FloodGuard output. */
import mapUrl from "/assets/geo/india-map.json?url";

let dataP;
export const loadIndia = () => (dataP ||= fetch(mapUrl).then(r => { if (!r.ok) throw new Error("india-map " + r.status); return r.json(); }));

const R = Math.PI / 180;

/* inverse of the forward projection in fg-map.js → [lon, lat] */
export function unprojector(D) {
  const { n, F, rho0, lam0, s, tx, ty } = D.proj;
  return (x, y) => {
    const X = (x - tx) / s, Y = rho0 + (y - ty) / s;
    const rho = Math.hypot(X, Y), th = Math.atan2(X, Y);
    const lat = 2 * Math.atan(Math.pow(F / rho, 1 / n)) - Math.PI / 2;
    return [lam0 + th / n / R, lat / R];
  };
}

/* "M x y l dx dy … z" (absolute start, relative after, several subpaths) → rings */
export function pathToRings(d, inv) {
  const rings = [];
  for (const sub of d.split(/(?=M)/)) {
    const m = sub.match(/^M\s*(-?[\d.]+)[ ,]\s*(-?[\d.]+)([^z]*)/);
    if (!m) continue;
    let x = +m[1], y = +m[2];
    const ring = [inv(x, y)];
    const nums = m[3].replace(/^\s*l/, "").match(/-?\d*\.?\d+/g) || [];
    for (let i = 0; i + 1 < nums.length; i += 2) { x += +nums[i]; y += +nums[i + 1]; ring.push(inv(x, y)); }
    if (ring.length > 2) { ring.push(ring[0]); rings.push(ring); }
  }
  return rings;
}

/* districts → FeatureCollection with the heuristic risk values as properties */
export function districtsGeoJSON(D) {
  const inv = unprojector(D);
  return {
    type: "FeatureCollection",
    features: D.districts.map((d, i) => ({
      type: "Feature", id: i,
      properties: { name: d[0], state: d[1], lon: d[5], lat: d[6], risk: d[7] / 100, change: d[8] / 100 },
      geometry: { type: "MultiPolygon", coordinates: pathToRings(d[2], inv).map(r => [r]) },
    })),
  };
}
export function riversGeoJSON(D) {
  const inv = unprojector(D);
  return {
    type: "FeatureCollection",
    features: D.rivers.map(([rank, d], i) => ({
      type: "Feature", id: i, properties: { rank },
      geometry: { type: "MultiLineString", coordinates: pathToRings(d, inv).map(r => r.slice(0, -1)) },
    })),
  };
}
export function outlineGeoJSON(D) {
  const inv = unprojector(D);
  return { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: pathToRings(D.outline, inv).map(r => [r]) } };
}

/* recorded floods and cities carry map x/y only — back to lon/lat */
export function eventsLonLat(D) {
  const inv = unprojector(D);
  return D.events.map(([name, year, x, y]) => ({ name, year, pos: inv(x, y) }));
}
export function citiesLonLat(D) {
  const inv = unprojector(D);
  return D.cities.map(([name, x, y, w]) => ({ name, w, pos: inv(x, y) }));
}

/* ── analysis windows ─────────────────────────────────────────────
   Each is ~1.6° × 1.3° (about 170 × 140 km): large enough to hold a river
   basin, small enough to hold a fine grid. Picked for real flood history. */
export const REGIONS = [
  { id: "konkan", name: "Mumbai & Konkan", note: "Ghats, short steep rivers, tidal creeks · 2005 Mumbai floods", center: [73.35, 19.1], span: [1.7, 1.35], sea: true },
  { id: "kosi", name: "Kosi plains, Bihar", note: "One of the world's most mobile rivers · 2008 Kosi breach", center: [86.7, 26.1], span: [1.7, 1.35] },
  { id: "assam", name: "Brahmaputra, Assam", note: "Braided channel on a wide floodplain · 2022 Assam floods", center: [91.9, 26.25], span: [1.7, 1.35] },
  { id: "chennai", name: "Chennai coast", note: "Low coastal plain, tank-fed drainage · 2015 Chennai floods", center: [80.0, 13.1], span: [1.5, 1.25], sea: true },
  { id: "kerala", name: "Kerala midlands", note: "Western Ghats to backwaters · 2018 Kerala floods", center: [76.55, 9.95], span: [1.5, 1.25], sea: true },
  { id: "mahanadi", name: "Mahanadi delta, Odisha", note: "Delta distributaries, cyclone-surge coast", center: [85.9, 20.35], span: [1.7, 1.35], sea: true },
];

/* ── metres ↔ degrees and the mercator frame the 3D layers share ── */
export const M_PER_DEG_LAT = 110574;
export const mPerDegLon = lat => 111320 * Math.cos(lat * R);

/** frame for a window: local metres (east, north) from its centre ↔ mercator */
export function windowFrame(region) {
  const [clon, clat] = region.center;
  const [sx, sy] = region.span;
  const mx = mPerDegLon(clat), my = M_PER_DEG_LAT;
  return { clon, clat, mx, my, lon0: clon - sx / 2, lat0: clat - sy / 2, lon1: clon + sx / 2, lat1: clat + sy / 2, widthM: sx * mx, heightM: sy * my };
}
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; };
}
export const hashStr = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
