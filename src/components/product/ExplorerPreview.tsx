import IndiaChoropleth from "../maps/IndiaChoropleth";

/**
 * Preview slot for the Explorer ProductCard: a cropped, non-interactive
 * district map. Reuses the same choropleth so there's one map component.
 *
 * TODO: crop/zoom framing, decorative UI chrome around the map.
 */
export default function ExplorerPreview() {
  return (
    <div data-preview="explorer" aria-hidden="true">
      <IndiaChoropleth asset={null} values={{}} level="district" />
    </div>
  );
}
