# 3D Studio (`/studio.html`)

MapLibre base + deck.gl analytical layers + a Three.js terrain/water/rain layer, plus an exploded Three.js layer stack.
Everything is lazy: `assets/js/studio-page.js` fetches the libraries only when the section nears the viewport and WebGL 2 exists; otherwise it falls back to the flat SVG map (`fg-map.js`).

| File | Role |
|---|---|
| `studio.js` | controller: map, LOD, layer panel, scenario, hover, status badges |
| `three-terrain.js` | MapLibre custom layer — terrain slab, contours, grid, water, rain (GLSL) |
| `deck-layers.js` | deck.gl layer factories (hazard / exposure / depth cells, drainage + flow, events, climate) |
| `analysis.js` | priority-flood flow routing, accumulation, HAND, sky-view, flood + hazard fields |
| `real/` | **real data**: Terrarium DEM tiles (`terrain-tiles.js`), NASA GIBS (`gibs.js`) |
| `simulated/` | **placeholders**: population/assets (`exposure.js`), climate (`climate.js`) |
| `registry.js` | the nine layers: legend, data class (real / derived / simulated), defaults |
| `stack3d.js` | exploded layer stack |

## Data and keys
No API keys. Terrain: `s3.amazonaws.com/elevation-tiles-prod` (Mapzen / AWS Terrain Tiles). Satellite + rainfall: NASA GIBS (`gibs.earthdata.nasa.gov`). Boundaries/rivers: `assets/geo/india-map.json` (DataMeet CC BY 2.5 IN, Natural Earth).
To go production-grade, host the DEM and imagery on your own CDN/tile server and change the URLs in `real/terrain-tiles.js` and `real/gibs.js`.

## Licences
MapLibre GL JS (BSD-3-Clause), deck.gl (MIT), Three.js (MIT). Terrarium / NASA GIBS require the attribution already shown on the map.
Analysis and shaders were written for this project from published method descriptions. `quanta1985/terraslice3d` has no licence file, so none of its code was used.
