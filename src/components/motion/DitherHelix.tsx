/**
 * PORT SLOT for the dither-helix motion experiment.
 * Working vanilla implementation: /prototypes/dither-helix.html
 *
 * NOT placed on the homepage yet — the spec gives the hero to the
 * choropleth, and two competing visuals in one hero is one too many.
 * Candidate slots, pick one:
 *
 *   a) Product previews — replace the static Explorer/Live previews with
 *      a helix of deliverable cards. Strongest fit; it IS a deliverable
 *      showcase.
 *   b) Between IndustryGrid and ClosingCtaBand, as a "what you get" band.
 *   c) A methodology/product page rather than the homepage.
 *
 * Porting notes:
 *   - Effect logic is framework-free. Wrap in one useEffect, keep the
 *     rAF loop in a ref, cancel on unmount.
 *   - Swap the procedural map art for real deliverable screenshots.
 *   - Repoint accent reads at --color-accent (was --accent).
 *   - Card text must stay real DOM — that's what keeps it indexable
 *     and screen-reader accessible.
 *   - Keep the pause control. WCAG 2.2.2.
 */

interface Props {
  cards: Array<{ segment: string; title: string; note: string; image: string }>;
  preset?: "restrained" | "balanced" | "expressive";
}

export default function DitherHelix({ cards, preset = "restrained" }: Props) {
  return (
    <div data-helix data-preset={preset}>
      {/* TODO: port from prototypes/dither-helix.html */}
      {cards.map((c) => (
        <article key={c.title}>
          <p className="mono">{c.segment}</p>
          <h3>{c.title}</h3>
          <p>{c.note}</p>
        </article>
      ))}
    </div>
  );
}
