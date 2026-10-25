/* ── Three.js terrain, water and rain as a MapLibre custom layer ───
   The analysis window is drawn as one lit terrain "slab" that shares
   MapLibre's camera and depth buffer, so deck.gl columns, MapLibre rasters
   and this mesh intersect correctly.

   Technique (written for this project; the MapLibre custom-layer contract
   and Three.js ShaderMaterial are the only borrowed ideas):
   • heights live in one float texture; the vertex shader fetches them with
     texelFetch and derives normals by central differences, so vertical
     exaggeration, flooding and the sea are uniform / texture updates — no
     CPU geometry rebuilds;
   • fragment shader: hypsometric tint, hillshade, baked sky-view occlusion,
     antialiased contours, a precise metric grid, satellite draping, a
     radar-banded rainfall field and a hover cell;
   • water: a second pass over the same vertices, lifted to the flood
     level texture, shaded with animated normals, Fresnel, sun glint,
     shoreline foam and rain ripples;
   • rain: GPU-animated streaks (positions come from time in the vertex
     shader, nothing is updated on the CPU);
   • the slab: a skirt with strata bands, a lit top edge and a soft shadow
     plate so the block reads as a physical object.                       */
import * as THREE from "three";

const GLSL_COMMON = /* glsl */`
uniform sampler2D uH;
uniform vec2 uGrid;
uniform vec2 uCell;
uniform float uEx;
float H(vec2 id){ return texelFetch(uH, ivec2(clamp(id, vec2(0.0), uGrid - 1.0)), 0).r; }
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1,0)), f.x), mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

const TERRAIN_VS = /* glsl */`
${GLSL_COMMON}
attribute vec2 aIdx;
uniform float uLift;
varying vec3 vN; varying vec2 vUv; varying float vZ; varying vec3 vLocal;
void main(){
  float h = H(aIdx);
  float hx = (H(aIdx + vec2(1,0)) - H(aIdx - vec2(1,0))) * uEx / (2.0 * uCell.x);
  float hy = (H(aIdx + vec2(0,1)) - H(aIdx - vec2(0,1))) * uEx / (2.0 * uCell.y);
  vN = normalize(vec3(-hx, -hy, 1.0));
  vZ = h; vUv = (aIdx + 0.5) / uGrid;
  vLocal = vec3(position.xy, h * uEx + uLift);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(vLocal, 1.0);
}`;

const TERRAIN_FS = /* glsl */`
${GLSL_COMMON}
uniform sampler2D uSky, uSat;
uniform float uTime, uZMax, uTint, uShade, uContourOp, uContourStep, uGridOp, uGridStep, uSatOp, uRainOp, uRainI, uFade;
uniform vec3 uLight, uHover;
varying vec3 vN; varying vec2 vUv; varying float vZ; varying vec3 vLocal;

