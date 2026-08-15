import { timeline } from "@/content/home";
import YearBarChart from "../timeline/YearBarChart";
import YearDetailPopover from "../timeline/YearDetailPopover";
import IndiaChoropleth from "../maps/IndiaChoropleth";
import MapLegend from "../maps/MapLegend";

/**
 * Horizontal bar chart across 1951–2025 with a hover/tap year popover,
 * plus a secondary STATE-level map with legend.
 *
 * Selected year is owned here so the chart and the map stay in sync —
 * both children stay dumb.
 *
 * TODO: useState for selectedYear; keyboard arrow-key year stepping.
 */
export default function FloodStoryTimeline() {
  const selectedYear: number | null = null;

  return (
    <section aria-labelledby="timeline-title">
      <div className="container">
        <p className="mono">{timeline.eyebrow}</p>
        <h2 id="timeline-title">{timeline.title}</h2>

        <YearBarChart
          range={timeline.yearRange}
          years={timeline.years}
          selectedYear={selectedYear}
          onSelectYear={() => {}}
        />

        {selectedYear !== null && <YearDetailPopover year={selectedYear} detail={null} />}

        <div>
          <IndiaChoropleth asset={null} values={{}} level="state" />
          <MapLegend scale={null} />
        </div>
      </div>
    </section>
  );
}
