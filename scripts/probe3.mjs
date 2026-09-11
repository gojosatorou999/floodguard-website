import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:5173/', { waitUntil: 'load' });
await p.waitForTimeout(2000);
for (const y of [0, 3000, 6200, 7400, 9500]) {
  await p.evaluate(v => scrollTo(0, v), y);
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const t = id => { const e = document.getElementById(id); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : -1; };
    const h = id => { const e = document.getElementById(id); return e ? Math.round(e.getBoundingClientRect().height) : -1; };
    return { docH: document.documentElement.scrollHeight,
      problem: t('problem') + '/' + h('problem'),
      products: t('products') + '/' + h('products'),
      decision: t('decision') + '/' + h('decision'),
      isoRoot: t('isoRoot') + '/' + h('isoRoot') };
  });
  console.log(y, JSON.stringify(r));
}
await b.close();
