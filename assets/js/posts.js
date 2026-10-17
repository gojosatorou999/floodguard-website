/* ── Insights posts: the one list behind /insights and the homepage ──
   Add or edit a post here and both pages update. Newest first.

   kind     Research · White paper · Use case · Data story · Article
   title    the headline
   excerpt  one or two sentences
   date     "2026-10-20" (ISO) — leave null until it is published
   read     reading time in minutes, or null
   href     the post's page (e.g. "/insights/kosi-floods.html"); while it
            is null the card shows "Coming soon" and is not a link
   image    optional cover image path; without one the card uses the
            texture named in tex (dots · grid · hatch · contours) */
export const POSTS = [
  {
    kind: "Research",
    title: "Flood risk, climate data and India's changing risk landscape",
    excerpt: "How the observed record and climate projections disagree, where they agree, and what that means for anyone pricing or planning around flood.",
    date: null, read: null, href: null, tex: "dots",
  },
  {
    kind: "Data story",
    title: "Seventy-five years of rainfall, drawn",
    excerpt: "A visual walk through the flood history and rainfall record behind the platform — built from the same series as our homepage timeline.",
    date: null, read: null, href: null, tex: "contours",
  },
  {
    kind: "White paper",
    title: "Exposure and decision support",
    excerpt: "How exposure is resolved from district to site, and how the result is meant to be read by the people making the call.",
    date: null, read: null, href: null, tex: "grid",
  },
  {
    kind: "Use case",
    title: "What each sector actually asks of a flood model",
    excerpt: "Insurance, banking, government, infrastructure and agriculture each ask different questions of the same flood record — and that is where they diverge.",
    date: null, read: null, href: null, tex: "hatch",
  },
  {
    kind: "Article",
    title: "Perspectives on flood science and resilience",
    excerpt: "Shorter pieces on flood science, technology and resilience, written for people who have to act on the answer.",
    date: null, read: null, href: null, tex: "dots",
  },
];

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = d => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const ARROW = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4"/></svg>';

/* one card; a link only once the post exists */
export function postCard(p) {
  const meta = [p.date && `<time datetime="${esc(p.date)}">${fmt(p.date)}</time>`, p.read && `${p.read} min read`].filter(Boolean).join(" · ");
  const tag = p.href ? "a" : "article";
  const attrs = p.href ? ` href="${esc(p.href)}"` : ' aria-disabled="true"';
  const cover = p.image
    ? `<img src="${esc(p.image)}" alt="" loading="lazy">`
    : "";
  return `<${tag} class="post${p.href ? "" : " soon"}"${attrs}>
    <div class="postCover" data-tex="${esc(p.tex || "dots")}">${cover}<span class="postKind">${esc(p.kind)}</span></div>
    <div class="postTxt">
      <p class="postMeta">${meta}</p>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.excerpt)}</p>
      <span class="postGo">${p.href ? `Read ${p.kind === "Data story" ? "the story" : "more"} ${ARROW}` : "Coming soon"}</span>
    </div>
  </${tag}>`;
}

/* fill every [data-posts] grid on the page; data-posts="3" limits the count */
document.querySelectorAll("[data-posts]").forEach(el => {
  const n = parseInt(el.dataset.posts, 10) || POSTS.length;
  el.innerHTML = POSTS.slice(0, n).map(postCard).join("");
});
