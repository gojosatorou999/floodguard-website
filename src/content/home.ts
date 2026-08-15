/**
 * PLACEHOLDER COPY — none of this is final, and none of the numbers are real.
 * Structure is the point: it shows what each section needs. Copy comes from
 * the reference mockup once `floodguard-homepage.html` is available.
 */

export const hero = {
  eyebrow: "TODO eyebrow",
  headline: "TODO headline",
  subhead: "TODO subhead",
  primaryCta: { label: "TODO", href: "#" },
  secondaryCta: { label: "TODO", href: "#" },
  /** 4-stat bar. Values illustrative. */
  stats: [
    { label: "Years of observations", value: "—", caption: "TODO" },
    { label: "Districts", value: "—", caption: "TODO" },
    { label: "Talukas", value: "—", caption: "TODO" },
    { label: "Update cadence", value: "—", caption: "TODO" },
  ],
};

export const timeline = {
  eyebrow: "TODO",
  title: "TODO",
  yearRange: [1951, 2025] as [number, number],
  /** Empty by design — bars render from wired data, not this file. */
  years: [] as Array<{
    year: number;
    exposure: number;
    anomalyPct: number;
    eventCount: number;
    affectedDistricts: number;
  }>,
};

export const products = [
  {
    id: "explorer",
    name: "Explorer",
    tagline: "TODO",
    preview: "district-map" as const,
    tiers: {
      free: ["TODO feature", "TODO feature"],
      pro: ["TODO feature", "TODO feature"],
    },
    cta: { label: "TODO", href: "#" },
  },
  {
    id: "live",
    name: "Live",
    tagline: "TODO",
    preview: "phone-radar" as const,
    tiers: {
      free: ["TODO feature", "TODO feature"],
      pro: ["TODO feature", "TODO feature"],
    },
    cta: { label: "TODO", href: "#" },
  },
];

/** 6 items. Icon keys resolve in components/ui/Icon.tsx. */
export const whyFloodGuard = Array.from({ length: 6 }, (_, i) => ({
  icon: `todo-${i + 1}`,
  stat: "—",
  label: "TODO",
}));

/** 5 cards. */
export const industries = Array.from({ length: 5 }, (_, i) => ({
  icon: `todo-${i + 1}`,
  title: `TODO industry ${i + 1}`,
  description: "TODO one-line description",
}));

export const closingCta = {
  title: "TODO",
  body: "TODO",
  primary: { label: "TODO", href: "#" },
  secondary: { label: "TODO", href: "#" },
};
