/* ── Exploded layer stack (Three.js) ──────────────────────────────
   Nine plates with real thickness and lit edges, floating one above the
   other. Each plate's face is painted from the same fields the studio uses
   for the current window (terrain, drainage, flood depth, hazard, …), so
   it is a true "pulled apart" view of the analysis rather than an
   illustration. Hover lifts a plate; click toggles that layer in the
   studio; the slider collapses and explodes the stack.

   Own scene and renderer (it is a separate canvas from the map). Rendering
   pauses when the stack is off screen or the tab is hidden.               */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LAYERS, byId } from "/assets/js/studio/registry.js";
import { loadIndia } from "/assets/js/studio/geo.js";
import { windowMosaic } from "/assets/js/studio/real/gibs.js";
import { districtProjection } from "/assets/js/studio/simulated/climate.js";

const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
/* bottom → top */
const ORDER = ["terrain", "satellite", "drainage", "scenario", "hazard", "exposure", "history", "climate", "rain"];
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ramp = (stops, t) => {
  const x = Math.min(.9999, Math.max(0, t)) * (stops.length - 1), i = Math.floor(x), f = x - i, a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
};
const TERR = ["#07202b", "#0b3342", "#0e4a58", "#1d6b67", "#4a8a78", "#9db08c", "#d8d2ae"].map(hex);
const HAZ = ["#1f7d98", "#36a6b8", "#7cc4a0", "#e0c062", "#e38c4a", "#d4552b"].map(hex);
const DEP = ["#6dd5e3", "#2fb0c8", "#1688ad", "#0e5f94", "#133f7a", "#241d5e"].map(hex);
const RISK = ["#0f2b33", "#133f4f", "#175a73", "#1f7d98", "#36a6b8", "#7cc4a0", "#e0c062", "#e38c4a"].map(hex);
const CLI = ["#2b2a22", "#e0c062", "#e38c4a", "#d4552b", "#a82a22"].map(hex);

/* paint a field to a canvas; fn(i) → [r,g,b,a?] ; flips so the north edge is at the top */
function paint(A, w, fn, bg = [4, 20, 29]) {
  const h = Math.round(w * A.ny / A.nx), c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"), im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(A.nx - 1, Math.floor(x / w * A.nx)), sy = Math.min(A.ny - 1, Math.floor((h - 1 - y) / h * A.ny));
    const i = sy * A.nx + sx, c4 = fn(i, sx, sy), o = (y * w + x) * 4, a = (c4[3] ?? 255) / 255;
    im.data[o] = bg[0] * (1 - a) + c4[0] * a; im.data[o + 1] = bg[1] * (1 - a) + c4[1] * a; im.data[o + 2] = bg[2] * (1 - a) + c4[2] * a; im.data[o + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  // precise cell boundaries
  g.strokeStyle = "rgba(109,213,227,.16)"; g.lineWidth = 1; g.beginPath();
  for (let k = 1; k < 12; k++) { g.moveTo(k / 12 * w, 0); g.lineTo(k / 12 * w, h); }
  for (let k = 1; k < 12 * h / w; k++) { g.moveTo(0, k / 12 * w); g.lineTo(w, k / 12 * w); }
  g.stroke();
  return c;
}
const shadeAt = (A, i) => {
  const x = i % A.nx, y = (i / A.nx) | 0, z = A.z;
  const dzx = z[y * A.nx + Math.min(A.nx - 1, x + 1)] - z[y * A.nx + Math.max(0, x - 1)], dzy = z[Math.min(A.ny - 1, y + 1) * A.nx + x] - z[Math.max(0, y - 1) * A.nx + x];
  return Math.max(0.35, Math.min(1.4, 0.9 + (-dzx * 0.5 + dzy * 0.5) / (A.dx * 2) * 6)) * (0.55 + A.sky[i] / 255 * 0.5);
};

function noise(seed) {
  const h = (a, b) => { let x = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ seed; x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967295; };
  const v = (x, y) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, w = y - j, s = u * u * (3 - 2 * u), t = w * w * (3 - 2 * w); return (h(i, j) * (1 - s) + h(i + 1, j) * s) * (1 - t) + (h(i, j + 1) * (1 - s) + h(i + 1, j + 1) * s) * t; };
  return (x, y) => v(x, y) * .55 + v(x * 2.1, y * 2.1) * .3 + v(x * 4.3, y * 4.3) * .15;
}

