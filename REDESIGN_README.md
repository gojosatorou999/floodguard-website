# FloodGuard Homepage — Redesign Spec v2
### Scroll narratives · section rebuilds · cross-device hardening

> **Audience:** the coding agent working in this repo.
> **Read fully before editing.** Execute phases in order (§9). Every phase ends green on `tsc --noEmit`, `vite build`, and the QA screenshots (§7).
> Where this spec conflicts with existing code conventions in `STRUCTURE.md`, follow `STRUCTURE.md` for *naming/location* and this spec for *behavior*.

---

## 0. Ground rules (non-negotiable)

1. **Stack is fixed:** Vite 6 · React 19 · TypeScript strict · React Router v7 · vanilla CSS + custom properties (`tokens.css`, 3-layer) · `motion/react`.
   **No Tailwind. No Next.js. No GSAP. No Lenis or any scroll-hijacking library.** Any reference material written in Tailwind/Next/GSAP syntax (including the isometric-stack prompt the owner supplied) is translated in this doc — implement the translation, not the original.
2. **Zero hardcoded hex / magic px in components.** New values go into `tokens.css` (semantic layer) first. SVG geometry constants are allowed, but only in `*.geometry.ts` files.
3. **Content lives in `src/data/content/home.ts`** (typed). Components take props. No copy strings in JSX.
4. **Stat discipline:** no numeric claim renders unless its data object has `validated: true`. Delete every `TODO` / `XX` / `—` placeholder stat. If a stat is not validated, omit the slot entirely — never show a placeholder.
5. **Native scroll everywhere.** Animations *read* scroll position; they never *control* it. No `wheel`/`touchmove` listeners that call `preventDefault()`.
6. **Animate `transform` and `opacity` only** (plus SVG `pathLength` / `stroke-dashoffset`). Never animate `width/height/top/left/filter/clip-path` per frame on screens < 900px.
7. **Every animated section has a complete static state.** Reduced motion, pins disabled, or observer failure → all content visible and readable in DOM order.
8. **Alert red (`#c1121f` token) stays reserved for live flood state.** It is not used anywhere in this spec.
9. **Brand tone:** calm, scientific, enterprise (Bloomberg / ArcGIS reference). One motion mechanism per section. Do **not** add generic fade-up-on-enter to other elements on top of the specified mechanism. §09 About is the page's single "bold" moment; everything else stays disciplined.

---

## 1. Change map

| § | Section | Current | Target | Component(s) |
|---|---|---|---|---|
| 01 | The flood problem | 3 static boxes | The **existing §05 scroll animation**, extracted into a reusable `ScrollNarrative`, fed §01 content | `ScrollNarrative` |
| 02 | The decision gap | Side-by-side boxes: 7 inputs → FloodGuard → Decision | **Confluence:** 7 tributary streams scroll-draw and converge into a FloodGuard hub → single Decision outlet | `Confluence` |
| 05 | Decision support | Scroll animation (moves to §01) | **Split-screen sticky isometric layer stack** | `IsoStack`, `IsoStackVisual` |
| 06 | Platform | Static boxes + placeholder data | **Tide reveal:** wave band opens, each card surfaces as a wave recedes, vertical single-column list, water-level progress gauge (≥1200) | `TideBand`, `WaveReveal`, `DepthGauge` |
| 09 | About us | — | **Droplet genesis:** drop falls → impact → ripple expands into a reveal → about cards rise from the waterline | `DropletGenesis` |
| 10 | Insights | Side-by-side cards | **Depth deck:** sticky stacked cards, previous card recedes in depth; sticky intro column | `DepthDeck` |
| — | Footer | Misaligned; "FloodGuard" renders twice | Rebuilt grid, legal bar, responsive collapse, safe-area aware | `SiteFooter` |
| — | Water ripple background | Too faint | Theme-aware intensity tokens; clearly visible in light + dark | existing ripple component |
| all | Responsive | Ad hoc | Unified breakpoints, viewport units, pin policy, per-platform fixes | global |

Sections **03, 04, 07, 08**: no redesign. Only the global responsive pass (§4) applies.

---

## 2. Pre-flight audit (do first; summarize findings in the PR description)

- [ ] **Locate current §05** (grep `Decision support`, `decision-support`, `decisionSupport` in `home.ts`). Write one paragraph documenting its mechanism: hook(s) used, scroll offsets, step logic, visual elements. You will extract it verbatim in P1.
- [ ] **Locate the water ripple background** (grep `ripple`, `canvas`, `requestAnimationFrame`). Record current color, alpha, stroke width, spawn logic.
- [ ] **Locate the footer** and identify why "FloodGuard" renders twice (likely logo `<img alt="FloodGuard">` next to a text wordmark, or an SVG `<title>` + text).
- [ ] **Check `package.json` for `motion`.** If absent: `npm i motion`. Import from `motion/react`.
- [ ] **Check the theme mechanism** in `ThemeToggle.tsx` (attribute/class on `<html>`). This spec writes `[data-theme="dark"]` — replace with the real selector everywhere.
- [ ] **Check every ancestor of sections that will pin** (`App`, layout wrappers, `<main>`, section wrappers) for `overflow: hidden|auto|scroll`, `transform`, `filter`, `contain`, `content-visibility`, `will-change: transform`. Remove/convert per §4.4, otherwise `position: sticky` silently fails (especially on Safari).
- [ ] **Confirm `--header-h`** exists and matches the rendered header height at each breakpoint. If not, add it.
- [ ] **List existing routes** from `nav.ts` / `routes/` — needed for footer and card links (no dead links).

---

## 3. Open questions for the owner (don't block — use the defaults)

| Question | Default until answered |
|---|---|
| Footer lists **Atlas** as a product, but the products section shows only Explorer + Live. Is Atlas public-facing? | Keep the footer link; flag in PR. |
| How many steps does the current §05 content have? | `IsoStack` supports 3–6 layers; default mapping in §5.3. |
| Final About copy | Use the cards in §5.5 marked `// CONFIRM`. |
| Platform card copy (currently placeholder) | Plain capability copy, **no numbers**, marked `// CONFIRM`. |

---

## 4. Global foundation

### 4.1 Breakpoints (mobile-first, `min-width` queries only)

| Name | Range (CSS px) | Typical devices |
|---|---|---|
| `xs` | < 360 | Galaxy Fold folded (280), older small Android |
| `sm` | 360–599 | iPhone 375–430, Android 360–412 |
| `md` | 600–899 | iPad mini / tablets portrait, foldables open |
| `lg` | 900–1199 | iPad landscape, small laptops, **Windows @150% (1280)** |
| `xl` | 1200–1599 | MacBook Air/Pro (1440–1512), **Windows @125% (1536)** |
| `2xl` | ≥ 1600 | 1920+ desktops; content capped at `--container-max` |

