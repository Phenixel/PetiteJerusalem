#!/usr/bin/env node
/**
 * Films the app, screen by screen, for the videos: public/captures/*.jpg.
 *
 * The native app, not the site: like scripts/store-screenshots.mjs, each
 * page loads with a "home-made" Capacitor platform, so the interface is the
 * installed app's (tab bar, gestures, tips turned off). Animations stay on,
 * and some shots are sequences: a prayer time row pulled with a finger, the
 * compass turning, a box being checked; each frame is a screenshot, placed
 * on the video's grid by Remotion.
 *
 * Screen: 390×800 points at density 3 (1170×2400), the video's phone minus
 * its status bar, drawn on top.
 *
 * Two sets of shots:
 *  - `v4` (default): version 4.0, scripts/shots-v4.mjs, filmed on today's
 *    app, and for the "before" shots on the 3.10 app (see BEFORE_PORT);
 *  - `v3`: series 1 and 2, scripts/shots.mjs, filmed on 3.10: they can only
 *    be filmed again on a copy of the app at that tag.
 *
 * Usage: npm run captures [-- --set v3] [-- --only fr-daf] (exact name, repeatable)
 * Starts scripts/demo-server.mjs if it is not already running.
 */
import { fork } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { BEFORE_PORT, DEMO_PORT } from "./ports.mjs";
import { STREAK_DAYS, seedParcours } from "./demo-parcours.mjs";

const root = join(import.meta.dirname, "..");
const outDir = join(root, "public/captures");
mkdirSync(outDir, { recursive: true });

const arg = (name) => process.argv.flatMap((a, i, argv) => (a === name ? [argv[i + 1]] : []));
const set = arg("--set")[0] ?? "v4";
const { SHOTS } = await import(set === "v3" ? "./shots.mjs" : "./shots-v4.mjs");

// Onboarding version and tip list, read from the app's code like
// store-screenshots does: marked as seen, they cover no screenshot, even
// after one is added. The "before" app has its own, read from its copy.
function seenFlags(appRoot) {
  const src = join(appRoot, "src/composables");
  const onboarding = readFileSync(join(src, "useOnboarding.ts"), "utf8").match(
    /const ONBOARDING_VERSION = "([^"]+)"/,
  )?.[1];
  const tips = [
    ...(readFileSync(join(src, "useFeatureTips.ts"), "utf8")
      .match(/export const TIP_IDS[^=]*=\s*\[([^\]]*)\]/)?.[1]
      .matchAll(/"([a-z-]+)"/g) ?? []),
  ].map((m) => m[1]);
  if (!onboarding || tips.length === 0) {
    throw new Error(`captures: onboarding version or tips not found in ${appRoot}`);
  }
  return { onboarding, tips };
}
const APPS = {
  now: { url: `http://localhost:${DEMO_PORT}`, flags: seenFlags(join(root, "..")) },
  before: { url: `http://localhost:${BEFORE_PORT}`, flags: null },
};
const VIEWPORT = { width: 390, height: 800 };
const PARIS = { latitude: 48.8566, longitude: 2.3522 };

const only = arg("--only");
const shots = only.length ? SHOTS.filter((s) => only.includes(s.name)) : SHOTS;