export async function bootStack(studio) {
  const host = document.getElementById("stk"), cv = document.getElementById("stkCanvas"), labelsEl = document.getElementById("stkLabels"), slider = document.getElementById("stkIn");
  if (!host || !cv) return;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); }
  catch (_) { document.getElementById("stkFail").hidden = false; return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const D = await loadIndia();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  const ctl = new OrbitControls(camera, cv);
  ctl.enablePan = false; ctl.enableDamping = true; ctl.dampingFactor = .07; ctl.minDistance = 4; ctl.maxDistance = 16; ctl.maxPolarAngle = Math.PI * .47; ctl.minPolarAngle = Math.PI * .12;
  ctl.autoRotate = !RM; ctl.autoRotateSpeed = .45;
  scene.add(new THREE.HemisphereLight(0xbfeaf0, 0x06202b, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-3, 6, 4); scene.add(key);

  const W = 3.4, T = .075;          // plate width, thickness
  let Hh = W * .78;                 // plate depth, from the window's aspect
  const plates = [];
  const edgeCol = new THREE.Color(0x6dd5e3), hotCol = new THREE.Color(0xffffff);

  function makePlate(id) {
    const g = new THREE.Group();
    const side = new THREE.MeshStandardMaterial({ color: 0x0b3342, roughness: .45, metalness: .25, transparent: true, opacity: .92, emissive: 0x06202b, emissiveIntensity: .8 });
    const top = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(W, T, Hh), [side, side, top, side, side, side]);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: edgeCol, transparent: true, opacity: .95 }));
    g.add(box, edges);
    scene.add(g);
    return { id, g, box, edges, top, side, y: 0, lift: 0, liftT: 0, hot: false };
  }
  ORDER.forEach(id => plates.push(makePlate(id)));
  const byPlate = Object.fromEntries(plates.map(p => [p.id, p]));
  labelsEl.innerHTML = plates.map(p => `<li data-id="${p.id}"><i></i>${byId[p.id].name}<small>${({ real: "real", derived: "derived", simulated: "simulated", mixed: "real + sim." })[byId[p.id].data]}</small></li>`).join("");
  const labelEls = Object.fromEntries([...labelsEl.children].map(li => [li.dataset.id, li]));

  /* ── faces from the current window ── */
  let satCanvas = null, faceFor = 0;
  async function buildFaces() {
    const A = studio.state.A, R = studio.state.region; if (!A) return;
    const my = ++faceFor;
    Hh = W * A.ny / A.nx;
    plates.forEach(p => { p.box.geometry.dispose(); p.box.geometry = new THREE.BoxGeometry(W, T, Hh); p.edges.geometry.dispose(); p.edges.geometry = new THREE.EdgesGeometry(p.box.geometry); });
    const S = studio.state, N = A.nx * A.ny, res = 384;
    const range = Math.max(10, A.zmax - Math.max(0, A.zmin)), zr = Math.max(0, A.zmin);
    const nz = noise(7);
    const F = A.frame;
    // nearest district for each coarse cell (historical + climate plates)
    const proj = S.projection || districtProjection(D, "none", 2050);
    const cw = 96, ch = Math.round(cw * A.ny / A.nx), near = new Int32Array(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const lon = F.lon0 + (x + .5) / cw * (F.lon1 - F.lon0), lat = F.lat0 + (y + .5) / ch * (F.lat1 - F.lat0);
      let b = 0, bd = 1e9;
      for (let k = 0; k < D.districts.length; k++) { const d = (D.districts[k][5] - lon) ** 2 + (D.districts[k][6] - lat) ** 2; if (d < bd) { bd = d; b = k; } }
      near[y * cw + x] = b;
    }
    const nearAt = (sx, sy) => near[Math.min(ch - 1, Math.floor(sy / A.ny * ch)) * cw + Math.min(cw - 1, Math.floor(sx / A.nx * cw))];
    const faces = {
      terrain: paint(A, res, (i) => { const t = Math.pow(Math.max(0, (A.z[i] - zr) / range), .72); const c = A.z[i] <= 0.5 ? [8, 40, 54] : ramp(TERR, t); const s = shadeAt(A, i); return [c[0] * s, c[1] * s, c[2] * s]; }),
      drainage: paint(A, res, i => A.channel[i] ? (() => { const k = Math.min(1, Math.log(A.acc[i] / A.chanMin + 1) / Math.log(A.accMax / A.chanMin + 1)); return [86 + k * 130, 200 + k * 50, 220 + k * 35]; })() : A.sea[i] ? [8, 40, 54] : [5, 30, 40 + A.sky[i] * .04]),
      scenario: paint(A, res, i => S.flood.depth[i] > .05 ? [...ramp(DEP, Math.min(1, S.flood.depth[i] / 6)), 255] : A.sea[i] ? [10, 52, 72] : (c => [c[0] * .5, c[1] * .5, c[2] * .5])(ramp(TERR, Math.pow(Math.max(0, (A.z[i] - zr) / range), .72)))),
      hazard: paint(A, res, i => S.hazard[i] > .008 ? [...ramp(HAZ, Math.sqrt(S.hazard[i] / .5)), 255] : [6, 30, 40]),
      exposure: paint(A, res, i => {
        const p = S.E.pop[i] / S.E.pmax, d = S.flood.depth[i] > .1;
        return p > .03 ? (d ? [255, 106, 61] : [240 * Math.sqrt(p) + 30, 160 * Math.sqrt(p) + 50, 60 * Math.sqrt(p) + 20]) : [6, 30, 40];
      }),
      history: paint(A, res, (i, sx, sy) => ramp(RISK, D.districts[nearAt(sx, sy)][7] / 100 * 1.05)),
      climate: paint(A, res, (i, sx, sy) => { const d = proj[nearAt(sx, sy)]; return ramp(CLI, d.delta / .2); }),
      rain: paint(A, res, (i, sx, sy) => {
        const v = Math.max(0, nz(sx / 26, sy / 26) * 1.5 - .45) * 1.4, b = v < .1 ? 0 : v < .3 ? 1 : v < .48 ? 2 : v < .66 ? 3 : v < .84 ? 4 : 5;
        return [[0, 0, 0, 0], [79, 182, 201, 150], [111, 214, 224, 180], [191, 240, 234, 210], [233, 210, 124, 230], [227, 140, 74, 240]][b];
      }),
      satellite: null,
    };
    const apply = (id, canvas) => {
      const p = byPlate[id]; if (!p || !canvas) return;
      const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      p.top.map?.dispose(); p.top.map = tex; p.top.needsUpdate = true;
    };
    for (const id of Object.keys(faces)) apply(id, faces[id]);
    apply("satellite", faces.terrain);       // until the real picture arrives
    const sat = await windowMosaic(R, "sat", 7, 512).catch(() => null);
    if (my === faceFor && sat?.ok) { apply("satellite", sat.canvas); }
    dirty = true;
  }

  /* ── layout ── */
  let explode = 1, explodeT = 1, started = false, dirty = true;
  const spacing = () => (T + .1 + explode * .5);
  function layout() {
    const n = plates.length, total = (n - 1) * spacing();
    plates.forEach((p, i) => {
      p.y = i * spacing() - total / 2;
      p.lift += (p.liftT - p.lift) * .16;
      p.g.position.y = p.y + p.lift;
      const on = studio.state.layers[p.id].on;
      p.top.opacity += ((on ? 1 : .22) - p.top.opacity) * .15;
      p.edges.material.opacity = on ? .95 : .35;
      p.edges.material.color.copy(edgeCol).lerp(hotCol, p.hot ? .85 : 0);
      p.g.rotation.y = 0;
    });
  }

  function resize() {
    const r = host.getBoundingClientRect(); if (!r.width) return;
    renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); dirty = true;
    camera.userData.fit = r.width < 640 ? 1.5 : 1;
  }
  new ResizeObserver(resize).observe(host); resize();
  camera.position.set(6.2, 3.2, 7.4); ctl.target.set(0, 0, 0);

  /* ── pointer ── */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let hot = null, downAt = null;
  const pickPlate = e => {
    const r = cv.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(plates.map(p => p.box), false)[0];
    return hit ? plates.find(p => p.box === hit.object) : null;
  };
  const setHot = p => {
    if (hot === p) return; if (hot) { hot.hot = false; hot.liftT = 0; labelEls[hot.id].dataset.hot = "false"; }
    hot = p; if (hot) { hot.hot = true; hot.liftT = .16 * explode + .03; labelEls[hot.id].dataset.hot = "true"; }
    cv.style.cursor = hot ? "pointer" : "grab"; ctl.autoRotate = !RM && !hot;
  };
  cv.addEventListener("pointermove", e => { if (e.buttons) return; setHot(pickPlate(e)); });
  cv.addEventListener("pointerleave", () => setHot(null));
  cv.addEventListener("pointerdown", e => { downAt = [e.clientX, e.clientY]; });
  cv.addEventListener("pointerup", e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const p = pickPlate(e); if (!p) return;
    const box = document.querySelector(`.slyr[data-layer="${p.id}"] input[type=checkbox]`);
    if (box) { box.checked = !box.checked; box.dispatchEvent(new Event("change", { bubbles: true })); }
  });
  slider.addEventListener("input", () => { explode = explodeT = slider.value / 100; });

  /* ── loop, only while visible ── */
  let vis = false, t0 = 0;
  new IntersectionObserver(es => {
    vis = es[0].isIntersecting;
    if (vis && !started) { started = true; t0 = performance.now(); explode = RM ? 1 : 0; slider.value = RM ? 100 : 0; }
  }, { threshold: .2 }).observe(host);
  const v3 = new THREE.Vector3();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!vis || document.hidden) return;
    if (started && !RM && now - t0 < 2200) { const k = Math.min(1, (now - t0 - 250) / 1700); if (k > 0) { explode = 1 - Math.pow(1 - k, 3); slider.value = Math.round(explode * 100); } }
    layout(); ctl.update();
    renderer.render(scene, camera);
    const r = host.getBoundingClientRect();
    for (const p of plates) {
      v3.set(W / 2 + .06, p.g.position.y, Hh / 2 * 0).project(camera);
      const li = labelEls[p.id], x = (v3.x * .5 + .5) * r.width, y = (-v3.y * .5 + .5) * r.height;
      li.style.transform = `translate(${x + 8}px, ${y - 7}px)`;
      li.dataset.off = String(!studio.state.layers[p.id].on);
      li.style.display = r.width < 520 ? "none" : "";
    }
  }
  requestAnimationFrame(frame);

  let deb = 0;
  document.getElementById("studio").addEventListener("studio:region", () => { clearTimeout(deb); deb = setTimeout(buildFaces, 350); });
  if (studio.state.A) buildFaces();
}
