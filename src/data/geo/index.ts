import type { RegionMapAsset, RegionValues, ChoroplethScale } from "./types";

/**
 * Loader stub. Swap the implementation, not the call sites.
 *
 * TODO: drop the real asset into this folder as `india-districts.json`
 * / `india-states.json` (see ./README.md for the expected shape), then
 * replace the throw with a dynamic import so it code-splits:
 *
 *   const mod = await import("./india-districts.json");
 *   return mod.default as RegionMapAsset;
 */
export async function loadMapAsset(
  level: "state" | "district"
): Promise<RegionMapAsset> {
  throw new Error(`No map asset wired for level "${level}". See src/data/geo/README.md`);
}

/** Placeholder metric. Real risk values get wired in later. */
export async function loadRegionValues(_metric: string): Promise<RegionValues> {
  return {};
}

/** Fallback scale so the legend renders before real data exists. */
export const placeholderScale: ChoroplethScale = {
  breaks: [10, 25, 40, 55, 70, 85],
  unit: "%",
  label: "Exposure",
};

export type { RegionMapAsset, RegionValues, ChoroplethScale };
