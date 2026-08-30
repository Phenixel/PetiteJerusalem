#!/usr/bin/env node
/**
 * Génère les captures d'écran des fiches Play Store et App Store de façon
 * reproductible : émulateurs Firebase éphémères + données de démo fixes,
 * puis trois modes de rendu :
 *
 *   (défaut)  l'app **native** (Capacitor) sur un émulateur Android dédié
 *             (1080×1920, le 9:16 exact attendu par le Play Store), pilotée
 *             par Playwright à travers sa webview, capturée par
 *             `adb screencap` (barre de statut et barre d'onglets incluses,
 *             comme sur un vrai téléphone) ;
 *   --web     variante rapide pour la fiche Play : Chrome mobile 360×640@3x
 *             (1080×1920, sans barre d'onglets native) ;
 *   --ios     fiche App Store : Chrome aux dimensions exactes exigées par
 *             Apple, iPhone 6,9" (440×956@3x, soit 1320×2868) et iPad 13"
 *             (1032×1376@2x, soit 2064×2752), en JPEG donc sans canal alpha.
 *             L'envoi dans App Store Connect est fait ensuite par
 *             scripts/asc-screenshots.mjs.
 *
 * Pages capturées (dans l'ordre des fiches) :
 *   01 accueil connecté (tableau de bord)   05 lecture quotidienne
 *   02 session de partage de lecture        06 détail d'un chiour
 *   03 bibliothèque                         07 accueil visiteur
 *   04 lecteur de texte (Tehilim 1)
 *
 * Usage :
 *   npm run store:screenshots           captures Play depuis l'app native
 *   npm run store:screenshots -- --web  variante web rapide (fiche Play)
 *   npm run store:screenshots -- --ios  captures App Store (iPhone + iPad)
 *
 * Prérequis : CLI firebase + JDK 21 ; en mode natif, le SDK Android (l'AVD
 * « pj-store » est créé automatiquement, l'image système doit être installée,
 * voir le job « screenshots » de deploy-android.yml pour la CI). Les
 * émulateurs de dev (npm run dev:local) doivent être arrêtés : le script
 * démarre les siens, vides, sur les mêmes ports, et n'écrit jamais dans
 * .emulator-data.
 *
 * En CI, l'émulateur n'est pas ouvert par ce script : le job « screenshots »
 * de deploy-android.yml le confie à l'action android-emulator-runner, qui
 * sait le démarrer et l'attendre sur un runner sans écran, et pose
 * ANDROID_SERIAL pour que le script s'y branche. Les captures de la fiche
 * App Store, elles, ne demandent aucun émulateur (mode --ios, Chrome).
 *
 * Sorties :
 *   store-assets/metadata/android/fr-FR/images/phoneScreenshots/*.png
 *   store-assets/metadata/ios/screenshots/fr-FR/{iphone,ipad}-*.jpg
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const androidOutDir = join(root, "store-assets/metadata/android/fr-FR/images/phoneScreenshots");
const iosOutDir = join(root, "store-assets/metadata/ios/screenshots/fr-FR");

const FIRESTORE_PORT = 8470; // même plage que firebase.json / firebase.ts
const AUTH_PORT = 8471;
const VITE_PORT = 5273; // hors du 5173 par défaut pour ne pas gêner un dev en cours
const PROJECT_ID = "petite-jerusalem-dev";

const WEB_MODE = process.argv.includes("--web");
const IOS_MODE = process.argv.includes("--ios");
const BROWSER_MODE = WEB_MODE || IOS_MODE; // rendu Chrome, pas d'émulateur Android
// Machine sans écran (GitHub Actions pose CI=true) : l'émulateur que LE SCRIPT
// lance tourne alors hors fenêtre. Sans effet sur un émulateur fourni.
const HEADLESS = Boolean(process.env.CI);

// Émulateur Android dédié : profil pixel_2 = 1080×1920 @ 420 dpi, le 9:16
// exact attendu par le Play Store, capturé tel quel sans retaille.
const AVD_NAME = "pj-store";
// android-36 : sa WebView récente rend correctement les textes en dégradé
// (background-clip: text), que la WebView d'android-34 affiche en bloc plein.
// L'ABI suit la machine : arm64 en local (Apple Silicon), x86_64 en CI. La
// variante playstore (celle du dev local) est un build user qui refuse
// `pm disable-user` ; en x86_64 on prend google_apis, même WebView, qui
// laisse neutraliser le Bluetooth.
const AVD_ABI = process.arch === "arm64" ? "arm64-v8a" : "x86_64";
const AVD_FLAVOR = process.arch === "arm64" ? "google_apis_playstore" : "google_apis";
const AVD_IMAGE = `system-images;android-36;${AVD_FLAVOR};${AVD_ABI}`;
const EMULATOR_PORT = 5584; // pair, hors du 5554 par défaut d'un émulateur déjà ouvert
// ANDROID_SERIAL (la variable que reconnaît adb lui-même) désigne un émulateur
// DÉJÀ démarré, auquel se brancher au lieu d'en lancer un : c'est ce que fait
// la CI, où l'émulateur est ouvert par l'action android-emulator-runner (elle
// sait le démarrer et l'attendre sur un runner sans écran, ce qui demande plus
// que trois options de ligne de commande). Sans elle, le script lance le sien,
// sur son port dédié, et le referme en partant.
const PROVIDED_SERIAL = process.env.ANDROID_SERIAL?.trim() || null;
const SERIAL = PROVIDED_SERIAL ?? `emulator-${EMULATOR_PORT}`;
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

// Dimensions des contextes navigateur : la fiche Play recommande le 9:16
// (1080×1920), Apple exige des dimensions au pixel près par famille
// d'appareils (docs/ios-ci-cd.md).
const BROWSER_DEVICES = {
  phone: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 }, // 1080×1920
  iphone: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 }, // 1320×2868 (6,9")
  ipad: { viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2 }, // 2064×2752 (13")
};

// --- Préparation de l'environnement -----------------------------------------

// Émulateurs Firebase, Gradle et avdmanager exigent Java >= 21, mais le JDK
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
      `store-screenshots: le port ${port} est occupé, arrêter les émulateurs/serveurs de dev (npm run dev:local) avant de lancer les captures.`,
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

/**
 * Lance un serveur de longue durée (émulateurs Firebase, Vite, émulateur
 * Android) en le rendant tuable pour de bon.
 *
 * Deux précautions, apprises du tag v3.8.1 : le job de captures y est resté
 * suspendu 42 minutes après la mort du script, jusqu'à l'annulation à la main.
 *
 * 1. `detached` fait de l'enfant le chef de son groupe, et cleanup() tue le
 *    groupe : sans cela, un SIGTERM au seul chef laisse vivre ses propres
 *    enfants, le vite lancé par npx et son esbuild, les JVM des émulateurs.
 * 2. Aucun flux n'est « inherit » : un enfant qui survivrait garderait sinon
 *    ouverte la sortie du step, que l'action qui l'attend ne verrait jamais se
 *    fermer. Les flux sont relayés par ce processus-ci, qui les referme en
 *    mourant, si bien que le journal du run montre la même chose qu'avant.
 */
