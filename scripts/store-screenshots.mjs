#!/usr/bin/env node
/**
 * Génère les captures d'écran des fiches Play Store et App Store, les mêmes
 * pour les deux, en un seul passage reproductible : émulateurs Firebase
 * éphémères, données de démo fixes, puis Chrome headless qui rend l'app.
 *
 * L'app, pas le site : chaque page se charge avec une plateforme Capacitor
 * « maison » (window.CapacitorCustomPlatform, prévue par @capacitor/core),
 * si bien que `Capacitor.isNativePlatform()` répond vrai et que l'interface
 * est celle de l'app installée (barre d'onglets du bas, pas d'en-tête ni de
 * pied de page de site). Les plugins natifs retombent sur leur implémentation
 * web, ou échouent proprement quand ils n'en ont pas : rien n'attend une
 * réponse native qui ne viendrait jamais. Ni émulateur Android ni simulateur
 * iOS : un runner Linux suffit, en quelques minutes, et aucune barre système
 * d'une plateforme ne se retrouve dans la fiche de l'autre.
 *
 * Un seul jeu d'écrans, rendu dans trois formats, parce que les deux stores
 * n'acceptent pas les mêmes proportions (le Play Store refuse un côté plus de
 * deux fois plus long que l'autre, Apple exige du 6,9" au pixel près) :
 *   phone   fiche Play, téléphone : 360×640 @3x, soit 1080×1920 (9:16)
 *   iphone  fiche App Store, iPhone 6,9" : 440×956 @3x, soit 1320×2868
 *   ipad    fiche App Store, iPad 13" : 1032×1376 @2x, soit 2064×2752
 * En JPEG, sans canal alpha : Apple le refuse, Google l'accepte.
 *
 * Écrans capturés (dans l'ordre des fiches, SCREENS plus bas) :
 *   01 accueil connecté (tableau de bord)   05 bibliothèque
 *   02 horaires du jour (Paris)             06 lecture quotidienne
 *   03 session de partage de lecture        07 détail d'un chiour
 *   04 lecteur de texte (Tehilim 1)         08 calendrier des fêtes
 * Le Play Store en prend huit au plus par format (le compte y est), l'App
 * Store dix.
 *
 * Usage :
 *   npm run store:screenshots                      les trois formats
 *   npm run store:screenshots -- --device iphone   un seul (itération locale)
 *
 * Prérequis : CLI firebase + JDK 21 (émulateurs), Chrome de préférence (voir
 * launchBrowser). Les émulateurs de dev (npm run dev:local) doivent être
 * arrêtés : le script démarre les siens, vides, sur les mêmes ports, et
 * n'écrit jamais dans .emulator-data.
 *
 * Sortie, partagée par les deux fiches (voir store-assets/screenshots/) :
 *   store-assets/screenshots/fr-FR/{phone,iphone,ipad}-NN-nom.jpg
 * lue par scripts/play-listing.mjs (phone-*) et scripts/asc-screenshots.mjs
 * (iphone-*, ipad-*). En CI, le workflow store-screenshots.yml la produit
 * une fois par tag pour deploy-android.yml et deploy-ios.yml.
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  AUTH_PORT,
  FIRESTORE_PORT,
  createEmulatorUser,
  seedDoc,
  waitFor,
} from "./lib/firebase-emulator.mjs";

const root = join(import.meta.dirname, "..");
const outDir = join(root, "store-assets/screenshots/fr-FR");

// Ports des émulateurs : scripts/lib/firebase-emulator.mjs (même plage que
// firebase.json et src/firebase/*.ts).
const VITE_PORT = 5273; // hors du 5173 par défaut pour ne pas gêner un dev en cours

// Formats de rendu : taille CSS × densité = dimensions exactes exigées par
// chaque store (store-assets/screenshots/README.md).
const DEVICES = {
  phone: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 }, // 1080×1920, Play
  iphone: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 }, // 1320×2868, 6,9"
  ipad: { viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2 }, // 2064×2752, 13"
};

// --device iphone (répétable) : un format seulement, pour itérer vite en local.
const wantedDevices = process.argv
  .flatMap((arg, i, argv) => (arg === "--device" ? [argv[i + 1]] : []))
  .filter(Boolean);
for (const device of wantedDevices) {
  if (!(device in DEVICES)) {
    console.error(
      `store-screenshots: format inconnu « ${device} » (attendus : ${Object.keys(DEVICES).join(", ")})`,
    );
    process.exit(1);
  }
}
const devices = wantedDevices.length > 0 ? wantedDevices : Object.keys(DEVICES);

const DEMO_EMAIL = "demo@petite-jerusalem.fr";
const DEMO_PASSWORD = "demo-petite-jerusalem";
const DEMO_NAME = "Sarah Levy";
const SESSION_SLUG = "tehilim-pour-la-communaute";
const CHIOUR_SLUG = "la-force-de-la-priere";

// Position de l'appareil simulé : Paris, la ville des horaires capturés. Sans
// elle, la géolocalisation demandée par l'accueil n'aboutirait jamais.
const PARIS = { latitude: 48.8566, longitude: 2.3522 };

// Les astuces de première visite (useFeatureTips) se montrent dans l'app
// native à qui n'a pas encore vu la page : toutes marquées vues, sans quoi
// une bulle recouvrirait les captures. La liste est relue dans le code de
// l'app pour qu'une astuce ajoutée plus tard soit couverte d'office.
const TIP_IDS = (() => {
  const source = readFileSync(join(root, "src/composables/useFeatureTips.ts"), "utf8");
  const list = source.match(/export const TIP_IDS[^=]*=\s*\[([^\]]*)\]/)?.[1];
  const ids = list ? [...list.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]) : [];
  if (ids.length === 0) {
    throw new Error("TIP_IDS introuvable dans src/composables/useFeatureTips.ts");
  }
  return ids;
})();

// Même raison pour l'introduction de première ouverture (useOnboarding) : elle
// se remontre quand sa version change, la version vue est donc relue aussi.
const ONBOARDING_VERSION = (() => {
  const source = readFileSync(join(root, "src/composables/useOnboarding.ts"), "utf8");
  const version = source.match(/const ONBOARDING_VERSION = "([^"]+)"/)?.[1];
  if (!version) {
    throw new Error("ONBOARDING_VERSION introuvable dans src/composables/useOnboarding.ts");
  }
  return version;
})();

// --- Préparation de l'environnement -----------------------------------------

// Les émulateurs Firebase exigent Java >= 21. Sur macOS, le JDK de Homebrew
// est keg-only, invisible pour qui ne le cherche pas.
if (process.platform === "darwin") {
  const candidates = ["/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"];
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

const children = [];

/**
 * Lance un serveur de longue durée (émulateurs Firebase, Vite) en le rendant
 * tuable pour de bon.
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

/**
 * Arrêt gracieux, avant de sortir : SIGINT, puis attente de la fin de chaque
 * enfant (20 secondes au plus). La CLI firebase lance les JVM des émulateurs
 * dans leur propre session, hors de portée du SIGKILL de groupe de cleanup() :
 * seul son propre arrêt les referme, et un émulateur Firestore resté en vie
 * garde son port, qui bloque le lancement suivant.
 */
