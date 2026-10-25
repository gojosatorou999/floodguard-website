/* ── homepage "approach" stack: nine analytical surfaces ──────────
   Replaces the CSS-gradient diamonds (.fxTile) in #gap with real meshes,
   rendered by Three.js into one shared WebGL context and copied into each
   tile as a 2D canvas.

   Every surface is a height-field: a grid of vertices (N×N cells) whose
   heights come from a field function, shaded with vertex colours, lit by a
   hemisphere + key light, and overlaid with a grid mesh that follows the
   same surface. Layers that need it get contour lines (marching squares on
   the grid), a branching drainage network (steepest-descent traces on the
   field), or stepped terraces (exposure cells).

   The field functions are illustrative shapes for the homepage picture; they
   are not FloodGuard model output. The stack is decorative.

   Loads Three.js lazily, only when the section approaches the viewport. If
   WebGL is unavailable the CSS diamonds stay as they were.                  */

const LAYERS = {
  // ── left: the six data layers ──
  rain: {
    N: 52, amp: .22, thick: .07, grid: ["#d9f3ff", .2], rain: { drops: 220, color: "#bfe6ff", a: .55 },
    h: (u, v) => .34 * fbm(u * 2.4, v * 2.4, 1) + .6 * blob(u, v, .34, .38, .2) + .42 * blob(u, v, .7, .62, .15) + .12,
    col: (u, v, h) => {
      const t = clamp(h, 0, 1), c = ramp(["#0d3366", "#1a5494", "#2f7cc0", "#5fa9e0"], t);
      const cloud = smooth(.6, .95, t) * .85 + .15 * fbm(u * 9, v * 9, 3);
      return mix(c, [.94, .98, 1], clamp(cloud, 0, .9));
    },
  },
  hist: {
    N: 64, amp: .2, thick: .05, opacity: .92, grid: ["#2c7396", .5], water: .42,
    h: (u, v) => .5 + .26 * fbm(u * 2.2, v * 2.2, 2) - .3 * blob(u, v, .5, .5, .3),
    col: (u, v, h) => ramp(["#e4f6fa", "#c2e6f0", "#93cadd", "#5f9fbf"], clamp((h - .3) / .5, 0, 1)),
  },
  terr: {
    N: 80, amp: .46, thick: .12, grid: ["#22361a", .28], contours: { levels: [.2, .28, .36, .44, .52, .6, .68, .76, .84], color: "#1a2a10", a: .95 },
    h: (u, v) => clamp(.62 * fbm(u * 2.2, v * 2.2, 3) + .24 * ridge(u, v, 4) + .08, 0, 1),
    col: (u, v, h) => ramp(["#4d7a3b", "#7b9446", "#c5b35c", "#9b7444", "#6c5233"], clamp(h * 1.05, 0, 1)),
  },
  drain: {
    N: 44, amp: .14, thick: .06, grid: ["#2fa9cc", .42], network: { seeds: 110, color: "#c4f7ff", a: .95 },
    h: (u, v) => .5 + .28 * fbm(u * 2.2, v * 2.2, 5) - .25 * blob(u, v, .5, .5, .42),
    col: (u, v, h) => ramp(["#06182a", "#0b2a43", "#133f60"], clamp(h, 0, 1)),
  },
  sat: {
    N: 64, amp: .28, thick: .1, grid: ["#1a2e16", .26],
    h: (u, v) => .25 + .22 * fbm(u * 5, v * 5, 6) + .05 * parcel(u, v, 8).t,
    col: (u, v, h) => {
      const p = parcel(u, v, 8);
      const base = ramp(["#2b5226", "#3f6e33", "#7d8c3e", "#8e7c4e", "#5b4a34"], p.t);
      return mix([.1, .16, .08], base, .7 + .3 * clamp(h, 0, 1)) .map((x, k) => x * (.86 + .14 * p.f));
    },
  },
  clim: {
    N: 20, amp: .42, thick: .1, grid: ["#ffffff", .3], steps: 10,
    h: (u, v) => clamp(.1 + .75 * u * (.7 + .3 * v) + .08 * fbm(u * 3, v * 3, 9), 0, 1),
    col: (u, v, h) => ramp(["#2c6aa8", "#7fbcd9", "#f1c34f", "#e0673a", "#b3302a"], clamp(h * 1.05, 0, 1)),
  },
  // ── right: hazard, exposure, risk ──
  haz: {
    N: 60, amp: .36, thick: .1, grid: ["#0a3055", .48],
    h: (u, v) => clamp(.6 * blob(u, v, .42, .44, .19) + .16 * fbm(u * 2.4, v * 2.4, 10) + .08, 0, 1),
    col: (u, v, h) => ramp(["#cfe7f4", "#84bfe2", "#2f7fb8", "#15517f", "#0b3050"], clamp(h / .85, 0, 1)),
  },
  exp: {
    N: 22, amp: .3, thick: .08, grid: ["#f6fafb", .75], steps: 6,
    h: (u, v) => clamp(.5 * blob(u, v, .52, .5, .24) + .14 * fbm(u * 3, v * 3, 11) + .05, 0, 1),
    col: (u, v, h) => ramp(["#7a878e", "#9ba9af", "#d9a27a", "#e0673a", "#c2401f"], clamp(h / .62, 0, 1)),
  },
  risk: {
    N: 64, amp: .4, thick: .11, grid: ["#1d4f7a", .4],
    h: (u, v) => clamp(.5 * blob(u, v, .3, .62, .16) + .78 * blob(u, v, .62, .38, .14) + .36 * blob(u, v, .7, .7, .1) + .12 * fbm(u * 3, v * 3, 12), 0, 1),
    col: (u, v, h) => ramp(["#2c6aa8", "#7cc0e0", "#f1c34f", "#e0673a", "#b3302a"], clamp(h / .9, 0, 1)),
  },
};

