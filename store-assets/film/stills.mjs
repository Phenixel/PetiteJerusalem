// Images fixes du film : node stills.mjs <dossier> <t1> <t2> ...
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const here = dirname(fileURLToPath(import.meta.url));
const [outDir, ...times] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1440 } });
page.on("pageerror", (e) => console.error("page:", e.message));
page.on("console", (m) => console.log("console:", m.text()));
await page.goto("file://" + resolve(here, "film.html") + "?render");
await page.evaluate(() => window.ready);
for (const t of times) {
  const data = await page.evaluate((t) => { window.seek(+t); return document.getElementById("c").toDataURL("image/png"); }, t);
  const name = resolve(outDir, `t${String(t).padStart(5, "0")}.png`);
  writeFileSync(name, Buffer.from(data.split(",")[1], "base64"));
  console.log(name);
}
await browser.close();
