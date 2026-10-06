#!/usr/bin/env node
/**
 * Filme l'app, écran par écran, pour les vidéos : public/captures/*.jpg.
 *
 * L'app native, pas le site : comme scripts/store-screenshots.mjs, chaque
 * page se charge avec une plateforme Capacitor « maison », si bien que
 * l'interface est celle de l'app installée (barre d'onglets, gestes,
 * astuces coupées). Les animations restent allumées, et certains plans sont
 * des séquences : une ligne d'horaire tirée au doigt, la boussole qui
 * tourne, une case qui se coche ; chaque image est une capture, posée sur
 * la grille de la vidéo par Remotion.
 *
 * Écran : 390×800 points à la densité 3 (1170×2400), le téléphone de la
 * vidéo moins sa barre d'état, dessinée par-dessus.
 *
 * Usage : npm run captures [-- --only sunset-horaires-swipe] (nom exact, répétable)
 * Lance scripts/demo-server.mjs s'il ne tourne pas déjà.
 */
import { fork } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { SHOTS } from "./shots.mjs";

const root = join(import.meta.dirname, "..");
const outDir = join(root, "public/captures");
mkdirSync(outDir, { recursive: true });

// Version de l'introduction et liste des astuces, relues dans le code de
// l'app comme le fait store-screenshots : marquées vues, elles ne
// recouvrent aucune capture, même après un ajout.
const appSrc = join(root, "../src/composables");
const ONBOARDING_VERSION = readFileSync(join(appSrc, "useOnboarding.ts"), "utf8").match(
  /const ONBOARDING_VERSION = "([^"]+)"/,
)?.[1];
const TIP_IDS = [
  ...(readFileSync(join(appSrc, "useFeatureTips.ts"), "utf8")
    .match(/export const TIP_IDS[^=]*=\s*\[([^\]]*)\]/)?.[1]
    .matchAll(/"([a-z-]+)"/g) ?? []),
].map((m) => m[1]);
if (!ONBOARDING_VERSION || TIP_IDS.length === 0) {
  throw new Error("captures: version de l'introduction ou astuces introuvables");
}

const PORT = 5274;
const baseUrl = `http://localhost:${PORT}`;
const VIEWPORT = { width: 390, height: 800 };
const PARIS = { latitude: 48.8566, longitude: 2.3522 };

const only = process.argv.flatMap((a, i, argv) => (a === "--only" ? [argv[i + 1]] : []));
const shots = only.length ? SHOTS.filter((s) => only.includes(s.name)) : SHOTS;

async function serverUp() {
  try {
    return (await fetch(baseUrl)).ok;
  } catch {
    return false;
  }
}

let server = null;
if (!(await serverUp())) {
  server = fork(join(root, "scripts/demo-server.mjs"), { stdio: "inherit" });
  await new Promise((resolve, reject) => {
    server.once("message", resolve);
    server.once("exit", (code) => reject(new Error(`demo-server arrêté (${code})`)));
  });
}