async function stopChildren() {
  const alive = children.filter((child) => child.exitCode === null && child.signalCode === null);
  await Promise.all(
    alive.map(
      (child) =>
        new Promise((resolve) => {
          const timer = setTimeout(resolve, 20000);
          child.once("exit", () => {
            clearTimeout(timer);
            resolve();
          });
          try {
            process.kill(-child.pid, "SIGINT");
          } catch {
            clearTimeout(timer);
            resolve();
          }
        }),
    ),
  );
}

// --- Émulateurs Firebase éphémères (vides : ni --import ni --export-on-exit) --

console.log("store-screenshots: démarrage des émulateurs Firebase (vides)…");
spawnChild("firebase", ["emulators:start", "--only", "auth,firestore"], { cwd: root });
await waitFor(`http://localhost:${AUTH_PORT}/`, "l'émulateur Auth", 90000);
await waitFor(`http://localhost:${FIRESTORE_PORT}/`, "l'émulateur Firestore", 90000);

// --- Données de démo ---------------------------------------------------------

console.log("store-screenshots: création du compte et des données de démo…");
const uid = await createEmulatorUser({
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
  displayName: DEMO_NAME,
});

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
  theme: "sunset",
  // Sans le décor de la fête du jour : une fiche générée pendant Souccot le
  // garderait jusqu'au tag suivant, en plein hiver.
  holidayThemes: false,
  fontLatin: "manrope",
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

// --- Écrans ------------------------------------------------------------------

/**
 * Les écrans des fiches, dans leur ordre d'affichage. `readyText` est un texte
 * que l'écran montre une fois chargé (pas un spinner attrapé trop tôt),
 * `beforeShot` un dernier geste avant la capture.
 */
