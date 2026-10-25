// dev helper: load /studio.html headless with software WebGL, fly into a region, log console problems, take shots
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const [region = "konkan", name = "studio", wh = "1440x900", extra = ""] = process.argv.slice(2);
const [w, h] = wh.split("x").map(Number);
mkdirSync("qa-shots", { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: "dark", deviceScaleFactor: 1 });
const logs = [];
page.on("console", m => { if (["error", "warning"].includes(m.type())) logs.push(m.type() + ": " + m.text().slice(0, 300)); });
page.on("pageerror", e => logs.push("pageerror: " + (e.stack || e.message).slice(0, 700)));
await page.goto((process.env.QA_BASE || "http://localhost:5173") + "/studio.html?region=" + region, { waitUntil: "load" });
await page.addStyleTag({ content: "html{scroll-behavior:auto!important}" });
await page.evaluate(() => document.getElementById("studio").scrollIntoView());
await page.waitForTimeout(Number(process.env.WAIT || 14000));
if (extra) await page.evaluate(extra);
await page.waitForTimeout(2500);
if (process.env.STAGE) await page.locator("#stuStage").screenshot({ path: `qa-shots/${name}.png` }); else await page.screenshot({ path: `qa-shots/${name}.png` });
if (process.env.STACK) {
  await page.evaluate(() => document.getElementById("stack").scrollIntoView());
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `qa-shots/${name}-stack.png` });
}
console.log(logs.length ? logs.join("\n") : "no console errors");
console.log("shot → qa-shots/" + name + ".png");
await browser.close();
