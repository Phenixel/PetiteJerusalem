// Planche contact : node sheet.mjs <sortie.png> <colonnes> <t1> <t2> ...
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const here = dirname(fileURLToPath(import.meta.url));
const [out, cols, ...times] = process.argv.slice(2);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1440 } });
page.on("pageerror", (e) => console.error("page:", e.message));
await page.goto("file://" + resolve(here, "film.html") + "?render");
await page.evaluate(() => window.ready);
const data = await page.evaluate(({ cols, times }) => {
  const cell = 480, n = times.length, rows = Math.ceil(n / cols);
  const sheet = Object.assign(document.createElement("canvas"), { width: cols * cell, height: rows * cell });
  const g = sheet.getContext("2d");
  times.forEach((t, i) => {
    window.seek(+t);
    const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
    g.drawImage(document.getElementById("c"), x, y, cell, cell);
    g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(x, y, 90, 30);
    g.fillStyle = "#fff"; g.font = "600 18px Manrope"; g.fillText(t + " s", x + 8, y + 21);
  });
  return sheet.toDataURL("image/png");
}, { cols: +cols, times });
writeFileSync(out, Buffer.from(data.split(",")[1], "base64"));
await browser.close();
