import { whyFloodGuard } from "@/content/home";

/** "Why FloodGuard" — 6-item icon + stat grid. */
export default function StatIconRow() {
  return (
    <section aria-labelledby="why-title">
      <div className="container">
        <h2 id="why-title">TODO section title</h2>
        <ul>
          {whyFloodGuard.map((item, i) => (
            <li key={i}>
              {/* TODO: <Icon name={item.icon} /> */}
              <span className="mono tabular">{item.stat}</span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