/* ── noise and shapes ── */
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y, seed) {
  const i = Math.floor(x + seed * 17.3), j = Math.floor(y + seed * 5.1), u = x - Math.floor(x), v = y - Math.floor(y);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  const s = u * u * (3 - 2 * u), t = v * v * (3 - 2 * v);
  return a + (b - a) * s + (c - a) * t + (a - b - c + d) * s * t;
}
function fbm(x, y, seed = 0) {
  let s = 0, a = .5, f = 1;
  for (let k = 0; k < 5; k++) { s += a * vnoise(x * f, y * f, seed); f *= 2.03; a *= .5; }
  return s / .96875;
}
function ridge(x, y, seed) { return 1 - Math.abs(fbm(x * 3, y * 3, seed) * 2 - 1); }
function parcel(u, v, n) {
  const x = Math.floor(u * n), y = Math.floor(v * n), r = hash(x * 3.1 + 1, y * 7.7 + 2);
  const edge = Math.min(u * n - x, x + 1 - u * n, v * n - y, y + 1 - v * n);
  return { t: r, f: smooth(0, .08, edge) * .6 + .4 * (1 - Math.abs(hash(x, y) - .5) * 2) };
}
const blob = (u, v, cx, cy, r) => Math.exp(-(((u - cx) ** 2 + (v - cy) ** 2) / (r * r)));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => [0, 1, 2].map(k => a[k] + (b[k] - a[k]) * t);
function ramp(stops, t) {
  const cols = stops.map(hex), x = clamp(t, 0, .9999) * (cols.length - 1), i = Math.floor(x);
  return mix(cols[i], cols[i + 1], x - i);
}
function hex(h) { return [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16) / 255); }
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* ── geometry ── */
function heightGrid(spec) {
  const { N } = spec, H = new Float32Array((N + 1) * (N + 1)), R = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const u = i / N, v = j / N, raw = spec.h(u, v), k = j * (N + 1) + i;
    R[k] = raw;
    H[k] = spec.steps ? Math.floor(raw * spec.steps + .5) / spec.steps : raw;
    if (spec.water != null && raw < spec.water) H[k] = spec.water;   // flood water sits flat at the level
  }
  return { H, R };
}

function surfaceMesh(THREE, spec, G) {
  const { N, amp } = spec, { H } = G, W = N + 1;
  const pos = new Float32Array(W * W * 3), col = new Float32Array(W * W * 3), idx = [];
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const u = i / N, v = j / N, k = j * W + i, y = H[k] * amp;
    pos.set([u - .5, y, v - .5], k * 3);
    const c = spec.water != null && G.R[k] < spec.water ? mix([.36, .78, .9], [.1, .45, .62], clamp((spec.water - G.R[k]) * 4, 0, 1)) : spec.col(u, v, G.R[k]);
    col.set(c, k * 3);
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: .62, metalness: .04, transparent: !!spec.opacity, opacity: spec.opacity ?? 1,
  }));
  return m;
}

