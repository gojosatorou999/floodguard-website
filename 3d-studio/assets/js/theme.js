/* Light/dark toggle for the secondary pages. Shares the "fg_theme" key with the
   home page, so a choice made anywhere follows you everywhere. The saved value
   itself is applied by an inline snippet in each page's <head>, before first
   paint; this file only wires the button. */
(() => {
  const root = document.documentElement;
  const sys = matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => {
    const t = root.getAttribute("data-theme");
    return t ? t === "dark" : sys.matches;
  };
  const sync = () => {
    const dark = isDark();
    document.querySelectorAll("[data-theme-toggle]").forEach(b => {
      b.dataset.mode = dark ? "dark" : "light";
      b.setAttribute("aria-pressed", String(dark));
      b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    });
  };
  document.querySelectorAll("[data-theme-toggle]").forEach(b => b.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("fg_theme", next); } catch (_) { }
    sync();
  }));
  sys.addEventListener("change", sync);
  /* another tab changed it */
  addEventListener("storage", e => {
    if (e.key === "fg_theme" && e.newValue) { root.setAttribute("data-theme", e.newValue); sync(); }
  });
  sync();
})();