function spawnChild(command, args, options = {}) {
  const child = spawn(command, args, {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  // Un flux jamais lu finit par remplir son tampon et bloquer l'écrivain.
  child.stdout?.resume();
  child.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  children.push(child);
  return child;
}

function cleanup() {
  // Un émulateur fourni (CI) ne nous appartient pas : c'est l'action qui l'a
  // ouvert et qui le refermera.
  if (!BROWSER_MODE && !PROVIDED_SERIAL) {
    try {
      spawnSync(adbBin, ["-s", SERIAL, "emu", "kill"], { timeout: 10000 });
    } catch {
      /* émulateur déjà arrêté */
    }
  }
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    try {
      // Le groupe entier (pid négatif), pas seulement le chef. SIGKILL parce
      // qu'un gestionnaire « exit » est synchrone : on ne peut pas attendre
      // ici qu'un arrêt gracieux aboutisse.
      process.kill(-child.pid, "SIGKILL");
    } catch {
      try {
        child.kill("SIGKILL");
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
spawnChild("firebase", ["emulators:start", "--only", "auth,firestore"], { cwd: root });
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
spawnChild("npx", ["vite", "--port", String(VITE_PORT), "--strictPort"], {
  cwd: root,
  // Sans le badge flottant Vue DevTools (cf. vite.config.ts).
  env: { ...process.env, STORE_SCREENSHOTS: "1" },
});
const baseUrl = `http://localhost:${VITE_PORT}`;
await waitFor(baseUrl, "le serveur Vite");

// --- Scénario de capture (commun aux trois modes) ----------------------------

/**
 * Déroule les 7 écrans des fiches : accueil visiteur, connexion du compte de
 * démo, puis les 6 écrans connectés. `shoot(name)` reçoit le nom de base de
 * la capture (sans extension), l'appelant décide du fichier et du support
 * (adb screencap ou page.screenshot).
 */
async function runScenario(page, shoot) {
  async function capture(path, name, { readyText, beforeShot } = {}) {
    // Pas de "networkidle" : Firestore garde une connexion ouverte en
    // permanence une fois connecté, l'événement n'arriverait jamais.
    await page.goto(`${baseUrl}${path}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    // Attend le contenu (pas un spinner « Chargement… » attrapé trop tôt).
    // `visible=true` : sans lui, `first()` peut se figer sur une occurrence
    // cachée du texte (le même libellé vit aussi dans le menu replié de
    // l'en-tête, « Bibliothèque » par exemple) et ne jamais la voir devenir
    // visible.
    if (readyText) {
      await page.locator(`text=${readyText} >> visible=true`).first().waitFor({ timeout: 20000 });
    }
    if (beforeShot) await beforeShot();
    // Laisse finir les chargements Firestore, les animations d'apparition et
    // l'estompage des barres de défilement.
    await page.waitForTimeout(2500);
    await shoot(name);
  }

  // 07 d'abord : l'accueil visiteur se capture avant la connexion.
  await capture("/", "07-accueil-visiteur", { readyText: "Créer un compte" });

  console.log("store-screenshots: connexion du compte de démo…");
  await page.goto(`${baseUrl}/login`, { waitUntil: "load" });
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });

  await capture("/", "01-accueil-connecte", { readyText: "Ma lecture quotidienne" });
  await capture(`/share-reading/session/${SESSION_SLUG}`, "02-partage-session", {
    readyText: "Participe",
  });
  await capture("/bibliotheque", "03-bibliotheque", { readyText: "Bibliothèque" });
  // URL canonique de Tehilim 1 (/lire/103 hors session redirige vers elle).
  await capture("/bibliotheque/tehilim/1", "04-lecture-tehilim", { readyText: "Phonétique" });
  // La lecture quotidienne a quitté le profil pour sa page de la
  // bibliothèque : c'est elle que montre l'écran 05.
  await capture("/bibliotheque/lecture-du-jour", "05-lecture-quotidienne", {
    readyText: "Tehilim 1",
    // On cale le titre de la section en haut de l'écran pour montrer le
    // suivi du jour (et laisser le lien de retour hors champ).
    beforeShot: async () => {
      await page
        .locator("text=Ma lecture quotidienne >> visible=true")
        .first()
        .evaluate((el) => el.scrollIntoView({ block: "start" }));
    },
  });
  await capture(`/chiourim/${CHIOUR_SLUG}`, "06-chiour", { readyText: "Description" });
}

// --- Navigateur (modes --web / --ios) ou app native sur émulateur Android ----

/**
 * Chrome installé de préférence : le Chromium headless de Playwright n'a pas
 * toutes les polices hébraïques (cantillation) et affiche des carrés. S'il
 * manque (poste sans Chrome), le Chromium de Playwright est installé puis
 * utilisé en dépannage.
 */
async function launchBrowser() {
  const { chromium } = await import("playwright");
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    console.warn("store-screenshots: Chrome introuvable, repli sur le Chromium de Playwright…");
    spawnSync("npx", ["playwright", "install", "chromium"], { stdio: "inherit", cwd: root });
    return chromium.launch();
  }
}

/** Contexte mobile fr-FR sur les dimensions d'un appareil de BROWSER_DEVICES. */
async function newDeviceContext(browser, device) {
  const context = await browser.newContext({
    ...BROWSER_DEVICES[device],
    isMobile: true,
    hasTouch: true,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    reducedMotion: "reduce",
  });
  // L'app suit la locale de l'appareil : on force le français comme le ferait
  // le sélecteur de langue (localStorage), avant tout script de page. Le
  // consentement analytics est posé sur « denied » : la bannière (PostHog)
  // recouvrirait sinon le bas de chaque capture, et une session de captures
  // n'a rien à mesurer.
  await context.addInitScript(() => {
    localStorage.setItem("petite-jerusalem-locale", "fr");
    localStorage.setItem("pj_analytics_consent", "denied");
  });
  return context;
}

if (IOS_MODE) {
  // Les jeux iPhone/iPad remplacent l'existant : un fichier orphelin d'une
  // exécution précédente partirait sinon en trop dans App Store Connect.
  mkdirSync(iosOutDir, { recursive: true });
  for (const file of readdirSync(iosOutDir)) {
    if (/^(iphone|ipad)-.*\.(png|jpe?g)$/i.test(file)) rmSync(join(iosOutDir, file));
  }

  const browser = await launchBrowser();
  let count = 0;
  for (const device of ["iphone", "ipad"]) {
    console.log(`store-screenshots: captures ${device} (App Store)…`);
    const context = await newDeviceContext(browser, device);
    const page = await context.newPage();
    await runScenario(page, async (name) => {
      const file = `${device}-${name}.jpg`;
      // JPEG : Apple refuse le canal alpha des PNG de Playwright.
      await page.screenshot({ path: join(iosOutDir, file), type: "jpeg", quality: 90 });
      console.log(`store-screenshots: ${file}`);
      count++;
    });
    await context.close();
  }
  await browser.close();
  console.log(`store-screenshots: ${count} captures écrites dans ${iosOutDir}`);
  process.exit(0);
}

mkdirSync(androidOutDir, { recursive: true });

if (WEB_MODE) {
  const browser = await launchBrowser();
  const context = await newDeviceContext(browser, "phone");
  const page = await context.newPage();
  let count = 0;
  await runScenario(page, async (name) => {
    const file = `${name}.png`;
    await page.screenshot({ path: join(androidOutDir, file) });
    console.log(`store-screenshots: ${file}`);
    count++;
  });
  await browser.close();
  console.log(`store-screenshots: ${count} captures écrites dans ${androidOutDir}`);
  process.exit(0);
}

// --- Mode natif : app Capacitor sur l'émulateur Android ----------------------

// 6 minutes : un premier boot x86_64 sur un runner CI peut dépasser les 4
// minutes qui suffisent en local.
const BOOT_TIMEOUT = 360000;

/** Vrai quand le device répond « 1 » ; faux tant qu'adb ne le voit pas. */
function bootCompleted() {
  try {
    return adb("shell", "getprop", "sys.boot_completed") === "1";
  } catch {
    return false;
  }
}

if (PROVIDED_SERIAL) {
  console.log(`store-screenshots: émulateur ${SERIAL} fourni par l'environnement.`);
  const start = Date.now();
  let ready = bootCompleted();
  while (!ready && Date.now() - start < BOOT_TIMEOUT) {
    await new Promise((r) => setTimeout(r, 2000));
    ready = bootCompleted();
  }
  if (!ready) {
    throw new Error(
      `ANDROID_SERIAL désigne ${SERIAL}, qu'adb ne voit pas démarré : vérifier que l'émulateur est bien ouvert avant d'appeler ce script (adb devices).`,
    );
  }
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
  // L'émulateur dit ses refus (accélération matérielle absente, image
  // introuvable, mémoire…) sur sa SORTIE STANDARD, pas sur l'erreur standard :
  // la jeter, c'était ne plus rien savoir d'un démarrage manqué. Elle part
  // donc dans un journal, relu et affiché si le boot n'aboutit pas.
  const emulatorLog = join(tmpdir(), `${AVD_NAME}-emulator.log`);
  const emulatorLogFd = openSync(emulatorLog, "w");
  const emulator = spawnChild(
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
      // Sans affichage : rendu logiciel hors écran (le screencap, lui, capture
      // le framebuffer, fenêtre ou pas), et pas de snapshot à charger ni à
      // écrire sur une machine jetable.
      ...(HEADLESS ? ["-no-window", "-gpu", "swiftshader_indirect", "-no-snapshot"] : []),
    ],
    { stdio: ["ignore", emulatorLogFd, emulatorLogFd] },
  );

  // Un émulateur qui refuse de démarrer rend la main tout de suite : le
  // guetter évite d'attendre six minutes un device déjà mort.
  let emulatorExit = null;
  emulator.on("exit", (code, signal) => {
    emulatorExit = signal ?? `code ${code}`;
  });
  const journal = () => {
    const log = existsSync(emulatorLog) ? readFileSync(emulatorLog, "utf8").trim() : "";
    return log ? `Journal de l'émulateur :\n${log.split("\n").slice(-40).join("\n")}` : "";
  };

  const start = Date.now();
  let ready = false;
  while (!ready && Date.now() - start < BOOT_TIMEOUT) {
    if (emulatorExit !== null) {
      throw new Error(`L'émulateur s'est arrêté (${emulatorExit}) avant d'avoir démarré.\n${journal()}`);
    }
    ready = bootCompleted();
    if (!ready) await new Promise((r) => setTimeout(r, 2000));
  }
  if (!ready) {
    throw new Error(
      `L'émulateur Android n'a pas fini de démarrer après ${BOOT_TIMEOUT / 60000} minutes.\n${journal()}`,
    );
  }
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
const device = devices.find((d) => d.serial() === SERIAL);
if (!device) throw new Error(`Device ${SERIAL} introuvable par Playwright`);
const webview = await device.webView({ pkg: APP_ID }, { timeout: 60000 });
const page = await webview.page();

// L'app suit la locale de l'appareil : on force le français comme le ferait
// le sélecteur de langue (localStorage), avant la première navigation. Même
// geste pour le consentement analytics : la bannière (PostHog) recouvrirait
// sinon le bas de chaque capture.
await page.evaluate(() => {
  localStorage.setItem("petite-jerusalem-locale", "fr");
  localStorage.setItem("pj_analytics_consent", "denied");
});

let count = 0;
await runScenario(page, async (name) => {
  const file = `${name}.png`;
  await device.screenshot({ path: join(androidOutDir, file) });
  console.log(`store-screenshots: ${file}`);
  count++;
});

adb("shell", "am", "broadcast", "-a", "com.android.systemui.demo", "-e", "command", "exit");
// Remet la config Capacitor normale (sans server.url) dans android/ pour ne
// pas laisser une app locale branchée sur un serveur de dev éteint.
if (existsSync(join(root, "dist"))) {
  spawnSync("npx", ["cap", "copy", "android"], { cwd: root, stdio: "ignore" });
} else {
  console.warn(
    "store-screenshots: dist/ absent, lancer `npm run app:build` pour remettre android/ en config bundle.",
  );
}
await device.close();
console.log(`store-screenshots: ${count} captures écrites dans ${androidOutDir}`);
process.exit(0);
