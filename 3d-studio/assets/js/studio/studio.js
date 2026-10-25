/* ── Flood Intelligence Studio · controller ────────────────────────
   Wires the pieces together:

     MapLibre      interactive base: GPU colour-relief + hillshade from the
                   DEM, NASA GIBS rasters, district extrusion, rivers
     Three.js      the analysis-window terrain slab, water and rain
                   (three-terrain.js, a MapLibre custom layer)
     deck.gl       hazard / exposure / depth cells, drainage lines + flow,
                   recorded floods, climate columns (deck-layers.js)

   Level of detail is zoom-driven: zoomed out you see India (district
   extrusion, climate columns, recorded floods, satellite rainfall); zoom in
   and those cross-fade to the 3D analysis window. Heavy modules, tiles and
   analysis run lazily — nothing here loads until the studio scrolls near.   */
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import {
  loadIndia, districtsGeoJSON, riversGeoJSON, eventsLonLat, citiesLonLat, REGIONS, windowFrame, smooth, clamp,
} from "/assets/js/studio/geo.js";
import { loadWindowDEM } from "/assets/js/studio/real/terrain-tiles.js";
import { windowMosaic } from "/assets/js/studio/real/gibs.js";
import { analyse, floodField, hazardField, channelPaths, climateFactor, rainFor, stageFor, SSP } from "/assets/js/studio/analysis.js";
import { simulateExposure, exposureUnder } from "/assets/js/studio/simulated/exposure.js";
import { districtProjection } from "/assets/js/studio/simulated/climate.js";
import { createTerrain3D } from "/assets/js/studio/three-terrain.js";
import { buildStyle, MAP_LAYERS, OPACITY_PROP, HIST_H } from "/assets/js/studio/map-style.js";
import * as DL from "/assets/js/studio/deck-layers.js";
import { LAYERS, byId, BADGE, RETURN_PERIODS } from "/assets/js/studio/registry.js";
import { CanvasTexture, LinearFilter } from "three";

const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const LITE = matchMedia("(pointer: coarse)").matches || innerWidth < 720;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = (n, d = 0) => n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });
const OVERVIEW = { center: [80.6, 22.4], zoom: LITE ? 3.5 : 4.15, pitch: 42, bearing: -6 };
const VIEWS = { persp: { pitch: 58, bearing: -18 }, iso: { pitch: 47, bearing: 45 }, plan: { pitch: 0, bearing: 0 } };

