interface Props {
  free: string[];
  pro: string[];
}

/**
 * Two-tier feature list inside a ProductCard.
 *
 * TODO: tier headings, check/lock affordance per row. Tier must be legible
 * without relying on colour alone.
 */
export default function TierFeatureList({ free, pro }: Props) {
  return (
    <div data-tiers>
      <div>
        <h4 className="mono">Free</h4>
        <ul>{free.map((f) => <li key={f}>{f}</li>)}</ul>
      </div>
      <div>
        <h4 className="mono">Pro</h4>
        <ul>{pro.map((f) => <li key={f}>{f}</li>)}</ul>
      </div>
    </div>
  );
}
