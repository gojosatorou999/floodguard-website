import type { ReactNode } from "react";
import TierFeatureList from "../product/TierFeatureList";

interface Props {
  name: string;
  tagline: string;
  tiers: { free: string[]; pro: string[] };
  cta: { label: string; href: string };
  /** Explorer → <ExplorerPreview />, Live → <LivePreview />. */
  preview: ReactNode;
  /** Mirrors the visual reference: previews alternate sides. */
  reversed?: boolean;
}

/**
 * Used twice — Explorer and Live. The preview is a slot, so the two
 * instances differ by content only, not by component.
 */
export default function ProductCard({ name, tagline, tiers, cta, preview, reversed }: Props) {
  return (
    <article data-reversed={reversed || undefined}>
      <div>
        <h3>{name}</h3>
        <p>{tagline}</p>
        <TierFeatureList free={tiers.free} pro={tiers.pro} />
        <a href={cta.href}>{cta.label}</a>
      </div>
      <div>{preview}</div>
    </article>
  );
}
