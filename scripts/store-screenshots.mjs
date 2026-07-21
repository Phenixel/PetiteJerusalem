#!/usr/bin/env node
/**
 * Génère les captures d'écran de la fiche Play Store (1080×1920, 9:16) de
 * façon reproductible : émulateurs Firebase éphémères + données de démo
 * fixes + l'app **native** (Capacitor) sur un émulateur Android dédié,
 * pilotée par Playwright à travers sa webview, capturée par `adb screencap`
 * (barre de statut et barre d'onglets incluses, comme sur un vrai téléphone).
 *
 * Pages capturées (dans l'ordre de la fiche) :
 *   01 accueil connecté (tableau de bord)   05 profil : lecture quotidienne
 *   02 session de partage de lecture        06 détail d'un chiour
 *   03 bibliothèque                         07 accueil visiteur
 *   04 lecteur de texte (Tehilim 1)
 *
 * Usage :
 *   npm run store:screenshots           captures depuis l'app native (émulateur)
 *   npm run store:screenshots -- --web  variante rapide : Chrome mobile 360×640@3x
 *                                       (sans barre d'onglets native)
 *
 * Prérequis : CLI firebase + JDK 21 + SDK Android (AVD « pj-store » créé
 * automatiquement, 1080×1920) ; Playwright (`npx playwright install chromium`
 * fait par le script en mode --web). Les émulateurs de dev (npm run dev:local)
 * doivent être arrêtés : le script démarre les siens, vides, sur les mêmes
 * ports, et n'écrit jamais dans .emulator-data.
 *
 * Sortie : store-assets/metadata/android/fr-FR/images/phoneScreenshots/
 * (envoyées sur le Play Store par la CI via scripts/play-listing.mjs).
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const outDir = join(root, "store-assets/metadata/android/fr-FR/images/phoneScreenshots");

const FIRESTORE_PORT = 8470; // même plage que firebase.json / firebase.ts
const AUTH_PORT = 8471;
const VITE_PORT = 5273; // hors du 5173 par défaut pour ne pas gêner un dev en cours
const PROJECT_ID = "petite-jerusalem-dev";

const WEB_MODE = process.argv.includes("--web");

// Émulateur Android dédié : profil pixel_2 = 1080×1920 @ 420 dpi, le 9:16
// exact attendu par le Play Store, capturé tel quel sans retaille.
const AVD_NAME = "pj-store";
// android-36 : sa WebView récente rend correctement les textes en dégradé
// (background-clip: text), que la WebView d'android-34 affiche en bloc plein.
const AVD_IMAGE = "system-images;android-36;google_apis_playstore;arm64-v8a";
const EMULATOR_PORT = 5584; // pair, hors du 5554 par défaut d'un émulateur déjà ouvert
const SERIAL = `emulator-${EMULATOR_PORT}`;
const APP_ID = "fr.petitejerusalem.app";

const sdkDir = process.env.ANDROID_HOME ?? join(homedir(), "Library/Android/sdk");
const adbBin = join(sdkDir, "platform-tools/adb");
const emulatorBin = join(sdkDir, "emulator/emulator");
const avdmanagerBin = join(sdkDir, "cmdline-tools/latest/bin/avdmanager");

const DEMO_EMAIL = "demo@petite-jerusalem.fr";
const DEMO_PASSWORD = "demo-petite-jerusalem";
const DEMO_NAME = "Sarah Levy";
const SESSION_SLUG = "tehilim-pour-la-communaute";
const CHIOUR_SLUG = "la-force-de-la-priere";

// --- Préparation de l'environnement -----------------------------------------

// Émulateurs Firebase, Gradle et avdmanager exigent Java >= 21 — mais le JDK
// 21 exact de préférence : Gradle (AGP de Capacitor 8) ne supporte pas les
// class files des JDK plus récents (« Unsupported class file major version »).
if (process.platform === "darwin") {
  const candidates = [
    // Keg-only Homebrew : invisible pour java_home, d'où le chemin direct.
    "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
  ];
  try {
    candidates.push(
      execFileSync("/usr/libexec/java_home", ["-v", "21+"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
    );
  } catch {
    // Pas de JVM enregistrée : on s'en tient aux chemins connus.
  }
  const home = candidates.find((dir) => dir && existsSync(join(dir, "bin/java")));
  if (home) {
    process.env.JAVA_HOME = home;
    process.env.PATH = `${home}/bin:${process.env.PATH}`;
  }
}

function portTaken(port) {
  const res = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
    encoding: "utf8",
  });
  return Boolean(res.stdout?.trim());
}

for (const port of [FIRESTORE_PORT, AUTH_PORT, VITE_PORT]) {
  if (portTaken(port)) {
    console.error(
      `store-screenshots: le port ${port} est occupé — arrêter les émulateurs/serveurs de dev (npm run dev:local) avant de lancer les captures.`,
    );
    process.exit(1);
  }
}

function adb(...args) {
  const res = spawnSync(adbBin, ["-s", SERIAL, ...args], { encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error(`adb ${args.join(" ")} : ${res.stderr || res.stdout}`);
  }
  return res.stdout.trim();
}

const children = [];
function cleanup() {
  if (!WEB_MODE) {
    try {
      spawnSync(adbBin, ["-s", SERIAL, "emu", "kill"], { timeout: 10000 });
    } catch {
      /* émulateur déjà arrêté */
    }
  }
  for (const child of children) {
    if (!child.killed) {
      try {
        child.kill("SIGTERM");
      } catch {
        /* déjà parti */
      }
    }
  }
}
process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));