Custom properties can't be used inside media queries → hardcode px in queries and mirror them in `src/styles/breakpoints.ts` for JS (`useMediaQuery`).

**Height classes (critical — Windows scaled displays and landscape phones are short):**

- `(min-height: 560px)` → pinned/sticky scroll stages allowed.
- `(max-height: 559px)` → all pins OFF; every section renders its static layout.

### 4.2 Token additions — `tokens.css` (semantic layer)

Map every `var(--blue-*)` / `var(--teal-*)` below to the **actual primitive names** already in `tokens.css` (scale `#04263d → #c4ebe6`). Don't introduce new primitives.

```css
:root {
  /* layout */
  --header-h: 64px;
  --container-max: 1320px;
  --gutter: clamp(16px, 4vw, 40px);
  --section-pad-y: clamp(64px, 10svh, 140px);

  /* scroll stages */
  --step-h: 70svh;                              /* scroll length per narrative step */
  --stage-h: calc(100svh - var(--header-h));    /* pinned stage height */

  /* motion */
  --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-fast: 180ms;
  --dur-med: 480ms;
  --dur-slow: 900ms;

  /* iso stack (§05) — bottom → top */
  --iso-l1: var(--blue-900);
  --iso-l2: var(--blue-800);
  --iso-l3: var(--blue-700);
  --iso-l4: var(--teal-600);
  --iso-l5: var(--teal-400);
  --iso-side-left: rgb(0 0 0 / 0.22);
  --iso-side-right: rgb(0 0 0 / 0.10);
  --iso-texture-opacity: 0.18;

  /* confluence streams (§02) */
  --stream-hazard: var(--blue-700);
  --stream-observed: var(--blue-500);
  --stream-physical: var(--teal-600);
  --stream-exposure: var(--teal-400);

  /* water surfaces (§06, §09) */
  --surface-water: var(--blue-50);
  --surface-about: var(--blue-900);   /* deep brand in BOTH themes */
  --text-on-brand: var(--teal-50);

  /* deck (§10) */
  --deck-top: 32px;
  --deck-step: 20px;

  /* ripple background (§5.8) — rgb triplets because canvas reads them */
  --ripple-rgb: 10 82 115;            /* = brand blue-800 #0a5273 */
  --ripple-alpha: 0.16;
  --ripple-alpha-echo: 0.08;
  --ripple-stroke: 1.5;               /* CSS px; canvas multiplies by DPR */
  --ripple-blend: multiply;
}

[data-theme="dark"] {
  --iso-side-left: rgb(0 0 0 / 0.35);
  --iso-side-right: rgb(0 0 0 / 0.18);
  --surface-water: var(--blue-950, var(--blue-900));
  --ripple-rgb: 124 214 204;          /* use nearest light-teal primitive */
  --ripple-alpha: 0.13;
  --ripple-alpha-echo: 0.06;
  --ripple-blend: screen;
}

@media (max-width: 899px) {
  :root { --header-h: 56px; --step-h: 60svh; --deck-top: 16px; --deck-step: 12px; }
}

/* svh fallback (Safari < 15.4 etc.) — keep this block LAST */
@supports not (height: 1svh) {
  :root {
    --step-h: 70vh;
    --stage-h: calc(100vh - var(--header-h));
    --section-pad-y: clamp(64px, 10vh, 140px);
  }
}
```

### 4.3 Global CSS fixes — `global.css`

```css
html {
  scroll-padding-top: calc(var(--header-h) + 16px);
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  color-scheme: light dark;
  scrollbar-gutter: stable;                 /* Windows: no layout jump when scrollbar appears */
}
html, body { overflow-x: clip; }            /* NOT hidden — hidden breaks position:sticky */
body {
  min-height: 100svh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-tap-highlight-color: transparent;
}
img, video, canvas { max-width: 100%; height: auto; display: block; }
:where(a, button, [role="button"], summary) { touch-action: manipulation; }
.container { width: min(100% - 2 * var(--gutter), var(--container-max)); margin-inline: auto; }

/* all hover-only effects live inside this query */
@media (hover: hover) and (pointer: fine) { /* … */ }

/* pause helper used by useInViewPause */
[data-paused="true"], [data-paused="true"] * { animation-play-state: paused !important; }

@media (forced-colors: active) {
  svg [data-decorative] { display: none; }
  svg { forced-color-adjust: auto; }
}
```

Rules:
- **Never use `100vw` for widths** (Windows classic scrollbars add ~17px → horizontal overflow). Use `100%`. For full-bleed elements, use a full-bleed grid layout, not `margin-inline: calc(50% - 50vw)`.
- **Never `background-attachment: fixed`** (broken on iOS).
- Form inputs: `font-size: max(16px, 1rem)` (prevents iOS focus zoom).
- Don't use `content-visibility: auto` on any section that contains a sticky element.

`index.html` `<head>`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="color-scheme" content="light dark" />
<meta name="theme-color" media="(prefers-color-scheme: light)" content="<light surface hex>" />
<meta name="theme-color" media="(prefers-color-scheme: dark)"  content="<dark surface hex>" />
```

- Do **not** add `maximum-scale=1` or `user-scalable=no`.
- `ThemeToggle` must also update `meta[name="theme-color"]` when the user switches theme manually (status-bar tint on iOS/Android).
- Header gets `padding-top: env(safe-area-inset-top)` and `padding-inline: max(var(--gutter), env(safe-area-inset-left))` (notch in landscape). Header uses `-webkit-backdrop-filter` alongside `backdrop-filter`.

### 4.4 Pin policy (sticky scroll stages)

- Pins are **CSS `position: sticky`** only. Never JS-driven `position: fixed`.
- Structure: `.stage-track` (sets scroll length) › `.stage` (`position: sticky; top: var(--header-h); height: var(--stage-h);`).
- Heights use **`svh`, never `dvh`**. `dvh` changes while the mobile URL bar collapses → stage resizes mid-scroll → visible jank on iOS Safari and Android Chrome.
- Pins are enabled only when `useCanPin()` is true: `(min-height: 560px)` **and** not reduced motion. Otherwise: track height `auto`, stage `position: static`, section renders its static layout.
- No ancestor of a `.stage` may have: `overflow` other than `visible`/`clip`, `transform`, `filter`, `perspective`, `contain: paint|layout|strict`, `content-visibility`, or `will-change: transform`.
- Scrubbed state must be derived from **scroll position**, never from counting events — fast trackpad/touch flings skip intermediate positions.

### 4.5 Shared primitives — `src/components/motion/`

```ts
// useMediaQuery.ts — matchMedia + 'change' listener; initial value read synchronously
export function useMediaQuery(query: string): boolean;

// useCanPin.ts
export function useCanPin(): boolean; // useMediaQuery('(min-height: 560px)') && !useReducedMotion()

// useFinePointer.ts
export function useFinePointer(): boolean; // useMediaQuery('(hover: hover) and (pointer: fine)')