/* the grid lines, lifted a hair off the surface so they follow its shape */
function gridLines(THREE, spec, H) {
  const { N, amp } = spec, W = N + 1, eps = .004, p = [];
  const Y = (i, j) => H[j * W + i] * amp + eps;
  for (let j = 0; j <= N; j++) for (let i = 0; i < N; i++) p.push(i / N - .5, Y(i, j), j / N - .5, (i + 1) / N - .5, Y(i + 1, j), j / N - .5);
  for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) p.push(i / N - .5, Y(i, j), j / N - .5, i / N - .5, Y(i, j + 1), (j + 1) / N - .5);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  const [c, a] = spec.grid;
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: a, depthWrite: false }));
}

/* marching squares on the height grid → line segments at each level */
function contourSegments(spec, H, levels) {
  const { N, amp } = spec, W = N + 1, out = [];
  for (const L of levels) {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const v0 = H[j * W + i], v1 = H[j * W + i + 1], v2 = H[(j + 1) * W + i + 1], v3 = H[(j + 1) * W + i];
      const idx = (v0 >= L ? 1 : 0) | (v1 >= L ? 2 : 0) | (v2 >= L ? 4 : 0) | (v3 >= L ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const edge = e => {
        const [ax, ay, bx, by, va, vb] = e === 0 ? [i, j, i + 1, j, v0, v1] : e === 1 ? [i + 1, j, i + 1, j + 1, v1, v2] : e === 2 ? [i + 1, j + 1, i, j + 1, v2, v3] : [i, j + 1, i, j, v3, v0];
        const t = (L - va) / (vb - va || 1e-9);
        const x = (ax + (bx - ax) * t) / N - .5, z = (ay + (by - ay) * t) / N - .5;
        return [x, L * amp + .006, z];
      };
      const pairs = { 1: [[3, 0]], 2: [[0, 1]], 3: [[1, 3]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[2, 3]], 8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]] }[idx] || [];
      for (const [e0, e1] of pairs) out.push(...edge(e0), ...edge(e1));
    }
  }
  return out;
}

/* steepest-descent traces on the field: a drainage network that follows the terrain */
function networkSegments(spec, rnd) {
  const { N, amp } = spec, n = spec.network, segs = [], paths = [];
  const hf = (u, v) => spec.h(clamp(u, 0, 1), clamp(v, 0, 1));
  const grad = (u, v) => { const e = .01; return [(hf(u + e, v) - hf(u - e, v)) / (2 * e), (hf(u, v + e) - hf(u, v - e)) / (2 * e)]; };
  const trace = (u, v) => {
    const pts = [[u, v]];
    for (let s = 0; s < 260; s++) {
      const [gx, gy] = grad(u, v), m = Math.hypot(gx, gy);
      if (m < 1e-4) break;
      const wob = (rnd() - .5) * .35, dx = -gx / m, dy = -gy / m;
      u += (dx * Math.cos(wob) - dy * Math.sin(wob)) * .0085;
      v += (dx * Math.sin(wob) + dy * Math.cos(wob)) * .0085;
      if (u < 0 || v < 0 || u > 1 || v > 1) break;
      pts.push([u, v]);
    }
    return pts;
  };
  for (let k = 0; k < n.seeds; k++) {
    const su = rnd(), sv = rnd();
    if (hf(su, sv) < .42) continue;               // start on higher ground
    paths.push(trace(su, sv));
  }
  for (const p of paths) for (let s = 1; s < p.length; s++) {
    const [u0, v0] = p[s - 1], [u1, v1] = p[s];
    segs.push(u0 - .5, hf(u0, v0) * amp + .008, v0 - .5, u1 - .5, hf(u1, v1) * amp + .008, v1 - .5);
  }
  return segs;
}

function lineSegs(THREE, pos, color, opacity) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
}

/* the slab: thickness, a lit lip and a dark base, so each surface reads as a physical plate */
function slab(THREE, spec, H) {
  const { N, amp, thick } = spec, W = N + 1, group = new THREE.Group();
  const side = [];
  const edge = [];
  const ring = [];
  for (let i = 0; i <= N; i++) ring.push([i, 0]);
  for (let j = 1; j <= N; j++) ring.push([N, j]);
  for (let i = N - 1; i >= 0; i--) ring.push([i, N]);
  for (let j = N - 1; j >= 1; j--) ring.push([0, j]);
  const P = ([i, j]) => [i / N - .5, H[j * W + i] * amp, j / N - .5];
  for (let k = 0; k < ring.length; k++) {
    const a = P(ring[k]), b = P(ring[(k + 1) % ring.length]);
    const ab = [a[0], -thick, a[2]], bb = [b[0], -thick, b[2]];
    side.push(...a, ...b, ...bb, ...a, ...bb, ...ab);
    edge.push(...a, ...b);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute(side, 3));
  sg.computeVertexNormals();
  group.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0x0a3550, roughness: .85, metalness: 0, side: THREE.DoubleSide })));
  const base = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x06243a, roughness: 1 }));
  base.rotation.x = -Math.PI / 2; base.position.y = -thick;
  group.add(base);
  group.add(lineSegs(THREE, edge, 0x8fe6f2, .75));
  return group;
}

