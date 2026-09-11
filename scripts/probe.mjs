import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('qa-shots', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:5173/', { waitUntil: 'load' });
await p.waitForTimeout(2000);
const info = await p.evaluate(() => {
  const out = { docH: document.documentElement.scrollHeight, secs: [] };
  for (const s of document.querySelectorAll('section, .pinsec')) {
    const r = s.getBoundingClientRect();
    out.secs.push({ id: s.id || s.className, top: Math.round(r.top + scrollY), h: Math.round(r.height) });
  }
  out.nopin = document.body.classList.contains('nopin');
  out.cards = document.querySelectorAll('#problemHx .hc').length;
  out.slabs = document.querySelectorAll('#isoStage .isoSlab').length;
  return out;
});
console.log(JSON.stringify(info, null, 1));
await b.close();