vec3 ramp(float t){
  vec3 c0 = vec3(0.024,0.125,0.169), c1 = vec3(0.039,0.188,0.251), c2 = vec3(0.055,0.290,0.345), c3 = vec3(0.114,0.420,0.404),
       c4 = vec3(0.290,0.541,0.471), c5 = vec3(0.616,0.690,0.549), c6 = vec3(0.847,0.824,0.682);
  t = clamp(t, 0.0, 1.0) * 6.0;
  if (t < 1.0) return mix(c0, c1, t); if (t < 2.0) return mix(c1, c2, t - 1.0); if (t < 3.0) return mix(c2, c3, t - 2.0);
  if (t < 4.0) return mix(c3, c4, t - 3.0); if (t < 5.0) return mix(c4, c5, t - 4.0); return mix(c5, c6, t - 5.0);
}
vec4 radar(float v){
  if (v < 0.12) return vec4(0.0);
  if (v < 0.30) return vec4(0.31,0.71,0.79,0.30);
  if (v < 0.48) return vec4(0.44,0.84,0.88,0.38);
  if (v < 0.66) return vec4(0.75,0.94,0.92,0.46);
  if (v < 0.84) return vec4(0.91,0.82,0.49,0.52);
  return vec4(0.89,0.55,0.29,0.60);
}
void main(){
  vec3 n = normalize(vN);
  float diff = clamp(dot(n, normalize(uLight)), 0.0, 1.0);
  float sky = texture(uSky, vUv).r;
  float occ = mix(0.42, 1.0, smoothstep(0.35, 0.95, sky));
  float t = pow(clamp(vZ / max(uZMax, 1.0), 0.0, 1.0), 0.72);
  vec3 tint = vZ < 0.0 ? mix(vec3(0.03,0.16,0.22), vec3(0.015,0.06,0.09), clamp(-vZ / 6.0, 0.0, 1.0)) : ramp(t);
  vec3 flat_ = vec3(0.075,0.16,0.20) + 0.06 * t;
  vec3 albedo = mix(flat_, tint, uTint);
  if (uSatOp > 0.0) {
    vec3 s = texture(uSat, vUv).rgb;
    s = mix(vec3(dot(s, vec3(0.3,0.59,0.11))), s, 0.85) * vec3(0.78, 0.92, 0.98);
    albedo = mix(albedo, s * 0.9, uSatOp * step(0.0, vZ));
  }
  float lit = mix(1.0, 0.22 + 0.98 * diff, uShade);
  vec3 col = albedo * lit * occ;
  col += vec3(0.05,0.12,0.15) * (1.0 - n.z) * uShade;             // faint rim on steep faces

  // contours
  if (uContourOp > 0.0 && vZ > 0.0) {
    float f = vZ / uContourStep, fw = fwidth(f) + 1e-5;
    float l1 = 1.0 - clamp(abs(fract(f - 0.5) - 0.5) / fw, 0.0, 1.0);
    float f5 = f / 5.0, fw5 = fwidth(f5) + 1e-5;
    float l5 = 1.0 - clamp(abs(fract(f5 - 0.5) - 0.5) / (fw5 * 1.6), 0.0, 1.0);
    float fade = 1.0 - smoothstep(0.22, 0.55, fw);
    col = mix(col, vec3(0.45,0.86,0.9), clamp(l1 * 0.2 + l5 * 0.5, 0.0, 1.0) * fade * uContourOp);
  }
  // metric grid: fine + coarse
  if (uGridOp > 0.0) {
    vec2 g = vLocal.xy / uGridStep, gw = fwidth(g) + 1e-6;
    vec2 d1 = abs(fract(g - 0.5) - 0.5) / gw, d5 = abs(fract(g / 5.0 - 0.5) - 0.5) / (gw / 5.0 * 1.5);
    float l1 = 1.0 - clamp(min(d1.x, d1.y), 0.0, 1.0), l5 = 1.0 - clamp(min(d5.x, d5.y), 0.0, 1.0);
    float fade = 1.0 - smoothstep(0.25, 0.6, max(gw.x, gw.y));
    col += vec3(0.20,0.62,0.70) * (l1 * 0.12 * fade + l5 * 0.26) * uGridOp;
  }
  // rainfall field, banded like weather radar
  if (uRainOp > 0.0 && uRainI > 0.0) {
    vec2 p = vUv * vec2(uGrid.x / uGrid.y, 1.0) * 3.2 + vec2(uTime * 0.018, uTime * 0.007);
    float cell = fbm(p) * 0.65 + fbm(p * 2.7 + 9.0) * 0.35;
    float v = smoothstep(0.5 - 0.1 * uRainI, 0.9, cell) * (0.45 + 0.9 * uRainI);
    vec4 r = radar(v);
    col = mix(col, r.rgb, r.a * 0.8 * uRainOp);
  }
  // hover cell
  if (uHover.z > 0.0) {
    vec2 c = vUv * uGrid - 0.5, dd = abs(c - uHover.xy);
    float box = max(dd.x, dd.y);
    float fill = 1.0 - step(0.5, box), edge = smoothstep(0.34, 0.5, box) * fill;
    float halo = exp(-length((c - uHover.xy)) * 0.55) * 0.18;
    col += vec3(0.95,0.72,0.30) * (fill * 0.20 + edge * 0.85 + halo) * uHover.z;
  }
  gl_FragColor = vec4(col * uFade, uFade);
}`;

/* wire / grid overlay lines follow the surface */
const LINE_VS = /* glsl */`
${GLSL_COMMON}
attribute vec2 aIdx; uniform float uLift; varying float vH;
void main(){ float h = H(aIdx); vH = h; gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, h * uEx + uLift, 1.0); }`;
const LINE_FS = /* glsl */`
uniform float uOp, uZMax, uFade; varying float vH;
void main(){ float t = clamp(vH / max(uZMax, 1.0), 0.0, 1.0); vec3 c = mix(vec3(0.16,0.62,0.72), vec3(0.78,0.94,0.9), t);
  float a = uOp * uFade * (0.30 + 0.5 * t); gl_FragColor = vec4(c * a, a); }`;

const WATER_VS = /* glsl */`
${GLSL_COMMON}
uniform sampler2D uW; uniform float uLift;
attribute vec2 aIdx;
varying float vDepth; varying float vSea; varying vec3 vLocal;
void main(){
  float g = H(aIdx); vec2 w = texelFetch(uW, ivec2(aIdx), 0).rg;
  vDepth = w.r - g; vSea = w.g;
  vLocal = vec3(position.xy, max(w.r, g) * uEx + uLift);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(vLocal, 1.0);
}`;
const WATER_FS = /* glsl */`
${GLSL_COMMON}
uniform float uTime, uWaterOp, uFade, uRainI, uRipple;
uniform vec3 uLight, uEye;
varying float vDepth; varying float vSea; varying vec3 vLocal;
void main(){
  float d = vDepth;
  if (d < 0.02) discard;
  vec2 q = vLocal.xy * 0.00042;
  float e = 0.02, t = uTime;
  float h0 = fbm(q * 1.6 + vec2(t * 0.05, t * 0.03)) + 0.5 * fbm(q * 4.0 - vec2(t * 0.045, -t * 0.065));
  float hx = fbm((q + vec2(e, 0.0)) * 1.6 + vec2(t * 0.05, t * 0.03)) + 0.5 * fbm((q + vec2(e, 0.0)) * 4.0 - vec2(t * 0.045, -t * 0.065));
  float hy = fbm((q + vec2(0.0, e)) * 1.6 + vec2(t * 0.05, t * 0.03)) + 0.5 * fbm((q + vec2(0.0, e)) * 4.0 - vec2(t * 0.045, -t * 0.065));
  vec3 n = normalize(vec3(-(hx - h0) / e * 0.3, -(hy - h0) / e * 0.3, 1.0));
  vec3 V = normalize(uEye - vLocal), L = normalize(uLight);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
  float spec = pow(max(dot(n, normalize(L + V)), 0.0), 80.0);

  vec3 shallow = vec3(0.30,0.80,0.88), mid = vec3(0.07,0.47,0.58), deep = vec3(0.02,0.16,0.29);
  vec3 c = mix(shallow, mid, smoothstep(0.0, 2.0, d)); c = mix(c, deep, smoothstep(2.0, 9.0, d));
  if (vSea > 0.5) c = mix(vec3(0.03,0.24,0.34), vec3(0.01,0.09,0.17), smoothstep(0.0, 6.0, d));
  c = mix(c, vec3(0.50,0.80,0.90), fres * 0.55) + vec3(0.9,0.97,1.0) * spec * 0.45;
  c *= 0.82 + 0.28 * h0;

  float edge = 1.0 - smoothstep(0.03, 0.55, d);
  float foam = edge * smoothstep(0.42, 0.72, fbm(q * 26.0 + t * 0.2)) * (1.0 - vSea);
  c += vec3(0.7,0.92,0.95) * foam * 0.55;

  float rip = 0.0;
  if (uRainI > 0.0) {
    vec2 p = vLocal.xy / uRipple, id = floor(p), f = fract(p) - 0.5;
    float ph = fract(t * 0.7 + hash21(id)), r = ph * 0.5;
    rip = smoothstep(0.07, 0.0, abs(length(f) - r)) * (1.0 - ph) * step(hash21(id + 7.0), uRainI * 0.45) * (1.0 - vSea * 0.6);
  }
  c += vec3(0.8,0.95,1.0) * rip * 0.5;

  float a = (vSea > 0.5 ? 0.92 : mix(0.52, 0.90, smoothstep(0.0, 2.0, d))) * smoothstep(0.02, 0.28, d);
  a = clamp(a + foam * 0.3 + fres * 0.1, 0.0, 1.0) * uWaterOp * uFade;
  gl_FragColor = vec4(c * a, a);
}`;

const SKIRT_VS = /* glsl */`
${GLSL_COMMON}
attribute vec2 aIdx; attribute float aV; uniform float uThick; varying float vV; varying vec3 vLocal; varying float vTop;
void main(){ float h = H(aIdx) * uEx; vTop = h; vV = aV; vLocal = vec3(position.xy, mix(h, -uThick, aV));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(vLocal, 1.0); }`;
const SKIRT_FS = /* glsl */`
uniform float uThick, uFade; varying float vV; varying vec3 vLocal; varying float vTop;
void main(){
  float depthN = clamp((vTop - vLocal.z) / (vTop + uThick), 0.0, 1.0);
  vec3 c = mix(vec3(0.06,0.24,0.30), vec3(0.015,0.07,0.11), depthN);
  float bands = fract(vLocal.z / (uThick * 0.16));
  float line = 1.0 - smoothstep(0.0, 0.05, abs(bands - 0.5) - 0.45 + 0.05);
  c += vec3(0.08,0.22,0.26) * smoothstep(0.9, 1.0, bands) * 0.7;
  float top = 1.0 - smoothstep(0.0, 0.035 * (vTop + uThick), vLocal.z - (vTop - 0.0)) ;
  float lipLine = smoothstep(0.03, 0.0, vV);
  c += vec3(0.35,0.85,0.92) * lipLine * 0.9;
  gl_FragColor = vec4(c * uFade, uFade);
}`;

const EDGE_VS = /* glsl */`
${GLSL_COMMON}
attribute vec2 aIdx; varying float vA;
void main(){ float h = H(aIdx) * uEx; vA = 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, h + 4.0, 1.0); }`;
const EDGE_FS = /* glsl */`uniform float uFade; varying float vA; void main(){ gl_FragColor = vec4(vec3(0.45,0.9,0.96) * uFade, uFade); }`;

const SHADOW_VS = /* glsl */`varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SHADOW_FS = /* glsl */`uniform vec2 uHalf; uniform float uFade; varying vec2 vP;
void main(){ vec2 d = abs(vP) / uHalf; float a = 0.62 * (1.0 - smoothstep(0.82, 1.0, max(d.x, d.y))); a *= uFade; gl_FragColor = vec4(vec3(0.0,0.015,0.03) * a, a); }`;

