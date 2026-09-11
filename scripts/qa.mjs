/**
 * QA harness for the redesign (spec §7).
 *
 * For each viewport × theme it loads the page, scrolls through it, and
 * asserts the two things that break silently in a scroll-driven layout:
 * horizontal overflow, and anything wider than its own viewport. Console
 * errors and page errors fail the run outright.
 *
 *   node scripts/qa.mjs                 # default matrix
 *   node scripts/qa.mjs --shots         # also write screenshots
 *   node scripts/qa.mjs --only=1280x600 # one viewport
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.QA_BASE || 'http://localhost:5173/';
const SHOTS = process.argv.includes('--shots');
const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];

/* spec §7 QA matrix, trimmed to what Chromium can speak for */
const VIEWPORTS = [
  { name: '280x653',  w: 280,  h: 653 },   // Galaxy Fold, folded
  { name: '360x800',  w: 360,  h: 800 },   // small Android
  { name: '375x667',  w: 375,  h: 667 },   // iPhone SE
  { name: '393x852',  w: 393,  h: 852 },   // iPhone 15/16
  { name: '430x932',  w: 430,  h: 932 },   // iPhone Pro Max
  { name: '844x390',  w: 844,  h: 390 },   // phone landscape → pins OFF
  { name: '744x1133', w: 744,  h: 1133 },  // iPad mini portrait
  { name: '1180x820', w: 1180, h: 820 },   // iPad Air landscape
  { name: '1280x600', w: 1280, h: 600 },   // Windows @150%
  { name: '1536x730', w: 1536, h: 730 },   // Windows @125%
  { name: '1440x800', w: 1440, h: 800 },   // MacBook Air
  { name: '1920x960', w: 1920, h: 960 },   // desktop FHD
  { name: '2560x1300', w: 2560, h: 1300 }, // QHD
].filter(v => !only || v.name === only);

const THEMES = ['light', 'dark'];
const failures = [];

if (SHOTS) mkdirSync('qa-shots', { recursive: true });

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: 1,
      colorScheme: theme,
    });
    const page = await ctx.newPage();
    const tag = `${vp.name} ${theme}`;
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));

    await page.goto(BASE, { waitUntil: 'load' });
    await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
    await page.waitForTimeout(1800);            // let the preloader finish

    /* walk the page in viewport-sized steps, the way a reader would */
    const steps = 14;
    const docH = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let i = 0; i <= steps; i++) {
      await page.evaluate(y => scrollTo(0, y), Math.round((docH - vp.h) * (i / steps)));
      await page.waitForTimeout(120);

      const bad = await page.evaluate(() => {
        const out = { scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, wide: [] };
        const sel = '[data-step], .deck__card, .isoStep, .hc, section, .wrap, .container, footer';
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          if (r.width > window.innerWidth + 1 && r.height > 0) {
            out.wide.push((el.id || el.className || el.tagName).toString().slice(0, 60) + ' w=' + Math.round(r.width));
          }
        }
        return out;
      });
      if (bad.scrollW > bad.innerW + 1) {
        failures.push(`${tag} step${i}: horizontal overflow ${bad.scrollW} > ${bad.innerW}`);
        break;
      }
      if (bad.wide.length) {
        failures.push(`${tag} step${i}: element wider than viewport → ${bad.wide.slice(0, 3).join(' | ')}`);
        break;
      }
      if (SHOTS && i % 7 === 0) {
        await page.screenshot({ path: `qa-shots/${vp.name}-${theme}-${i}.png` });
      }
    }
    if (errs.length) failures.push(`${tag}: console → ${[...new Set(errs)].slice(0, 3).join(' | ')}`);
    await ctx.close();
    process.stdout.write(failures.some(f => f.startsWith(tag)) ? 'x' : '.');
  }
}

await browser.close();
console.log('\n');
if (failures.length) {
  console.log(`${failures.length} failure(s):`);
  for (const f of failures) console.log('  ' + f);
  process.exit(1);
}
console.log(`clean across ${VIEWPORTS.length} viewports x ${THEMES.length} themes`);