async function waitFor(url, label, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`${label} ne répond pas sur ${url} après ${timeoutMs / 1000}s`);
}

// --- Émulateurs Firebase éphémères (vides : ni --import ni --export-on-exit) --

console.log("store-screenshots: démarrage des émulateurs Firebase (vides)…");
const emulators = spawn("firebase", ["emulators:start", "--only", "auth,firestore"], {
  cwd: root,
  stdio: ["ignore", "pipe", "inherit"],
});
emulators.stdout.resume(); // on n'affiche pas leur log, mais il ne doit pas bloquer
children.push(emulators);
await waitFor(`http://localhost:${AUTH_PORT}/`, "l'émulateur Auth", 90000);
await waitFor(`http://localhost:${FIRESTORE_PORT}/`, "l'émulateur Firestore", 90000);

// --- Données de démo ---------------------------------------------------------

/** Encode une valeur JS au format REST de Firestore. */
function toFirestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  switch (typeof value) {
    case "string":
      return { stringValue: value };
    case "boolean":
      return { booleanValue: value };
    case "number":
      return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    case "object":
      return { mapValue: { fields: toFirestoreFields(value) } };
    default:
      throw new Error(`Type non géré : ${typeof value}`);
  }
}

function toFirestoreFields(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFirestoreValue(v)]));
}

async function seedDoc(path, docId, data) {
  const res = await fetch(
    `http://localhost:${FIRESTORE_PORT}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}?documentId=${docId}`,
    {
      method: "POST",
      // "Bearer owner" : jeton spécial de l'émulateur qui court-circuite les règles.
      headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
      body: JSON.stringify({ fields: toFirestoreFields(data) }),
    },
  );
  if (!res.ok) throw new Error(`Seed ${path}/${docId} : ${res.status} ${await res.text()}`);
}

