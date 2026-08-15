export interface YearDatum {
  year: number;
  exposure: number;
  anomalyPct: number;
  eventCount: number;
  affectedDistricts: number;
}

interface Props {
  range: [number, number];
  years: YearDatum[];
  selectedYear: number | null;
  onSelectYear: (year: number | null) => void;
}

/**
 * Horizontal run of one bar per year, 1951–2025.
 *
 * Numbers in the reference mockup are illustrative — nothing real is
 * hardcoded here.
 *
 * TODO: bar heights from exposure; hover + focus both select; arrow keys
 * step years; render as a real list so it degrades without JS.
 */
export default function YearBarChart({ range, years, selectedYear, onSelectYear }: Props) {
  return (
    <div
      data-barchart
      role="group"
      aria-label={`Flood exposure by year, ${range[0]} to ${range[1]}`}
    >
      {years.length === 0 ? (
        <p className="mono">TODO — bars render once year data is wired</p>
      ) : (
        years.map((d) => (
          <button
            key={d.year}
            type="button"
            aria-pressed={d.year === selectedYear}
            onClick={() => onSelectYear(d.year)}
          >
            <span className="sr-only">{d.year}</span>
          </button>
        ))
      )}
    </div>
  );
}
