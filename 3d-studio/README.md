# FloodGuard 3D Studio

Flood intelligence on a lit 3D terrain model of India's flood-prone regions: MapLibre base map, deck.gl analytical layers, a Three.js terrain/water/rain layer, and an exploded layer stack.

This was split out of the FloodGuard marketing site (`floodguard-website`) so it can grow as its own project. It is no longer part of that site.

```
npm install
npm run dev        # http://localhost:5173/studio.html
npm run build      # -> dist/
npm run shot       # headless screenshot: node tools/studio-shot.mjs [region] [name] [WxH]
                   #   (needs `npx playwright install chromium`, and the dev server running)
```

## What's here

| Path | What |
|---|---|
| `studio.html` | the page: hero, the studio, the exploded stack, the data-sources section |
| `assets/studio.css` | the studio's design (always dark navy / teal, whatever the site theme) |
| `assets/js/studio-page.js` | entry: lazy-loads the libraries, falls back to the flat SVG map without WebGL 2 |
| `assets/js/studio/` | the engine. See `assets/js/studio/README.md` for the file-by-file map |
| `assets/geo/india-map.json` | boundaries + rivers (DataMeet CC BY 2.5 IN, Natural Earth) |
| `scripts/geo/build-india-map.mjs` | rebuilds `india-map.json` from source data (`mapshaper` is a devDependency) |
| `tools/studio-shot.mjs` | headless screenshot helper |

## Left over from the website (rework these)

The page still wears the website's chrome so it runs exactly as it did:

- `fg-base.css`, `fg-pages.css`, `webinar.css`, `assets/fonts/`, `assets/img/logo-mark.png`: the site's design system, fonts and logo.
- `nav.js`, `theme.js`, `mist.js`, `totop.js`, `page.js`, `smooth-scroll.js`: header, theme toggle, background, scroll behaviour.
- The header/footer links (`/products.html`, `/solutions.html`, `/contact.html` ...) point at website pages that don't exist here. Replace them with your own navigation or remove them.
- The "Request a Demo" buttons keep their `data-lead` attribute but the website's lead form (`lead.js`, Supabase) was **not** copied, so they are plain links. The webinar registration popup was left behind too: webinar links go straight to the URL in `webinar.config.json`.
- `fg-map.js` is only the flat-map fallback when WebGL 2 is missing.

## Data and keys

No API keys. Terrain: Mapzen / AWS Terrain Tiles (`s3.amazonaws.com/elevation-tiles-prod`). Satellite and rainfall: NASA GIBS (`gibs.earthdata.nasa.gov`). To go production-grade, host the DEM and imagery on your own CDN or tile server and change the URLs in `assets/js/studio/real/terrain-tiles.js` and `real/gibs.js`.

Population/assets (`simulated/exposure.js`) and climate (`simulated/climate.js`) are labelled **simulated placeholders**; the flood depths come from a screening model (height above nearest drainage), not hydrodynamic simulation.

## Licences

MapLibre GL JS (BSD-3-Clause), deck.gl (MIT), Three.js (MIT). Terrarium and NASA GIBS require the attribution already shown on the map.