// useActiveStep.ts — IntersectionObserver on [data-step] children; returns highest index
// intersecting the center band; -1 before the first step; holds last index after the last.
export function useActiveStep(
  container: React.RefObject<HTMLElement | null>,
  selector?: string,      // default '[data-step]'
  rootMargin?: string     // default '-45% 0px -45% 0px'
): number;

// useSectionProgress.ts — wraps motion's useScroll; on fine pointers (mouse wheel = 100px jumps)
// returns a spring-smoothed value, on touch returns the raw value (touch is already smooth).
export function useSectionProgress(
  target: React.RefObject<HTMLElement | null>,
  offset?: ScrollOffset   // default ['start start', 'end end']
): MotionValue<number>;
//   spring config (fine pointer only): { stiffness: 120, damping: 30, restDelta: 0.001 }

// useInViewPause.ts — true while in view AND document visible.
// Consumers: pause rAF loops, set data-paused on CSS-animated wrappers,
// call svg.pauseAnimations()/unpauseAnimations() for SMIL.
export function useInViewPause(ref: React.RefObject<Element | null>, rootMargin?: string): boolean;

// range.ts
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a)); // phase-local 0..1
```

Rules for all motion code:
- Motion values go straight into `style` props (`<motion.g style={{ y, opacity }}>`). **No React state updates per scroll frame.** `setState` only for discrete changes (active step index).
- Per-item scroll transforms (`useTransform` inside a `.map`) must live in a child component (`<DeckCard>`, `<IsoSlab>`), never hooks-in-a-loop.
- `will-change: transform` only on elements currently animating; remove when idle.

### 4.6 Accessibility contract

- Headings and step text are real DOM text in reading order. Decorative SVGs: `aria-hidden="true" focusable="false"`. If a visual carries information (Confluence inputs), provide a visually-hidden text equivalent.
- **Content is never permanently at opacity 0.** Initial hidden states apply only under `[data-motion="ready"]`, set by JS on mount. No JS → content visible.
- `:focus-within` on any revealable card forces its revealed state (keyboard users tabbing into hidden content).
- Reduced motion (`prefers-reduced-motion: reduce` + `useReducedMotion()`): no scrubbing, no pins, no loops. Render final states. Crossfades ≤ 200ms allowed.
- Contrast: ≥ 4.5:1 body, ≥ 3:1 large text and meaningful strokes — check both themes, including over the ripple background and on `--surface-about`.
- Touch targets ≥ 44×44 CSS px on coarse pointers. Visible `:focus-visible` rings from tokens.
- Windows High Contrast (`forced-colors: active`): SVG strokes → `CanvasText`, fills → `Canvas`, decorative layers hidden.

### 4.7 Performance contract

- **Target device:** mid-range Android (Redmi / Samsung A-series class — the core India audience). Test with Chrome DevTools 4× CPU throttle and on a real device if available. 60fps scroll through every pinned section.
- LCP < 2.5s on 4G · CLS < 0.05 · INP < 200ms.
- No animated `filter` (`blur`, `drop-shadow`) below 900px. Glows are duplicated strokes at low opacity.
- Canvas DPR cap: `Math.min(devicePixelRatio, 2)` on fine pointers, `1.5` on coarse pointers.
- Pause every loop off-screen and on `document.hidden`.
- Below-the-fold sections lazy-load via `React.lazy` + `Suspense` with a reserved `min-height` fallback (no CLS).
- SVG path strings are precomputed at module scope. Never regenerate geometry per frame.

---

## 5. Section specs

### 5.1 §01 The flood problem → `ScrollNarrative`

**Intent:** the owner likes the current §05 scroll animation. It moves to §01 unchanged in feel; §05 gets the new isometric stack (§5.3).

1. Extract the mechanism of the current §05 into `src/components/motion/ScrollNarrative.tsx` (+ `scroll-narrative.css`). **Preserve its timing, easing, offsets and visuals exactly.** Only change: content comes from props.
2. §01 renders `<ScrollNarrative {...home.floodProblem} />`.
3. Content is the existing §01 copy, unchanged:
   - label "01 — The flood problem", heading "Flood risk is changing. The way we assess it hasn't.", two lead paragraphs.
   - steps: Backward-looking · Too coarse · Fragmented, each with its one-liner.
4. If the extracted mechanism isn't responsive, bring it in line with the pin policy: ≥900 its current layout; <900 single column; pins disabled → static stacked list.

```ts
export type NarrativeStep = { id: string; title: string; body: string };
export type ScrollNarrativeProps = {
  id: string; label: string; heading: string; lead: string[]; steps: NarrativeStep[];
};
```

**Acceptance:** §01 scrolls and looks like old §05 did; §05 no longer imports it; old §01 box components are deleted (not left orphaned).

---

### 5.2 §02 The decision gap → `Confluence`

**Concept — drainage basin.** The 7 data inputs are tributaries; FloodGuard is the confluence; the Decision is the single outlet. The section visually resolves §01's "Fragmented" point: scattered inputs settle, streams draw in, and one channel leaves the hub.

**Structure**
- Header (label, h2 "Data alone doesn't answer the decision.") left-aligned above the stage.
- Stage: pinned when `useCanPin()`; track height `220svh` (≥900) / `200svh` (<900).
- Visually hidden `<ol>` for screen readers: the 7 inputs → FloodGuard → Decision.
- SVG `aria-hidden`.

**Geometry** — `confluence.geometry.ts` exports `DESKTOP` (viewBox `1200×560`) and `MOBILE` (viewBox `360×720`). Pick with `useMediaQuery('(min-width: 900px)')`. Below 340px width → static fallback (vertical list + a single downward connector line + hub + outlet).

Desktop (1200×560):

| Element | Spec |
|---|---|
| Input pills | `rect` w=200 h=40 rx=20 at `x = 40 + JX[i]`, `y = 60 + i*72 - 20`; `JX = [0, 28, 8, 36, 0, 22, 12]`. Label: SVG `<text>` 16 units, Inter 500, `--text-secondary`, left padded 18. |
| Tributary i | `M (x+200) (y) C (x+420) (y), 600 280, 716 280` — ends at the hub's left edge. Stroke 2.5, round caps, color by group token. |
| Hub | `circle` r=64 at (780, 280), brand mark via `<use href="#fg-mark">` (reuse the logo SVG as a `<symbol>`), outer ring r=84 dashed `4 6`. |
| Outlet | `M 844 280 L 980 280`, stroke 6. |
| Decision card | `rect` 180×96 rx=14 at (990, 232). "Decision" + optional sublabel. |

Mobile (360×720):

| Element | Spec |
|---|---|
| Input pills | single left column: x=16, w=190, h=40, `y = 24 + i*52`. |
| Tributary i | `M 206 (y+20) C 290 (y+20), 300 380, 300 420` |
| Trunk | `M 300 420 C 300 470, 180 450, 180 500` |
| Hub | `circle` r=48 at (180, 548) |
| Outlet | `M 180 596 L 180 620` |
| Decision card | 200×72 rx=12, centered at x=180, y=620 |

SVG sizing inside the stage: `height: 100%; width: auto; max-width: 100%; margin-inline: auto`.

**Groups** (stream tint only — all from the blue-teal scale, no rainbow):
Hazard = Rainfall, Climate projections · Observed = Flood history, Satellite data · Physical = Terrain, Drainage · Exposure = Exposure.

**Scroll timeline** (`p` = track progress via `useSectionProgress`):

| p | Event |
|---|---|
| 0.00–0.12 | Pills settle from a "fragmented" state: offset `(dx, dy, rot, opacity) = (±14, ±14, ±5°, .45)` → `(0, 0, 0, 1)`. Offsets are a deterministic per-index table — no `Math.random()` at render. |
| 0.12–0.62 | Tributaries draw: `pathLength 0 → 1`; stream i range `[0.12 + i*0.05, 0.32 + i*0.05]`. |
| 0.55–0.72 | Hub activates: ring rotate 0→60°, fill opacity 0→1, scale .9→1. |
| 0.70–0.85 | Outlet draws; Decision card `x -16→0`, opacity 0→1. |
| 0.85–1.00 | Hold. |

**Ambient flow** (starts once `p ≥ 0.85`, only while in view): each drawn path keeps a solid base at 30% opacity, with a duplicated overlay path using `stroke-dasharray: 6 10` and a CSS keyframe on `stroke-dashoffset` (1.6s linear infinite). Pause off-screen via `data-paused`.

**Non-pinned mode:** one-shot time-based sequence (same order, 1.8s total) when 40% in view, then ambient flow.

**Interaction**
- Fine pointer: hover a pill → its stream + pill switch to `--accent`, others dim to 35%. If `note` exists, show it as a small tooltip anchored to the pill.
- Touch: tap toggles the same highlight; tap elsewhere clears.
- Pills are not focusable (decorative); the SR list covers the content.

```ts
export type ConfluenceInput = {
  id: string; label: string;
  group: 'hazard' | 'observed' | 'physical' | 'exposure';
  note?: string;
};
export type ConfluenceContent = {
  label: string; heading: string;
  inputs: ConfluenceInput[];            // exactly the 7 current inputs, current order
  hub: { label: string };               // "FloodGuard"
  outlet: { label: string; sub?: string }; // "Decision"
};
```

**Acceptance:** at every QA viewport the full diagram fits the stage with no clipped labels; scrolling back up reverses cleanly; no Math.random; ambient flow stops when off-screen.

---

### 5.3 §05 Decision support → `IsoStack`

**Translation of the owner's reference prompt to this codebase:**

| Reference prompt | Implement as |
|---|---|
| Tailwind utility classes | `iso-stack.css` with tokens |
| Next.js component | Vite SPA component |
| GSAP ScrollTrigger | `useActiveStep` (IntersectionObserver) |
| `min-h-[250vh]`, `space-y-[45vh]` | each step block `min-height: var(--step-h)` |
| `sticky top-14 h-[calc(100vh-3.5rem)]` | `.stage` per pin policy (`top: var(--header-h); height: var(--stage-h)`) |
| `#0B0F17` dark-only canvas | theme tokens — must work in light AND dark |
| fixed viewBox `400×580` | computed from layer count (geometry below) |
| `filter: drop-shadow` glow | duplicated stroke polygon (Safari/mobile perf) |

