import { primaryNav, isGroup } from "@/content/nav";
import NavDropdown from "./NavDropdown";
import MobileNav from "./MobileNav";

/**
 * Sticky header. Logo + nav with Products/Resources dropdowns.
 * Collapses to MobileNav below the nav breakpoint.
 *
 * TODO: sticky + scrolled-state shadow; focus trap handled in MobileNav.
 */
export default function Header() {
  return (
    <header data-sticky>
      <div className="container">
        <a href="/" aria-label="FloodGuard home">
          {/* TODO: Logo.jpg → SVG, light/dark variants. Asset not yet supplied. */}
          <span>FloodGuard</span>
        </a>

        <nav aria-label="Primary">
          {primaryNav.map((item) =>
            isGroup(item) ? (
              <NavDropdown key={item.label} group={item} />
            ) : (
              <a key={item.label} href={item.href}>{item.label}</a>
            )
          )}
        </nav>

        {/* TODO: primary CTA button */}
        <MobileNav />
      </div>
    </header>
  );
}