/* ── one tile: scene and camera ── */
function buildScene(THREE, key) {
  const spec = LAYERS[key], G = heightGrid(spec);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdcf6ff, 0x072033, 1.05));
  const key1 = new THREE.DirectionalLight(0xffffff, 1.9); key1.position.set(-1.2, 2.4, 1.1); scene.add(key1);
  const fill = new THREE.DirectionalLight(0x9fd8ea, .35); fill.position.set(1.6, .9, -1.2); scene.add(fill);

  scene.add(slab(THREE, spec, G.H));
  scene.add(surfaceMesh(THREE, spec, G));
  if (spec.rain) {
    // falling streaks above the storm: short slanted lines from the cloud layer down to the surface
    const r = rng(hashSeed(key) ^ 0x9e37), p = [];
    for (let k = 0; k < spec.rain.drops; k++) {
      const x = (r() - .5) * .9, z = (r() - .5) * .9, top = spec.amp * (1.1 + .5 * r()), len = .05 + .07 * r();
      p.push(x, top, z, x + .018, top - len, z + .006);
    }
    scene.add(lineSegs(THREE, p, spec.rain.color, spec.rain.a));
  }
  scene.add(gridLines(THREE, spec, G.H));
  if (spec.contours) {
    const seg = contourSegments(spec, G.H, spec.contours.levels);
    scene.add(lineSegs(THREE, seg, spec.contours.color, spec.contours.a));
  }
  if (spec.network) scene.add(lineSegs(THREE, networkSegments(spec, rng(hashSeed(key))), spec.network.color, spec.network.a));

  const camera = new THREE.PerspectiveCamera(19, 1, .1, 60);
  const d = 3.7, lift = spec.amp * .35 - spec.thick * .3;
  camera.position.set(d, d * 1.02 + lift, d);          // isometric heading, perspective lens
  camera.lookAt(0, lift * .35, 0);
  return { scene, camera };
}
const hashSeed = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

/* ── wiring: find the tiles, render once per size, and only when visible ── */
let booted = false;
async function boot() {
  if (booted) return; booted = true;
  const tiles = [...document.querySelectorAll("#gap .fxTile")];
  if (!tiles.length) return;
  let THREE;
  try { THREE = await import("three"); } catch (e) { console.warn("[fx] three unavailable", e); return; }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" }); }
  catch (e) { console.warn("[fx] WebGL unavailable", e); return; }
  renderer.setClearColor(0x000000, 0);

  const items = tiles.map(el => {
    const key = (el.className.match(/\bt-(\w+)/) || [])[1];
    if (!LAYERS[key]) return null;
    const { scene, camera } = buildScene(THREE, key);
    const c = document.createElement("canvas");
    c.className = "fxGLc"; c.setAttribute("aria-hidden", "true");
    el.append(c);
    return { el, c, scene, camera };
  }).filter(Boolean);

  const paint = it => {
    /* an even CSS size, so the centring translate lands on a whole pixel, and a
       buffer drawn at 2–4x the screen's pixels and scaled down: on 125 % / 150 %
       Windows scaling a 1:1 canvas sits on half pixels and comes out soft */
    const css = Math.max(40, 2 * Math.round(it.el.getBoundingClientRect().width * 1.05));
    if (!css) return;
    const dpr = Math.min(4, Math.max(2, Math.ceil(devicePixelRatio || 1) * 2));
    renderer.setPixelRatio(dpr);
    renderer.setSize(css, css, false);
    it.camera.aspect = 1; it.camera.updateProjectionMatrix();
    renderer.render(it.scene, it.camera);
    it.c.style.width = css + "px"; it.c.style.height = css + "px";
    it.c.width = Math.round(css * dpr); it.c.height = Math.round(css * dpr);
    it.c.getContext("2d").drawImage(renderer.domElement, 0, 0, it.c.width, it.c.height);
  };

  let raf = 0;
  const all = () => { items.forEach(paint); };
  const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(all); });
  items.forEach(it => ro.observe(it.el));
  all();
  document.documentElement.classList.add("fxGL");
}

if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { io.disconnect(); boot(); }
  }, { rootMargin: "400px 0px" });
  const gap = document.getElementById("gap");
  if (gap) io.observe(gap);
} else boot();
