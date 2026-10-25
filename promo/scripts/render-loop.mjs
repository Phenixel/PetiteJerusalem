#!/usr/bin/env node
/**
 * Renders the shape loop (promo/loop/shape-loop.html) in Chromium.
 *
 *   node scripts/render-loop.mjs --check            purity and loop seam
 *   node scripts/render-loop.mjs --contact out/c    contact sheets around each key time
 *   node scripts/render-loop.mjs --frames 0,30 out/f   single frames as PNG
 *   node scripts/render-loop.mjs --video            out/loop-story.mp4 (60 fps)
 *                                                    and out/loop-whatsapp.mp4 (30 fps)
 *
 * Frame n is window.renderAt(n / 60), with its motion blur. The WhatsApp
 * file keeps one frame out of two of the same render.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const page_url = pathToFileURL(join(root, "loop/shape-loop.html")).href;

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    // The cloud sessions ship a global Playwright.
    return createRequire(import.meta.url)(join(process.env.NODE_PATH ?? "/opt/node-tools/node_modules", "playwright"));
  }
}

async function openLoop() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 2100 } });
  await page.goto(page_url);
  await page.evaluate(() => window.loopReady);
  const loop = await page.evaluate(() => ({ ...window.LOOP }));
  return { browser, page, loop };
}

/** PNG of frame n, as a Buffer. */
async function framePng(page, n, fps = 60) {
  const url = await page.evaluate(
    ([n, fps]) => {
      window.renderAt(n / fps);
      return document.getElementById("frame").toDataURL("image/png");
    },
    [n, fps],
  );
  return Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
}

async function check(page, loop) {
  const result = await page.evaluate(({ D, FRAMES }) => {
    const canvas = document.getElementById("frame");
    const ctx = canvas.getContext("2d");
    const grab = (t) => {
      window.renderAt(t);
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data.slice();
    };
    const diff = (a, b) => {
      let sum = 0, max = 0;
      for (let i = 0; i < a.length; i++) {
        const d = Math.abs(a[i] - b[i]);
        sum += d; if (d > max) max = d;
      }
      return { mean: sum / a.length, max };
    };
    const f123a = grab(123 / 60), f123b = grab(123 / 60);
    const f0 = grab(0), f14 = grab(D), f28 = grab(2 * D);
    const last = grab((FRAMES - 1) / 60), f1 = grab(1 / 60);
    return {
      pure: diff(f123a, f123b),
      t0_vs_t14: diff(f0, f14),
      t0_vs_t28: diff(f0, f28),
      seam_last_to_0: diff(last, f0),
      step_0_to_1: diff(f0, f1),
    };
  }, loop);
  console.log(JSON.stringify(result, null, 2));
  const ok = result.pure.max === 0 && result.t0_vs_t14.max === 0 && result.t0_vs_t28.max === 0;
  console.log(ok ? "OK: pure and exact at the seam" : "FAILED");
  if (!ok) process.exitCode = 1;
}

