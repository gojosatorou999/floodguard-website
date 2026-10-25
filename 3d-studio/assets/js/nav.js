/* Primary nav for the content pages: the Products / Solutions dropdowns
   and the phone menu. The markup is stamped into every page by
   scripts/shell.mjs, so the way through the site never changes from one
   page to the next. */
const TOUCH = matchMedia("(hover: none), (pointer: coarse)").matches;
const drops = [...document.querySelectorAll(".tni")];
let open = null, timer = null;

function close() {
  if (!open) return;
  open.classList.remove("open");
  open.querySelector("button").setAttribute("aria-expanded", "false");
  open = null;
}
function show(n) {
  if (open === n) return;
  close();
  n.classList.add("open");
  n.querySelector("button").setAttribute("aria-expanded", "true");
  open = n;
}
drops.forEach(n => {
  const btn = n.querySelector("button");
  if (!TOUCH) {
    n.addEventListener("pointerenter", () => { clearTimeout(timer); show(n); });
    n.addEventListener("pointerleave", () => { timer = setTimeout(close, 140); });
  }
  btn.addEventListener("click", e => { e.stopPropagation(); open === n ? close() : show(n); });
  // leaving the panel by keyboard closes it
  n.addEventListener("focusout", e => { if (!n.contains(e.relatedTarget)) close(); });
});

/* phone / tablet menu */
const mBtn = document.querySelector(".tmenu"), mPanel = document.getElementById("tmenuPanel");
function setMenu(on) {
  if (!mBtn || !mPanel) return;
  mPanel.hidden = !on;
  mBtn.setAttribute("aria-expanded", String(on));
  mBtn.setAttribute("aria-label", on ? "Close menu" : "Open menu");
}
mBtn?.addEventListener("click", e => { e.stopPropagation(); setMenu(mPanel.hidden); });

document.addEventListener("click", e => {
  if (open && !e.target.closest(".tni")) close();
  if (mPanel && !mPanel.hidden && !e.target.closest(".tmenuPanel")) setMenu(false);
});
addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (open) { const b = open.querySelector("button"); close(); b.focus(); }
  if (mPanel && !mPanel.hidden) { setMenu(false); mBtn.focus(); }
});
