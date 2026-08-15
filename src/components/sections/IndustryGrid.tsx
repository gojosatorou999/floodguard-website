import { industries } from "@/content/home";

/** 5-card grid: icon, title, one-line description. */
export default function IndustryGrid() {
  return (
    <section aria-labelledby="industries-title">
      <div className="container">
        <h2 id="industries-title">TODO section title</h2>
        <ul>
          {industries.map((item) => (
            <li key={item.title}>
              {/* TODO: <Icon name={item.icon} /> */}
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