const browser = await chromium.launch({
  executablePath: process.env.PROMO_CHROMIUM || undefined,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

/** Un contexte « app native » fr, au thème voulu, connecté au compte de démo. */
/**
 * `locale` : langue de l'interface ; `clock` : date et heure figées (ISO),
 * pour filmer une fête ou une heure du jour, en invité seulement (un compte
 * dont l'horloge diffère de celle de l'émulateur verrait son jeton refusé) ;
 * `holidays` : laisser le thème de la fête du moment s'appliquer.
 */
async function appContext({ theme = "sunset", scheme = "light", signedIn = true, locale = "fr", clock, holidays = false }) {
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
    ({ prefs, onboardingVersion, tipIds, locale }) => {
      window.CapacitorCustomPlatform = { name: "promo-videos" };
      localStorage.setItem("petite-jerusalem-locale", locale);
      localStorage.setItem("pj_analytics_consent", "denied");
      // Introduction et astuces vues : elles prendraient l'écran.
      localStorage.setItem("pj_onboarding_seen", onboardingVersion);
      localStorage.setItem("pj_tips_seen", JSON.stringify(tipIds));
      localStorage.setItem("pj-preferences:guest", JSON.stringify(prefs));
      // Pas de barre de défilement dans les captures.
      const style = document.createElement("style");
      style.textContent = "::-webkit-scrollbar{display:none} *{scrollbar-width:none}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
    },
    {
      prefs: { theme, colorScheme: scheme, holidayThemes: holidays, fontLatin: "manrope", fontHebrew: "frank" },
      onboardingVersion: ONBOARDING_VERSION,
      tipIds: TIP_IDS,
      locale,
    },
  );
  if (clock) await context.clock.setFixedTime(new Date(clock));
  const page = await context.newPage();
  if (signedIn) {
    await page.goto(`${baseUrl}/login`, { waitUntil: "load" });
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', "demo@petite-jerusalem.fr");
    await page.fill('input[type="password"]', "demo-petite-jerusalem");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
    // Le thème du compte passe devant celui de l'invité : on l'aligne.
    await page.evaluate(
      async ({ theme, scheme }) => {
        const { userPreferencesService } = await import("/src/services/userPreferencesService.ts");
        const { auth } = await import("/src/firebase/core.ts");
        await userPreferencesService.savePreferences(auth.currentUser.uid, { theme, colorScheme: scheme });
      },
      { theme, scheme },
    ).catch((e) => console.warn("captures: thème du compte non réglé", e.message));
    // Les dates personnelles du compte rejoignent l'appareil au premier
    // passage sur l'accueil : sans lui, le calendrier ouvert d'emblée ne
    // les montre pas encore.
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
  return { context, page };
}

// Les zones repérées dans les captures (un bouton, une carte), en points
// de l'écran : le montage y pose un doigt, un cadre, un zoom.
const marksFile = join(outDir, "marks.json");
const marks = existsSync(marksFile) ? JSON.parse(readFileSync(marksFile, "utf8")) : {};

/** Outils donnés à chaque plan pour se mettre en scène et se filmer. */
function tools(page, shot) {
  let frame = 0;
  const cdp = page.context().newCDPSession(page);
  return {
    page,
    async open(path, readyText) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      if (readyText) {
        await page.locator(`text=${readyText} >> visible=true`).first().waitFor({ timeout: 20000 });
      }
      await page.waitForTimeout(1800);
    },
    /** Une image de la séquence (ou l'image unique du plan). */
    async snap(suffix) {
      const name = suffix ?? (shot.frames ? String(frame++).padStart(2, "0") : null);
      const file = name ? `${shot.name}-${name}.jpg` : `${shot.name}.jpg`;
      writeFileSync(join(outDir, file), await page.screenshot({ type: "jpeg", quality: 92 }));
      return file;
    },
    /**
     * La page entière, pour un défilement fait au montage. Bornée à 2 400
     * points : au-delà, le JPEG dépasse ce que Chromium sait encoder (une
     * session de 150 psaumes, un office entier) et sort vide.
     */
    async snapFull(suffix = "full") {
      const file = `${shot.name}-${suffix}.jpg`;
      // Sans ce qui est fixe à l'écran (barre d'onglets, bouton rond) : figé
      // au milieu de la page entière, il défilerait avec elle. Le montage
      // repose la barre par-dessus (Scroll, `chrome`).
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
    /** Un élément seul, fond transparent, pour le faire sortir du téléphone. */
    async snapElement(locator, suffix) {
      const file = `${shot.name}-${suffix}.png`;
      writeFileSync(join(outDir, file), await locator.screenshot({ type: "png", omitBackground: true }));
      return file;
    },
    async touch(type, x, y) {
      await (await cdp).send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y, radiusX: 8, radiusY: 8, force: 1 }],
      });
    },
    wait: (ms) => page.waitForTimeout(ms),
    /** Note la zone d'un élément, telle qu'elle est à l'écran. */
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
      if (!box) throw new Error(`zone introuvable : ${key}`);
      marks[`${shot.name}:${key}`] = {
        x: Math.round(box.x),
        y: Math.round(box.y),
        w: Math.round(box.width),
        h: Math.round(box.height),
      };
    },
  };
}

const failed = [];
// Les plans d'un même habillage partagent un contexte (une connexion).
const groups = new Map();
for (const shot of shots) {
  const key = JSON.stringify(shot.look ?? {});
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(shot);
}
try {
  for (const [key, group] of groups) {
    const look = JSON.parse(key);
    let context, page;
    try {
      ({ context, page } = await appContext(look));
    } catch (error) {
      console.error(`captures: habillage ${key} impossible à préparer`, error.message);
      failed.push(...group.map((shot) => shot.name));
      continue;
    }
    try {
      for (const shot of group) {
        try {
          await shot.run(tools(page, shot));
          console.log(`captures: ${shot.name}`);
        } catch (error) {
          console.error(`captures: ${shot.name} a échoué`, error.message);
          failed.push(shot.name);
        }
      }
    } finally {
      await context.close();
    }
  }
} finally {
  writeFileSync(marksFile, `${JSON.stringify(marks, null, 2)}\n`);
  await browser.close();
  server?.kill("SIGINT");
}
if (failed.length) {
  console.error(`captures: ${failed.length} plan(s) en échec : ${failed.join(", ")}`);
  process.exit(1);
}
