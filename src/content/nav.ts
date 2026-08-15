/** Nav structure is real (from spec); labels/hrefs are provisional. */

export interface NavItem {
  label: string;
  href: string;
  description?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const primaryNav: Array<NavItem | NavGroup> = [
  {
    label: "Products",
    items: [
      { label: "Explorer", href: "/products/explorer", description: "TODO" },
      { label: "Live", href: "/products/live", description: "TODO" },
    ],
  },
  {
    label: "Resources",
    items: [
      { label: "TODO", href: "#" },
      { label: "TODO", href: "#" },
    ],
  },
  { label: "Methodology", href: "/methodology" },
  { label: "Company", href: "/company" },
];

export const isGroup = (n: NavItem | NavGroup): n is NavGroup => "items" in n;

/** Footer: 5 columns per spec. */
export const footerColumns = [
  { title: "Products", items: [] as NavItem[] },
  { title: "Methodology", items: [] as NavItem[] },
  { title: "Resources", items: [] as NavItem[] },
  { title: "Company", items: [] as NavItem[] },
];