const RAIN_VS = /* glsl */`
attribute vec4 aRand; attribute float aEnd;
uniform float uTime, uRainI, uSpan, uTop, uLen; uniform vec2 uHalf; varying float vA;
void main(){
  float on = step(aRand.w, uRainI);
  float ph = fract(uTime * (0.55 + 0.5 * aRand.z) + aRand.z * 7.0);
  vec3 p = vec3((aRand.x - 0.5) * 2.0 * uHalf.x, (aRand.y - 0.5) * 2.0 * uHalf.y, uTop * (1.0 - ph));
  p.xy += vec2(0.18, 0.06) * (p.z - uTop) ;
  p += aEnd * vec3(0.18, 0.06, 1.0) * uLen;
  vA = on * (0.25 + 0.5 * aEnd) * smoothstep(0.0, 0.08, ph) * smoothstep(1.0, 0.9, ph);
  gl_Position = on > 0.5 ? projectionMatrix * modelViewMatrix * vec4(p, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}`;
const RAIN_FS = /* glsl */`uniform float uFade; varying float vA; void main(){ float a = vA * 0.32 * uFade; gl_FragColor = vec4(vec3(0.62,0.86,0.95) * a, a); }`;

/* ── geometry builders ─────────────────────────────────────────── */
function gridGeometry(nx, ny, dx, dy) {
  const g = new THREE.BufferGeometry(), N = nx * ny;
  const pos = new Float32Array(N * 3), idx = new Float32Array(N * 2), ind = new Uint32Array((nx - 1) * (ny - 1) * 6);
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const i = y * nx + x;
    pos[i * 3] = (x - (nx - 1) / 2) * dx; pos[i * 3 + 1] = (y - (ny - 1) / 2) * dy;
    idx[i * 2] = x; idx[i * 2 + 1] = y;
  }
  let k = 0;
  for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    const a = y * nx + x, b = a + 1, c = a + nx, d = c + 1;
    // alternate the diagonal so slopes don't show a directional grain
    if ((x + y) & 1) { ind[k++] = a; ind[k++] = b; ind[k++] = d; ind[k++] = a; ind[k++] = d; ind[k++] = c; }
    else { ind[k++] = a; ind[k++] = b; ind[k++] = c; ind[k++] = b; ind[k++] = d; ind[k++] = c; }
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aIdx", new THREE.BufferAttribute(idx, 2));
  g.setIndex(new THREE.BufferAttribute(ind, 1));
  return g;
}
function perimeter(nx, ny) {
  const p = [];
  for (let x = 0; x < nx; x++) p.push([x, 0]);
  for (let y = 1; y < ny; y++) p.push([nx - 1, y]);
  for (let x = nx - 2; x >= 0; x--) p.push([x, ny - 1]);
  for (let y = ny - 2; y > 0; y--) p.push([0, y]);
  return p;
}
function skirtGeometry(nx, ny, dx, dy) {
  const per = perimeter(nx, ny), n = per.length;
  const pos = new Float32Array(n * 2 * 3), idx = new Float32Array(n * 2 * 2), v = new Float32Array(n * 2), ind = [];
  per.forEach(([x, y], i) => {
    for (let s = 0; s < 2; s++) {
      const j = i * 2 + s;
      pos[j * 3] = (x - (nx - 1) / 2) * dx; pos[j * 3 + 1] = (y - (ny - 1) / 2) * dy;
      idx[j * 2] = x; idx[j * 2 + 1] = y; v[j] = s;
    }
    const a = i * 2, b = ((i + 1) % n) * 2;
    ind.push(a, a + 1, b, b, a + 1, b + 1);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aIdx", new THREE.BufferAttribute(idx, 2));
  g.setAttribute("aV", new THREE.BufferAttribute(v, 1));
  g.setIndex(ind);
  return { g, per };
}
function edgeLine(nx, ny, dx, dy) {
  const per = perimeter(nx, ny), pos = new Float32Array(per.length * 3), idx = new Float32Array(per.length * 2);
  per.forEach(([x, y], i) => { pos[i * 3] = (x - (nx - 1) / 2) * dx; pos[i * 3 + 1] = (y - (ny - 1) / 2) * dy; idx[i * 2] = x; idx[i * 2 + 1] = y; });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aIdx", new THREE.BufferAttribute(idx, 2));
  return g;
}
/* every `step`-th row and column as polylines that follow the surface */
function wireGeometry(nx, ny, dx, dy, step) {
  const pos = [], idx = [];
  const P = (x, y) => { pos.push((x - (nx - 1) / 2) * dx, (y - (ny - 1) / 2) * dy, 0); idx.push(x, y); };
  for (let y = 0; y < ny; y += step) for (let x = 0; x < nx - 1; x++) { P(x, y); P(x + 1, y); }
  for (let x = 0; x < nx; x += step) for (let y = 0; y < ny - 1; y++) { P(x, y); P(x, y + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aIdx", new THREE.Float32BufferAttribute(idx, 2));
  return g;
}
function rainGeometry(count) {
  const r = new Float32Array(count * 2 * 4), e = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const a = Math.random(), b = Math.random(), c = Math.random(), d = Math.random();
    for (let s = 0; s < 2; s++) { r.set([a, b, c, d], (i * 2 + s) * 4); e[i * 2 + s] = s; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
  g.setAttribute("aRand", new THREE.BufferAttribute(r, 4));
  g.setAttribute("aEnd", new THREE.BufferAttribute(e, 1));
  return g;
}

/**
 * createTerrain3D(maplibregl, A, { lite }) → { layer, set(), setWater(), pick(), zAt(), ex }
 *   A: analysed DEM (analysis.js) with .frame
 */
export function createTerrain3D(maplibregl, A, { lite = false, reduceMotion = false } = {}) {
  const { nx, ny, dx, dy, frame: F } = A, N = nx * ny;
  const zref = Math.max(0, A.zmin), range = Math.max(10, A.zmax - zref);
  const widthM = nx * dx;

  /* textures */
  const hData = new Float32Array(N);
  for (let i = 0; i < N; i++) hData[i] = Math.max(A.z[i], -6) - zref;
  const hTex = new THREE.DataTexture(hData, nx, ny, THREE.RedFormat, THREE.FloatType);
  hTex.minFilter = hTex.magFilter = THREE.NearestFilter; hTex.needsUpdate = true;
  const skyTex = new THREE.DataTexture(A.sky, nx, ny, THREE.RedFormat, THREE.UnsignedByteType);
  skyTex.minFilter = skyTex.magFilter = THREE.LinearFilter; skyTex.needsUpdate = true;
  const wData = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { wData[i * 2] = A.sea[i] ? -zref : -1e4; wData[i * 2 + 1] = A.sea[i] ? 1 : 0; }
  const wTex = new THREE.DataTexture(wData, nx, ny, THREE.RGFormat, THREE.FloatType);
  wTex.minFilter = wTex.magFilter = THREE.NearestFilter; wTex.needsUpdate = true;
  const blank = new THREE.DataTexture(new Uint8Array([20, 40, 50, 255]), 1, 1); blank.needsUpdate = true;

  const ex0 = Math.min(14, Math.max(1.5, 0.045 * widthM / range));
  const thick = 0.035 * widthM;
  const shared = {
    uH: { value: hTex }, uGrid: { value: new THREE.Vector2(nx, ny) }, uCell: { value: new THREE.Vector2(dx, dy) },
    uEx: { value: ex0 }, uFade: { value: 1 }, uTime: { value: 0 }, uZMax: { value: range },
    uLight: { value: new THREE.Vector3(-0.55, 0.5, 0.62) }, uLift: { value: 0 },
  };
  const U = extra => ({ ...shared, ...extra });

  const scene = new THREE.Scene(), camera = new THREE.Camera();
  const geo = gridGeometry(nx, ny, dx, dy);

  const terrainMat = new THREE.ShaderMaterial({
    vertexShader: TERRAIN_VS, fragmentShader: TERRAIN_FS, side: THREE.DoubleSide, transparent: false,
    premultipliedAlpha: true,
    uniforms: U({
      uSky: { value: skyTex }, uSat: { value: blank }, uTint: { value: 1 }, uShade: { value: 1 }, uContourOp: { value: 1 },
      uContourStep: { value: niceStep(range / 18) }, uGridOp: { value: 0.8 }, uGridStep: { value: niceGrid(widthM / 14) },
      uSatOp: { value: 0 }, uRainOp: { value: 0 }, uRainI: { value: 0 }, uHover: { value: new THREE.Vector3(0, 0, 0) },
    }),
  });
  const terrain = new THREE.Mesh(geo, terrainMat); terrain.frustumCulled = false; scene.add(terrain);

  const wireMat = new THREE.ShaderMaterial({
    vertexShader: LINE_VS, fragmentShader: LINE_FS, transparent: true, depthWrite: false, premultipliedAlpha: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    uniforms: U({ uOp: { value: 0 }, uLift: { value: 30 } }),
  });
  const wire = new THREE.LineSegments(wireGeometry(nx, ny, dx, dy, lite ? 12 : 8), wireMat); wire.frustumCulled = false; wire.visible = false; scene.add(wire);

  const waterMat = new THREE.ShaderMaterial({
    vertexShader: WATER_VS, fragmentShader: WATER_FS, side: THREE.DoubleSide, transparent: true, depthWrite: false, premultipliedAlpha: true,
    uniforms: U({ uW: { value: wTex }, uWaterOp: { value: 1 }, uRainI: { value: 0 }, uRipple: { value: widthM / 60 }, uEye: { value: new THREE.Vector3(0, -1e5, 5e4) }, uLift: { value: 6 } }),
  });
  const water = new THREE.Mesh(geo, waterMat); water.frustumCulled = false; water.renderOrder = 2; scene.add(water);

  const sk = skirtGeometry(nx, ny, dx, dy);
  const skirtMat = new THREE.ShaderMaterial({ vertexShader: SKIRT_VS, fragmentShader: SKIRT_FS, side: THREE.DoubleSide, premultipliedAlpha: true, uniforms: U({ uThick: { value: thick } }) });
  const skirt = new THREE.Mesh(sk.g, skirtMat); skirt.frustumCulled = false; scene.add(skirt);
  const edge = new THREE.LineLoop(edgeLine(nx, ny, dx, dy), new THREE.ShaderMaterial({ vertexShader: EDGE_VS, fragmentShader: EDGE_FS, uniforms: U({}), transparent: true, premultipliedAlpha: true }));
  edge.frustumCulled = false; scene.add(edge);

  const shadowGeo = new THREE.PlaneGeometry(widthM * 1.7, ny * dy * 1.7);
  shadowGeo.translate(0, -thick * 0.1, 0);
  const shadowMat = new THREE.ShaderMaterial({ vertexShader: SHADOW_VS, fragmentShader: SHADOW_FS, transparent: true, depthWrite: false, premultipliedAlpha: true, uniforms: { uHalf: { value: new THREE.Vector2(widthM * 0.85, ny * dy * 0.85) }, uFade: shared.uFade } });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.position.z = -thick - 40; shadow.renderOrder = -1; shadow.frustumCulled = false; scene.add(shadow);

  const rainMat = new THREE.ShaderMaterial({
    vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false, premultipliedAlpha: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    uniforms: { uTime: shared.uTime, uRainI: { value: 0 }, uSpan: { value: widthM }, uTop: { value: Math.max(range * ex0, 0) + widthM * 0.16 }, uLen: { value: widthM * 0.02 }, uHalf: { value: new THREE.Vector2(nx * dx / 2, ny * dy / 2) }, uFade: shared.uFade },
  });
  const rain = new THREE.LineSegments(rainGeometry(lite ? 2200 : 5200), rainMat); rain.frustumCulled = false; rain.visible = false; rain.renderOrder = 3; scene.add(rain);

  /* mercator frame of the window */
  let model = null, combined = null, renderer = null, mapRef = null, t0 = performance.now(), animate = false;
  const state = { ex: ex0, tint: 1, water: true };

  const layer = {
    id: "terrain3d", type: "custom", renderingMode: "3d",
    onAdd(map, gl) {
      mapRef = map;
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      const mc = maplibregl.MercatorCoordinate.fromLngLat([F.clon, F.clat], 0), s = mc.meterInMercatorCoordinateUnits();
      model = new THREE.Matrix4().set(s, 0, 0, mc.x, 0, -s, 0, mc.y, 0, 0, s, 0, 0, 0, 0, 1);
    },
    render(gl, args) {
      const m = args && (args.defaultProjectionData?.mainMatrix || args.modelViewProjectionMatrix) || args;
      combined = new THREE.Matrix4().fromArray(m).multiply(model);
      camera.projectionMatrix.copy(combined); camera.projectionMatrixInverse.copy(combined).invert();
      const inv = camera.projectionMatrixInverse;
      waterMat.uniforms.uEye.value.set(0, 0, -1).applyMatrix4(inv);
      shared.uTime.value = reduceMotion ? 3 : (performance.now() - t0) / 1000;
      renderer.resetState();
      renderer.render(scene, camera);
      if (animate && !reduceMotion) mapRef.triggerRepaint();
    },
    onRemove() { renderer?.dispose?.(); },
  };

  /* height of the visible surface at local metres (E, N) — bilinear, exaggerated */
  const zAtLocal = (E, Nn) => {
    const fx = E / dx + (nx - 1) / 2, fy = Nn / dy + (ny - 1) / 2;
    if (fx < 0 || fy < 0 || fx > nx - 1 || fy > ny - 1) return null;
    const x0 = Math.min(nx - 2, Math.floor(fx)), y0 = Math.min(ny - 2, Math.floor(fy)), u = fx - x0, v = fy - y0, i = y0 * nx + x0;
    return ((hData[i] * (1 - u) + hData[i + 1] * u) * (1 - v) + (hData[i + nx] * (1 - u) + hData[i + nx + 1] * u) * v) * shared.uEx.value;
  };

  const api = {
    layer, zref, range, thick, get ex() { return shared.uEx.value; },
    defaultEx: ex0,
    /** visual (exaggerated) elevation in metres for cell index i */
    zOf(i) { return hData[i] * shared.uEx.value; },
    set(p) {
      if (p.ex != null) { shared.uEx.value = p.ex; rainMat.uniforms.uTop.value = range * p.ex + widthM * 0.16; }
      const T = terrainMat.uniforms;
      if (p.tint != null) T.uTint.value = p.tint;
      if (p.shade != null) T.uShade.value = p.shade;
      if (p.contour != null) T.uContourOp.value = p.contour;
      if (p.grid != null) T.uGridOp.value = p.grid;
      if (p.satOp != null) T.uSatOp.value = p.satOp;
      if (p.satTex !== undefined) { T.uSat.value = p.satTex || blank; }
      if (p.rainOp != null) T.uRainOp.value = p.rainOp;
      if (p.rain != null) { T.uRainI.value = p.rain; waterMat.uniforms.uRainI.value = p.rain; rainMat.uniforms.uRainI.value = p.rain; }
      if (p.streaks != null) rain.visible = p.streaks && p.rain > 0;
      if (p.wire != null) { wireMat.uniforms.uOp.value = p.wire; wire.visible = p.wire > 0.01; }
      if (p.waterOp != null) waterMat.uniforms.uWaterOp.value = p.waterOp;
      if (p.fade != null) {
        shared.uFade.value = p.fade;
        const solid = p.fade >= 0.999;
        terrainMat.transparent = skirtMat.transparent = !solid; terrainMat.depthWrite = skirtMat.depthWrite = true;
        terrain.visible = skirt.visible = edge.visible = shadow.visible = water.visible = p.fade > 0.003;
      }
      if (p.hover !== undefined) { const h = T.uHover.value; p.hover ? h.set(p.hover[0], p.hover[1], 1) : h.set(0, 0, 0); }
      if (p.animate != null) animate = p.animate;
      mapRef?.triggerRepaint();
    },
    /** flood level per cell, metres above sea level (use -1e4 for dry) */
    setWater(level) {
      for (let i = 0; i < N; i++) { wData[i * 2] = A.sea[i] ? -zref : (level[i] > -1e3 ? level[i] - zref : -1e4); }
      wTex.needsUpdate = true; mapRef?.triggerRepaint();
    },
    /** screen px (CSS) → grid cell on the visible surface, or null */
    pick(px, py) {
      if (!combined || !mapRef) return null;
      const cv = mapRef.getCanvas(), nxc = (px / cv.clientWidth) * 2 - 1, nyc = 1 - (py / cv.clientHeight) * 2;
      const inv = camera.projectionMatrixInverse;
      const a = new THREE.Vector3(nxc, nyc, -1).applyMatrix4(inv), b = new THREE.Vector3(nxc, nyc, 1).applyMatrix4(inv);
      const STEPS = 700, hx = nx * dx / 2, hy = ny * dy / 2;
      let prev = null, prevT = 0;
      for (let k = 0; k <= STEPS; k++) {
        const t = k / STEPS, E = a.x + (b.x - a.x) * t, Nn = a.y + (b.y - a.y) * t, U = a.z + (b.z - a.z) * t;
        if (Math.abs(E) > hx || Math.abs(Nn) > hy) { prev = null; continue; }
        const h = zAtLocal(E, Nn);
        if (h == null) { prev = null; continue; }
        if (U <= h) {
          if (prev == null) return null;
          let lo = prevT, hi = t;
          for (let q = 0; q < 14; q++) {
            const mid = (lo + hi) / 2, Em = a.x + (b.x - a.x) * mid, Nm = a.y + (b.y - a.y) * mid, Um = a.z + (b.z - a.z) * mid;
            (Um <= zAtLocal(Em, Nm) ? hi = mid : lo = mid);
          }
          const E2 = a.x + (b.x - a.x) * hi, N2 = a.y + (b.y - a.y) * hi;
          const ix = Math.min(nx - 1, Math.max(0, Math.round(E2 / dx + (nx - 1) / 2))), iy = Math.min(ny - 1, Math.max(0, Math.round(N2 / dy + (ny - 1) / 2)));
          return { ix, iy, i: iy * nx + ix };
        }
        prev = U; prevT = t;
      }
      return null;
    },
    dispose() {
      for (const o of [geo, sk.g, wire.geometry, rain.geometry, shadowGeo, edge.geometry]) o.dispose();
      for (const t of [hTex, skyTex, wTex, blank]) t.dispose();
      for (const m of [terrainMat, wireMat, waterMat, skirtMat, rainMat, shadowMat, edge.material]) m.dispose();
    },
  };
  return api;
}

function niceStep(v) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1e-3)))), f = v / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}
const niceGrid = v => niceStep(v);