async function up(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

let server = null;
if (!(await up(APPS.now.url))) {
  server = fork(join(root, "scripts/demo-server.mjs"), { stdio: "inherit" });
  await new Promise((resolve, reject) => {
    server.once("message", resolve);
    server.once("exit", (code) => reject(new Error(`demo-server stopped (${code})`)));
  });
}
if (shots.some((s) => s.look?.app === "before")) {
  if (!(await up(APPS.before.url))) {
    throw new Error(
      `captures: the "before" shots film the 3.10 app on port ${BEFORE_PORT}. ` +
        'Prepare its copy and hand it to the demo server (promo/README.md, "Before and after").',
    );
  }
  APPS.before.flags = seenFlags(process.env.PROMO_BEFORE_DIR ?? join(root, "../../pj-v3"));
}

const browser = await chromium.launch({
  executablePath: process.env.PROMO_CHROMIUM || undefined,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

// The demo class really plays: a silence as long as the class, served in
// place of its fictitious address (the player then shows its real length
// and moves forward).
const SILENCE = join(root, "public/captures/.silence.mp3");

/**
 * A "native app" context, in the wanted theme, signed in to the demo account.
 *
 * - `locale`: the interface language;
 * - `clock`: a frozen date and time (ISO). With an account, only in the
 *   past: a token issued by the emulator stays valid for a clock running
 *   late, not for one running ahead;
 * - `holidays`: let the theme of the current holiday apply;
 * - `app`: "before" for the 3.10 app;
 * - `parcours`: lay down the demo Mon parcours (demo-parcours.mjs);
 * - `mocks`: the demo « Nous écrire » thread and the class audio;
 * - `android`: the Android app, with a phone whose quiet modes answer
 *   (the PjQuiet plugin, played here): the panel a tefila opens on.
 */
async function appContext({
  theme = "sunset",
  scheme = "light",
  signedIn = true,
  locale = "fr",
  clock,
  holidays = false,
  app = "now",
  parcours = false,
  mocks = false,
  android = false,
}) {
  const { url: baseUrl, flags } = APPS[app];
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: { fr: "fr-FR", en: "en-US", he: "he-IL" }[locale],
    timezoneId: "Europe/Paris",
    colorScheme: scheme,
    geolocation: PARIS,
    permissions: ["geolocation", "notifications", "camera"],
  });
  await context.addInitScript(
    ({ prefs, onboardingVersion, tipIds, locale, android }) => {
      window.CapacitorCustomPlatform = { name: android ? "android" : "promo-videos" };
      if (android) {
        // The phone's quiet modes, as the PjQuiet plugin gives them: all off,
        // Do Not Disturb access granted, each change applied.
        const phone = { dnd: false, ringer: "normal", access: true };
        const methods = ["getState", "start", "stop", "setDnd", "setRinger", "openAccessSettings"];
        window.Capacitor = {
          PluginHeaders: [{ name: "PjQuiet", methods: methods.map((name) => ({ name, rtype: "promise" })) }],
          nativePromise: async (plugin, method, options) => {
            if (plugin !== "PjQuiet") throw new Error(`${plugin} is not played here`);
            if (method === "setDnd") phone.dnd = options.on;
            if (method === "setRinger") phone.ringer = options.mode;
            if (method === "openAccessSettings") return { opened: false };
            return { ...phone, applied: true };
          },
        };
      }
      localStorage.setItem("petite-jerusalem-locale", locale);
      localStorage.setItem("pj_analytics_consent", "denied");
      // Onboarding and tips seen: they would take over the screen.
      localStorage.setItem("pj_onboarding_seen", onboardingVersion);
      localStorage.setItem("pj_tips_seen", JSON.stringify(tipIds));
      localStorage.setItem("pj-preferences:guest", JSON.stringify(prefs));
      // No scrollbar in the screenshots.
      const style = document.createElement("style");
      style.textContent = "::-webkit-scrollbar{display:none} *{scrollbar-width:none}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
    },
    {
      prefs: { theme, colorScheme: scheme, holidayThemes: holidays, fontLatin: "manrope", fontHebrew: "frank" },
      onboardingVersion: flags.onboarding,
      tipIds: flags.tips,
      locale,
      android,
    },
  );
  if (clock) await context.clock.setFixedTime(new Date(clock));
  if (mocks) await installMocks(context, clock ? new Date(clock).getTime() : Date.now(), locale);
  const page = await context.newPage();
  if (signedIn) {
    await page.goto(`${baseUrl}/login`, { waitUntil: "load" });
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', "demo@petite-jerusalem.fr");
    await page.fill('input[type="password"]', "demo-petite-jerusalem");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
    // The account's theme wins over the guest's: align it.
    await page
      .evaluate(
        async ({ theme, scheme }) => {
          const { userPreferencesService } = await import("/src/services/userPreferencesService.ts");
          const { auth } = await import("/src/firebase/core.ts");
          await userPreferencesService.savePreferences(auth.currentUser.uid, { theme, colorScheme: scheme });
        },
        { theme, scheme },
      )
      .catch((e) => console.warn("captures: account theme not set", e.message));
    if (set === "v3") {
      // The account's personal dates reach the device on the first visit to
      // the home page: without it, a calendar opened right away does not
      // show them yet.
      for (let attempt = 1; ; attempt++) {
        await page.goto(`${baseUrl}/`, { waitUntil: "load" });
        try {
          await page.locator("text=Anniversaire de Noa >> visible=true").first().waitFor({ timeout: 15000 });
          break;
        } catch (error) {
          if (attempt === 3) throw error;
        }
      }
    }
    if (parcours) {
      await page.goto(`${baseUrl}/`, { waitUntil: "load" });
      await page.waitForTimeout(2500);
      await page.evaluate(seedParcours, { streak: STREAK_DAYS, locale });
    }
  }
  return { context, page, baseUrl, locale };
}

/** The demo « Nous écrire » thread, and the class audio (see SILENCE). */
async function installMocks(context, now, locale) {
  if (!existsSync(SILENCE)) {
    const { execFileSync } = await import("node:child_process");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=22050:cl=mono", "-t", "2520", "-c:a", "libmp3lame", "-b:a", "8k", SILENCE]);
  }
  const mp3 = readFileSync(SILENCE);
  await context.route("https://demo.petite-jerusalem.fr/**", (route) =>
    route.fulfill({ status: 200, contentType: "audio/mpeg", body: mp3, headers: { "Accept-Ranges": "bytes" } }),
  );
  const DAY = 86400000;
  const thread = SUPPORT_THREAD[locale];
  // Cloud Functions do not run in the demo: the thread list answers from
  // here, with a question and the team's reply.
  await context.route("**/listSupportThreads", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          threads: [
            {
              id: "demo-fil",
              kind: "idea",
              otherKind: "",
              status: "answered",
              unread: true,
              createdAt: now - 2 * DAY,
              updatedAt: now - 2 * 3600000,
              messages: [
                { from: "user", text: thread.question, at: now - 2 * DAY },
                { from: "team", text: thread.answer, at: now - 2 * 3600000 },
              ],
              contact: "",
              support: "app",
              platform: "ios",
              version: "3.10.11",
              page: "/bibliotheque",
            },
          ],
        },
      }),
    }),
  );
}