console.log("store-screenshots: création du compte et des données de démo…");
const signUp = await fetch(
  `http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      displayName: DEMO_NAME,
      returnSecureToken: true,
    }),
  },
);
if (!signUp.ok) throw new Error(`Création du compte de démo : ${await signUp.text()}`);
const { localId: uid } = await signUp.json();

function todayKey() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

// Tehilim 1 → 150 portent les ids 103 → 252 dans src/datas/textStudies.json.
const tehilimId = (n) => String(102 + n);

/** Réservations de démo : 6 participants, 41 psaumes réservés dont 15 lus. */
function demoReservations() {
  const participants = [
    { name: DEMO_NAME, userId: uid, from: 1, to: 5, read: 3 },
    { name: "David Benhamou", guest: "guest-david", from: 6, to: 15, read: 4 },
    { name: "Rivka Azoulay", guest: "guest-rivka", from: 16, to: 20, read: 5 },
    { name: "Yossef Amar", guest: "guest-yossef", from: 21, to: 30, read: 0 },
    { name: "Esther Toledano", guest: "guest-esther", from: 121, to: 125, read: 2 },
    { name: "Moché Elfassi", guest: "guest-moche", from: 145, to: 150, read: 1 },
  ];
  const reservations = [];
  for (const p of participants) {
    for (let n = p.from; n <= p.to; n++) {
      const reservation = {
        id: `demo-resa-${n}`,
        textStudyId: tehilimId(n),
        chosenByName: p.name,
        available: false,
        isCompleted: n - p.from < p.read,
        createdAt: new Date(Date.now() - (151 - n) * 3600 * 1000).toISOString(),
      };
      if (p.userId) reservation.chosenById = p.userId;
      else reservation.chosenByGuestId = p.guest;
      reservations.push(reservation);
    }
  }
  return reservations;
}

const DAY = 24 * 3600 * 1000;
await seedDoc("sessions", "demo-session-tehilim", {
  name: "Tehilim pour la communauté",
  type: "Tehilim",
  description:
    "Lisons les 150 Tehilim ensemble avant Roch Hodech : réservez vos psaumes et cochez-les une fois lus.",
  dateLimit: new Date(Date.now() + 21 * DAY),
  createdAt: new Date(Date.now() - 7 * DAY),
  personId: uid,
  creatorName: DEMO_NAME,
  slug: SESSION_SLUG,
  isCompleted: false,
  reservations: demoReservations(),
});

await seedDoc("userPreferences", uid, {
  theme: "ocean",
  fontLatin: "inter",
  fontHebrew: "frank",
  dailyReadingIds: [103, 104, 105], // Tehilim 1, 2, 3
  dailyReadingProgress: { date: todayKey(), completedIds: [103] },
  fcmTokens: [],
  pushReminderEnabled: true,
  pushReminderHour: 7,
  pushReminderMinute: 30,
  pushLocale: "fr",
});

const chiourim = [
  {
    slug: CHIOUR_SLUG,
    name: "La force de la prière",
    description:
      "Comment la prière transforme notre quotidien : sources dans le Talmud et conseils pratiques pour donner du sens à chaque tefila.",
    auteur: "Rav David Cohen",
    categories: ["Emouna"],
    niveau: "Tous niveaux",
    duration: 2520,
    order: 1,
  },
  {
    slug: "paracha-de-la-semaine",
    name: "Paracha de la semaine : regards croisés",
    description: "Une lecture de la paracha à travers Rachi et le Midrach.",
    auteur: "Rav Yossef Attal",
    categories: ["Paracha"],
    niveau: "Tous niveaux",
    duration: 1980,
    order: 2,
  },
  {
    slug: "introduction-a-la-guemara",
    name: "Introduction à la Guemara",
    description: "Les clés pour aborder une page de Talmud : structure, langage, méthode.",
    auteur: "Rav David Cohen",
    categories: ["Guemara"],
    niveau: "Débutant",
    duration: 3120,
    order: 3,
  },
  {
    slug: "les-lois-de-chabbat",
    name: "Les lois de Chabbat",
    description: "Panorama des 39 melakhot et de leurs applications concrètes.",
    auteur: "Rav Moché Benhamou",
    categories: ["Halakha"],
    niveau: "Tous niveaux",
    duration: 2760,
    order: 4,
  },
];
for (const chiour of chiourim) {
  await seedDoc("chiourim", chiour.slug, {
    ...chiour,
    // URL factice : le lecteur audio s'affiche sans que le fichier soit lu.
    audioPath: `chiourim/demo/${chiour.slug}.mp3`,
    mediaUrl: `https://demo.petite-jerusalem.fr/audio/${chiour.slug}.mp3`,
    fileSize: null,
    published: true,
    createdAt: new Date(Date.now() - 30 * DAY),
    updatedAt: new Date(Date.now() - 30 * DAY),
  });
}

// --- Serveur de dev (mode DEV → branché sur les émulateurs) ------------------

console.log("store-screenshots: démarrage du serveur Vite…");
const vite = spawn("npx", ["vite", "--port", String(VITE_PORT), "--strictPort"], {
  cwd: root,
  stdio: ["ignore", "pipe", "inherit"],
  // Sans le badge flottant Vue DevTools (cf. vite.config.ts).
  env: { ...process.env, STORE_SCREENSHOTS: "1" },
});
vite.stdout.resume();
children.push(vite);
const baseUrl = `http://localhost:${VITE_PORT}`;
await waitFor(baseUrl, "le serveur Vite");

// --- Navigateur (mode --web) ou app native sur émulateur Android -------------

mkdirSync(outDir, { recursive: true });

