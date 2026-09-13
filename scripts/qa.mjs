/**
 * QA harness for the redesign (spec §7).
 *
 * For each viewport × theme it loads the page, walks it top to bottom, and
 * asserts the things that fail silently in a scroll-driven layout:
 *
 *   - horizontal overflow, and any element wider than its own viewport
 *   - console and page errors
 *   - content stranded at opacity 0 after the section has been scrolled past
 *   - pinned stages taller than the viewport they pin to
 *
 * Plus two whole-page modes the matrix alone can't reach: reduced motion,
 * and a viewport short enough that the pin policy must switch everything to
 * its static layout.
 *
 *   node scripts/qa.mjs                 # full run
 *   node scripts/qa.mjs --shots         # also write screenshots
 *   node scripts/qa.mjs --only=1280x600 # one viewport
 *
 * Playwright's WebKit is not real iOS Safari. Final sign-off still needs a
 * pass on a physical iPhone for §02, §05, §09 and §10.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.QA_BASE || 'http://localhost:5173/';
const SHOTS = process.argv.includes('--shots');
const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];

/* spec §7 QA matrix, trimmed to what Chromium can speak for */
const VIEWPORTS = [
  { name: '280x653',   w: 280,  h: 653 },   // Galaxy Fold, folded
  { name: '360x800',   w: 360,  h: 800 },   // small Android
  { name: '375x667',   w: 375,  h: 667 },   // iPhone SE
  { name: '393x852',   w: 393,  h: 852 },   // iPhone 15/16
  { name: '430x932',   w: 430,  h: 932 },   // iPhone Pro Max
  { name: '412x915',   w: 412,  h: 915 },   // Pixel 8
  { name: '844x390',   w: 844,  h: 390 },   // phone landscape → pins OFF
  { name: '744x1133',  w: 744,  h: 1133 },  // iPad mini portrait
  { name: '1180x820',  w: 1180, h: 820 },   // iPad Air landscape
  { name: '1280x600',  w: 1280, h: 600 },   // Windows @150%
  { name: '1536x730',  w: 1536, h: 730 },   // Windows @125%
  { name: '1440x800',  w: 1440, h: 800 },   // MacBook Air
  { name: '1920x960',  w: 1920, h: 960 },   // desktop FHD
  { name: '2560x1300', w: 2560, h: 1300 },  // QHD
  { name: '3440x1300', w: 3440, h: 1300 },  // ultrawide
].filter(v => !only || v.name === only);

if (only && VIEWPORTS.length === 0) {
  console.error(`Unknown viewport "${only}". Valid names: ${['280x653','360x800','375x667','393x852','430x932','412x915','844x390','744x1133','1180x820','1280x600','1536x730','1440x800','1920x960','2560x1300','3440x1300'].join(', ')}`);
  process.exit(1);
}

const failures = [];
const note = m => failures.push(m);

if (SHOTS) mkdirSync('qa-shots', { recursive: true });

const browser = await chromium.launch();

async function open(vp, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    colorScheme: opts.theme || 'light',
    reducedMotion: opts.reduce ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(BASE, { waitUntil: 'load' });
  /* the harness drives scroll directly; smooth behaviour would mean every
     measurement below was taken mid-flight */
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await page.waitForTimeout(1900);           // let the preloader finish
  return { ctx, page, errs };
}

/* Nothing the reader has just scrolled past may still be invisible — that is
   the failure mode a reveal system hides best. Checked close behind the
   viewport during the walk: Chromium defers transitions for elements far
   off-screen (their currentTime stays at 0 until they matter), so measuring
   the whole page from the bottom would report every deferred reveal as
   stranded. */
