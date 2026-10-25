/* ── layer registry ───────────────────────────────────────────────
   One entry per disaster-intelligence layer: what it is, whether its data
   is real / derived / simulated, its legend, and its default visibility
   and opacity. How a layer is drawn lives in studio.js (`apply`); keeping
   the catalogue here is what lets the panel, the legend and the 3D layer
   stack all read from one list.

   data:  real       measured / observed, fetched at runtime
          derived    computed in the browser from real data
          simulated  illustrative placeholder — never FloodGuard output        */
export const BADGE = {
  real: ["Real data", "Measured or observed; fetched at runtime"],
  derived: ["Derived", "Computed in your browser from real terrain data"],
  simulated: ["Simulated", "Illustrative placeholder, not FloodGuard model output"],
  mixed: ["Real + simulated", "Real satellite rainfall, with a simulated design-storm field over the 3D window"],
};

export const LAYERS = [
  {
    id: "rain", name: "Rainfall intensity", data: "mixed", on: true, opacity: .8, color: "#6fd6e0",
    blurb: "Latest NASA GPM IMERG rain rate across India; in the 3D window a simulated design storm falls on the terrain, scaled to the scenario.",
    legend: { type: "ramp", unit: "mm/h", stops: [["#1e8f4e", "0.1"], ["#9bd23a", "1"], ["#f2d33b", "4"], ["#f08a24", "12"], ["#d62d20", "30+"]] },
    sources: "NASA GIBS · GPM IMERG",
  },
  {
    id: "history", name: "Historical flood zones", data: "simulated", on: true, opacity: .9, color: "#e38c4a",
    blurb: "Districts extruded by an illustrative historical flood-frequency index, with eleven recorded events marked.",
    legend: { type: "steps", items: [["#0f2b33", "Low"], ["#1f7d98", "Moderate"], ["#7cc4a0", "High"], ["#e38c4a", "Very high"]] },
    sources: "DataMeet district boundaries (CC BY 2.5 IN) · heuristic index",
  },
  {
    id: "terrain", name: "Terrain & elevation", data: "real", on: true, opacity: 1, color: "#7cc4a0",
    blurb: "Real elevation: GPU colour-relief across India, and a lit 3D mesh with contours and metric grid in the analysis window.",
    legend: { type: "ramp", unit: "m", stops: [["#06222e", "sea"], ["#0d4150", "120"], ["#14585d", "350"], ["#2a7569", "800"], ["#5b9a80", "1,600"], ["#9bb592", "3,200"], ["#e6e8d4", "5,000+"]] },
    sources: "Mapzen / AWS Terrain Tiles (SRTM, ASTER, GMTED)",
  },
  {
    id: "drainage", name: "Drainage network", data: "derived", on: true, opacity: .9, color: "#56c8dc",
    blurb: "Natural Earth rivers across India; in the window, a stream network traced from the terrain by flow accumulation, with animated flow.",
    legend: { type: "steps", items: [["#56c8dc", "Stream"], ["#9be4ef", "River"], ["#d2faff", "Main stem"]], note: "Line weight = upstream area" },
    sources: "Natural Earth rivers · flow routing from the DEM",
  },
  {
    id: "satellite", name: "Satellite observations", data: "real", on: false, opacity: .8, color: "#9edad9",
    blurb: "Latest daily VIIRS true-colour imagery from NASA, draped over the 3D terrain.",
    legend: { type: "steps", items: [["#3d5f4a", "Vegetation"], ["#8f7d5a", "Bare / dry"], ["#c9d6dc", "Cloud"], ["#1c3d52", "Water"]], note: "VIIRS SNPP corrected reflectance, daily" },
    sources: "NASA GIBS · VIIRS SNPP",
  },
  {
    id: "climate", name: "Climate projections", data: "simulated", on: false, opacity: .95, color: "#e0c062",
    blurb: "Columns raised on each district show the added flood-risk index under the chosen warming scenario and horizon (SSP2-4.5 at 2050 while the scenario is set to Today).",
    legend: { type: "ramp", unit: "added risk index", stops: [["#e0c062", "+0.02"], ["#e38c4a", "+0.08"], ["#d4552b", "+0.15"], ["#a82a22", "+0.22"]] },
    sources: "Coarse warming curves · illustrative sensitivities",
  },
  {
    id: "hazard", name: "Hazard probability", data: "derived", on: false, opacity: .92, color: "#e0c062",
    blurb: "Annual chance each grid cell floods, from height above nearest drainage, under the chosen climate scenario. Cell height = probability.",
    legend: { type: "ramp", unit: "annual probability", stops: [["#1f7d98", "1%"], ["#36a6b8", "3%"], ["#7cc4a0", "8%"], ["#e0c062", "20%"], ["#e38c4a", "35%"], ["#d4552b", "50%"]] },
    sources: "Screening model on real terrain (HAND)",
  },
  {
    id: "exposure", name: "Population & infrastructure", data: "simulated", on: false, opacity: .95, color: "#f0b84e",
    blurb: "Settlement-model population columns and sample critical assets. Anything inside the current flood turns orange.",
    legend: { type: "ramp", unit: "people per cell", stops: [["#4a3a2a", "few"], ["#8f6a34", ""], ["#d49a3e", ""], ["#f0b84e", ""], ["#ffd98a", "dense"]], extra: [["#ff6a3d", "Inside flood"]] },
    sources: "Seeded settlement model · replace with WorldPop / OSM",
  },
  {
    id: "scenario", name: "Flood depth & risk scenario", data: "derived", on: true, opacity: .95, color: "#2fb0c8",
    blurb: "A living water surface for the chosen return period and climate. Switch on depth bars to read the depth in each cell.",
    legend: { type: "ramp", unit: "metres", stops: [["#6dd5e3", "0.1"], ["#2fb0c8", "1"], ["#1688ad", "2"], ["#0e5f94", "4"], ["#133f7a", "6"], ["#241d5e", "6+"]] },
    sources: "Bathtub-on-HAND screening model",
  },
];
export const byId = Object.fromEntries(LAYERS.map(l => [l.id, l]));

export const RETURN_PERIODS = [10, 25, 100, 500];
export const HORIZON_MIN = 2025, HORIZON_MAX = 2100;