const SUPPORT_THREAD = {
  fr: {
    question: "Bonjour ! Serait-il possible d'avoir le Kitsour Choulhan Aroukh dans l'app ?",
    answer: "Bonjour Sarah, bonne nouvelle : il arrive avec la version 4.0, dans le nouveau rayon Halakha. Merci pour l'idée !",
  },
  en: {
    question: "Hello! Could you add the Kitzur Shulchan Aruch to the app?",
    answer: "Hello Sarah, good news: it comes with version 4.0, on the new Halakha shelf. Thank you for the idea!",
  },
  he: {
    question: "שלום! אפשר להוסיף לאפליקציה את הקיצור שולחן ערוך?",
    answer: "שלום שרה, חדשות טובות: הוא מגיע עם גרסה 4.0, במדף ההלכה החדש. תודה על הרעיון!",
  },
};

// Areas located in the screenshots (a button, a card), in screen points:
// the edit places a finger, a frame or a zoom there.
const marksFile = join(outDir, "marks.json");
const marks = existsSync(marksFile) ? JSON.parse(readFileSync(marksFile, "utf8")) : {};

/** Tools given to each shot to stage and film itself. */
function tools({ page, baseUrl, locale }, shot) {
  let frame = 0;
  const cdp = page.context().newCDPSession(page);
  const touch = async (type, x, y) =>
    (await cdp).send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y, radiusX: 8, radiusY: 8, force: 1 }],
    });
  const strings = new Map();
  const t = {
    page,
    locale,
    async open(path, ready) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      if (typeof ready === "string") {
        await page.locator(`text=${ready} >> visible=true`).first().waitFor({ timeout: 20000 });
      } else if (ready?.css) {
        await page.locator(`${ready.css} >> visible=true`).first().waitFor({ timeout: 20000 });
      }
      await page.waitForTimeout(1800);
    },
    /** An interface label, in the shot's language (a src/locales key). */
    async L(key) {
      if (!strings.has(key)) {
        const value = await page.evaluate(
          async ({ key, locale }) => {
            const mod = await import(`/src/locales/${locale}.ts`);
            return key.split(".").reduce((o, k) => o?.[k], mod.default);
          },
          { key, locale },
        );
        if (typeof value !== "string") throw new Error(`label not found: ${key}`);
        strings.set(key, value);
      }
      return strings.get(key);
    },
    /** One frame of the sequence (or the shot's single image). */
    async snap(suffix) {
      const name = suffix ?? (shot.frames ? String(frame++).padStart(2, "0") : null);
      const file = name ? `${shot.name}-${name}.jpg` : `${shot.name}.jpg`;
      writeFileSync(join(outDir, file), await page.screenshot({ type: "jpeg", quality: 92 }));
      return file;
    },
    /** `count` frames of the sequence, `every` ms apart. */
    async film(count, every = 0) {
      for (let i = 0; i < count; i++) {
        if (every) await page.waitForTimeout(every);
        await t.snap();
      }
    },
    /**
     * The whole page, for a scroll done in the edit. Capped at 2,400 points:
     * beyond that, the JPEG exceeds what Chromium can encode (a session of
     * 150 psalms, a whole service) and comes out empty.
     */
    async snapFull(suffix = "full") {
      const file = `${shot.name}-${suffix}.jpg`;
      // Without what is fixed on screen (tab bar, round button): frozen in
      // the middle of the whole page, it would scroll with it. The edit puts
      // the bar back on top (Scroll, `chrome`).
      const height = await page.evaluate(() => {
        for (const el of document.querySelectorAll("body *")) {
          const position = getComputedStyle(el).position;
          if (position === "fixed" || position === "sticky") el.setAttribute("data-promo-hidden", el.style.visibility || "-");
        }
        document.querySelectorAll("[data-promo-hidden]").forEach((el) => (el.style.visibility = "hidden"));
        return Math.min(2400, document.documentElement.scrollHeight);
      });
      writeFileSync(
        join(outDir, file),
        await page.screenshot({ type: "jpeg", quality: 90, fullPage: true, clip: { x: 0, y: 0, width: VIEWPORT.width, height } }),
      );
      await page.evaluate(() =>
        document.querySelectorAll("[data-promo-hidden]").forEach((el) => {
          const before = el.getAttribute("data-promo-hidden");
          el.style.visibility = before === "-" ? "" : before;
          el.removeAttribute("data-promo-hidden");
        }),
      );
      return file;
    },
    /** One element alone, on a transparent background, to pop it out of the phone. */
    async snapElement(locator, suffix) {
      const file = `${shot.name}-${suffix}.png`;
      writeFileSync(join(outDir, file), await locator.screenshot({ type: "png", omitBackground: true }));
      return file;
    },
    touch,
    /** A short tap with a finger (touch pointer events, as on the phone). */
    async tap(x, y) {
      await touch("touchStart", x, y);
      await page.waitForTimeout(70);
      await touch("touchEnd", x, y);
    },
    async tapOn(locator) {
      const box = await locator.first().boundingBox();
      if (!box) throw new Error("tapOn: element not visible");
      await t.tap(box.x + box.width / 2, box.y + box.height / 2);
    },
    /**
     * Slows CSS animations down (transitions included): a 300 ms animation
     * slowed to 0.1 lasts three seconds, time enough to take ten frames.
     */
    async slow(rate) {
      const session = await cdp;
      await session.send("Animation.enable");
      await session.send("Animation.setPlaybackRate", { playbackRate: rate });
    },
    /** Removes from the screen what does not concern the video (a demo warning). */
    async remove(css) {
      await page.evaluate((css) => document.querySelectorAll(css).forEach((el) => el.remove()), css);
    },
    wait: (ms) => page.waitForTimeout(ms),
    /** Records an element's area, as it is on screen. */
    async mark(key, target) {
      const box = target.card
        ? await page.evaluate((text) => {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
              if (!node.textContent.includes(text)) continue;
              let el = node.parentElement;
              if (!el || el.getBoundingClientRect().width === 0) continue;
              while (el && el !== document.body) {
                const cs = getComputedStyle(el);
                const filled = cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent";
                if (cs.boxShadow !== "none" || (filled && parseFloat(cs.borderRadius) > 0)) {
                  const r = el.getBoundingClientRect();
                  return { x: r.x, y: r.y, width: r.width, height: r.height };
                }
                el = el.parentElement;
              }
            }
            return null;
          }, target.card)
        : await target.first().boundingBox();
      if (!box) throw new Error(`area not found: ${key}`);
      marks[`${shot.name}:${key}`] = {
        x: Math.round(box.x),
        y: Math.round(box.y),
        w: Math.round(box.width),
        h: Math.round(box.height),
      };
    },
  };
  return t;
}

const failed = [];
// Shots with the same look share a context (one sign-in).
const groups = new Map();
for (const shot of shots) {
  const key = JSON.stringify(shot.look ?? {});
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(shot);
}
try {
  for (const [key, group] of groups) {
    const look = JSON.parse(key);
    let env;
    try {
      env = await appContext(look);
    } catch (error) {
      console.error(`captures: look ${key} could not be prepared`, error.message);
      failed.push(...group.map((shot) => shot.name));
      continue;
    }
    try {
      for (const shot of group) {
        try {
          await shot.run(tools(env, shot));
          console.log(`captures: ${shot.name}`);
        } catch (error) {
          console.error(`captures: ${shot.name} failed`, error.message);
          failed.push(shot.name);
        }
      }
    } finally {
      await env.context.close();
    }
  }
} finally {
  writeFileSync(marksFile, `${JSON.stringify(marks, null, 2)}\n`);
  await browser.close();
  server?.kill("SIGINT");
}
if (failed.length) {
  console.error(`captures: ${failed.length} shot(s) failed: ${failed.join(", ")}`);
  process.exit(1);
}
