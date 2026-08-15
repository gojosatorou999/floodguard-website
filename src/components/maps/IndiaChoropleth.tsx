import type { RegionMapAsset, RegionValues, AdminLevel } from "@/data/geo/types";

interface Props {
  /** null until an asset is wired — component renders its empty state. */
  asset: RegionMapAsset | null;
  values: RegionValues;
  level: AdminLevel;
  onSelectRegion?: (id: string) => void;
  selectedId?: string | null;
}

/**
 * Renders whatever RegionMapAsset it's handed. Knows nothing about India
 * specifically, nor about where geometry came from — that's the point.
 *
 * TODO: bucket values against ChoroplethScale → --map-1..7; hover tooltip;
 * keyboard-navigable regions with accessible names; <title>/<desc> on the
 * svg; a plain data table fallback for screen readers.
 */
export default function IndiaChoropleth({ asset, values, level }: Props) {
  if (!asset) {
    return (
      <div data-map-empty role="img" aria-label={`${level} map — data not yet wired`}>
        {/* TODO: skeleton/placeholder outline */}
      </div>
    );
  }

  return (
    <svg viewBox={asset.viewBox} role="img">
      {asset.features.map((f) => (
        <path key={f.id} d={f.d} data-region={f.id} data-value={values[f.id] ?? undefined} />
      ))}
    </svg>
  );
}
