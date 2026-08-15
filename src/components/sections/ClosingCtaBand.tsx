import { closingCta } from "@/content/home";

/**
 * Gradient navy panel, two CTAs.
 * Background comes from --gradient-band so it flips with the theme.
 */
export default function ClosingCtaBand() {
  return (
    <section aria-labelledby="closing-title" data-band>
      <div className="container">
        <h2 id="closing-title">{closingCta.title}</h2>
        <p>{closingCta.body}</p>
        {/* TODO: primary + secondary CTA — check contrast on the gradient */}
      </div>
    </section>
  );
}
