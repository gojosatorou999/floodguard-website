/* ── SIMULATED DATA · climate projections ─────────────────────────
   PLACEHOLDER. Warming per scenario is a coarse global-mean curve, and the
   per-district change in flood-risk index is the illustrative `change`
   value from assets/geo/india-map.json scaled by that warming. It is not a
   downscaled CMIP6 projection. Swap `districtProjection` for FloodGuard's
   real scenario grid when it exists; the layer only reads the returned list. */
import { SSP, climateFactor } from "/assets/js/studio/analysis.js";

export { SSP, climateFactor };
export const HORIZONS = [2030, 2040, 2050, 2070, 2100];

/** → [{ name, state, pos:[lon,lat], base, delta, value }] ; delta in risk-index points (0–1) */
export function districtProjection(D, ssp, year) {
  const { rain } = climateFactor(ssp, year);
  return D.districts.map(d => {
    const base = d[7] / 100, k = d[8] / 100;           // base risk, sensitivity to climate
    const delta = Math.min(1 - base, k * (rain - 1) * 2.2);
    return { name: d[0], state: d[1], pos: [d[5], d[6]], base, delta, value: base + delta };
  });
}
