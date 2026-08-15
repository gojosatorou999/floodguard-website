import { footerColumns } from "@/content/nav";

/**
 * 5 columns: brand blurb + Products, Methodology, Resources, Company.
 */
export default function Footer() {
  return (
    <footer>
      <div className="container">
        <div>
          {/* TODO: logo, one-line description, socials (real accounts only) */}
        </div>

        {footerColumns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3>{col.title}</h3>
            <ul>
              {col.items.map((item) => (
                <li key={item.label}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* TODO: legal bar — /privacy and /terms as routes, not modals */}
    </footer>
  );
}