**Layout**

| Condition | Layout |
|---|---|
| ≥900 and canPin | Grid `minmax(0, 5fr) minmax(0, 6fr)`, gap `var(--gutter)`. Left: header + steps (`data-step`, `min-height: var(--step-h)`, content vertically centered, `max-width: 46ch`). Right: sticky stage, SVG centered, `max-height: calc(var(--stage-h) - 48px)`. |
| 600–899 and canPin | Single column. Visual stage sticky at top: `top: var(--header-h); height: 44svh; z-index: 1; background: var(--surface-section)` with a 32px bottom fade (`mask-image` linear-gradient). Steps below, `min-height: 55svh`; step text scrolls under the stage. |
| <600 and canPin | Same as above, stage `40svh`. |
| !canPin | No sticky. Header → full static stack (all layers visible) → steps as an ordered list. |

**Geometry** — `isoStack.geometry.ts`

```ts
export type IsoConfig = {
  cx: number; halfW: number; halfH: number; depth: number; gap: number; pad: number;
};
export const ISO: IsoConfig = { cx: 200, halfW: 155, halfH: 78, depth: 14, gap: 88, pad: 32 };

/** i = 0 is the BOTTOM layer (revealed first). Top layer has the smallest cy. */
export const layerCy = (i: number, n: number, c = ISO) => c.pad + c.halfH + (n - 1 - i) * c.gap;

export const viewBoxH = (n: number, c = ISO) => c.pad * 2 + c.halfH * 2 + (n - 1) * c.gap + c.depth;
// n=5 → 586. Width: 400, or 560 at ≥1200 when external labels render (cx stays 200).

type P = [number, number];
const pts = (...p: P[]) => p.map(([x, y]) => `${x},${y}`).join(' ');

export function slab(cy: number, c = ISO) {
  const T: P = [c.cx, cy - c.halfH];
  const R: P = [c.cx + c.halfW, cy];
  const B: P = [c.cx, cy + c.halfH];
  const L: P = [c.cx - c.halfW, cy];
  const d = c.depth;
  return {
    top:   pts(T, R, B, L),
    left:  pts(L, B, [B[0], B[1] + d], [L[0], L[1] + d]),
    right: pts(B, R, [R[0], R[1] + d], [B[0], B[1] + d]),
  };
}

/** Dashed connectors at both side corners between layer i (lower) and i+1 (upper). */
export function connectors(i: number, n: number, c = ISO) {
  const yUpper = layerCy(i + 1, n, c) + c.depth;
  const yLower = layerCy(i, n, c);
  return [c.cx - c.halfW, c.cx + c.halfW].map((x) => ({ x, y1: yLower, y2: yUpper }));
}
```

**Rendering rules**
- Paint order in DOM: `i = 0 … n-1` (bottom first) so upper slabs overlap lower ones.
- Each slab is an `<IsoSlab>` child component rendering a `<motion.g>`:
  hidden `{ opacity: 0, y: 30 }` → visible `{ opacity: 1, y: 0 }`, `duration: 0.48, ease: [0.22, 1, 0.36, 1]`. Visible iff `i ≤ active`.
