/**
 * Stamps the shared page shell — header, "Get started" CTA and footer — into
 * every page, so they can never drift apart.
 *
 *   node scripts/shell.mjs
 *
 * Each page carries marker comments; everything between a pair is
 * regenerated from the fragments below:
 *
 *   <!-- shell:header -->  … <!-- /shell:header -->   (content pages only;
 *                                                     the homepage keeps its own bar)
 *   <!-- shell:cta -->     … <!-- /shell:cta -->
 *   <!-- shell:footer -->  … <!-- /shell:footer -->
 *
 * The page's place in the nav comes from <body data-nav="products|solutions|
 * platform|insights|about|contact">. Edit a fragment here, re-run, commit.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PAGES = [
  "index.html", "products.html", "solutions.html", "platform.html", "insights.html", "about.html", "contact.html",
  "solutions/insurance.html", "solutions/banking.html", "solutions/agriculture.html",
  "solutions/infrastructure.html", "solutions/government.html",
];

/* ── site map: one list drives the bar, the phone menu and the footer ── */
export const EXPLORER = "/index.html#hmap";
const PRODUCTS = [
  ["Explorer", "/products.html#explorer", "Free district-level flood history"],
  ["Atlas", "/products.html#atlas", "Historical and future flood risk, in depth"],
  ["Live", "/products.html#live", "Real-time rainfall, radar and alerts"],
];
const SOLUTIONS = [
  ["Insurance & Reinsurance", "/solutions/insurance.html", "Underwriting, accumulation and claims"],
  ["Banking & Finance", "/solutions/banking.html", "Collateral and portfolio screening"],
  ["Agriculture", "/solutions/agriculture.html", "Crop and agricultural flood risk"],
  ["Infrastructure", "/solutions/infrastructure.html", "Sites, assets and corridors"],
  ["Government & Disaster Management", "/solutions/government.html", "Prepare, monitor and respond"],
];
const esc = s => s.replace(/&(?!amp;)/g, "&amp;");
const ARROW = '<svg class="ar" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4"/></svg>';
const CHEV = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4.5 6 8.5 10 4.5"/></svg>';
const cur = (on) => (on ? ' aria-current="page"' : "");

function header(nav) {
  const drop = (key, label, items, all) => `
      <div class="tni">
        <button type="button" aria-expanded="false" aria-controls="dd-${key}"${cur(nav === key)}>${label} ${CHEV}</button>
        <div class="tdrop" id="dd-${key}">
${items.map(([t, h, d]) => `          <a href="${h}"><b>${esc(t)}</b><em>${d}</em></a>`).join("\n")}
          <a class="all" href="${all[1]}">${all[0]} →</a>
        </div>
      </div>`;
  const plain = (key, label, href) => `\n      <a href="${href}"${cur(nav === key)}>${label}</a>`;
  const mlink = ([t, h]) => `      <a href="${h}">${esc(t)}</a>`;
  return `<div class="wrap topWrap">
  <header class="topbar">
    <a class="brandmark" href="/index.html" aria-label="FloodGuard — home">
      <img src="/assets/img/logo-mark.png" alt="" aria-hidden="true"><b>FLOODGUARD</b>
    </a>
    <nav class="tnav" aria-label="Primary">${drop("products", "Products", PRODUCTS, ["All products", "/products.html"])}${drop("solutions", "Solutions", SOLUTIONS, ["Solutions overview", "/solutions.html"])}${plain("platform", "Platform", "/platform.html")}${plain("insights", "Insights", "/insights.html")}${plain("about", "About", "/about.html")}
    </nav>
    <div class="topbarAct">
      <button class="themeBtn" type="button" data-theme-toggle aria-label="Switch to dark mode">
        <svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>
        <svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>
      </button>
      <a class="btn bg2 tExplore" href="${EXPLORER}">Explore Free Data</a>
      <a class="btn bp" href="/contact.html"${cur(nav === "contact")}>Request a Demo</a>
      <a class="tsign" href="/auth.html" data-signin>Sign in</a>
      <button class="tmenu" type="button" aria-expanded="false" aria-controls="tmenuPanel" aria-label="Open menu"><i></i><i></i><i></i></button>
    </div>
    <div class="tmenuPanel" id="tmenuPanel" hidden>
      <p>Products</p>
${PRODUCTS.map(mlink).join("\n")}
      <p>Solutions</p>
      <a href="/solutions.html">Overview</a>
${SOLUTIONS.map(mlink).join("\n")}
      <hr>
      <a href="/platform.html"${cur(nav === "platform")}>Platform</a>
      <a href="/insights.html"${cur(nav === "insights")}>Insights</a>
      <a href="/about.html"${cur(nav === "about")}>About us</a>
      <a href="/contact.html"${cur(nav === "contact")}>Contact us</a>
      <div class="themeRow"><span>Appearance</span>
        <button class="themeBtn" type="button" data-theme-toggle aria-label="Switch to dark mode">
          <svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>
          <svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>
        </button>
      </div>
      <a class="btn bp" href="${EXPLORER}">Explore Free Data ${ARROW}</a>
    </div>
  </header>
</div>`;
}

