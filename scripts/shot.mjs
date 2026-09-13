/**
 * Screenshot one scroll position — for eyeballing a section while working.
 *
 *   node scripts/shot.mjs <scrollY> <name> [WxH] [light|dark]
 *   node scripts/shot.mjs 8300 iso-stack 1440x900 dark
 *
 * Writes to qa-shots/<name>.png. Needs a server (npm run dev), or QA_BASE.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [y, name = 'shot', wh = '1440x900', theme = 'light'] = process.argv.slice(2);
if (y === undefined) {
  console.error('usage: node scripts/shot.mjs <scrollY> <name> [WxH] [light|dark]');
  process.exit(1);
}
const [w, h] = wh.split('x').map(Number);
mkdirSync('qa-shots', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: theme });
await page.goto(process.env.QA_BASE || 'http://localhost:5173/', { waitUntil: 'load' });
/* smooth scrolling would still be in flight when the shot is taken */
await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
await page.waitForTimeout(2200);
await page.evaluate(v => scrollTo(0, v), Number(y));
await page.waitForTimeout(1000);
await page.screenshot({ path: `qa-shots/${name}.png` });
console.log(`qa-shots/${name}.png @ y=${await page.evaluate(() => Math.round(scrollY))}`);
await browser.close();