- Faces: top polygon fill `var(--iso-l{i+1})`. Left/right faces: fill with the same layer color, then an overlay polygon filled `--iso-side-left` / `--iso-side-right`.
- **Top-face texture (desirable):** one `<pattern>` per texture type with `patternTransform="matrix(1 0.5 -1 0.5 0 0)"` so it lies flat on the 2:1 dimetric face; clip to the top polygon; opacity `--iso-texture-opacity`. Types: `dots` (rainfall), `contours` (terrain), `grid` (exposure), `hatch` (risk), `none` (decision).
- **Active layer** (`i === active`): top stroke `--accent` width 2.5, plus a glow = second polygon with identical points, stroke width 8, opacity .18. No CSS `filter`.
- **Visible, inactive layers:** opacity .7, stroke `--border-subtle` width 1.
- **Connectors** between each visible adjacent pair: `<line>` with `stroke-dasharray: 3 5`, `--border-strong`.
- **Particle:** `circle r=3 fill=--accent` on both corner connectors between `active-1` and `active`, travelling **upward** (data flowing into the newest layer):
  `<animateMotion dur="1.4s" repeatCount="indefinite" path="M0,0 L0,-{y1 - y2}" />` with the circle placed at `(x, y1)`. Pause with `svgRef.current.pauseAnimations()` when off-screen or reduced motion.
- **Labels:** ≥1200 → leader line from the right corner `(cx + halfW, cy)` 24 units right, then index + short title (14 units). <1200 → no external labels; top face shows the index number only (unskewed text, centered, 14 units).

**Content**

```ts
export type IsoLayer = {
  id: string; title: string; short: string; body: string;
  texture?: 'dots' | 'contours' | 'grid' | 'hatch' | 'none';
};
export type DecisionSupportContent = {
  label: string; heading: string; lead?: string; layers: IsoLayer[]; // 3–6
};
```

Use the existing §05 steps as layers (text column order top→bottom = layer order bottom→top).
If the current content isn't a 3–6 item sequence, default (`// CONFIRM` copy):
**Hazard signals** (dots) → **Terrain & drainage** (contours) → **Exposure** (grid) → **Risk** (hatch) → **Decision** (none).

**Acceptance:** no layout shift as layers appear; final step → all layers visible with glow on the top layer; scrolling up hides layers in reverse; SVG never exceeds the stage at 1280×600.

---

### 5.4 §06 Platform → Tide reveal

**Concept:** the water recedes and the platform surfaces. Cards read top-to-bottom in one column — readable first, animated second.

**Content restructure (placeholders removed).** Cards map to the Platform IA that already exists in the footer: **Data · Technology · Methodology · Validation · API**. Each links to its route if it exists; if not, no link (never a dead link). Copy from `home.ts`; where it's `TODO`, write plain capability copy with **no numbers** and mark `// CONFIRM`.

```ts
export type PlatformItem = {
  id: 'data' | 'technology' | 'methodology' | 'validation' | 'api';
  title: string; body: string; points?: string[]; href?: string;
  stat?: { value: string; label: string; validated: boolean }; // renders only if validated
};
export type PlatformContent = { label: string; heading: string; lead: string; items: PlatformItem[] };
```

**Layout**
- `TideBand` at the section top: full-bleed (grid, not `100vw`), height `clamp(96px, 14svh, 180px)`, 3 wave layers.
- ≥1200: two columns. Left: sticky (`top: calc(var(--header-h) + 32px)`) label, h2, lead, `DepthGauge`. Right: card list, `max-width: 760px`.
- <1200: single column; header, then cards; no gauge.
- Cards: full width of the list column; gap `clamp(16px, 3svh, 32px)`. Anatomy: icon 24px + h3 title row → body (≤ 65ch) → 2–4 points → optional "Explore {title}" link. `--radius-lg`, flat surface + 1px `--border-subtle`. No shadow stack.

**Wave geometry** — `waves.ts` (module-scope, computed once)

```ts
/** Closed, horizontally tileable wave fill. `width` must be a multiple of `wavelength`. */
export function waveFill(width: number, height: number, amp: number, wavelength: number, baseY: number) {
  const half = wavelength / 2;
  let d = `M0 ${baseY}`;
  for (let x = 0; x < width; x += wavelength) d += ` q ${half / 2} ${-amp} ${half} 0 t ${half} 0`;
  return `${d} V ${height} H 0 Z`;
}
// Seamless drift: render viewBox width = 2*W (W a multiple of wavelength), SVG width 200% of
// its container, preserveAspectRatio="none", animate translateX(0 → -50%) linear infinite.
export const BAND = [
  waveFill(2400, 180, 14, 400, 40),
  waveFill(2400, 180, 10, 300, 70),
  waveFill(2400, 180, 8, 240, 100),
];
export const COVER = [waveFill(2400, 400, 18, 400, 24), waveFill(2400, 400, 12, 300, 44)];
```

**Motion**
- **TideBand** — progress over offset `['start end', 'start 0.3']`: layer k `translateY = -p * [0, 28, 56][k]` px (layers separate vertically = the tide "opens"); layer 3 opacity 1 → .35. Horizontal drift via CSS keyframes at 18s / 26s / 34s. Paused off-screen.
- **WaveReveal** (per card) — wrapper `position: relative; overflow: clip; isolation: isolate`. Cover = absolutely positioned SVG (`inset-inline: 0; top: -20%; height: 140%`) filled `--surface-section`, top edge = the 2 `COVER` paths (second at 60% opacity). Card progress `q` over offset `['start 0.92', 'start 0.5']`: cover `translateY 0% → 105%` (water recedes downward, revealing top first); card content `y 20 → 0`, opacity `0 → 1` over `q 0.2 → 1`. Cover drift 6s keyframes.
- **< 900px:** one cover path only; offset `['start 0.95', 'start 0.65']`; no drift on `(pointer: coarse)`.
- **DepthGauge (≥1200):** 2px vertical track, 240px tall; fill element `scaleY` = list progress with `transform-origin: bottom` (water level rises); one tick per card; active tick via `useActiveStep` on the cards; active card title shown next to its tick (small label).

**Static state:** reduced motion / no JS → covers not rendered at all, cards fully visible, band static.

---

### 5.5 §09 About us → `DropletGenesis`

**The page's one bold moment.** A single drop falls, strikes the surface, and its ripple becomes the section. Everything else on the page stays calm.

**Track:** ≥900 & canPin → `300svh`. <900 & canPin → `180svh` (phases A–C pinned; phase D in normal flow). !canPin → static composition.

