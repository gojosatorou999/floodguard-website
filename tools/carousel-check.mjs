// dev check: carousel controls, autoplay, hover pause, drag, pagination pill and Lenis smooth scroll
import { chromium } from "playwright";
const BASE = process.env.QA_BASE || "http://localhost:5173";
const b = await chromium.launch();
const out = []; const ok = (n, c, x = "") => out.push(`${c ? "PASS" : "FAIL"}  ${n}${x ? " — " + x : ""}`);
async function open(vp) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: "light" });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("fg_webinar_invite", "1"); } catch (_) {} });
  const p = await ctx.newPage(); p.errs = [];
  p.on("pageerror", e => p.errs.push(e.message)); p.on("console", m => m.type() === "error" && p.errs.push(m.text()));
  await p.goto(BASE + "/index.html", { waitUntil: "load" });
  await p.addStyleTag({ content: "#cookie,[class*=cookie]{display:none!important}" });
  await p.evaluate(() => document.querySelector("#products .carWrap").scrollIntoView({ block: "center" }));
  await p.waitForTimeout(1800);
  return p;
}
const idx = p => p.evaluate(() => [...document.querySelectorAll("#products .carDot")].findIndex(d => d.getAttribute("aria-current") === "true"));
const until = async (p, want, ms = 7000) => { try { await p.waitForFunction(w => [...document.querySelectorAll("#products .carDot")].findIndex(d => d.getAttribute("aria-current") === "true") === w, want, { timeout: ms }); return true; } catch { return false; } };
const changes = async (p, from, ms) => { try { await p.waitForFunction(f => [...document.querySelectorAll("#products .carDot")].findIndex(d => d.getAttribute("aria-current") === "true") !== f, from, { timeout: ms }); return true; } catch { return false; } };
for (const [label, vp, N] of [["desktop", { width: 1440, height: 900 }, 2], ["mobile", { width: 390, height: 844 }, 3]]) {
  const p = await open(vp);
  ok(`${label}: prev + next buttons and ${N} stops`, await p.locator("#products .carBtn").count() === 2 && await p.locator("#products .carDot").count() === N);
  ok(`${label}: first stop starts active`, (await idx(p)) === 0);
  await p.locator('#products .carBtn[data-dir="1"]').click();
  ok(`${label}: next moves forward`, await until(p, 1));
  for (let k = 1; k < N; k++) await p.locator('#products .carBtn[data-dir="1"]').click().then(() => until(p, k + 1 === N ? 0 : k + 1));
  ok(`${label}: next past the last loops to the first`, (await idx(p)) === 0, String(await idx(p)));
  await p.locator('#products .carBtn[data-dir="-1"]').click();
  ok(`${label}: prev from the first loops to the last`, await until(p, N - 1));
  await p.waitForTimeout(900);
  const w = await p.evaluate(() => { const ds = [...document.querySelectorAll("#products .carDot")], a = ds.find(d => d.getAttribute("aria-current") === "true"), o = ds.find(d => d !== a); return [a.getBoundingClientRect().width, o.getBoundingClientRect().width]; });
  ok(`${label}: active dot is a wider pill`, w[0] > w[1] * 2, w.map(Math.round).join(" vs "));
  await p.mouse.move(5, 5);
  const a0 = await idx(p);
  ok(`${label}: autoplay advances by itself`, await changes(p, a0, 16000), `from ${a0}`);
  if (label === "desktop") {
    await p.locator("#products .carTrack").hover(); await p.waitForTimeout(600); const h0 = await idx(p);
    ok("desktop: hover pauses autoplay", !(await changes(p, h0, 5600)));
    await p.mouse.move(5, 5);
    ok("desktop: autoplay resumes on mouse-out", await changes(p, h0, 16000));
    await p.evaluate(() => document.querySelector("#products .carTrack").scrollTo({ left: 0, behavior: "instant" })); await until(p, 0);
    const box = await p.locator("#products .carTrack").boundingBox();
    await p.mouse.move(box.x + 900, box.y + 120); await p.mouse.down(); await p.mouse.move(box.x + 200, box.y + 120, { steps: 10 }); await p.mouse.up();
    ok("desktop: mouse drag moves the track", await until(p, 1));
  }
  ok(`${label}: no page errors`, p.errs.filter(e => !/favicon|Failed to load resource|\[vite\]/.test(e)).length === 0, p.errs.join("|").slice(0, 160));
  await p.screenshot({ path: `qa-shots/car-${label}.png` });
  await p.context().close();
}
{
  const p = await open({ width: 1440, height: 900 });
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(800);
  ok("lenis is running on desktop", await p.evaluate(() => !!window.__lenis && document.documentElement.classList.contains("lenis")));
  await p.mouse.move(700, 400); await p.mouse.wheel(0, 600);
  const samples = []; for (let i = 0; i < 10; i++) { await p.waitForTimeout(90); samples.push(Math.round(await p.evaluate(() => scrollY))); }
  const mono = samples.every((v, i) => !i || v >= samples[i - 1]);
  ok("wheel glides: many distinct positions, never backwards", new Set(samples).size >= 3 && mono && samples.at(-1) > 200, samples.join(","));
  await p.context().close();
}
await b.close();
console.log(out.join("\n"));