const SCREENS = [
  { name: "01-accueil", path: "/", readyText: "Ma lecture quotidienne" },
  // Les horaires d'une ville nommée plutôt que ceux de « ma position » : la
  // capture dit Paris en toutes lettres, où que tourne le script.
  { name: "02-horaires", path: "/horaires/paris", readyText: "Paris" },
  {
    name: "03-partage-session",
    path: `/share-reading/session/${SESSION_SLUG}`,
    readyText: "Participe",
  },
  // URL canonique de Tehilim 1 (/lire/103 hors session redirige vers elle).
  { name: "04-lecture-tehilim", path: "/bibliotheque/tehilim/1", readyText: "Phonétique" },
  { name: "05-bibliotheque", path: "/bibliotheque", readyText: "Bibliothèque" },
  {
    name: "06-lecture-quotidienne",
    path: "/bibliotheque/lecture-du-jour",
    readyText: "Tehilim 1",
    // Le titre de la section calé en haut de l'écran montre le suivi du jour
    // (et laisse le lien de retour hors champ). Une marge au-dessus : collé
    // au bord, le haut des lettres serait rogné.
    beforeShot: (page) =>
      page
        .locator("text=Ma lecture quotidienne >> visible=true")
        .first()
        .evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 24)),
  },
  { name: "07-chiour", path: `/chiourim/${CHIOUR_SLUG}`, readyText: "Description" },
  // Le calendrier des fêtes, l'onglet voisin des horaires : ses lignes
  // disent l'heure d'allumage de chaque fête.
  { name: "08-calendrier", path: "/calendrier", readyText: "Allumage" },
];

// --- Navigateur --------------------------------------------------------------

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

/** Contexte « app native » fr-FR aux dimensions d'un format de DEVICES. */
async function newAppContext(browser, device) {
  const context = await browser.newContext({
    ...DEVICES[device],
    isMobile: true,
    hasTouch: true,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    reducedMotion: "reduce",
    geolocation: PARIS,
    permissions: ["geolocation"],
  });
  await context.addInitScript(
    ({ tipIds, onboardingVersion }) => {
      // Avant @capacitor/core : c'est ce qui fait de la page l'app native (voir
      // l'en-tête). Le nom n'est ni « ios » ni « android », pour qu'aucun
      // chemin propre à l'une des deux ne s'y trompe.
      window.CapacitorCustomPlatform = { name: "store-screenshots" };
      // Français forcé comme le ferait le sélecteur de langue. Consentement
      // analytics sur « denied » : la bannière recouvrirait le bas de chaque
      // capture, et une session de captures n'a rien à mesurer. Introduction
      // de première ouverture et astuces marquées vues : elles prendraient
      // l'écran (useOnboarding, useFeatureTips).
      localStorage.setItem("petite-jerusalem-locale", "fr");
      localStorage.setItem("pj_analytics_consent", "denied");
      localStorage.setItem("pj_onboarding_seen", onboardingVersion);
      localStorage.setItem("pj_tips_seen", JSON.stringify(tipIds));
    },
    { tipIds: TIP_IDS, onboardingVersion: ONBOARDING_VERSION },
  );
  return context;
}

/** Charge un écran et attend qu'il soit prêt à être capturé. */
async function openScreen(page, { path, readyText, beforeShot }) {
  // Pas de "networkidle" : Firestore garde une connexion ouverte en
  // permanence une fois connecté, l'événement n'arriverait jamais.
  await page.goto(`${baseUrl}${path}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  // `visible=true` : sans lui, `first()` peut se figer sur une occurrence
  // cachée du texte et ne jamais la voir devenir visible.
  await page.locator(`text=${readyText} >> visible=true`).first().waitFor({ timeout: 20000 });
  if (beforeShot) await beforeShot(page);
  // Laisse finir les chargements Firestore, les animations d'apparition et
  // l'estompage des barres de défilement.
  await page.waitForTimeout(2500);
}

/** Connexion du compte de démo par le formulaire, comme un utilisateur. */
async function signIn(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "load" });
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
}

/** Déroule tous les écrans dans un format ; rend les fichiers écrits. */
async function captureDevice(browser, device) {
  const context = await newAppContext(browser, device);
  const page = await context.newPage();
  const files = [];
  try {
    await signIn(page);
    for (const screen of SCREENS) {
      await openScreen(page, screen);
      const file = `${device}-${screen.name}.jpg`;
      await page.screenshot({ path: join(outDir, file), type: "jpeg", quality: 90 });
      console.log(`store-screenshots: ${file}`);
      files.push(file);
    }
  } finally {
    await context.close();
  }
  return files;
}

// Le jeu d'un format remplace l'existant : un fichier orphelin d'une
// exécution précédente (écran retiré, renommé) partirait sinon en trop.
mkdirSync(outDir, { recursive: true });
for (const file of readdirSync(outDir)) {
  const device = file.split("-")[0];
  if (devices.includes(device) && /\.(png|jpe?g)$/i.test(file)) rmSync(join(outDir, file));
}

// Les formats en parallèle, chacun dans son contexte (sa session, son
// stockage) : le passage entier tient dans le temps du plus lent.
let exitCode = 0;
try {
  const browser = await launchBrowser();
  try {
    const written = (
      await Promise.all(devices.map((device) => captureDevice(browser, device)))
    ).flat();
    console.log(`store-screenshots: ${written.length} captures écrites dans ${outDir}`);
  } finally {
    await browser.close();
  }
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await stopChildren();
}
process.exit(exitCode);
