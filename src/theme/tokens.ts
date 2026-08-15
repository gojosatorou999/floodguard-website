/**
 * TS mirror of tokens.css, for the few places JS needs a token value
 * (canvas/WebGL drawing, chart scales). Anything that can read the CSS
 * variable directly SHOULD — this exists so canvas code isn't blocked.
 */

export const blueScale = [
  "#012A4A", "#013A63", "#01497C", "#014F86", "#2A6F97",
  "#2C7DA0", "#468FAF", "#61A5C2", "#89C2D9", "#A9D6E5",
] as const;

/** Reserved for live / flood-alert states only. Never decorative. */
export const ALERT = "#C1121F";

/** Choropleth buckets, low → high exposure. Mirrors --map-1..7. */
export const mapRamp = [
  "var(--map-1)", "var(--map-2)", "var(--map-3)", "var(--map-4)",
  "var(--map-5)", "var(--map-6)", "var(--map-7)",
] as const;

/** Read a live token value — respects the active theme. */
export function token(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

export const fonts = {
  display: "Manrope",
  body: "Inter",
  mono: "JetBrains Mono",
} as const;