**Scene** — SVG viewBox `1000×1000`, `preserveAspectRatio="xMidYMid slice"`, fills the stage. Waterline at y=620.
- **Droplet:** path `M 0 -46 C 16 -20 30 -2 30 16 A 30 30 0 1 1 -30 16 C -30 -2 -16 -20 0 -46 Z` at x=500; linear gradient light brand → deep brand; specular highlight ellipse `(-10, 6) rx 6 ry 10`, white 45%.
- **Water surface:** band from y=620 down, `--surface-water`, subtle vertical gradient.
- **Ripple rings:** 4 ellipses at (500, 620), `rx 40 ry 12` (0.3 perspective), stroke `rgb(var(--ripple-rgb))`.
- **Reveal disc:** an HTML `div` (not SVG) at the impact point (50% x, 62% y of the stage), 40px circle, `background: var(--surface-about)`, scaled via `transform: scale()` to cover the stage. Cover scale = `hypot(stageW, stageH) / 20`, recomputed with `ResizeObserver`.

**Phases** (`p` = track progress):

| p | Phase | Animation |
|---|---|---|
| 0.00–0.22 | A · Fall | Droplet `y -80 → 580`, `scaleY 1 → 1.12`, `scaleX 1 → .94`. Section label visible top-left (static). |
| 0.22–0.30 | B · Impact | Droplet `scaleY → .3`, `scaleX → 1.6`, opacity → 0 by 0.28. Crown splash (≥900 only): 6 circles r 3–5 on arcs (x ±20/40/60, up 30–70 then down), fading out. |
| 0.26–0.45 | C · Ripple | Ring i (stagger 0.03): scale `0 → 6 + 3i`, opacity `.9 → 0`. Disc scale `0 → cover` over 0.32–0.48, `--ease-in-out`. |
| 0.45–1.00 | D · Surface (≥900) | On the disc: h2 + lead rise (`y 40 → 0`, opacity) at 0.45–0.55. Then about cards rise from the waterline at `[0.55, 0.65, 0.75, 0.85]`: `y 80 → 0`, opacity 0→1, `blur 6px → 0` (**≥900 only**, and only while animating). |

**Phase D layout (≥900):** left column h2 + lead; right column a vertical stack of 4 compact cards (title + ≤2-line body), each rising into place below the previous. If `(max-height: 759px)`, the cards switch to a 2×2 grid spanning both columns so everything fits the stage.

**Phase D (<900):** after the disc covers the stage and the track ends, the section continues in normal flow on the same `--surface-about` background (seamless). Heading, lead, cards; each card rises once on enter (`y 32 → 0`, opacity, 80ms stagger via `useInView({ once: true })`).

**Ambient (≥900 fine pointer, after D, in view only):** 2 large radial-gradient "caustic" blobs on the disc layer drifting via CSS keyframes (20s), opacity .08. Paused off-screen.

**Theme:** `--surface-about` is deep brand blue in **both** themes, text uses `--text-on-brand`. Add a single-wave divider at the bottom of §09 in `--surface-about` over §10's background so the handoff is seamless.

**About cards** (`// CONFIRM` against `home.ts`; no numbers):
- **Who we are** — FloodGuard Solutions Pvt. Ltd., founded 2025 in Hyderabad; a DPIIT-recognised startup.
- **What we build** — flood intelligence across time — historical, current and future — turned into decision-ready insight.
- **Who we serve** — governments, insurers, banks, infrastructure and agriculture (mirrors the Solutions IA).
- **Backed by** — T-Hub and WE-Hub.

```ts
export type AboutContent = {
  label: string; heading: string; lead: string;
  cards: { id: string; title: string; body: string }[]; // 3–4
};
```

**Static state (reduced motion / !canPin):** section on `--surface-about`, 3 faint frozen ripple rings as top decoration, heading, lead, all cards visible.

---

### 5.6 §10 Insights → `DepthDeck`

**Layout**
- ≥900: grid `minmax(0, 4fr) minmax(0, 7fr)`. Left: sticky (`top: calc(var(--header-h) + 48px)`) label, h2 "Understanding flood risk, beyond the map", lead, "Browse all insights" link (only if the route exists). Right: the deck.
- <900: header block, then the deck.

**Deck mechanics** — all cards are direct children of `.deck` (sticky only works across siblings of the same parent):

```css
.deck { position: relative; }
.deck__card {
  position: sticky;
  top: calc(var(--header-h) + var(--deck-top) + var(--i) * var(--deck-step));
  margin-bottom: 40svh;                 /* scroll distance per card */
}
.deck__card:last-child { margin-bottom: 0; }
@media (max-width: 899px) { .deck__card { margin-bottom: 28svh; } }
```

`--i` is set inline per card. Card height: ≥900 `min(480px, calc(var(--stage-h) - 120px))`; <900 `auto`, `max-height: 72svh`.

**Depth effect** — in `<DeckCard>` (child component, not hooks-in-a-loop):

```tsx
const { scrollYProgress } = useScroll({ target: deckRef, offset: ['start start', 'end end'] });
const targetScale = 1 - (n - 1 - i) * 0.05;
const scale = useTransform(scrollYProgress, [i / n, 1], [1, targetScale]);
const dim   = useTransform(scrollYProgress, [i / n, 1], [0, i === n - 1 ? 0 : 0.25]);
// apply scale to .deck__card-inner (transform-origin: top center), dim to an overlay div
```

**Card anatomy**
- ≥900: horizontal — text 55% (kind tag, h3 ≤ 3 lines, excerpt 3-line clamp, date + read time, "Read {kind}" link) | media 45% (`aspect-ratio: 4/3`, `object-fit: cover`).
- <900: vertical — media `16/9` on top, text below, excerpt 2-line clamp.
- No image → a brand texture tile (reuse the iso pattern defs from §5.3), never a grey placeholder box.
- Whole card clickable via a stretched link (`a::after { content: ''; position: absolute; inset: 0; }`), one link per card, focus ring on the card.
- Card surfaces step through the blue scale so the stacked top edges read as distinct layers.
- If ≥ 3 items: final deck card is a compact "Browse all insights" card.

**Data rules**

```ts
export type InsightItem = {
  id: string;
  kind: 'Research' | 'White paper' | 'Use case' | 'Data story' | 'Article';
  title: string; excerpt: string; href: string;
  date?: string; readMins?: number;
  image?: { src: string; alt: string; width: number; height: number };
  published: boolean;
};
```

Render only `published` items. 0 items → section not rendered. 1–2 items → static cards, no deck.

**Static states:** reduced motion → keep sticky stacking, drop scale/dim. !canPin → no sticky, normal list.

---

### 5.7 Footer → `SiteFooter`

**Fixes:** single wordmark (logo mark `aria-hidden`, text wordmark once, link `aria-label="FloodGuard home"`); top-aligned columns; legal links moved to a bottom bar; responsive collapse; safe-area padding.

