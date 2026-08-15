/**
 * Map geometry is a SWAPPABLE ASSET, never hardcoded in a component.
 * Components receive `RegionMapAsset` + `RegionValues` as props and
 * know nothing about where either came from.
 */

export type AdminLevel = "state" | "district" | "taluka";

/** Stable key. Suggest ISO-ish: "IN-TG" (state), "IN-TG-HYD" (district). */
export type RegionId = string;

export interface RegionFeature {
  id: RegionId;
  name: string;
  level: AdminLevel;
  /** Parent region, e.g. a district's state. */
  parentId?: RegionId;
  /** Pre-projected SVG path. Pre-generating beats projecting at runtime. */
  d: string;
  /** Label anchor in viewBox units. */
  centroid?: [number, number];
}

export interface RegionMapAsset {
  /** e.g. "0 0 1000 1100" */
  viewBox: string;
  level: AdminLevel;
  /** Provenance — which projection/simplification produced this. */
  meta?: { projection?: string; source?: string; generated?: string };
  features: RegionFeature[];
}

/** Metric values keyed by region. Missing key renders as --map-null. */
export type RegionValues = Record<RegionId, number | null>;

/** Buckets a continuous value into the 7-step ramp. */
export interface ChoroplethScale {
  /** Ascending upper bounds; length should be ramp length - 1. */
  breaks: number[];
  unit?: string;
  label?: string;
}
