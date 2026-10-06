#!/usr/bin/env node
/**
 * L'app de démonstration des vidéos : émulateurs Firebase vides, compte et
 * données de démo, serveur Vite en mode DEV branché sur eux. Reste en vie
 * jusqu'à Ctrl+C ; scripts/captures.mjs le lance seul s'il ne tourne pas.
 *
 * Les données reprennent celles des captures des stores
 * (scripts/store-screenshots.mjs) : même compte, même session de Tehilim,
 * mêmes chiourim, pour que les vidéos montrent la même app que les fiches.
 * S'y ajoutent des dates personnelles, pour le calendrier et l'accueil.
 *
 * Prérequis : CLI firebase et JDK 21 (comme store-screenshots), ports 8470,
 * 8471 et 5274 libres.
 */
import { spawn } from "node:child_process";
import { join } from "node:path";
import {
  AUTH_PORT,
  FIRESTORE_PORT,
  createEmulatorUser,
  seedDoc,
  waitFor,
} from "../../scripts/lib/firebase-emulator.mjs";

const appRoot = join(import.meta.dirname, "../..");
export const DEMO_PORT = 5274;
export const DEMO_EMAIL = "demo@petite-jerusalem.fr";
export const DEMO_PASSWORD = "demo-petite-jerusalem";
const DEMO_NAME = "Sarah Levy";

const children = [];
function spawnChild(command, args, options = {}) {
  const child = spawn(command, args, { detached: true, stdio: ["ignore", "pipe", "pipe"], ...options });
  child.stdout?.resume();
  child.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  children.push(child);
  return child;
}
function cleanup() {
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    try {
      process.kill(-child.pid, "SIGINT");
    } catch {
      /* déjà parti */
    }
  }
}
process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));

console.log("demo-server: émulateurs Firebase…");
spawnChild("firebase", ["emulators:start", "--only", "auth,firestore"], { cwd: appRoot });
await waitFor(`http://localhost:${AUTH_PORT}/`, "l'émulateur Auth", 90000);
await waitFor(`http://localhost:${FIRESTORE_PORT}/`, "l'émulateur Firestore", 90000);

console.log("demo-server: données de démo…");
const uid = await createEmulatorUser({ email: DEMO_EMAIL, password: DEMO_PASSWORD, displayName: DEMO_NAME });

const DAY = 24 * 3600 * 1000;
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// Tehilim 1 → 150 portent les ids 103 → 252 dans src/datas/textStudies.json.
const tehilimId = (n) => String(102 + n);

const participants = [
  { name: DEMO_NAME, userId: uid, from: 1, to: 5, read: 3 },
  { name: "David Benhamou", guest: "guest-david", from: 6, to: 15, read: 4 },
  { name: "Rivka Azoulay", guest: "guest-rivka", from: 16, to: 20, read: 5 },
  { name: "Yossef Amar", guest: "guest-yossef", from: 21, to: 30, read: 0 },
  { name: "Esther Toledano", guest: "guest-esther", from: 121, to: 125, read: 2 },
  { name: "Moché Elfassi", guest: "guest-moche", from: 145, to: 150, read: 1 },
  { name: "Hanna Cohen", guest: "guest-hanna", from: 31, to: 41, read: 6 },
  { name: "Elie Sebag", guest: "guest-elie", from: 90, to: 100, read: 3 },
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
await seedDoc("sessions", "demo-session-tehilim", {
  name: "Tehilim pour la communauté",
  type: "Tehilim",
  description:
    "Lisons les 150 Tehilim ensemble avant Roch Hodech : réservez vos psaumes et cochez-les une fois lus.",
  dateLimit: new Date(Date.now() + 21 * DAY),
  createdAt: new Date(Date.now() - 7 * DAY),
  personId: uid,
  creatorName: DEMO_NAME,
  slug: "tehilim-pour-la-communaute",
  isCompleted: false,
  reservations,
});

await seedDoc("userPreferences", uid, {
  theme: "sunset",
  holidayThemes: false,
  fontLatin: "manrope",
  fontHebrew: "frank",
  dailyReadingIds: [103, 104, 105, 125],
  dailyReadingProgress: { date: todayKey(), completedIds: [103] },
  fcmTokens: [],
  pushReminderEnabled: true,
  pushReminderHour: 7,
  pushReminderMinute: 30,
  pushLocale: "fr",
  // Mois hebcal : 7 Tichri, 8 'Hechvan, 9 Kislev.
  hebrewOccasions: [
    { id: "demo-anniv", name: "Anniversaire de Noa", kind: "birthday", day: 28, month: 7, reminder: "morning" },
    { id: "demo-azkara", name: "Leilouy nichmat de Mordekhaï ben Esther", kind: "yahrzeit", day: 3, month: 8, reminder: "nightfall" },
    { id: "demo-mariage", name: "Anniversaire de mariage", kind: "other", day: 12, month: 9, reminder: "weekBefore" },
  ],
});

const chiourim = [
  ["la-force-de-la-priere", "La force de la prière", "Rav David Cohen", "Emouna", 2520],
  ["paracha-de-la-semaine", "Paracha de la semaine : regards croisés", "Rav Yossef Attal", "Paracha", 1980],
  ["introduction-a-la-guemara", "Introduction à la Guemara", "Rav David Cohen", "Guemara", 3120],
  ["les-lois-de-chabbat", "Les lois de Chabbat", "Rav Moché Benhamou", "Halakha", 2760],
];
for (const [i, [slug, name, auteur, categorie, duration]] of chiourim.entries()) {
  await seedDoc("chiourim", slug, {
    slug,
    name,
    description:
      "Comment la prière transforme notre quotidien : sources dans le Talmud et conseils pratiques pour donner du sens à chaque tefila.",
    auteur,
    categories: [categorie],
    niveau: "Tous niveaux",
    duration,
    order: i + 1,
    audioPath: `chiourim/demo/${slug}.mp3`,
    mediaUrl: `https://demo.petite-jerusalem.fr/audio/${slug}.mp3`,
    fileSize: null,
    published: true,
    createdAt: new Date(Date.now() - 30 * DAY),
    updatedAt: new Date(Date.now() - 30 * DAY),
  });
}

console.log("demo-server: serveur Vite…");
spawnChild("npx", ["vite", "--port", String(DEMO_PORT), "--strictPort"], {
  cwd: appRoot,
  env: { ...process.env, STORE_SCREENSHOTS: "1" },
});
await waitFor(`http://localhost:${DEMO_PORT}`, "le serveur Vite");
console.log(`demo-server: prêt sur http://localhost:${DEMO_PORT}`);
// Le signal de disponibilité lu par captures.mjs.
process.send?.("ready");