```html
<footer class="site-footer">
  <div class="container site-footer__top">
    <div class="site-footer__brand">
      <a href="/" class="site-footer__logo" aria-label="FloodGuard home">
        <svg aria-hidden="true" focusable="false"><use href="#fg-mark" /></svg>
        <span class="site-footer__wordmark">FloodGuard</span>
      </a>
      <p class="site-footer__tagline">Predict · Plan · Protect</p>
      <p class="site-footer__desc">Flood intelligence across time — historical, current and future — translated into decision-ready intelligence for organizations exposed to flood risk.</p>
    </div>
    <nav class="site-footer__nav" aria-label="Footer">
      <!-- ×5 -->
      <div class="site-footer__col">
        <h2 class="site-footer__heading">Products</h2>
        <ul role="list"><li><a href="…">Explorer</a></li>…</ul>
      </div>
    </nav>
  </div>
  <div class="container site-footer__bottom">
    <p>© {currentYear} FloodGuard Solutions Pvt. Ltd. · Hyderabad, India</p>
    <ul role="list" class="site-footer__legal"><li><a>Privacy</a></li><li><a>Terms</a></li></ul>
    <button type="button" class="site-footer__top-btn">Back to top</button>
  </div>
</footer>
```

**Columns** (from `nav.ts`; make `footerColumns` data-driven):
Products: Explorer, Atlas, Live · Platform: Technology, Data, Methodology, Validation, API · Solutions: Insurance, Banking, Government, Infrastructure, Agriculture · Insights: Research, White papers, Use cases, Data stories, Articles · Company: About us, Contact, Careers.
Privacy + Terms → bottom bar only.
Links to routes that don't exist yet → point at the closest homepage anchor (e.g. Insurance → `/#industries`, About us → `/#about`). No dead links.

```css
.site-footer { padding-top: var(--section-pad-y); }
.site-footer__top { display: grid; gap: clamp(32px, 5vw, 64px); grid-template-columns: 1fr; align-items: start; }
.site-footer__desc { max-width: 36ch; }
.site-footer__nav { display: grid; gap: 32px 24px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (min-width: 600px)  { .site-footer__nav { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 900px)  { .site-footer__nav { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
@media (min-width: 1200px) { .site-footer__top { grid-template-columns: minmax(260px, 4fr) 8fr; } }
@media (max-width: 339px)  { .site-footer__nav { grid-template-columns: 1fr; } }

.site-footer__heading { margin: 0 0 12px; font: var(--type-label); color: var(--text-primary); }
.site-footer__nav a { display: inline-flex; align-items: center; min-height: 44px; color: var(--text-secondary); }
@media (pointer: fine) { .site-footer__nav a { min-height: 32px; } }

.site-footer__bottom {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: 12px 24px; margin-top: clamp(40px, 6vw, 72px);
  padding-block: 24px calc(24px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--border-subtle);
}
@media (max-width: 599px) { .site-footer__bottom { flex-direction: column; align-items: flex-start; } }
```

Back to top: `window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })`, then move focus to the skip-link target.

---

### 5.8 Water ripple background (more visible, both themes)

- Read `--ripple-rgb`, `--ripple-alpha`, `--ripple-alpha-echo`, `--ripple-stroke`, `--ripple-blend` via `getComputedStyle(document.documentElement)` **on mount and on theme change** (subscribe to the existing theme context, or a `MutationObserver` on the theme attribute). Never read computed styles per frame.
- Draw each ring as `rgba(r, g, b, alpha * life)` with `lineWidth = stroke * dpr`, plus an **echo ring** 12px inside it at `alpha-echo`.
- Canvas element: `position: fixed; inset: 0; height: 100lvh; z-index: -1; pointer-events: none; mix-blend-mode: var(--ripple-blend);`
  `100lvh` (large viewport) so the canvas never reallocates while the iOS/Android URL bar collapses. Ignore height-only resize events < 120px; debounce `ResizeObserver` at 150ms.
- **Intensity target:** roughly double current visibility — light mode peak alpha ≈ 0.16 (brand blue, `multiply`), dark ≈ 0.13 (light teal, `screen`). Tune only via tokens.
- Max concurrent ripples: 6 on fine pointers, 3 on coarse. Keep the existing spawn logic; don't add new interaction unless trivial.
- DPR cap per §4.7. Pause on `document.hidden`.
- Reduced motion: render one static frame with 3 frozen rings.
- **Readability guard:** body text must keep ≥ 4.5:1 contrast over the worst-case ring pixel in both themes — verify with a contrast checker on a screenshot.

---

## 6. Platform checklist

**iOS / iPadOS Safari (target 16.4+)**
- [ ] Sticky works: `overflow-x: clip` (not hidden) on html/body; no transform/filter/overflow ancestors on pinned stages.
- [ ] Stages use `svh`; fixed ripple canvas uses `lvh`.
- [ ] `viewport-fit=cover` + `env(safe-area-inset-*)` on header (top + sides in landscape), footer bottom, and full-bleed stage edges.
- [ ] `-webkit-backdrop-filter` present wherever `backdrop-filter` is used.
- [ ] No `background-attachment: fixed`. Inputs ≥ 16px.
- [ ] SMIL particles pause via `pauseAnimations()` off-screen.
- [ ] Low Power Mode (rAF throttled to 30fps): scrubbed states still correct (position-derived).
- [ ] iPad + trackpad: `(hover: hover)` is true → hover styles work and don't conflict with touch.

**Android (Chrome, Samsung Internet, Firefox)**
- [ ] `color-scheme` meta + CSS set → Samsung Internet's forced dark mode does not double-invert the theme.
- [ ] `theme-color` metas for both themes; updated on manual toggle.
- [ ] URL bar collapse causes no stage resize (svh) and no canvas realloc (lvh).
- [ ] Gesture-nav bottom inset respected in footer.
- [ ] 4× CPU throttle: no frames > 50ms while scrolling pinned sections.

**macOS (Safari, Chrome, Firefox)**
- [ ] Fast trackpad flings through every pinned section land in the correct state.
- [ ] Retina: SVG crisp; canvas DPR capped at 2.

**Windows (Chrome, Edge, Firefox)**
- [ ] No horizontal overflow from classic scrollbars (no `100vw`); `scrollbar-gutter: stable`.
- [ ] Display scaling 125% (≈1536×730 inner) and 150% (≈1280×600 inner): all stages fit; IsoStack and Confluence scale down; pins stay on (≥560px tall).
- [ ] Mouse-wheel 100px jumps look smooth thanks to spring-smoothed progress (fine pointer only).
- [ ] `forced-colors: active` renders legibly.
- [ ] ClearType: body ≥ 15px, small labels ≥ 13px at weight ≥ 500.

**Linux (Firefox, Chrome)**
- [ ] Nothing depends on CSS `animation-timeline` (not on by default in Firefox).
- [ ] Web fonts load (no reliance on system Inter/Manrope); `font-display: swap`; preload the Latin subsets actually used.
- [ ] Firefox SVG pattern performance acceptable in IsoStack (reduce texture density if not).

---

## 7. QA matrix and acceptance

Test every row in **light + dark**, plus one pass with **reduced motion**.