async function checkStranded(page, tag, step) {
  const stranded = await page.evaluate(() => {
    const out = [];
    const sel = 'h1,h2,h3,p,li,a,article,.platBody,.dropCards article,.deckInner';
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 || r.bottom < -innerHeight * 1.5) continue;   // just-passed only
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (!el.textContent.trim()) continue;
      if (parseFloat(cs.opacity) > 0.01) continue;
      /* A reveal that has been triggered but is still fading in is not
         stranded, and Chromium defers transitions on elements far from the
         viewport, so a large scroll step can outrun one by seconds. What
         matters is whether the reveal fired at all. */
      if (el.getAnimations().some(a => a.playState === 'running' || a.playState === 'paused')) continue;
      if (el.closest('[aria-hidden="true"], .ov, #pre, #cookie, .drop, #menuPanel, .msPanel, #pop, .mtip')) continue;
      /* Scrubbed animations may be invisible once you are past them — they
         come back on the way up. Only one-shot reveals, which never come
         back, count as stranded. */
      if (el.closest('.scard, .hc, #whyPin, .nstage')) continue;
      out.push(((el.tagName + '.' + el.className) + '').slice(0, 50) + ' :: ' + el.textContent.trim().slice(0, 40));
    }
    return out;
  });
  if (stranded.length) note(`${tag} step${step}: content left at opacity 0 → ${stranded.slice(0, 3).join(' | ')}`);
}

/* ── 1. the matrix: overflow, errors, stranded content ───────────────── */
for (const vp of VIEWPORTS) {
  for (const theme of ['light', 'dark']) {
    const tag = `${vp.name} ${theme}`;
    const { ctx, page, errs } = await open(vp, { theme });
    const before = failures.length;

    const docH = await page.evaluate(() => document.documentElement.scrollHeight);
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      await page.evaluate(y => scrollTo(0, y), Math.round((docH - vp.h) * (i / steps)));
      /* Headless Chromium has no GPU: a 3440x1300 page carrying this much
         blur renders at roughly 3fps, so one frame is ~330ms. A short fixed
         settle would sample before the reveal loop had run even once and
         report every pending reveal as stranded. Scale it with the area. */
      await page.waitForTimeout(vp.w * vp.h > 2.2e6 ? 1600 : 200);

      const bad = await page.evaluate(() => {
        const out = { scrollW: document.documentElement.scrollWidth, innerW: innerWidth, wide: [], tallPin: [] };
        const sel = '[data-step], .deckCard, .isoStep, .hc, .platCard, section, .wrap, .container, footer';
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          if (r.width > innerWidth + 1 && r.height > 0) {
            out.wide.push(((el.id || el.className || el.tagName) + '').slice(0, 50) + ' w=' + Math.round(r.width));
          }
        }
        /* a pinned stage taller than the viewport can never be fully seen */
        for (const el of document.querySelectorAll('.pin, .dropStage, .isoStageWrap, .platHead, .deckHead')) {
          if (getComputedStyle(el).position !== 'sticky') continue;
          const r = el.getBoundingClientRect();
          if (r.height > innerHeight + 2) {
            out.tallPin.push(((el.id || el.className) + '').slice(0, 40) + ' h=' + Math.round(r.height));
          }
        }
        return out;
      });
      if (bad.scrollW > bad.innerW + 1) { note(`${tag} step${i}: horizontal overflow ${bad.scrollW} > ${bad.innerW}`); break; }
      if (bad.wide.length) { note(`${tag} step${i}: wider than viewport → ${bad.wide.slice(0, 3).join(' | ')}`); break; }
      if (bad.tallPin.length) { note(`${tag} step${i}: sticky stage taller than viewport → ${bad.tallPin.join(' | ')}`); break; }

      if (SHOTS && i % 8 === 0) await page.screenshot({ path: `qa-shots/${vp.name}-${theme}-${i}.png` });
      await checkStranded(page, tag, i);
    }

    if (errs.length) note(`${tag}: console → ${[...new Set(errs)].slice(0, 3).join(' | ')}`);
    await ctx.close();
    process.stdout.write(failures.length > before ? 'x' : '.');
  }
}

