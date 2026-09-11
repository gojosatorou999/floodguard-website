/**
 * Contrast + content audit (spec §4.6, §0.4).
 *   - every visible text node must clear 4.5:1, or 3:1 if it is large text
 *   - no placeholder stat may render: TODO, XX, or a bare em dash
 * Backgrounds are resolved by walking up for the first opaque ancestor,
 * which is what the eye actually sees through the glass layers.
 */
import { chromium } from 'playwright';

const BASE = process.env.QA_BASE || 'http://localhost:5173/';
const browser = await chromium.launch();
const failures = [];

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await page.waitForTimeout(1900);
  /* walk the page so scroll-revealed text is painted before it is sampled */
  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let i = 0; i <= 12; i++) {
    await page.evaluate(y => scrollTo(0, y), Math.round(docH * (i / 12)));
    await page.waitForTimeout(140);
  }
  await page.waitForTimeout(900);

  const res = await page.evaluate(() => {
    const lum = ([r, g, b]) => {
      const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    /* Chromium serialises color-mix() as `color(srgb 0.85 0.93 0.93)` with
       0..1 channels, while everything else comes back as rgb() in 0..255.
       Reading the float form as 8-bit makes every mixed surface look black. */
    const parse = c => {
      const n = (c.match(/[\d.]+/g) || []).map(Number);
      if (/^color\(/.test(c)) return n.slice(0, 3).map(v => v * 255).concat(n[3] === undefined ? [] : [n[3]]);
      return n;
    };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const opaqueBg = el => {
      let n = el;
      while (n && n !== document.documentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c.length >= 3 && (c[3] === undefined || c[3] >= 0.92)) return c.slice(0, 3);
        n = n.parentElement;
      }
      return parse(getComputedStyle(document.body).backgroundColor).slice(0, 3);
    };

    const bad = [], stats = [];
    for (const el of document.querySelectorAll('h1,h2,h3,h4,p,li,a,span,b,em,button,time')) {
      if (el.children.length && !/\S/.test([...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(''))) continue;
      const t = el.textContent.trim();
      if (!t) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.5) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (el.closest('#pre, .ov, [aria-hidden="true"], .sr')) continue;
      /* an ancestor can hide this without changing its own computed style —
         a tooltip at opacity 0, a chip whose wrapper is display:none */
      let hidden = false;
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const p = getComputedStyle(n);
        if (p.display === 'none' || p.visibility === 'hidden' || parseFloat(p.opacity) < 0.5) { hidden = true; break; }
      }
      if (hidden) continue;
      /* A gradient or image behind the text has no single colour to compare
         against, so a ratio computed from the first opaque *colour* ancestor
         would be meaningless. Those need a human eye on a screenshot. */
      let painted = false;
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        if (getComputedStyle(n).backgroundImage !== 'none') { painted = true; break; }
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c.length >= 3 && (c[3] === undefined || c[3] >= 0.92)) break;
      }
      if (painted) continue;

      if (/\bTODO\b|\bXX\b/.test(t) || /^[\u2014\u2013-]$/.test(t)) stats.push(t.slice(0, 40));

      const fg = parse(cs.color);
      if (fg.length >= 4 && fg[3] < 0.5) continue;
      const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const need = large ? 3 : 4.5;
      const got = ratio(fg.slice(0, 3), opaqueBg(el));
      if (got < need - 0.05) {
        bad.push(`${got.toFixed(2)}:1 (need ${need}) ${el.tagName}.${(el.className + '').slice(0, 24)} "${t.slice(0, 32)}"`);
      }
    }
    return { bad, stats };
  });

  for (const b of [...new Set(res.bad)].slice(0, 12)) failures.push(`${theme} contrast: ${b}`);
  for (const s of [...new Set(res.stats)]) failures.push(`${theme} placeholder stat rendered: "${s}"`);
  await ctx.close();
  process.stdout.write(res.bad.length || res.stats.length ? 'x' : '.');
}

await browser.close();
console.log('\n');
if (failures.length) { for (const f of failures) console.log('  ' + f); process.exit(1); }
console.log('contrast and content audit clean in both themes');
