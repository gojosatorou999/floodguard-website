import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:5173/', { waitUntil: 'load' });
await p.addStyleTag({content:'html{scroll-behavior:auto!important}'});
await p.waitForTimeout(2000);
for (const y of [6200, 6800, 7400, 8000, 8600, 9200, 9500]) {
  await p.evaluate(v => scrollTo(0, v), y);
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => ({
    on: document.querySelectorAll('#isoStage .isoSlab.on').length,
    act: [...document.querySelectorAll('#isoStage .isoSlab')].findIndex(e => e.classList.contains('act')),
    steps: [...document.querySelectorAll('.isoStep')].map(e => {
      const r = e.getBoundingClientRect();
      return Math.round(r.top) + '..' + Math.round(r.bottom);
    }),
  }));
  console.log(y, 'slabsOn=' + r.on, 'active=' + r.act, r.steps.join(' '));
}
await b.close();
