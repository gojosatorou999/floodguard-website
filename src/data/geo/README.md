# Map assets

Geometry lives here as data. No component hardcodes paths.

## Expected files

| File | Level | Used by |
|---|---|---|
| `india-districts.json` | district | Hero choropleth, Explorer preview |
| `india-states.json` | state | FloodStoryTimeline secondary map |

## Shape

Conforms to `RegionMapAsset` in [`types.ts`](./types.ts):

```jsonc
{
  "viewBox": "0 0 1000 1100",
  "level": "district",
  "meta": { "projection": "EPSG:7755 / mercator", "source": "…", "generated": "2026-08-13" },
  "features": [
    { "id": "IN-TG-HYD", "name": "Hyderabad", "level": "district",
      "parentId": "IN-TG", "d": "M512,388L…Z", "centroid": [514, 392] }
  ]
}
```

## Producing it

Either is fine — the component doesn't care:

1. **Pre-generated SVG paths (preferred).** Project + simplify offline
   (mapshaper / `d3-geo`), commit the JSON. No projection library ships
   to the browser, and the payload is far smaller.
2. **Raw GeoJSON.** Keep it only if boundaries need reprojecting at
   runtime; then add `d3-geo` and convert inside the loader, not the
   component.

Simplify hard. Full-resolution district boundaries for India run into
several MB — target well under 300KB gzipped for a marketing page.

## Not yet decided

- Source of boundaries and its licence/attribution requirements
- Whether taluka-level geometry ships on the marketing site at all, or
  stays inside the Explorer product