let page; // pilote la navigation (page Chrome, ou webview de l'app native)
let device = null; // ANDROID uniquement : capture d'écran du device entier
let browser = null;

if (WEB_MODE) {
  console.log("store-screenshots: installation de Chromium pour Playwright si besoin…");
  spawnSync("npx", ["playwright", "install", "chromium"], { stdio: "inherit", cwd: root });
  const { chromium } = await import("playwright");
  // Chrome installé de préférence : le Chromium headless de Playwright n'a pas
  // toutes les polices hébraïques (cantillation) et affiche des carrés.
  browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
  const context = await browser.newContext({
    // 360×640 CSS × 3 = 1080×1920 physiques : le 9:16 recommandé par Google.
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    reducedMotion: "reduce",
  });
  page = await context.newPage();
} else {
  // L'AVD dédié (1080×1920) est créé au premier lancement.
  const avdList = spawnSync(emulatorBin, ["-list-avds"], { encoding: "utf8" });
  if (!avdList.stdout?.split("\n").includes(AVD_NAME)) {
    console.log(`store-screenshots: création de l'AVD ${AVD_NAME} (1080×1920)…`);
    const created = spawnSync(
      avdmanagerBin,
      ["create", "avd", "-n", AVD_NAME, "-k", AVD_IMAGE, "-d", "pixel_2"],
      { input: "no\n", encoding: "utf8" },
    );
    if (created.status !== 0) {
      throw new Error(`Création de l'AVD impossible : ${created.stderr}`);
    }
  }

  console.log("store-screenshots: démarrage de l'émulateur Android…");
  const emulator = spawn(
    emulatorBin,
    [
      "-avd",
      AVD_NAME,
      "-port",
      String(EMULATOR_PORT),
      "-no-boot-anim",
      "-no-audio",
      // Sans émulation Bluetooth : son crash en boucle affiche une boîte
      // « Bluetooth keeps stopping » par-dessus les captures.
      "-feature",
      "-BluetoothEmulation",
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  children.push(emulator);
  spawnSync(adbBin, ["-s", SERIAL, "wait-for-device"], { timeout: 120000 });
  const bootStart = Date.now();
  while (Date.now() - bootStart < 240000) {
    try {
      if (adb("shell", "getprop", "sys.boot_completed") === "1") break;
    } catch {
      /* adb pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (adb("shell", "getprop", "sys.boot_completed") !== "1") {
    throw new Error("L'émulateur Android n'a pas fini de démarrer après 4 minutes");
  }

  // Le localhost du device = la machine : Vite et les émulateurs Firebase
  // (firebase.ts pointe sur localhost:8470/8471 en mode DEV).
  for (const port of [VITE_PORT, FIRESTORE_PORT, AUTH_PORT]) {
    adb("reverse", `tcp:${port}`, `tcp:${port}`);
  }

  // Config Capacitor pointée sur Vite (CAP_SERVER_URL), puis build + install.
  console.log("store-screenshots: build et installation de l'app (gradle)…");
  const capCopy = spawnSync("npx", ["cap", "copy", "android"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, CAP_SERVER_URL: `http://localhost:${VITE_PORT}` },
  });
  if (capCopy.status !== 0) throw new Error("npx cap copy android a échoué");
  const gradle = spawnSync("./gradlew", ["installDebug", "--no-daemon"], {
    cwd: join(root, "android"),
    stdio: "inherit",
  });
  if (gradle.status !== 0) throw new Error("gradlew installDebug a échoué");

  // Barre de statut « propre » (mode démo SystemUI) : 12:00, wifi plein,
  // batterie 100 %, pas d'icônes de notification.
  adb("shell", "settings", "put", "global", "sysui_demo_allowed", "1");
  const demo = (...pairs) =>
    adb("shell", "am", "broadcast", "-a", "com.android.systemui.demo", ...pairs);
  demo("-e", "command", "enter");
  demo("-e", "command", "clock", "-e", "hhmm", "1200");
  demo("-e", "command", "network", "-e", "wifi", "show", "-e", "level", "4", "-e", "fully", "true");
  demo("-e", "command", "battery", "-e", "level", "100", "-e", "plugged", "false");
  demo("-e", "command", "notifications", "-e", "visible", "false");

  // Neutralise le Bluetooth de l'émulateur (crash en boucle → dialogue
  // « Bluetooth keeps stopping » par-dessus l'app).
  try {
    adb("shell", "pm", "disable-user", "--user", "0", "com.android.bluetooth");
  } catch {
    console.warn("store-screenshots: impossible de désactiver le Bluetooth (image playstore ?)");
  }

  // Évite la demande de permission notifications au premier lancement.
  adb("shell", "pm", "grant", APP_ID, "android.permission.POST_NOTIFICATIONS");
  adb("shell", "am", "start", "-n", `${APP_ID}/.MainActivity`);

  console.log("store-screenshots: connexion Playwright à la webview…");
  const { _android } = await import("playwright");
  const devices = await _android.devices();
  device = devices.find((d) => d.serial() === SERIAL);
  if (!device) throw new Error(`Device ${SERIAL} introuvable par Playwright`);
  const webview = await device.webView({ pkg: APP_ID }, { timeout: 60000 });
  page = await webview.page();
}

// --- Captures ----------------------------------------------------------------

async function shoot(file) {
  if (device) await device.screenshot({ path: join(outDir, file) });
  else await page.screenshot({ path: join(outDir, file) });
  console.log(`store-screenshots: ${file}`);
}

async function capture(path, file, { readyText, beforeShot } = {}) {
  // Pas de "networkidle" : Firestore garde une connexion ouverte en
  // permanence une fois connecté, l'événement n'arriverait jamais.
  await page.goto(`${baseUrl}${path}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  // Attend le contenu (pas un spinner « Chargement… » attrapé trop tôt).
  if (readyText) {
    await page.locator(`text=${readyText}`).first().waitFor({ timeout: 20000 });
  }
  if (beforeShot) await beforeShot();
  // Laisse finir les chargements Firestore, les animations d'apparition et
  // l'estompage des barres de défilement Android.
  await page.waitForTimeout(2500);
  await shoot(file);
}

// L'app suit la locale de l'appareil : on force le français comme le ferait
// le sélecteur de langue (localStorage), avant la première navigation.
await page.evaluate(() => localStorage.setItem("petite-jerusalem-locale", "fr"));

// 07 d'abord : l'accueil visiteur se capture avant la connexion.
await capture("/", "07-accueil-visiteur.png", { readyText: "Créer un compte" });

console.log("store-screenshots: connexion du compte de démo…");
await page.goto(`${baseUrl}/login`, { waitUntil: "load" });
await page.waitForSelector('input[type="email"]');
await page.fill('input[type="email"]', DEMO_EMAIL);
await page.fill('input[type="password"]', DEMO_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });

await capture("/", "01-accueil-connecte.png", { readyText: "Ma lecture quotidienne" });
await capture(`/share-reading/session/${SESSION_SLUG}`, "02-partage-session.png", {
  readyText: "Participe",
});
await capture("/bibliotheque", "03-bibliotheque.png", { readyText: "Bibliothèque" });
// URL canonique de Tehilim 1 (/lire/103 hors session redirige vers elle).
await capture("/bibliotheque/tehilim/1", "04-lecture-tehilim.png", { readyText: "Phonétique" });
await capture("/profile", "05-lecture-quotidienne.png", {
  readyText: "Tehilim 1",
  // L'onglet Lecture quotidienne est actif par défaut : on cale le titre de
  // la section en haut de l'écran pour montrer le suivi du jour (et laisser
  // le bouton Déconnexion de l'en-tête hors champ).
  beforeShot: async () => {
    await page
      .locator("text=Ma lecture quotidienne")
      .first()
      .evaluate((el) => el.scrollIntoView({ block: "start" }));
  },
});
await capture(`/chiourim/${CHIOUR_SLUG}`, "06-chiour.png", { readyText: "Description" });

if (browser) await browser.close();
if (device) {
  adb("shell", "am", "broadcast", "-a", "com.android.systemui.demo", "-e", "command", "exit");
  // Remet la config Capacitor normale (sans server.url) dans android/ pour ne
  // pas laisser une app locale branchée sur un serveur de dev éteint.
  if (existsSync(join(root, "dist"))) {
    spawnSync("npx", ["cap", "copy", "android"], { cwd: root, stdio: "ignore" });
  } else {
    console.warn(
      "store-screenshots: dist/ absent — lancer `npm run app:build` pour remettre android/ en config bundle.",
    );
  }
  await device.close();
}
console.log(`store-screenshots: 7 captures écrites dans ${outDir}`);
process.exit(0);