| Class | Inner viewport (CSS px) | Browsers |
|---|---|---|
| Galaxy Fold, folded | 280 × 653 | Chrome Android |
| Small Android | 360 × 800 | Chrome, Samsung Internet |
| iPhone SE | 375 × 667 | Safari iOS |
| iPhone 15/16 | 393 × 852 | Safari iOS |
| iPhone Pro Max | 430 × 932 | Safari iOS |
| Pixel 8 | 412 × 915 | Chrome Android |
| Phone landscape | 844 × 390 | Safari iOS, Chrome Android → **pins OFF** |
| iPad mini portrait | 744 × 1133 | Safari |
| iPad Air landscape | 1180 × 820 | Safari |
| Windows laptop @150% | 1280 × 600 | Chrome, Edge |
| Windows laptop @125% | 1536 × 730 | Chrome, Edge, Firefox |
| MacBook Air | 1440 × 800 | Safari, Chrome |
| Desktop FHD | 1920 × 960 | Chrome, Edge, Firefox |
| QHD / ultrawide | 2560 × 1300 · 3440 × 1300 | Chrome |

**Automation** — add `scripts/responsive-shots.ts` (Playwright; Chromium + WebKit + Firefox):
- For each viewport × theme: load `/`, and for each redesigned section scroll to track progress `[0, .25, .5, .75, 1]` and screenshot.
- Assert per viewport: `document.documentElement.scrollWidth <= window.innerWidth` (no horizontal overflow).
- Assert no element with `[data-step]` or `.deck__card` has `getBoundingClientRect().width > innerWidth`.
- Playwright WebKit ≠ real iOS Safari. Final sign-off requires a real iPhone (or BrowserStack) pass on §02, §05, §09, §10.

**Global acceptance**
- [ ] No horizontal scroll at any viewport.
- [ ] No clipped/overlapping text at any viewport, either theme.
- [ ] Pinned visuals never exceed stage height.
- [ ] Scrolling back up reverses every scrubbed animation cleanly.
- [ ] Reduced motion: all content visible; nothing moves beyond ≤ 200ms crossfades.
- [ ] Height < 560px: all pins off, static layouts render.
- [ ] Lighthouse mobile: Performance ≥ 85, Accessibility ≥ 95, CLS < 0.05.
- [ ] Ripple background clearly visible in both themes on a phone at 50% brightness; text contrast holds.
- [ ] Footer: one wordmark, columns top-aligned, legal bar, safe-area padding.
- [ ] No placeholder stats anywhere; any rendered number has `validated: true`.

---

## 8. File plan

Match existing conventions in `STRUCTURE.md`. Do not create a parallel folder structure.

```
src/
  components/
    motion/
      useMediaQuery.ts  useCanPin.ts  useFinePointer.ts  useActiveStep.ts
      useSectionProgress.ts  useInViewPause.ts  range.ts
      ScrollNarrative.tsx  scroll-narrative.css        # extracted from old §05
    sections/
      FloodProblem.tsx                                 # §01 → ScrollNarrative
      DecisionGap/     Confluence.tsx  confluence.geometry.ts  confluence.css
      DecisionSupport/ IsoStack.tsx  IsoStackVisual.tsx  IsoSlab.tsx  isoStack.geometry.ts  iso-stack.css
      Platform/        TideBand.tsx  WaveReveal.tsx  DepthGauge.tsx  waves.ts  platform.css
      About/           DropletGenesis.tsx  droplet.css
      Insights/        DepthDeck.tsx  DeckCard.tsx  depth-deck.css
    layout/
      SiteFooter.tsx  site-footer.css
  data/content/home.ts        # + all content types from §5
  styles/tokens.css  global.css  breakpoints.ts
scripts/responsive-shots.ts
```

Delete components made obsolete (old §01 boxes, old §02 boxes, old §06/§10 grids) in the same phase that replaces them.

---

## 9. Phases (one PR or commit group each)

| Phase | Scope | Exit criteria |
|---|---|---|
| **P0** Foundation | §2 audit, tokens, global CSS, `index.html` metas, primitives (§4.5), pin-policy ancestor fixes, ripple background (§5.8) | Site unchanged visually except ripple; no horizontal overflow anywhere; sticky verified on iOS |
| **P1** Swap | Extract `ScrollNarrative` → §01; build `IsoStack` → §05 | §5.1 + §5.3 acceptance |
| **P2** Confluence | §02 | §5.2 acceptance |
| **P3** Platform | §06 tide reveal + content cleanup | §5.4 acceptance, zero placeholders |
| **P4** Insights + Footer | §10 deck, footer rebuild | §5.6 + §5.7 acceptance |
| **P5** About | §09 droplet genesis | §5.5 acceptance, 60fps at 4× throttle |
| **P6** Hardening | Full §6 checklist + §7 matrix; fix list | All boxes checked |

Every phase: `tsc --noEmit` clean · `vite build` clean · screenshots from `responsive-shots.ts` · PR note listing any deviation from this spec with the reason.

---

## 10. Definition of done

- All sections in §1 implemented per spec; 03/04/07/08 pass the global responsive checks.
- §6 checklist and §7 acceptance fully checked, including a real-iPhone pass.
- No hardcoded colors in components; all new values in `tokens.css`.
- No placeholder data rendered; `// CONFIRM` markers listed in the PR description for the owner.
- `README.md` (existing) updated with: new motion primitives, pin policy, and how to run `responsive-shots.ts`.

---

## Appendix A — `useActiveStep` reference implementation

```ts
import { useEffect, useState, type RefObject } from 'react';

export function useActiveStep(
  container: RefObject<HTMLElement | null>,
  selector = '[data-step]',
  rootMargin = '-45% 0px -45% 0px'
): number {
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(selector));
    if (!els.length) return;

    const visible = new Set<number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.stepIndex);
          if (e.isIntersecting) visible.add(i);
          else visible.delete(i);
        }
        if (visible.size) {
          setActive(Math.max(...visible));
        } else if (els[0].getBoundingClientRect().top > window.innerHeight / 2) {
          setActive(-1); // above the first step
        } // below the last step: keep the last index
      },
      { rootMargin, threshold: 0 }
    );

    els.forEach((el, i) => {
      el.dataset.stepIndex = String(i);
      io.observe(el);
    });
    return () => io.disconnect();
  }, [container, selector, rootMargin]);

  return active;
}
```

Steps are contiguous blocks with `min-height: var(--step-h)`, so the center band always intersects exactly one step while inside the list. On fast flings the index may jump several steps at once — consumers must render from the index (`visible = i <= active`), never step through intermediate values.

## Appendix B — `useCanPin`

```ts
import { useReducedMotion } from 'motion/react';
import { useMediaQuery } from './useMediaQuery';

export function useCanPin(): boolean {
  const tallEnough = useMediaQuery('(min-height: 560px)');
  const reduce = useReducedMotion();
  return tallEnough && !reduce;
}
```
