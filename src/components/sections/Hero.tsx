import { hero } from "@/content/home";
import IndiaChoropleth from "../maps/IndiaChoropleth";
import StatBar from "../ui/StatBar";

/**
 * Headline / subhead / CTA block + district choropleth + 4-stat bar.
 *
 * The map is fed by props from the route, never loaded here — keeps this
 * presentational and the geometry swappable.
 */
export default function Hero() {
  return (
    <section aria-labelledby="hero-title">
      <div className="container">
        <div>
          <p className="mono">{hero.eyebrow}</p>
          <h1 id="hero-title">{hero.headline}</h1>
          <p>{hero.subhead}</p>
          {/* TODO: primary + secondary CTA */}
        </div>

        <div>
          {/* TODO: pass asset + values down from the route once wired */}
          <IndiaChoropleth asset={null} values={{}} level="district" />
        </div>
      </div>

      <StatBar stats={hero.stats} />
    </section>
  );
}
