/* Dev-only render helper: rebuild index.html from the template, then
   screenshot it headlessly so layout can be checked instead of guessed.
   Usage: node _shot.cjs <out.png> <width> <height> [--flat] [--hide=sel,sel] */
const fs = require("fs");
const { execFileSync } = require("child_process");
const path = require("path");

const [, , out = "_s.png", w = "1440", h = "2400", ...rest] = process.argv;
const flat = rest.includes("--flat");
const hideArg = (rest.find((a) => a.startsWith("--hide=")) || "").replace("--hide=", "");

/* keep index.html in sync with the working template */
const tpl = fs.readFileSync("prototypes/homepage-template.html", "utf8");
const old = fs.readFileSync("index.html", "utf8");
const head = old.slice(0, old.indexOf("<style>"));
const ns = old.indexOf("<noscript>");
const ne = old.indexOf("</script>", ns) + 9;
const s = tpl.indexOf("<style>");
const e = tpl.indexOf("</style>") + 8;
const page =
  head + tpl.slice(s, e) + "\n" + old.slice(ns, ne) + "\n" + tpl.slice(e).trim() + "\n</body>\n</html>\n";
fs.writeFileSync("index.html", page);

let probe = `<style id="__probe">#pre{display:none!important}#cookie{display:none!important}`;
if (flat) {
  /* unpin everything and force revealed states so one tall capture shows real layout */
  probe += `
[data-rv],.mask>span,.ncard,.scard,.probList article,.prod,.prod .pbody{opacity:1!important;transform:none!important}
.pinsec,#decision{height:auto!important}
.pin,#deckPin{position:static!important;height:auto!important;min-height:0!important}
#hero{min-height:0!important;padding-top:7rem}
#stage{height:auto;perspective:none}
#hx{position:relative;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;inset:auto}
.hc{position:relative;left:auto;top:auto;width:225px;margin:0;transform:none!important;opacity:1!important}
.stackStage{height:auto;display:grid;gap:10px}
.scard{position:relative;top:auto;transform:none!important;opacity:1!important}`;
}
if (hideArg) probe += `\n${hideArg.split(",").join(",")}{display:none!important}`;
probe += `</style>`;

fs.writeFileSync("_probe.html", page.replace("</head>", probe + "</head>"));

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const abs = (f) => path.resolve(f).replace(/\//g, "\\");
try {
  execFileSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--virtual-time-budget=9000",
    `--window-size=${w},${h}`,
    `--screenshot=${abs(out)}`,
    abs("_probe.html"),
  ], { stdio: "ignore" });
} catch (_) {}
console.log(fs.existsSync(out) ? `${out} ${(fs.statSync(out).size / 1024).toFixed(0)}KB` : "screenshot failed");
