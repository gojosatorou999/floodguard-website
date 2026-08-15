interface Stat {
  label: string;
  value: string;
  caption?: string;
}

interface Props {
  stats: Stat[];
}

/**
 * 4-stat bar under the hero: Years of Observations, Districts, Talukas,
 * Update cadence. Values use --font-mono + tabular-nums so they align.
 */
export default function StatBar({ stats }: Props) {
  return (
    <dl data-statbar>
      {stats.map((s) => (
        <div key={s.label}>
          <dd className="mono tabular">{s.value}</dd>
          <dt>{s.label}</dt>
          {s.caption && <p className="mono">{s.caption}</p>}
        </div>
      ))}
    </dl>
  );
}
