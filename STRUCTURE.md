# Scaffold map

Structure only. Components are presentational stubs — no data fetching,
no real copy, no styling beyond tokens. `src/styles/tokens.css` is the one
file that is real and complete.

**Framework:** Vite + React 19 + TypeScript (README §4). Not Next.js.

## Homepage section order

| # | Section | Component | Children |
|---|---|---|---|
| 1 | Header | `layout/Header` | `NavDropdown`, `MobileNav` |
| 2 | Hero | `sections/Hero` | `maps/IndiaChoropleth`, `ui/StatBar` |
| 3 | Flood story | `sections/FloodStoryTimeline` | `timeline/YearBarChart`, `timeline/YearDetailPopover`, `maps/IndiaChoropleth`, `maps/MapLegend` |
| 4 | Products ×2 | `sections/ProductCard` | `product/TierFeatureList` + `ExplorerPreview` \| `LivePreview` |
| 5 | Why FloodGuard | `sections/StatIconRow` | — |
| 6 | Industries | `sections/IndustryGrid` | — |
| 7 | Closing CTA | `sections/ClosingCtaBand` | — |
| 8 | Footer | `layout/Footer` | — |

## Tree

```
src/
├── main.tsx · App.tsx
├── routes/Home.tsx            composes 1–8 in order
├── styles/
│   ├── tokens.css             ← REAL. Palette, type, space, 3 theme states.
│   └── global.css             thin base
├── theme/tokens.ts            TS mirror for canvas/chart code
├── content/
│   ├── home.ts                placeholder copy, all values "—"/TODO
│   └── nav.ts                 nav + footer structure (real shape)
├── data/geo/
│   ├── types.ts               RegionMapAsset, RegionValues, ChoroplethScale
│   ├── index.ts               loader stub — swap impl, not call sites
│   └── README.md              what asset to drop in, and how to make it
└── components/
    ├── layout/    Header · NavDropdown · MobileNav · Footer
    ├── sections/  Hero · FloodStoryTimeline · ProductCard · StatIconRow
    │              IndustryGrid · ClosingCtaBand
    ├── maps/      IndiaChoropleth · MapLegend
    ├── timeline/  YearBarChart · YearDetailPopover
    ├── product/   TierFeatureList · ExplorerPreview · LivePreview
    ├── motion/    DitherHelix          port slot, not yet placed
    └── ui/        StatBar · Button · Eyebrow
```

## Rules the scaffold enforces

- **Map geometry is an asset, not code.** `IndiaChoropleth` takes
  `RegionMapAsset` + `RegionValues` as props and knows nothing about
  India or where the data came from. One component serves the hero, the
  timeline's state map, and the Explorer preview.
- **`--color-alert` (#C1121F) appears in exactly one place** —
  the alert chip in `LivePreview`. It's bound to live flood state.
  Nowhere decorative.
- **No hex literals outside `tokens.css`.** Worth a lint rule before
  implementation starts.
- **Timeline state lives in `FloodStoryTimeline`**, so the chart and the
  state map stay in sync while both children stay dumb.

## Blocked on missing assets

None of these arrived — reconcile the scaffold against them when they do:

| Asset | Blocks |
|---|---|
| `floodguard-homepage.html` | Section-internal layout, interaction detail, real copy |
| `floodguard-final-homepage-design.png` | Spacing, hierarchy, component styling |
| `Logo.jpg` | Header + footer brand mark; needs SVG conversion, light/dark variants |
| India district/state geometry | Every map. See `src/data/geo/README.md`. |

## Derived, needs sign-off

The supplied palette has no neutrals, so `--n-*` and `--ink-*` in
`tokens.css` are derived with a blue bias to sit with the scale. Dark
theme also inverts the choropleth ramp direction — on a dark ground,
high exposure has to read light. Both are judgement calls, flagged
rather than assumed.
