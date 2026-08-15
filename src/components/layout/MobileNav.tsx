/**
 * Hamburger + full-screen drawer variant of the primary nav.
 * Dropdown groups become collapsible accordions here.
 *
 * TODO: focus trap, scroll lock, Escape to close, aria-controls wiring.
 */
export default function MobileNav() {
  return (
    <div data-mobile-nav>
      <button type="button" aria-label="Open menu" aria-expanded={false}>
        {/* TODO: hamburger icon */}
      </button>
      {/* TODO: drawer panel */}
    </div>
  );
}
