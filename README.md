# FloodGuard — Website Rebuild

Planning document for the v2 rebuild of [floodguard.in](https://www.floodguard.in/).
This file defines **what we're building and how it's structured**. Visual design
decisions (palette, typography scale, imagery direction) are deliberately **not**
settled here — see [Deferred Decisions](#12-deferred-decisions).

---

## 1. What FloodGuard Is

**FloodGuard Solutions Pvt. Ltd.** — founded 2025, based at COHORT Coworking,
Kondapur, Hyderabad. Currently incubated (three incubator emblems shown on the
live site).

**One-liner:** Flood risk intelligence for India — predict, plan, protect.

**What the product actually does:** combines satellite data, climate models,
historical flood patterns, and geospatial analysis to produce localized flood
vulnerability maps, future-risk projections, and decision dashboards.

**The problem it addresses (site's own framing):** India saw a ~1400% rise in
flood-related economic losses between 1990 and 2020 (CWC), driven by rapid
urbanization and climate change — while localized flood risk assessment and
preparedness remain a gap.

**The three-step promise:** Predict → Plan → Protect.

| Step | Promise |
|---|---|
| Predict | See how flood risk might change in the coming years |
| Plan | Know where to build safely and where to avoid |
| Protect | Prepare buildings and communities to reduce damage |

### 1.1 Audience Segments

The entire site is organized around five customer segments. This is the core IA
and should survive the rebuild.

| Segment | Route | Positioning | Offerings |
|---|---|---|---|
| **Governments & Urban Planners** | `/services/governments` | Build smarter, flood-resilient cities | High-vulnerability zone identification · Future-proof drainage design · Prioritised infrastructure upgrades · Alignment with national goals · Real-time response coordination · Reduced long-term economic losses |
| **Businesses** | `/services/businesses` | De-risk investments and plan for resilience | Site-specific flood risk assessment · Location advisory based on ESG · Business continuity planning |
| **Insurance & Financial Institutions** | `/services/insurance` | Climate-proof your portfolios | Flood vulnerability zones · Future risk projections · Portfolio-wide screening — framed against **IRDAI climate guidelines** (stress testing, disclosures, sustainable finance) |
| **Communities & Individuals** | `/services/communities` | Protect homes, lives, and livelihoods | Property-level risk scorecards · Community resilience planning · Construction & protection guidance |
| **Educational & Research Institutions** | `/services/education` | Teach and research with real data | Climate curriculum support · Research-ready datasets · Interactive learning tools |

### 1.2 Team (from the current About page)

Dhanya Bulla (Founder) · Vasuprada (GIS Developer) · Sagar (DevOps) · Sony
(Designer) · Pavan (Field Researcher). Each with a LinkedIn link and a
one-line bio.

**Values:** Innovation · Impact · Integrity.

---

## 2. Audit of the Current Site

The existing site is a Vite + React 18 + TypeScript + **Chakra UI v2** SPA with
React Router. The content and IA are solid. The delivery is what needs work.

### 2.1 Must fix

| # | Issue | Impact |
|---|---|---|
| 1 | **Production is running the Vite dev server.** `/@vite/client`, react-refresh, and inline base64 source maps are all served publicly. Full unminified source is readable by anyone. | Security + performance + credibility |
| 2 | **`/resources` is US boilerplate.** "Call 911 for immediate emergency assistance" on an India-focused product. All four cards link to dead anchors (`#flood-guide`, `#emergency-kit`). | Trust-destroying |
| 3 | **`/services` renders a bare `<Heading>Our Services</Heading>`** and nothing else. `/faqs` is a similar stub. Both are routed and reachable. | Broken pages in nav-adjacent routes |
| 4 | **Footer social icons point to `https://facebook.com`, `https://instagram.com`, `https://youtube.com`** — the bare platform homepages, not FloodGuard accounts. | Looks unfinished |
| 5 | **Demo form posts to `formsubmit.co/thefloodguard@gmail.com`** with `_captcha=false`, then hard-redirects to a YouTube link after a 2s `setTimeout`. No validation, no spam protection, no CRM. Leads land in a Gmail inbox. | Lead loss, spam exposure |
| 6 | **No SEO surface at all.** Single `<title>FloodGuard</title>`, no meta description, no OG/Twitter cards, no `robots.txt`, no sitemap, no structured data. Client-rendered SPA with no prerendering. | Effectively invisible to search |
| 7 | **No dark mode, and the architecture blocks it.** `#0F2922` is hardcoded ~60+ times across page files; the Chakra theme globally forces `body { bg: white }`. | Direct blocker for the stated goal |
| 8 | **Hero layout is held together by magic numbers.** The "Why FloodGuard?" card is `position: absolute; bottom: -220px` with a matching `pt: 240px` on the next section. Any content change breaks the overlap. | Fragile, breaks on mobile |
| 9 | **No accessibility pass.** Carousel arrows are `IconButton`s with no `aria-controls`, tab panels rely on Chakra defaults, images use decorative alt text, contrast unverified. | Legal + usability, matters for govt clients |
| 10 | **Two-image logo lockup** (`/logo.png` + `/logotext.png` side by side) with a separate `/logo.svg` favicon. No single scalable mark. | Rendering quality, dark mode |
| 11 | Inconsistent brand colors: `#0F2922` on Home/Nav, `#1B3C4B` on every service page heading. Two different "brand dark" values. | Visual incoherence |
| 12 | Legal pages are **modals** built from hardcoded JSX, not linkable routes. | Can't be cited, indexed, or updated |

### 2.2 Worth keeping

- The **five-segment IA** — it's the right way to sell this product.
- The **Predict / Plan / Protect** triad. Memorable, ownable.
- The **CWC 1400% statistic** as the hero's reason-to-care.
- The **"Incubated in"** trust row — that's real credibility, currently buried.
- The **audience tab carousel** on the home page — good pattern, needs rebuilding.
- Demo-request as the single primary conversion action.

---

## 3. Goals for v2

**Primary:** convert a government / enterprise / insurance visitor into a booked demo.

1. Look like a company a state government would sign a contract with.
2. Ship a real light/dark theme built on semantic tokens, not hardcoded hex.
3. Be findable — prerendered HTML, full meta, sitemap, structured data.
4. Make content editable without touching JSX.
5. Meet WCAG 2.1 AA. Non-negotiable for public-sector procurement.
6. Fast: Lighthouse ≥ 95 across the board on mobile.

**Explicit non-goals for v1 of the rebuild:** no customer login, no live map
dashboard embed, no CMS, no i18n runtime (the current code has commented-out
Hindi/Tamil/Telugu switching — we'll structure for it, not build it).

---

## 4. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite 6** + TypeScript (strict) | As specified. Fast, well-understood. |
| UI | **React 19** | Current stable. |
| Routing | **React Router v7** (declarative/framework mode) | Direct migration path from existing routes. |
| Prerendering | **`vite-react-ssg`** | Static HTML per route at build time. Solves the SEO problem without leaving Vite. |
| Styling | **Tailwind CSS v4** + CSS custom properties | v4's `@theme` maps cleanly onto a semantic token layer; theming becomes a variable swap. |
| Primitives | **Radix UI** (unstyled) | Accessible tabs/dialog/dropdown/accordion out of the box. Replaces Chakra without inheriting its opinions. |
| Motion | **Motion** (`motion/react`) | Scroll reveals, tab transitions. Gated behind `prefers-reduced-motion`. |
| Icons | **Lucide** | One consistent set. Replaces the react-icons grab-bag. |
| Forms | **React Hook Form** + **Zod** | Real validation on the demo form. |
| Deploy | **Vercel** or **Netlify** | Static output + a serverless function for form handling. Ends the dev-server-in-prod problem structurally. |
| Analytics | **Plausible** or **Vercel Analytics** | Cookieless, no consent banner needed. |

### 4.1 Why leave Chakra

Not a rewrite for its own sake. Chakra v2's theming is JS-runtime; every color is
resolved in React. A token-driven light/dark system wants CSS variables that flip
on a `data-theme` attribute with zero re-render. Tailwind v4 + CSS vars gives us
that, plus a smaller bundle and no runtime style engine. Since ~60 hardcoded hex
values need touching anyway, the migration cost is largely already sunk.

---

## 5. Information Architecture

```
/                          Home
/services                  Overview — all five segments (currently a stub)
  /services/governments    Governments & Urban Planners
  /services/businesses     Businesses
  /services/insurance      Insurance & Financial Institutions
  /services/communities    Communities & Individuals
  /services/education      Educational & Research Institutions
/about                     Mission · Team · Values
/demo                      Book a demo (real page, not just an anchor)
/contact                   Contact + office location
/privacy                   Privacy Policy (route, not modal)
/terms                     Terms of Service (route, not modal)
/404                       Not found

Deferred (route reserved, not built in v1):
/resources                 Rebuilt for India — NDMA/state SDMA contacts, real guides
/faqs                      Fold into segment pages first; promote if content justifies it
```

**Nav (desktop):** Logo · Home · Services ▾ · About · **[Book a Demo]**
**Nav (mobile):** Logo · hamburger → full-screen drawer with collapsible Services

`/resources` and `/faqs` ship as 404s or redirects until they have real content.
Shipping empty routes is worse than not shipping them.

---

## 6. Page Composition

### 6.1 Home

| # | Section | Notes |
|---|---|---|
| 1 | **Hero** | "Stay ahead of Floods" / "Predict, Plan & Protect" / CWC stat / primary CTA. Rebuild in normal flow (grid, not absolute positioning). |
| 2 | **Trust row** | "Incubated in" + emblems. Promote — this is credibility. |
| 3 | **Predict · Plan · Protect** | Three-up. Currently the overlapping card; make it a proper section. |
| 4 | **Impact stats** | New. 2–4 numbers with sources. Needs real data — see Deferred Decisions. |
| 5 | **Audience selector** | Rebuilt tabs, five segments. Radix Tabs, keyboard-navigable, deep-linkable via `?segment=`. |
| 6 | **How it works** | New. Data in → model → deliverable out. Makes the product concrete. |
| 7 | **Demo CTA** | "What to expect in the demo" + form. |
| 8 | **Footer** | |

### 6.2 Segment pages (×5)

Shared template, content-driven:

Hero (title · positioning paragraph · illustration · CTA) → Capabilities grid
(3–6 cards) → Outcomes narrative → *[optional case study / use case]* →
Cross-links to other segments → Demo CTA → Footer.

The five current pages are near-identical copies of one another. Extract to a
single `<SegmentPage>` driven by `src/content/segments/*.ts`.

### 6.3 About

Mission → Founding story (2025) → Team grid → Values → Incubators & partners →
Contact CTA.

### 6.4 Demo / Contact

Form (name · email · organisation type · preferred date · preferred time ·
notes) with Zod validation, honeypot, and a real backend endpoint. On success:
inline confirmation state — **not** a `setTimeout` redirect to YouTube. Offer the
video as an explicit link.

---

## 7. Theming Architecture

The core of the light/dark requirement. **We define token names and roles now;
values get filled in after the reference/moodboard pass.**

### 7.1 Three-layer token system

```
Layer 1 — Primitives    Raw ramps.  --fg-green-50 … --fg-green-950, --fg-neutral-*
                        Never referenced directly by components.

Layer 2 — Semantic      Role names. --color-bg, --color-surface, --color-border,
                        --color-text, --color-text-muted, --color-brand,
                        --color-brand-hover, --color-on-brand, --color-accent,
                        --color-risk-low | -moderate | -high | -severe
                        These are what components use. Only these flip per theme.

Layer 3 — Component     Optional aliases. --btn-primary-bg: var(--color-brand)
```

### 7.2 Mechanism

```css
:root { /* light values — the complete palette */ }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* dark overrides */ }
}

:root[data-theme="dark"] { /* dark overrides — explicit toggle wins */ }
```

Three states, matching real user expectation: `light` · `dark` · `system` (default).
Preference persists in `localStorage`; a tiny blocking inline script in `<head>`
sets `data-theme` before first paint to avoid a flash.

### 7.3 Rules

- **No hex literals in component files.** Enforced via lint rule. This is the
  single discipline that makes dark mode work.
- Dark mode is **not** an inverted light mode. Surfaces lift with lightness,
  brand color usually needs to desaturate/brighten to stay legible on dark.
- Every semantic pair must pass **4.5:1** (body) / **3:1** (large text, UI
  borders) in *both* themes. Validated in CI.
- **Risk colors are semantic data, not decoration.** Low/moderate/high/severe
  must be distinguishable for deuteranopia and protanopia — never rely on
  red/green alone. This matters more than the brand palette; it's the product.
- Illustrations and the logo need dark-mode variants or theme-neutral treatment.

### 7.4 Typography & spacing

Fluid type scale via `clamp()`, 8px spacing base, max content width ~1280px.
Typeface choice is deferred with the palette.

---

## 8. Directory Structure

```
floodguard-web/
├── public/
│   ├── images/           optimized, with .webp/.avif variants
│   ├── brand/            logo variants (light/dark, mark/lockup)
│   ├── robots.txt
│   └── sitemap.xml       generated at build
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   │   ├── Home.tsx
│   │   ├── About.tsx
│   │   ├── Demo.tsx
│   │   ├── Contact.tsx
│   │   ├── Legal.tsx             privacy + terms, MDX-backed
│   │   ├── NotFound.tsx
│   │   └── services/
│   │       ├── ServicesIndex.tsx
│   │       └── SegmentPage.tsx   one template, five routes
│   ├── components/
│   │   ├── ui/           Button, Card, Tabs, Dialog, Input, Badge…
│   │   ├── layout/       Header, Footer, Container, Section, ThemeToggle
│   │   └── sections/     Hero, TrustRow, PillarGrid, AudienceTabs,
│   │                     StatBand, HowItWorks, DemoCTA, TeamGrid
│   ├── content/          ← single source of truth for all copy
│   │   ├── site.ts       name, tagline, contact, socials, legal entity
│   │   ├── nav.ts
│   │   ├── home.ts
│   │   ├── segments/     governments.ts, businesses.ts, insurance.ts,
│   │   │                 communities.ts, education.ts
│   │   ├── team.ts
│   │   ├── stats.ts      each stat carries a `source` field
│   │   └── legal/        privacy.mdx, terms.mdx
│   ├── hooks/            useTheme, useMediaQuery, useReducedMotion
│   ├── lib/              cn(), seo(), analytics(), validation schemas
│   ├── styles/
│   │   ├── tokens.css    ← Layer 1 + 2. The palette lives here, alone.
│   │   └── global.css
│   └── types/
├── api/                  serverless: demo-request handler
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

**The content/ layer is the point.** Every string, list, and stat lives in typed
TS/MDX files. Components render structure; content files hold words. Copy edits
never require touching a component, and swapping in a CMS later means replacing
one import.

---

## 9. SEO, Performance, Accessibility

**SEO**
- Prerendered static HTML per route (`vite-react-ssg`)
- Per-route `<title>`, meta description, canonical, OG + Twitter cards
- JSON-LD: `Organization` (with `address`, `foundingDate: 2025`), `WebSite`,
  `Service` per segment page, `FAQPage` if FAQs ship
- `robots.txt` + generated `sitemap.xml`
- Geo-targeted: India / Hyderabad, `hreflang` reserved for future `hi`/`te`

**Performance budget**
- LCP < 2.0s, CLS < 0.05, INP < 200ms on mid-tier mobile / 4G
- Initial JS < 150KB gzipped; route-level code splitting
- All images AVIF/WebP with explicit `width`/`height`; hero preloaded
- Self-hosted fonts, `font-display: swap`, subset to Latin (+ Devanagari/Telugu
  later if i18n happens)

**Accessibility — WCAG 2.1 AA**
- Semantic landmarks, logical heading order, skip-to-content link
- Full keyboard operation incl. the audience tabs and mobile drawer
- Visible focus rings that survive both themes
- `prefers-reduced-motion` respected on every animation
- Real alt text (the current site uses "Incubation Emblems" for three distinct
  incubator logos)
- Contrast verified in CI, both themes
- Tested with NVDA + VoiceOver before launch

---

## 10. Build Phases

| Phase | Scope | Output |
|---|---|---|
| **0 — Direction** | Reference gathering, moodboard, palette + type selection, logo cleanup | Design direction locked, `tokens.css` filled |
| **1 — Foundation** | Vite scaffold, Tailwind v4, token layer, theme toggle, `ui/` primitives, layout shell | Working themed shell, empty routes |
| **2 — Content model** | All copy extracted into `src/content/`, rewritten and tightened | Typed content layer |
| **3 — Home** | All eight home sections, built responsive-first | Home page complete, both themes |
| **4 — Segments** | `SegmentPage` template + five content files + services index | Six pages from one template |
| **5 — Supporting** | About, Demo, Contact, Privacy, Terms, 404 | Full site |
| **6 — Backend** | Demo form endpoint, validation, spam protection, notifications | Working lead capture |
| **7 — Polish** | SEO, structured data, motion, image optimization, a11y audit, Lighthouse | Launch-ready |
| **8 — Launch** | Deploy, DNS cutover, analytics, redirects from old routes | Live |

Phases 1–2 can start immediately; only Phase 0's *output* (token values) blocks
Phase 3. Building against placeholder tokens is fine and is exactly what the
token layer is for.

---

## 11. Migration Notes

- Old routes `/services/*` map 1:1 — **no redirects needed** for the five segments.
- `/resources` and `/faqs` currently exist and may be indexed → 301 to `/` or `/services`.
- Legal modals become `/privacy` and `/terms` — new routes, no old URLs to preserve.
- The demo YouTube link (`youtu.be/l8pN_11Ilrc`) should be reviewed before reuse.
- All existing images need re-export at 2× with modern formats. Several current
  assets (`emblem0/1/2.png`, team `.jpeg`s) are unoptimized.

---

## 12. Deferred Decisions

Open items. Resolve before or during Phase 0 — none of them block Phases 1–2.

**Design**
- [ ] **Color palette** — deliberately open. Reference gathering first. Constraint
      to carry in: whatever we pick must produce a legible risk scale (low →
      severe) in both light and dark, and must not read as "generic climate-tech
      teal."
- [ ] Typeface pairing (display + body)
- [ ] Illustration vs. photography vs. data-visualization as the primary visual
      language. Current site mixes flat illustration with a photo hero.
- [ ] Logo: consolidate the two-image lockup into a single SVG with light/dark
      variants

**Content**
- [ ] Real impact numbers for the stats band — cities covered, area assessed,
      clients, model resolution. Each needs a citable source.
- [ ] At least one case study or named pilot. Biggest single credibility gain
      available.
- [ ] Which three incubators, spelled out by name (currently unlabeled emblems)
- [ ] Whether `/resources` gets rebuilt for India (NDMA, state SDMA helplines,
      real downloadable guides) or stays retired

**Technical / business**
- [ ] Form backend: serverless + Resend/SendGrid, or a CRM (HubSpot free tier)?
- [ ] Real social accounts — do FloodGuard's Facebook/Instagram/YouTube/LinkedIn
      profiles exist? Link them or drop the icons.
- [ ] Contact email: keep `thefloodguard@gmail.com` or move to
      `hello@floodguard.in`? A gmail address on a govt-facing site costs credibility.
- [ ] Hosting + CI/CD, and who owns the deploy
- [ ] Analytics choice
- [ ] Multilingual: is Hindi/Telugu on the roadmap? Affects font subsetting and
      the content-layer shape.

---

## 13. Immediate Action Item

Independent of the rebuild: **take the current site off the Vite dev server.**
Running `npm run build` and serving `dist/` behind nginx (or moving to Vercel)
is a ~30 minute job and closes a live source-code exposure today, months before
v2 ships.
