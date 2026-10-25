// dev check for the webinar funnel: banner, hero card, popup behaviour, link audit
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { readFileSync } from "node:fs";
mkdirSync("qa-shots", { recursive: true });
const BASE = process.env.QA_BASE || "http://localhost:5173";
const URL_ = JSON.parse(readFileSync("webinar.config.json", "utf8")).url;
const browser = await chromium.launch();
const out = [];
const ok = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);

async function run(label, vp, scheme) {
  const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme });
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  page.on("pageerror", e => errs.push("pageerror " + e.message));
  await page.goto(BASE + "/index.html", { waitUntil: "load" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `qa-shots/wb-${label}-hero.png` });
  ok(`${label}: banner present`, await page.locator(".wbBar").first().isVisible());
  ok(`${label}: hero card present`, await page.locator(".wbHero").isVisible());
  ok(`${label}: no popup before delay`, !(await page.locator("dialog.wbDlg[open]").count()));
  await page.waitForTimeout(2600);
  ok(`${label}: popup opens after ~2.6s`, await page.locator("dialog.wbDlg[open]").count() === 1);
  await page.screenshot({ path: `qa-shots/wb-${label}-popup.png` });
  const locked = await page.evaluate(() => getComputedStyle(document.documentElement).overflow);
  ok(`${label}: page scroll locked`, locked === "hidden", locked);
  const focusTxt = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 20));
  ok(`${label}: focus on primary CTA`, /Reserve/.test(focusTxt || ""), focusTxt);
  const href = await page.locator(".wbDlg .wbGo").getAttribute("href");
  ok(`${label}: popup CTA uses configured URL`, href === URL_);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok(`${label}: Escape closes`, await page.locator("dialog.wbDlg").count() === 0);
  ok(`${label}: scroll restored`, (await page.evaluate(() => getComputedStyle(document.documentElement).overflow)) !== "hidden");
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(4200);
  ok(`${label}: not shown again this session`, await page.locator("dialog.wbDlg").count() === 0);
  ok(`${label}: banner still visible after dismiss`, await page.locator(".wbBar").first().isVisible());
  // a fresh session shows it again; check "Maybe later" and backdrop click
  const ctx2 = await browser.newContext({ viewport: vp, colorScheme: scheme });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + "/index.html", { waitUntil: "load" });
  await p2.waitForSelector("dialog.wbDlg[open]", { timeout: 8000 });
  await p2.locator(".wbLater").click(); await p2.waitForTimeout(1500);
  ok(`${label}: "Maybe later" closes`, await p2.locator("dialog.wbDlg").count() === 0);
  const ctx3 = await browser.newContext({ viewport: vp, colorScheme: scheme });
  const p3 = await ctx3.newPage();
  await p3.goto(BASE + "/index.html", { waitUntil: "load" });
  await p3.waitForSelector("dialog.wbDlg[open]", { timeout: 8000 });
  await p3.mouse.click(5, 5); await p3.waitForTimeout(1500);
  ok(`${label}: backdrop click closes`, await p3.locator("dialog.wbDlg").count() === 0);
  // every data-webinar anchor resolves to the configured URL
  const hrefs = await p3.$$eval("a[data-webinar]", as => as.map(a => a.getAttribute("href")));
  ok(`${label}: ${hrefs.length} data-webinar links on home, all configured`, hrefs.length > 8 && hrefs.every(h => h === URL_));
  const overflowX = await p3.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`${label}: no horizontal overflow`, overflowX <= 1, String(overflowX));
  ok(`${label}: no console errors`, errs.filter(e => !/favicon|Failed to load resource/.test(e)).length === 0, errs.join(" | ").slice(0, 200));
  await ctx.close(); await ctx2.close(); await ctx3.close();
}
await run("desktop", { width: 1440, height: 900 }, "dark");
await run("mobile", { width: 390, height: 844 }, "light");

// a content page: banner above the nav, links
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const pg = await ctx.newPage();
await pg.goto(BASE + "/platform.html", { waitUntil: "load" });
await pg.waitForTimeout(800);
await pg.screenshot({ path: "qa-shots/wb-platform.png" });
ok("platform: banner above nav", await pg.evaluate(() => document.querySelector(".wbBar").getBoundingClientRect().bottom <= document.querySelector(".topbar").getBoundingClientRect().top + 12));
ok("platform: no popup on content pages", await pg.locator("dialog.wbDlg").count() === 0);
await browser.close();
console.log(out.join("\n"));