/* the one closing CTA, on every page (it started life on /products) */
const CTA = `<section class="sec getStarted" id="get-started">
  <div class="wrap">
    <div class="secHead">
      <p class="eyebrow"><i></i>Get started</p>
      <h2>Ready to explore FloodGuard?</h2>
    </div>
    <div class="paths">
      <div class="card" data-reveal>
        <span class="access">Explorer</span>
        <h3>Explore for free.</h3>
        <p>Access district-level historical flood risk and begin exploring India's flood record. No sales conversation required.</p>
        <div class="ctaRow"><a class="btn bp" href="${EXPLORER}">Explore Explorer ${ARROW}</a></div>
      </div>
      <div class="card ent" data-reveal>
        <span class="access">Atlas + Live</span>
        <h3>Talk to the FloodGuard team.</h3>
        <p>For professional and enterprise access, contact our team to discuss your geography, use case, data requirements and deployment needs.</p>
        <div class="ctaRow">
          <a class="btn bp" href="/contact.html?product=Atlas%20%2B%20Live">Request a Demo ${ARROW}</a>
          <a class="btn bg2" href="/contact.html?intent=sales">Contact Sales ${ARROW}</a>
        </div>
      </div>
    </div>
  </div>
</section>`;

export const CONTACT = {
  address: ["COHORT Coworking", "Kondapur, Hyderabad, Telangana"],
  phone: "+91 90307 62494", tel: "+919030762494",
  email: "dhanyabulla@floodguard.in",
};
const ICON = {
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>',
};

const col = (title, links) => `      <div class="site-footer__col">
        <h2 class="site-footer__heading">${title}</h2>
        <ul role="list">
${links.map(([t, h]) => `          <li><a href="${h}">${esc(t)}</a></li>`).join("\n")}
        </ul>
      </div>`;
const FOOTER = `<footer class="site-footer">
  <div class="wrap site-footer__top">
    <div class="site-footer__brand">
      <a class="site-footer__logo" href="/index.html" aria-label="FloodGuard home">
        <img src="/assets/img/logo-mark.png" alt="">
        <b class="site-footer__wordmark">FloodGuard</b>
      </a>
      <p class="site-footer__desc">Flood intelligence across time — historical, current and future — translated into decision-ready insight for organisations exposed to flood risk.</p>
      <address>
        <ul class="site-footer__contact" role="list">
          <li>${ICON.pin}<span>${CONTACT.address.join(", ")}</span></li>
          <li>${ICON.phone}<a href="tel:${CONTACT.tel}">${CONTACT.phone}</a></li>
          <li>${ICON.mail}<a href="mailto:${CONTACT.email}">${CONTACT.email}</a></li>
        </ul>
      </address>
    </div>
    <nav class="site-footer__nav" aria-label="Footer">
${col("Products", [...PRODUCTS.map(([t, h]) => [t, h]), ["Compare products", "/products.html#compare"]])}
${col("Solutions", SOLUTIONS.map(([t, h]) => [t.replace(" & Disaster Management", ""), h]))}
${col("Platform", [["Data", "/platform.html#data"], ["Technology", "/platform.html#technology"], ["Methodology", "/platform.html#methodology"], ["Validation", "/platform.html#validation"], ["API", "/platform.html#api"]])}
${col("Company", [["Insights", "/insights.html"], ["About us", "/about.html"], ["Contact us", "/contact.html"], ["Request a demo", "/contact.html?intent=demo"]])}
    </nav>
  </div>
  <div class="wrap site-footer__bottom">
    <p>© <span id="fgYear">${new Date().getFullYear()}</span> FloodGuard Solutions Pvt. Ltd. · Hyderabad, India</p>
  </div>
</footer>`;

const swap = (html, name, body) => {
  const re = new RegExp(`(<!-- shell:${name} -->)[\\s\\S]*?(<!-- /shell:${name} -->)`);
  if (!re.test(html)) return html;
  return html.replace(re, `$1\n${body}\n$2`);
};

let n = 0;
for (const rel of PAGES) {
  const file = resolve(root, rel);
  let html;
  try { html = readFileSync(file, "utf8"); } catch { console.warn("skip (missing)", rel); continue; }
  const nav = (html.match(/<body[^>]*data-nav="([^"]+)"/) || [])[1] || "";
  const out = [["header", header(nav)], ["cta", CTA], ["footer", FOOTER]].reduce((h, [k, b]) => swap(h, k, b), html);
  if (out !== html) { writeFileSync(file, out); n++; console.log("shell →", rel); }
}
console.log(n ? `${n} page(s) updated` : "all pages already in sync");
