import type { NavGroup } from "@/content/nav";

interface Props {
  group: NavGroup;
}

/**
 * Desktop dropdown (Products, Resources).
 *
 * TODO: open on hover AND click, Escape to close, roving focus through
 * items, aria-expanded on the trigger. Hover-only is an a11y fail.
 */
export default function NavDropdown({ group }: Props) {
  return (
    <div data-dropdown>
      <button type="button" aria-expanded={false}>
        {group.label}
      </button>
      <ul hidden>
        {group.items.map((item) => (
          <li key={item.label}>
            <a href={item.href}>{item.label}</a>
            {item.description && <span>{item.description}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
