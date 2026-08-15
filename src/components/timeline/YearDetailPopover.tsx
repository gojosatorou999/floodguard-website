import type { YearDatum } from "./YearBarChart";

interface Props {
  year: number;
  detail: YearDatum | null;
}

/**
 * Popover for a hovered/tapped year: exposure, anomaly %, event count,
 * affected districts.
 *
 * TODO: position against the active bar with collision handling; on touch
 * it's tap-to-open/dismiss, not hover; announce via aria-live.
 */
export default function YearDetailPopover({ year, detail }: Props) {
  return (
    <div role="dialog" aria-label={`Flood detail for ${year}`}>
      <p className="mono tabular">{year}</p>
      {detail ? (
        <dl className="tabular">
          <dt>Exposure</dt><dd>{detail.exposure}</dd>
          <dt>Anomaly</dt><dd>{detail.anomalyPct}%</dd>
          <dt>Events</dt><dd>{detail.eventCount}</dd>
          <dt>Districts affected</dt><dd>{detail.affectedDistricts}</dd>
        </dl>
      ) : (
        <p className="mono">TODO — no data wired</p>
      )}
    </div>
  );
}