export async function bootStudio(root, { onReady, onFail } = {}) {
  const el = {
    map: $("#stuMap", root), tip: $("#stuTip", root), status: $("#stuStatus", root), readout: $("#stuReadout", root),
    layers: $("#stuLayers", root), loading: $("#stuLoading", root), hint: $("#stuHint", root),
  };

  /* ── data that exists before any region is picked ── */
  const D = await loadIndia();
  const districts = districtsGeoJSON(D), rivers = riversGeoJSON(D), cities = citiesLonLat(D);
  const events = eventsLonLat(D).map(e => {
    let best = 0, bd = 1e9;
    D.districts.forEach((d, i) => { const dd = (d[5] - e.pos[0]) ** 2 + (d[6] - e.pos[1]) ** 2; if (dd < bd) { bd = dd; best = i; } });
    return { ...e, risk: D.districts[best][7] / 100, h: DL.HIST_H(D.districts[best][7] / 100) };
  });

  /* ── state ── */
  const S = {
    region: null, A: null, terr: null, flood: null, hazard: null, E: null, paths: null, projection: null,
    layers: Object.fromEntries(LAYERS.map(l => [l.id, { on: l.on, opacity: l.opacity }])),
    T: 100, ssp: "none", year: 2050, ex: 1, view: "persp",
    opts: { contour: true, grid: true, wire: false, depthBars: false, storm: true, orbit: false },
    stamp: { ex: 0, flood: 0, climate: 0 }, time: 0, token: 0, lod: 0,
  };

  /* ── status badges ── */
  const status = {};
  const setStatus = (key, state, text) => {
    status[key] = { state, text };
    el.status.innerHTML = Object.values(status).map(s => `<li data-s="${s.state}"><i></i>${s.text}</li>`).join("");
  };

  /* ── map ── */
  const map = new maplibregl.Map({
    container: el.map, style: buildStyle({ districts, rivers }), center: OVERVIEW.center, zoom: OVERVIEW.zoom, pitch: OVERVIEW.pitch, bearing: OVERVIEW.bearing,
    maxPitch: 82, minZoom: 2.5, maxZoom: 13, attributionControl: { compact: true }, canvasContextAttributes: { antialias: true },
    pixelRatio: Math.min(devicePixelRatio || 1, LITE ? 1.5 : 2), fadeDuration: 150, cooperativeGestures: false,
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
  map.getCanvas().addEventListener("webglcontextlost", e => { e.preventDefault(); onFail?.("The graphics context was lost. Reload the page to restore the 3D view."); });
  await new Promise((res, rej) => { map.once("load", res); map.once("error", e => { if (!map.loaded() && !map.isStyleLoaded()) rej(e.error || e); }); });

  /* a persistent custom layer that hosts whichever window is current, so deck.gl layers always sit above it */
  const host = { terr: null };
  map.addLayer({
    id: "terrain3d", type: "custom", renderingMode: "3d",
    onAdd(m, gl) { this._m = m; this._gl = gl; },
    render(gl, a) { host.terr?.layer.render(gl, a); },
  });
  const overlay = new MapboxOverlay({
    interleaved: true, layers: [],
    onHover: info => {
      const o = info.object;
      if (!o) { if (!hoverCell) hideTip(); return; }
      showTip(info.x, info.y, o.type ? `<b>${o.name}</b><em>${o.type} · ${S.flood?.depth[o.i] > 0.1 ? "in the " + S.T + "-year flood · " + S.flood.depth[o.i].toFixed(1) + " m" : "outside the flood"}</em><i>Simulated asset</i>`
        : o.year ? `<b>${o.name}</b><em>Recorded flood · ${o.year}</em>`
          : o.delta != null ? `<b>${o.name}</b><em>${o.state}</em><span>Risk index ${o.base.toFixed(2)} → ${(o.base + o.delta).toFixed(2)}</span><i>Simulated projection</i>` : "");
    },
  });
  map.addControl(overlay);

  /* ── tooltip / readout ── */
  let hoverCell = null;
  const showTip = (x, y, html) => {
    if (!html) return hideTip();
    el.tip.innerHTML = html; el.tip.hidden = false;
    const w = el.tip.offsetWidth, h = el.tip.offsetHeight, cw = el.map.clientWidth, ch = el.map.clientHeight;
    el.tip.style.transform = `translate(${Math.min(cw - w - 8, x + 14)}px, ${Math.min(ch - h - 8, Math.max(8, y - h - 10))}px)`;
  };
  const hideTip = () => { el.tip.hidden = true; };

  /* ── LOD ── */
  function applyLod() {
    const z = map.getZoom(), w = smooth(5.6, 6.9, z), ov = 1 - w;
    S.lod = w;
    S.terr?.set({ fade: w });
    paintMap(ov);
    refreshDeck();
  }

  /* ── MapLibre-side layer state ── */
  function paintMap(ov = 1 - S.lod) {
    const vis = (id, on) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    const op = (id, v) => map.getLayer(id) && map.setPaintProperty(id, OPACITY_PROP[id], v);
    const L = S.layers;
    vis("relief", true); vis("hillshade", true);
    const tOp = L.terrain.on ? L.terrain.opacity : .25;
    op("relief", .95 * tOp); op("hillshade", .55 * (L.terrain.on ? 1 : 0.4) * Math.max(L.terrain.opacity, .2));
    vis("sat", L.satellite.on); op("sat", L.satellite.opacity);
    vis("imerg", L.rain.on); op("imerg", L.rain.opacity);
    const hOn = L.history.on && ov > 0.02;
    vis("hist-ext", hOn); vis("hist-line", hOn);
    op("hist-ext", .92 * L.history.opacity * ov); op("hist-line", .18 * ov);
    vis("rivers", L.drainage.on); op("rivers", .55 * L.drainage.opacity * (0.4 + 0.6 * ov));
  }

  /* ── deck.gl ── */
  const memo = new Map();
  const cached = (key, stamp, fn) => { const m = memo.get(key); if (m && m.stamp === stamp) return m.v; const v = fn(); memo.set(key, { stamp, v }); return v; };
  let deckQueued = false;
  function refreshDeck() {
    if (deckQueued) return; deckQueued = true;
    requestAnimationFrame(() => { deckQueued = false; overlay.setProps({ layers: deckLayers() }); });
  }
  function deckLayers() {
    const out = [], L = S.layers, w = S.lod, ov = 1 - w, t = S.time;
    const ctx = {
      A: S.A, terr: S.terr, flood: S.flood, hazard: S.hazard, E: S.E, time: t, events, projection: S.projection,
      exStamp: S.stamp.ex, floodStamp: S.stamp.flood, climateStamp: S.stamp.climate, paths: S.paths, pathLoop: S.A?.pathLoop,
      memo: cached, stampKey: `${S.stamp.ex}|${S.stamp.flood}`,
    };
    if (L.history.on && ov > 0.05) out.push(...DL.eventLayers(ctx, { opacity: ov * L.history.opacity }));
    if (L.climate.on && ov > 0.03 && S.projection) out.push(DL.climateLayer(ctx, { opacity: ov * L.climate.opacity }));
    if (S.A && S.terr && w > 0.03) {
      if (L.drainage.on) out.push(...DL.drainageLayers(ctx, { opacity: w * L.drainage.opacity }));
      if (L.hazard.on) out.push(DL.hazardLayer(ctx, { opacity: w * L.hazard.opacity }));
      if (L.exposure.on) out.push(...DL.exposureLayers(ctx, { opacity: w * L.exposure.opacity }));
      if (L.scenario.on && S.opts.depthBars) out.push(DL.depthLayer(ctx, { opacity: w * .85 * L.scenario.opacity }));
    }
    return out;
  }

  /* ── window (Three.js) parameters from state ── */
  function applyTerrain() {
    const T = S.terr; if (!T) return;
    const L = S.layers, cf = climateFactor(S.ssp, S.year).rain;
    const rainI = clamp((rainFor(S.T, cf) - 90) / 220, 0.08, 1);
    T.set({
      ex: S.ex, tint: L.terrain.on ? L.terrain.opacity : 0, shade: 1,
      contour: S.opts.contour && L.terrain.on ? .9 * L.terrain.opacity : 0, grid: S.opts.grid ? .85 : 0, wire: S.opts.wire ? .9 : 0,
      satOp: L.satellite.on ? L.satellite.opacity : 0,
      waterOp: L.scenario.on ? L.scenario.opacity : 0,
      rain: L.rain.on && S.opts.storm ? rainI : 0, rainOp: L.rain.on ? L.rain.opacity : 0, streaks: L.rain.on && S.opts.storm,
      animate: !RM && (L.scenario.on || (L.rain.on && S.opts.storm)),
    });
  }

  /* ── scenario → fields → stats ── */
  function recompute() {
    if (!S.A) return;
    const cf = climateFactor(S.ssp, S.year).rain;
    S.flood = floodField(S.A, S.T, cf);
    S.hazard = hazardField(S.A, cf);
    S.terr.setWater(S.flood.water);
    S.stamp.flood++;
    S.projection = districtProjection(D, S.ssp === "none" ? "ssp245" : S.ssp, S.ssp === "none" ? 2050 : S.year); S.stamp.climate++;
    renderStats();
    applyTerrain(); refreshDeck();
    root.dispatchEvent(new CustomEvent("studio:region"));
  }
  const tween = new Map();
  function setNum(id, value, d = 0, suffix = "") {
    const n = $("#" + id, root); if (!n) return;
    const from = +n.dataset.v || 0; n.dataset.v = value;
    cancelAnimationFrame(tween.get(id));
    if (RM) { n.textContent = fmt(value, d) + suffix; return; }
    const t0 = performance.now(), dur = 600;
    const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); n.textContent = fmt(from + (value - from) * e, d) + suffix; if (k < 1) tween.set(id, requestAnimationFrame(step)); };
    tween.set(id, requestAnimationFrame(step));
  }
  function renderStats() {
    const { flood, E } = S, cf = climateFactor(S.ssp, S.year);
    const ex = exposureUnder(E, flood.depth);
    setNum("sArea", flood.stats.floodedKm2, 0); setNum("sDepth", flood.stats.maxDepth, 1);
    setNum("sPeople", Math.round(ex.people / 100) * 100, 0); setNum("sAssets", ex.assets, 0);
    setNum("sRain", rainFor(S.T, cf.rain), 0); setNum("sStage", flood.stage, 1);
    $("#sNote", root).textContent = `${S.T}-year event · ${SSP[S.ssp].label}${S.ssp === "none" ? "" : " · " + S.year + " (+" + cf.dT.toFixed(1) + " °C)"}`;
  }

  /* ── region (analysis window) ── */
  async function selectRegion(id, { fly = true } = {}) {
    const R = REGIONS.find(r => r.id === id); if (!R) return;
    const token = ++S.token;
    $$("[data-region]", root).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.region === id)));
    el.loading.hidden = false; el.loading.textContent = `Reading terrain for ${R.name}…`; if (el.hint) el.hint.hidden = true;
    const F = windowFrame(R);
    if (fly) flyToWindow(R, F);
    let A;
    try {
      const dem = await loadWindowDEM(R, { nx: LITE ? 176 : 256, zoom: LITE ? 8 : 9 });
      if (token !== S.token) return;
      el.loading.textContent = "Tracing drainage and flood paths…";
      await new Promise(r => setTimeout(r, 30));
      A = analyse(dem);
    } catch (e) {
      console.warn("[studio] window failed", e);
      el.loading.textContent = "Could not build the 3D window for this area."; setStatus("terrain", "bad", "3D window unavailable");
      setTimeout(() => { el.loading.hidden = true; }, 3000); return;
    }
    if (token !== S.token) return;
    const dem = A;
    setStatus("terrain", dem.source === "terrarium" ? "ok" : dem.source === "mixed" ? "warn" : "bad",
      dem.source === "terrarium" ? `Terrain · ${dem.tiles[0]}/${dem.tiles[1]} real DEM tiles`
        : dem.source === "mixed" ? `Terrain · partial tiles (${dem.tiles[0]}/${dem.tiles[1]}), coarse fill` : "Terrain · tiles offline, coarse ETOPO1 fallback");

    S.paths = channelPaths(A);
    S.E = simulateExposure(A, R, cities);
    S.region = R; S.A = A;
    S.terr?.dispose();
    const terr = createTerrain3D(maplibregl, A, { lite: LITE, reduceMotion: RM });
    terr.layer.onAdd(map, map.painter?.context?.gl || map.getCanvas().getContext("webgl2"));
    host.terr = terr; S.terr = terr;
    S.ex = terr.defaultEx; syncExSlider();
    memo.clear();
    $("#sRegion", root).textContent = R.name; $("#sRegionNote", root).textContent = R.note;
    recompute(); applyLod();
    if (S.layers.satellite.on) ensureSat();
    el.loading.hidden = true;
    map.triggerRepaint();
  }

  function flyToWindow(R, F, instant = false) {
    const cw = el.map.clientWidth, z = Math.log2(78271.517 * Math.cos(F.clat * Math.PI / 180) * 0.74 * cw / F.widthM) - (S.view === "plan" ? 0 : 0.12);
    const v = VIEWS[S.view];
    const o = { center: [F.clon, F.clat - (S.view === "plan" ? 0 : 0.08)], zoom: clamp(z, 6, 10), pitch: v.pitch, bearing: v.bearing, essential: true };
    if (RM || instant) map.jumpTo(o); else map.flyTo({ ...o, duration: 2600, curve: 1.35 });
  }
  function toOverview() {
    S.token++;
    $$("[data-region]", root).forEach(b => b.setAttribute("aria-pressed", "false"));
    if (RM) map.jumpTo(OVERVIEW); else map.flyTo({ ...OVERVIEW, duration: 2200, curve: 1.3, essential: true });
  }

  /* satellite draped on the terrain */
  let satFor = null;
  async function ensureSat() {
    if (!S.region || satFor === S.region.id + S.token) return;
    const R = S.region, A = S.A, terr = S.terr;
    satFor = R.id + S.token;
    setStatus("sat", "load", "Satellite · loading NASA imagery…");
    const { canvas, ok, total } = await windowMosaic(R, "sat", LITE ? 7 : 8, LITE ? 768 : 1024);
    if (terr !== S.terr) return;
    if (!ok) { setStatus("sat", "bad", "Satellite · NASA GIBS unreachable"); satFor = null; return; }
    const tex = new CanvasTexture(canvas); tex.flipY = false; tex.minFilter = LinearFilter; tex.generateMipmaps = false;
    terr.set({ satTex: tex });
    setStatus("sat", ok === total ? "ok" : "warn", `Satellite · VIIRS ${ok}/${total} tiles`);
    applyTerrain();
  }

  /* ── layer panel ── */
  function buildPanel() {
    el.layers.innerHTML = LAYERS.map(l => {
      const [bt, bd] = BADGE[l.data];
      return `<li class="slyr" data-layer="${l.id}" data-on="${l.on}" style="--c:${l.color}">
        <div class="lyrHead">
          <label class="sw"><input type="checkbox" ${l.on ? "checked" : ""} aria-label="Show ${l.name}"><i></i></label>
          <button type="button" class="lyrName" aria-expanded="false"><b>${l.name}</b><span class="bdg" data-d="${l.data}" title="${bd}">${bt}</span></button>
          <span class="lyrState" hidden></span>
        </div>
        <div class="lyrBody" hidden>
          <p>${l.blurb}</p>
          <label class="op"><span>Opacity</span><input type="range" min="0" max="100" value="${Math.round(l.opacity * 100)}" aria-label="${l.name} opacity"></label>
          ${legendHTML(l.legend)}
          <small>${l.sources}</small>
        </div></li>`;
    }).join("");
    el.layers.addEventListener("change", e => {
      const li = e.target.closest(".slyr"); if (!li || e.target.type !== "checkbox") return;
      const id = li.dataset.layer; S.layers[id].on = e.target.checked; li.dataset.on = e.target.checked;
      onLayerChange(id);
    });
    el.layers.addEventListener("input", e => {
      const li = e.target.closest(".slyr"); if (!li || e.target.type !== "range") return;
      S.layers[li.dataset.layer].opacity = e.target.value / 100; onLayerChange(li.dataset.layer);
    });
    el.layers.addEventListener("click", e => {
      const b = e.target.closest(".lyrName"); if (!b) return;
      const open = b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", String(open)); b.closest(".slyr").querySelector(".lyrBody").hidden = !open;
    });
  }
  function legendHTML(g) {
    if (g.type === "ramp") {
      return `<div class="leg"><div class="ramp" style="background:linear-gradient(90deg,${g.stops.map(s => s[0]).join(",")})"></div>
        <div class="ticks">${g.stops.map(s => `<span>${s[1]}</span>`).join("")}</div><em>${g.unit}</em>
        ${g.extra ? `<ul class="sw2">${g.extra.map(([c, t]) => `<li><i style="background:${c}"></i>${t}</li>`).join("")}</ul>` : ""}</div>`;
    }
    return `<div class="leg"><ul class="sw2">${g.items.map(([c, t]) => `<li><i style="background:${c}"></i>${t}</li>`).join("")}</ul>${g.note ? `<em>${g.note}</em>` : ""}</div>`;
  }
  function onLayerChange(id) {
    if (id === "satellite" && S.layers.satellite.on) ensureSat();
    if (id === "scenario" && !S.layers.scenario.on) { /* water hidden via opacity */ }
    paintMap(); applyTerrain(); refreshDeck();
  }
  function setLayerState(id, text) {
    const s = $(`.slyr[data-layer="${id}"] .lyrState`, root); if (!s) return;
    s.hidden = !text; s.textContent = text || "";
  }

  /* ── controls ── */
  function wire() {
    root.addEventListener("click", e => {
      const r = e.target.closest("[data-region]"); if (r) return selectRegion(r.dataset.region);
      if (e.target.closest("[data-overview]")) return toOverview();
      const rp = e.target.closest("[data-rp]"); if (rp) { S.T = +rp.dataset.rp; seg("rp", rp); return recompute(); }
      const sp = e.target.closest("[data-ssp]"); if (sp) { S.ssp = sp.dataset.ssp; seg("ssp", sp); $("#yearRow", root).hidden = S.ssp === "none"; return recompute(); }
      const vw = e.target.closest("[data-view]"); if (vw) {
        S.view = vw.dataset.view; seg("view", vw);
        const v = VIEWS[S.view]; RM ? map.jumpTo(v) : map.easeTo({ ...v, duration: 1400, easing: t => 1 - Math.pow(1 - t, 3) }); return;
      }
      if (e.target.closest("[data-fullscreen]")) { const st = $(".stuStage", root); document.fullscreenElement ? document.exitFullscreen() : st.requestFullscreen?.(); }
    });
    const seg = (k, btn) => $$(`[data-${k}]`, root).forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
    $("#yearIn", root).addEventListener("input", e => { S.year = +e.target.value; $("#yearOut", root).textContent = S.year; recompute(); });
    $("#exIn", root).addEventListener("input", e => { S.ex = +e.target.value; $("#exOut", root).textContent = S.ex.toFixed(1) + "×"; S.stamp.ex++; memo.clear(); S.terr?.set({ ex: S.ex }); S.terr && S.flood && applyTerrain(); refreshDeck(); });
    $$("[data-opt]", root).forEach(c => c.addEventListener("change", () => {
      S.opts[c.dataset.opt] = c.checked;
      if (c.dataset.opt === "orbit") { if (c.checked) startOrbit(); } else { applyTerrain(); refreshDeck(); }
    }));
    $("#resetView", root).addEventListener("click", () => { S.region ? flyToWindow(S.region, windowFrame(S.region)) : toOverview(); });
  }
  const syncExSlider = () => { const i = $("#exIn", root); i.value = S.ex.toFixed(1); $("#exOut", root).textContent = S.ex.toFixed(1) + "×"; };

  /* orbit */
  let orbiting = false;
  function startOrbit() {
    if (orbiting || RM) return; orbiting = true;
    const tick = () => { if (!S.opts.orbit) { orbiting = false; return; } map.setBearing(map.getBearing() + 0.07); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  map.on("mousedown", () => { if (S.opts.orbit) { S.opts.orbit = false; const c = $('[data-opt="orbit"]', root); if (c) c.checked = false; } });

  /* ── hover: terrain cell readout, district tooltip ── */
  let hq = null, lastDistrict = null;
  function readCell(i) {
    const { A, flood, hazard, E } = S, F = A.frame;
    const x = i % A.nx, y = (i / A.nx) | 0;
    el.readout.innerHTML = `<dl>
      <div><dt>Elevation</dt><dd>${fmt(Math.max(A.z[i], 0), 0)} m</dd></div>
      <div><dt>Above drainage</dt><dd>${A.sea[i] ? "sea" : fmt(A.hand[i], 1) + " m"}</dd></div>
      <div><dt>${S.T}-yr depth</dt><dd>${flood.depth[i] > 0.03 ? fmt(flood.depth[i], 1) + " m" : "dry"}</dd></div>
      <div><dt>Annual flood chance</dt><dd>${hazard[i] > 0 ? fmt(hazard[i] * 100, hazard[i] < .1 ? 1 : 0) + " %" : "—"}</dd></div>
      <div><dt>People in cell <u>sim.</u></dt><dd>${fmt(Math.round(E.pop[i] / 10) * 10)}</dd></div>
      <div><dt>Position</dt><dd>${(F.lat0 + (y + .5) / A.ny * (F.lat1 - F.lat0)).toFixed(3)}°N ${(F.lon0 + (x + .5) / A.nx * (F.lon1 - F.lon0)).toFixed(3)}°E</dd></div></dl>`;
  }
  map.on("mousemove", e => {
    if (hq) cancelAnimationFrame(hq);
    hq = requestAnimationFrame(() => {
      if (S.terr && S.lod > 0.6) {
        const hit = S.terr.pick(e.point.x, e.point.y);
        if (hit) { hoverCell = hit.i; S.terr.set({ hover: [hit.ix, hit.iy] }); readCell(hit.i); el.map.style.cursor = "crosshair"; el.hint && (el.hint.hidden = true); return; }
        if (hoverCell != null) { hoverCell = null; S.terr.set({ hover: null }); el.map.style.cursor = ""; }
      } else if (S.lod < 0.4 && S.layers.history.on) {
        const f = map.queryRenderedFeatures(e.point, { layers: ["hist-ext"] })[0];
        if (lastDistrict != null && (!f || f.id !== lastDistrict)) map.setFeatureState({ source: "districts", id: lastDistrict }, { hover: false });
        if (f) {
          if (f.id !== lastDistrict) map.setFeatureState({ source: "districts", id: f.id }, { hover: true });
          lastDistrict = f.id;
          const p = f.properties, r = +p.risk;
          showTip(e.point.x, e.point.y, `<b>${p.name}</b><em>${p.state}</em><span>Historical flood index ${r.toFixed(2)} · ${r < .34 ? "low" : r < .64 ? "moderate" : r < .87 ? "high" : "very high"}</span><i>Illustrative</i>`);
          return;
        } else lastDistrict = null;
      }
      if (hoverCell == null) hideTip();
    });
  });
  map.on("mouseout", () => { hoverCell = null; S.terr?.set({ hover: null }); hideTip(); });

  /* ── tiles that fail are reported, never fatal ── */
  const tileErr = { dem: 0, sat: 0, imerg: 0 };
  map.on("error", e => {
    const id = e.sourceId; if (!(id in tileErr)) return;
    if (++tileErr[id] === 3) {
      const msg = { dem: "Terrain tiles unavailable", sat: "Satellite tiles unavailable", imerg: "Rainfall tiles unavailable" }[id];
      setStatus("tile-" + id, "bad", msg); setLayerState({ dem: "terrain", sat: "satellite", imerg: "rain" }[id], "tiles offline");
    }
  });
  map.on("sourcedata", e => {
    if (e.isSourceLoaded && e.sourceId in tileErr && tileErr[e.sourceId] === 0 && !status["tile-" + e.sourceId] && !status[e.sourceId] && e.sourceId !== "dem") {
      const l = { sat: "satellite", imerg: "rain" }[e.sourceId];
      if (S.layers[l]?.on) setStatus(e.sourceId === "sat" ? "sat" : "tile-" + e.sourceId, "ok", e.sourceId === "sat" ? "Satellite · NASA VIIRS" : "Rainfall · NASA IMERG");
    }
  });

  map.on("zoom", applyLod);
  map.on("resize", () => { applyLod(); });

  /* ── clock for animated overlays ── */
  let last = 0, running = true;
  document.addEventListener("visibilitychange", () => { running = !document.hidden; });
  const io = new IntersectionObserver(es => { running = es[0].isIntersecting && !document.hidden; }, { threshold: 0.05 });
  io.observe(root);
  const loop = now => {
    requestAnimationFrame(loop);
    if (!running || RM || now - last < 40) return;
    last = now; S.time = now / 1000;
    const animDeck = (S.lod < .95 && S.layers.history.on) || (S.A && S.lod > .05 && (S.layers.drainage.on || (S.layers.exposure.on && S.flood)));
    if (animDeck) refreshDeck();
  };
  requestAnimationFrame(loop);

  /* ── go ── */
  buildPanel(); wire();
  setStatus("base", "ok", "Base · MapLibre + NASA / open terrain");
  paintMap(1); refreshDeck();
  S.projection = districtProjection(D, S.ssp === "none" ? "ssp245" : S.ssp, S.ssp === "none" ? 2050 : S.year);
  onReady?.({ selectRegion, toOverview, state: S, map });
  return { selectRegion, toOverview, state: S, map, terr: () => S.terr };
}
