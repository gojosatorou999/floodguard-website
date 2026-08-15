import type { ChoroplethScale } from "@/data/geo/types";

interface Props {
  scale: ChoroplethScale | null;
}

/**
 * Discrete 7-step legend for the choropleth ramp.
 *
 * TODO: render swatches from --map-1..7 with break labels; include a
 * "no data" swatch bound to --map-null.
 */
export default function MapLegend({ scale }: Props) {
  if (!scale) return null;

  return (
    <div data-legend>
      <span className="mono">{scale.label}</span>
      {/* TODO: swatch row + tabular break labels */}
    </div>
  );
}
