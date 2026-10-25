/* ── MapLibre base style ──────────────────────────────────────────
   No commercial basemap, no API key: the base is a night-navy ground,
   GPU colour-relief + hillshade from the open Terrarium DEM, NASA GIBS
   satellite and rainfall rasters, and the site's own district / river
   geometry. Layers are listed bottom → top; the Three.js terrain and the
   deck.gl overlay are added above these.                                  */
import { TERRARIUM_URL, TERRARIUM_ATTRIBUTION } from "/assets/js/studio/real/terrain-tiles.js";
import { gibsTemplate, GIBS_ATTRIBUTION } from "/assets/js/studio/real/gibs.js";
import { HIST_H } from "/assets/js/studio/deck-layers.js";

export const RISK_RAMP = ["#0f2b33", "#133f4f", "#175a73", "#1f7d98", "#36a6b8", "#7cc4a0", "#e0c062", "#e38c4a"];
const riskColor = ["interpolate", ["linear"], ["get", "risk"], 0, RISK_RAMP[0], .18, RISK_RAMP[1], .34, RISK_RAMP[2], .5, RISK_RAMP[3], .64, RISK_RAMP[4], .77, RISK_RAMP[5], .87, RISK_RAMP[6], .95, RISK_RAMP[7]];

export function buildStyle({ districts, rivers }) {
  return {
    version: 8,
    projection: { type: "mercator" },
    sources: {
      dem: { type: "raster-dem", tiles: [TERRARIUM_URL], encoding: "terrarium", tileSize: 256, maxzoom: 12, attribution: TERRARIUM_ATTRIBUTION },
      sat: { type: "raster", tiles: [gibsTemplate("sat")], tileSize: 256, maxzoom: 9, attribution: GIBS_ATTRIBUTION },
      imerg: { type: "raster", tiles: [gibsTemplate("rain")], tileSize: 256, maxzoom: 6 },
      districts: { type: "geojson", data: districts, generateId: false },
      rivers: { type: "geojson", data: rivers },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#04121a" } },
      {
        id: "relief", type: "color-relief", source: "dem",
        paint: {
          "color-relief-opacity": .95,
          "color-relief-color": ["interpolate", ["linear"], ["elevation"],
            -4000, "#020a10", -60, "#03141d", -1, "#06222e", 0, "#082c3b", 1, "#0a3342", 120, "#0d4150", 350, "#14585d", 800, "#2a7569", 1600, "#5b9a80", 3200, "#9bb592", 5200, "#cfd3ba", 7000, "#f1f3ea"],
        },
      },
      { id: "hillshade", type: "hillshade", source: "dem", paint: { "hillshade-exaggeration": .55, "hillshade-shadow-color": "#01090e", "hillshade-highlight-color": "#8fc7cc", "hillshade-accent-color": "#0a2c38", "hillshade-illumination-direction": 315 } },
      { id: "sat", type: "raster", source: "sat", layout: { visibility: "none" }, paint: { "raster-opacity": .8, "raster-saturation": -.15, "raster-brightness-max": .9, "raster-fade-duration": 300 } },
      { id: "imerg", type: "raster", source: "imerg", layout: { visibility: "none" }, paint: { "raster-opacity": .85, "raster-resampling": "linear", "raster-fade-duration": 300 } },
      {
        id: "hist-ext", type: "fill-extrusion", source: "districts",
        paint: {
          "fill-extrusion-color": riskColor,
          "fill-extrusion-height": ["*", ["case", ["boolean", ["feature-state", "hover"], false], 1.12, 1], 80000, ["^", ["get", "risk"], 1.6]],
          "fill-extrusion-base": 0, "fill-extrusion-opacity": .9, "fill-extrusion-vertical-gradient": true,
        },
      },
      { id: "hist-line", type: "line", source: "districts", paint: { "line-color": "#9edad9", "line-opacity": .16, "line-width": .5 } },
      {
        id: "rivers", type: "line", source: "rivers",
        paint: {
          "line-color": "#6dd5e3", "line-opacity": ["interpolate", ["linear"], ["zoom"], 3, .55, 8, .35],
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, ["match", ["get", "rank"], [1, 2, 3], 1.2, [4, 5], .9, .6], 8, ["match", ["get", "rank"], [1, 2, 3], 3, [4, 5], 2.2, 1.4]],
        },
        layout: { "line-cap": "round", "line-join": "round" },
      },
    ],
  };
}
export { HIST_H };

/* which style layers belong to each studio layer */
export const MAP_LAYERS = {
  rain: ["imerg"], satellite: ["sat"], history: ["hist-ext", "hist-line"], terrain: ["relief", "hillshade"], drainage: ["rivers"],
};
export const OPACITY_PROP = { relief: "color-relief-opacity", hillshade: "hillshade-exaggeration", sat: "raster-opacity", imerg: "raster-opacity", "hist-ext": "fill-extrusion-opacity", "hist-line": "line-opacity", rivers: "line-opacity" };