/** Contact sheets: one row per key time (n-2 to n+2), plus the seam. */
async function contact(page, loop, dir) {
  mkdirSync(dir, { recursive: true });
  const keys = [...new Set(Object.values(loop.T))].sort((a, b) => a - b).map((t) => Math.round(t * 60));
  const rows = keys.map((n) => ({ title: `${(n / 60).toFixed(1)} s`, frames: [n - 2, n - 1, n, n + 1, n + 2] }));
  rows.push({ title: "seam", frames: [loop.FRAMES - 2, loop.FRAMES - 1, 0, 1, 2] });
  // Settled states, a beat after each key: the critique reads them too.
  rows.push(...keys.map((n) => ({ title: `${(n / 60).toFixed(1)} s +0.4`, frames: [n + 24] })).reduce((acc, r, i) => {
    if (i % 5 === 0) acc.push({ title: "settled", frames: [] });
    acc[acc.length - 1].frames.push(r.frames[0]);
    return acc;
  }, []));
  const perSheet = 5;
  for (let s = 0; s * perSheet < rows.length; s++) {
    const sheetRows = rows.slice(s * perSheet, (s + 1) * perSheet);
    const url = await page.evaluate(
      ({ sheetRows, FRAMES }) => {
        const scale = 0.25, crop = [192, 1600];          // safe zone and signature
        const tw = 1080 * scale, th = (crop[1] - crop[0]) * scale, label = 32, gap = 8;
        const sheet = document.createElement("canvas");
        sheet.width = 5 * tw + 6 * gap;
        sheet.height = sheetRows.length * (th + label + gap) + gap;
        const c = sheet.getContext("2d");
        c.fillStyle = "#dddddd"; c.fillRect(0, 0, sheet.width, sheet.height);
        const src = document.getElementById("frame");
        sheetRows.forEach((row, r) => {
          row.frames.forEach((n, i) => {
            const f = ((n % FRAMES) + FRAMES) % FRAMES;
            window.renderAt(f / 60);
            const x = gap + i * (tw + gap), y = gap + r * (th + label + gap);
            c.drawImage(src, 0, crop[0], 1080, crop[1] - crop[0], x, y + label, tw, th);
            c.fillStyle = "#111111"; c.font = '700 20px "Manrope"';
            c.fillText(`#${f}  ${row.title}`, x + 4, y + 22);
          });
        });
        return sheet.toDataURL("image/png");
      },
      { sheetRows, FRAMES: loop.FRAMES },
    );
    const file = join(dir, `contact-${s + 1}.png`);
    writeFileSync(file, Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
    console.log(file);
  }
}

async function frames(page, list, dir) {
  mkdirSync(dir, { recursive: true });
  for (const n of list) {
    const file = join(dir, `frame-${String(n).padStart(3, "0")}.png`);
    writeFileSync(file, await framePng(page, n));
    console.log(file);
  }
}

async function video(page, loop) {
  const out = join(root, "out");
  mkdirSync(out, { recursive: true });
  const story = join(out, "loop-story.mp4"), whatsapp = join(out, "loop-whatsapp.mp4");
  const ffmpeg = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", "60", "-c:v", "png", "-i", "-",
    "-filter_complex", "[0:v]split=2[a][b];[b]select='not(mod(n\\,2))',setpts=N/30/TB[c]",
    // Instagram: the 60 fps master.
    "-map", "[a]", "-r", "60", "-c:v", "libx264", "-preset", "slow", "-crf", "14",
    "-profile:v", "high", "-level", "4.2", "-pix_fmt", "yuv420p", "-movflags", "+faststart", story,
    // WhatsApp: 30 fps, a light file that survives its recompression.
    "-map", "[c]", "-r", "30", "-c:v", "libx264", "-preset", "slow", "-b:v", "6M", "-maxrate", "8M", "-bufsize", "12M",
    "-profile:v", "high", "-level", "4.0", "-pix_fmt", "yuv420p", "-movflags", "+faststart", whatsapp,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((ok, ko) => ffmpeg.on("close", (code) => (code ? ko(new Error(`ffmpeg ${code}`)) : ok())));
  const hash = createHash("sha256");
  for (let n = 0; n < loop.FRAMES; n++) {
    const png = await framePng(page, n);
    hash.update(png);
    if (!ffmpeg.stdin.write(png)) await new Promise((ok) => ffmpeg.stdin.once("drain", ok));
    if (n % 60 === 0) process.stdout.write(`\r${n}/${loop.FRAMES}`);
  }
  ffmpeg.stdin.end();
  await done;
  console.log(`\r${loop.FRAMES}/${loop.FRAMES} frames, sha256 ${hash.digest("hex").slice(0, 16)}`);
  console.log(story);
  console.log(whatsapp);
}

const args = process.argv.slice(2);
const { browser, page, loop } = await openLoop();
try {
  if (args.includes("--check")) await check(page, loop);
  const c = args.indexOf("--contact");
  if (c >= 0) await contact(page, loop, resolve(args[c + 1] ?? join(root, "out/contact")));
  const f = args.indexOf("--frames");
  if (f >= 0) await frames(page, args[f + 1].split(",").map(Number), resolve(args[f + 2] ?? join(root, "out/frames")));
  if (args.includes("--video")) await video(page, loop);
} finally {
  await browser.close();
}