/* ── 2. reduced motion: everything readable, nothing scrubbed ────────── */
{
  const vp = { name: 'reduced-motion', w: 1440, h: 900 };
  const { ctx, page, errs } = await open(vp, { reduce: true });
  const before = failures.length;
  const r = await page.evaluate(() => {
    scrollTo(0, document.documentElement.scrollHeight / 2);
    return { rm: document.body.classList.contains('rm'), nopin: document.body.classList.contains('nopin') };
  });
  if (!r.rm) note('reduced motion: body.rm never set');
  if (!r.nopin) note('reduced motion: pins not disabled (body.nopin missing)');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(600);
  const hidden = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.isoStep, .platBody, .dropCards article, .deckInner, .nlist li')) {
      if (parseFloat(getComputedStyle(el).opacity) < 0.99) out.push((el.className + '').slice(0, 40));
    }
    return out;
  });
  if (hidden.length) note(`reduced motion: not fully opaque → ${[...new Set(hidden)].join(' | ')}`);
  if (errs.length) note(`reduced motion: console → ${[...new Set(errs)].slice(0, 2).join(' | ')}`);
  await ctx.close();
  process.stdout.write(failures.length > before ? 'x' : '.');
}

/* ── 3. short viewport: the pin policy must switch to static ─────────── */
{
  const vp = { name: 'short', w: 1024, h: 500 };
  const { ctx, page, errs } = await open(vp);
  const before = failures.length;
  const r = await page.evaluate(() => ({
    nopin: document.body.classList.contains('nopin'),
    sticky: [...document.querySelectorAll('.pin, .dropStage, .deckCard')]
      .filter(e => getComputedStyle(e).position === 'sticky')
      .map(e => (e.id || e.className + '').slice(0, 30)),
  }));
  if (!r.nopin) note('short viewport (500px): body.nopin not set — pins should be off');
  if (r.sticky.length) note(`short viewport: still sticky → ${[...new Set(r.sticky)].slice(0, 4).join(' | ')}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (overflow) note('short viewport: horizontal overflow');
  if (errs.length) note(`short viewport: console → ${[...new Set(errs)].slice(0, 2).join(' | ')}`);
  await ctx.close();
  process.stdout.write(failures.length > before ? 'x' : '.');
}

/* ── 4. scrubbed sections must reverse cleanly ───────────────────────── */
{
  const vp = { name: 'reverse', w: 1440, h: 900 };
  const { ctx, page, errs } = await open(vp);
  const before = failures.length;
  const probe = () => page.evaluate(() => {
    const q = s => document.querySelector(s);
    return {
      hub: q('.cflHub') && q('.cflHub').getAttribute('opacity'),
      slabs: document.querySelectorAll('.isoSlab.on').length,
      disc: q('#dropDisc') && q('#dropDisc').style.transform,
    };
  });
  const top = await page.evaluate(() => document.getElementById('gap').getBoundingClientRect().top + scrollY);
  await page.evaluate(y => scrollTo(0, y), top + 200);
  await page.waitForTimeout(400);
  const down = await probe();
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight * 0.8));
  await page.waitForTimeout(400);
  await page.evaluate(y => scrollTo(0, y), top + 200);
  await page.waitForTimeout(700);
  const back = await probe();
  for (const k of ['hub', 'slabs', 'disc']) {
    if (String(down[k]) !== String(back[k])) {
      note(`reverse: ${k} did not return (down=${down[k]} back=${back[k]})`);
    }
  }
  if (errs.length) note(`reverse: console → ${[...new Set(errs)].slice(0, 2).join(' | ')}`);
  await ctx.close();
  process.stdout.write(failures.length > before ? 'x' : '.');
}

await browser.close();
console.log('\n');
if (failures.length) {
  console.log(`${failures.length} failure(s):`);
  for (const f of failures) console.log('  ' + f);
  process.exit(1);
}
console.log(`clean — ${VIEWPORTS.length} viewports x 2 themes, plus reduced motion, short viewport and reverse-scroll`);
