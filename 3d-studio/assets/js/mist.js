/* Ambient mist — slow, wavy ribbons of the brand colour drifting behind the
   page. The field is drawn at a very low resolution and the browser scales
   the canvas up to the viewport, which is what makes it soft: no blur filter,
   one small texture upload per frame, so it stays cheap on phones and on the
   Android tablets whose GPUs choked on filtered layers.

   On the home page it joins the existing atmosphere (#atmos); on the other
   pages it gets a fixed layer of its own behind the content. */
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SMALL = matchMedia("(hover: none), (pointer: coarse)").matches || innerWidth < 760;
const W = SMALL ? 96 : 150, H = SMALL ? 64 : 92;

const cv = document.createElement("canvas");
cv.className = "fgMist";
cv.setAttribute("aria-hidden", "true");
cv.width = W; cv.height = H;
const atmos = document.getElementById("atmos");
if (atmos) atmos.insertBefore(cv, document.getElementById("water"));
else document.body.prepend(cv);
const cx = cv.getContext("2d");
const img = cx.createImageData(W, H);
const px = new Uint32Array(img.data.buffer);

/* sine in cycles, from a table: S(c) = sin(2πc) */
const N = 1024, LUT = new Float32Array(N);
for (let i = 0; i < N; i++) LUT[i] = Math.sin(i / N * 6.283185);
const S = c => LUT[((c * N) | 0) & (N - 1)];

/* colour and strength follow the theme */
let R = 18, G = 118, B = 143, AMAX = 70;
function readTheme() {
  const root = document.documentElement, cs = getComputedStyle(root);
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  const probe = document.createElement("canvas").getContext("2d");
  probe.fillStyle = "#12768f";
  probe.fillStyle = (cs.getPropertyValue(dark ? "--b200" : "--b600") || cs.getPropertyValue("--brand")).trim() || "#12768f";
  const hex = probe.fillStyle;
  if (/^#[0-9a-f]{6}$/i.test(hex)) { R = parseInt(hex.slice(1, 3), 16); G = parseInt(hex.slice(3, 5), 16); B = parseInt(hex.slice(5, 7), 16); }
  AMAX = dark ? 62 : 74;                       /* out of 255 */
  frozen = false;
}
let frozen = false;
readTheme();
new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readTheme);

const ASPECT = W / H;
function paint(t) {
  const rgb = (B << 16) | (G << 8) | R;         /* little-endian RGBA */
  for (let y = 0; y < H; y++) {
    const v = y / H;
    /* each row is pushed sideways by two slow waves — the "flow" */
    const wx = .10 * S(1.2 * v + t * .031) + .05 * S(2.6 * v - t * .047) + t * .012;
    for (let x = 0; x < W; x++) {
      const u = x / W * ASPECT * .62;
      const qx = u + wx, qy = v + .08 * S(1.1 * u - t * .027);
      /* three travelling waves at different angles and speeds interfere into
         soft ribbons that keep changing shape */
      let m = .5 * S(.9 * qx + .35 * qy + t * .055)
        + .3 * S(-.6 * qx + 1.4 * qy - t * .041)
        + .2 * S(1.9 * qx - .8 * qy + t * .073);
      m = m * .5 + .5;                              /* 0..1 */
      m = m * m * (3 - 2 * m);                      /* smoothstep: fuller bands */
      m *= m;                                       /* and clear gaps between them */
      px[y * W + x] = ((m * AMAX) << 24) | rgb;
    }
  }
  cx.putImageData(img, 0, 0);
}

let t = Math.random() * 400, last = 0, acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) { last = now; return; }
  if (RM) { if (!frozen) { paint(t); frozen = true; } return; }
  const dt = Math.min(.1, (now - (last || now)) / 1000); last = now;
  acc += dt; t += dt;
  if (acc < 1 / 30) return;                         /* ambient — 30fps is plenty */
  acc = 0;
  paint(t);
}
paint(t);
requestAnimationFrame(frame);
