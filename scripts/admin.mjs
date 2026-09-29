#!/usr/bin/env node
/**
 * Le backoffice en ligne de commande : ce que font les pages /admin, sans
 * l'interface. Pour Claude (« ajoute une information pour la mise en ligne »),
 * pour la CI (les notes de version en information), et à la main.
 *
 *   node scripts/admin.mjs aide
 *
 * Tout est décrit dans docs/backoffice-cli.md. Les garde-fous :
 * - une commande qui écrit ne fait qu'un essai (ce qu'elle écrirait) tant
 *   qu'on ne passe pas --confirmer ;
 * - une notification ne part qu'avec --notifier, jamais par défaut ;
 * - --emulateur vise les émulateurs locaux (npm run dev:local) au lieu de la
 *   production.
 *
 * Accès : le SDK admin de Firebase (celui des functions, functions/node_modules),
 * avec les identifiants par défaut de Google (ADC). En local :
 * `gcloud auth application-default login` avec admin@phenixel.fr ; en CI, le
 * compte de service posé par google-github-actions/auth.
 */
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { hostname, userInfo } from "node:os";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import {
  AUDIO_CONTENT_TYPES,
  BackofficeInputError,
  announcementFields,
  audioExtension,
  downloadUrl,
  localizedText,
  parseKind,
  parseList,
  releaseAnnouncement,
  releaseAnnouncementId,
  slugify,
  studioLink,
  versionOf,
} from "./lib/backoffice.mjs";

const PROJECT_ID = "petite-jerusalem-dev";
const STORAGE_BUCKET = "petite-jerusalem-dev.firebasestorage.app";
const REPO = "Phenixel/PetiteJerusalem";
const EMULATORS = { firestore: "localhost:8470", storage: "localhost:8472" };

// ---- Options -----------------------------------------------------------------

const OPTIONS = {
  confirmer: { type: "boolean" },
  emulateur: { type: "boolean" },
  json: { type: "boolean" },
  aide: { type: "boolean", short: "h" },
  // Informations
  type: { type: "string" },
  titre: { type: "string" },
  texte: { type: "string" },
  "texte-fichier": { type: "string" },
  "titre-en": { type: "string" },
  "texte-en": { type: "string" },
  "titre-he": { type: "string" },
  "texte-he": { type: "string" },
  lien: { type: "string" },
  "lien-texte": { type: "string" },
  version: { type: "string" },
  publier: { type: "boolean" },
  depublier: { type: "boolean" },
  notifier: { type: "boolean" },
  resolu: { type: "boolean" },
  "en-cours": { type: "boolean" },
  tag: { type: "string" },
  fichier: { type: "string" },
  brouillon: { type: "boolean" },
  date: { type: "string" },
  // Chiourim
  description: { type: "string" },
  auteur: { type: "string" },
  serie: { type: "string" },
  "sans-serie": { type: "boolean" },
  episode: { type: "string" },
  categories: { type: "string" },
  niveau: { type: "string" },
  duree: { type: "string" },
  filtre: { type: "string" },
  recherche: { type: "string" },
};

const { values: opts, positionals } = parseArgs({
  options: OPTIONS,
  allowPositionals: true,
  strict: true,
});
const [command = "aide", ...args] = positionals;

if (opts.emulateur) {
  process.env.FIRESTORE_EMULATOR_HOST = EMULATORS.firestore;
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = EMULATORS.storage;
}
const target = opts.emulateur ? "émulateurs locaux" : `production (${PROJECT_ID})`;
const apply = opts.confirmer === true;

/** Qui écrit, gardé sur le document (`updatedVia`). */
const VIA = process.env.GITHUB_ACTIONS
  ? `ci (${process.env.GITHUB_WORKFLOW ?? "GitHub Actions"})`
  : `cli (${userInfo().username}@${hostname()})`;

// ---- Firebase ------------------------------------------------------------------

/**
 * Une clé de compte de service passée par l'environnement, pour les machines
 * sans gcloud (sessions cloud de Claude Code) : `PJ_ADMIN_SERVICE_ACCOUNT`,
 * le JSON de la clé tel quel ou encodé en base64. Sans elle, les
 * identifiants par défaut de Google (ADC). Voir docs/backoffice-cli.md.
 */
let parsedKey;
function serviceAccount() {
  if (parsedKey !== undefined) return parsedKey;
  const raw = process.env.PJ_ADMIN_SERVICE_ACCOUNT?.trim();
  parsedKey = null;
  if (!raw || opts.emulateur) return parsedKey;
  try {
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    parsedKey = JSON.parse(json);
  } catch {
    fail("PJ_ADMIN_SERVICE_ACCOUNT illisible : le JSON de la clé, tel quel ou en base64.");
  }
  if (parsedKey.project_id !== PROJECT_ID) {
    fail(
      `PJ_ADMIN_SERVICE_ACCOUNT est une clé du projet ${parsedKey.project_id}, pas ${PROJECT_ID}.`,
    );
  }
  return parsedKey;
}

// Le SDK admin des functions : pas de dépendance de plus à la racine, et la
// CI l'installe déjà pour déployer (npm ci --prefix functions).
const requireFromFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
let admin = null;
function firebase() {
  if (admin) return admin;
  let app, firestore, storage;
  try {
    app = requireFromFunctions("firebase-admin/app");
    firestore = requireFromFunctions("firebase-admin/firestore");
    storage = requireFromFunctions("firebase-admin/storage");
  } catch {
    fail("firebase-admin introuvable : lancer d'abord `npm ci --prefix functions`.");
  }
  app.initializeApp({
    projectId: PROJECT_ID,
    storageBucket: STORAGE_BUCKET,
    ...(serviceAccount() ? { credential: app.cert(serviceAccount()) } : {}),
  });
  admin = {
    db: firestore.getFirestore(),
    FieldValue: firestore.FieldValue,
    Timestamp: firestore.Timestamp,
    bucket: storage.getStorage().bucket(STORAGE_BUCKET),
  };
  return admin;
}

// ---- Sortie --------------------------------------------------------------------

function fail(message) {
  console.error(`admin: ${message}`);
  process.exit(1);
}

function out(lines, data) {
  if (opts.json) console.log(JSON.stringify(data ?? null, null, 2));
  else for (const line of lines) console.log(line);
}

/** Une écriture : faite avec --confirmer, sinon seulement décrite. */
async function write(description, action) {
  if (!apply) {
    out([`[essai, ${target}] ${description}`, "Rien n'est écrit : relancer avec --confirmer."], {
      dryRun: true,
      target,
      description,
    });
    return false;
  }
  await action();
  return true;
}

const day = (value) => {
  const date = value?.toDate?.() ?? (value instanceof Date ? value : null);
  return date ? date.toISOString().slice(0, 16).replace("T", " ") : "-";
};

function readText(value, file) {
  if (file) return file === "-" ? readFileSync(0, "utf8") : readFileSync(file, "utf8");
  return value;
}

/** « 3 » → 3 ; vide → null ; autre chose qu'un entier positif : erreur. */
function episodeOf(value) {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 10000) fail(`épisode invalide : ${value}`);
  return n;
}

// ---- Informations --------------------------------------------------------------

function announcementInput(existing = null) {
  const kind = opts.type ? parseKind(opts.type) : (existing?.kind ?? null);
  if (!kind) fail("--type requis : nouveaute, mise-a-jour, incident ou question.");
  const pick = (flag, current) => (opts[flag] !== undefined ? opts[flag] : (current ?? ""));
  const texteFr = readText(opts.texte, opts["texte-fichier"]);
  const published = opts.publier ? true : opts.depublier ? false : existing?.published === true;
  return {
    kind,
    title: localizedText(
      pick("titre", existing?.title?.fr),
      pick("titre-en", existing?.title?.en),
      pick("titre-he", existing?.title?.he),
    ),
    body: localizedText(
      texteFr !== undefined ? texteFr : existing?.body?.fr,
      pick("texte-en", existing?.body?.en),
      pick("texte-he", existing?.body?.he),
    ),
    link: pick("lien", existing?.link?.url),
    linkLabel: localizedText(pick("lien-texte", existing?.link?.label?.fr)),
    version: pick("version", existing?.version),
    resolved: opts.resolu ? true : opts["en-cours"] ? false : existing?.resolved === true,
    published,
    notify: opts.notifier === true || existing?.notify === true,
  };
}

/**
 * `--date` : la date de publication à poser au lieu de maintenant, pour
 * reprendre un historique (les notes des versions passées). Une date à venir
 * est refusée : l'information serait cachée sous les autres jusque-là.
 */
function publicationDate() {
  if (!opts.date) return null;
  const date = new Date(opts.date);
  if (Number.isNaN(date.getTime()))
    fail(`--date illisible : ${opts.date} (AAAA-MM-JJ ou date ISO).`);
  if (date.getTime() > Date.now()) fail("--date ne peut pas être dans le futur.");
  // Une information antidatée est de l'historique : elle ne réveille personne.
  if (opts.notifier)
    fail("--date et --notifier ne vont pas ensemble : on ne notifie pas un historique.");
  return date;
}

/**
 * Écrit une information comme le backoffice (adminService.saveAnnouncement) :
 * `publishedAt` posé à la première publication seulement (ou, avec --date,
 * à la date donnée), `notifiedAt` jamais touché (il appartient à la Cloud
 * Function onAnnouncementWritten).
 */
async function saveAnnouncement(id, fields, existing) {
  const { db, FieldValue, Timestamp } = firebase();
  const date = publicationDate();
  const publishedAt = date ? Timestamp.fromDate(date) : FieldValue.serverTimestamp();
  const data = {
    ...fields,
    updatedAt: FieldValue.serverTimestamp(),
    updatedVia: VIA,
    ...(fields.published && (date || !existing?.publishedAt) ? { publishedAt } : {}),
  };
  if (existing) {
    await db.collection("announcements").doc(id).update(data);
    return id;
  }
  const ref = id ? db.collection("announcements").doc(id) : db.collection("announcements").doc();
  await ref.set({
    ...data,
    publishedAt: fields.published ? publishedAt : null,
    notifiedAt: null,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/** « , datée du 2026-07-21 » dans le résumé d'un essai, si --date est passé. */
function dateNote() {
  const date = publicationDate();
  return date ? `, datée du ${date.toISOString().slice(0, 16).replace("T", " ")}` : "";
}

/** Ce que l'écriture déclenchera : la même règle que la Cloud Function. */
function notifyNote(fields, existing) {
  const sends =
    fields.published &&
    fields.notify &&
    !existing?.notifiedAt &&
    !(existing?.published === true && existing?.notify === true);
  return sends
    ? "UNE NOTIFICATION PARTIRA vers tous les appareils abonnés."
    : "Aucune notification ne partira.";
}

async function getAnnouncement(id) {
  const snap = await firebase().db.collection("announcements").doc(id).get();
  if (!snap.exists) fail(`information introuvable : ${id}`);
  return snap.data();
}

function describeAnnouncement(id, a) {
  const state = a.published ? "publiée" : "brouillon";
  const extra = [
    a.kind === "incident" ? (a.resolved ? "résolu" : "EN COURS") : null,
    a.version ? `v${a.version}` : null,
    a.notifiedAt ? `notifiée ${day(a.notifiedAt)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return `${id}  [${a.kind}, ${state}${extra ? `, ${extra}` : ""}]  ${day(a.publishedAt)}  ${a.title?.fr ?? ""}`;
}

const commands = {};

commands["info:liste"] = async () => {
  const snap = await firebase().db.collection("announcements").get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  docs.sort(
    (a, b) => (b.publishedAt?.toMillis?.() ?? Infinity) - (a.publishedAt?.toMillis?.() ?? Infinity),
  );
  out(docs.length ? docs.map((a) => describeAnnouncement(a.id, a)) : ["Aucune information."], docs);
};

commands["info:voir"] = async ([id]) => {
  if (!id) fail("usage : info:voir <id>");
  const a = await getAnnouncement(id);
  out(
    [
      describeAnnouncement(id, a),
      "",
      a.body?.fr ?? "",
      ...(a.link ? ["", `Lien : ${a.link.url}`] : []),
      ...(a.title?.en ? ["", `EN : ${a.title.en}`] : []),
      ...(a.title?.he ? [`HE : ${a.title.he}`] : []),
    ],
    { id, ...a },
  );
};

commands["info:creer"] = async () => {
  const fields = announcementFields(announcementInput());
  const summary = `Créer l'information « ${fields.title.fr} » (${fields.kind}, ${fields.published ? "publiée" : "brouillon"}${dateNote()}). ${notifyNote(fields, null)}`;
  let id = null;
  if (await write(summary, async () => (id = await saveAnnouncement(null, fields, null)))) {
    out([`Information créée : ${id}`, notifyNote(fields, null)], { id, ...fields });
  }
};

commands["info:modifier"] = async ([id]) => {
  if (!id) fail("usage : info:modifier <id> [options]");
  const existing = await getAnnouncement(id);
  const fields = announcementFields(announcementInput(existing));
  const summary = `Modifier ${id} (« ${fields.title.fr} », ${fields.published ? "publiée" : "brouillon"}). ${notifyNote(fields, existing)}`;
  if (await write(summary, () => saveAnnouncement(id, fields, existing))) {
    out([`Information modifiée : ${id}`, notifyNote(fields, existing)], { id, ...fields });
  }
};

commands["info:resoudre"] = async ([id]) => {
  if (!id) fail("usage : info:resoudre <id>");
  const existing = await getAnnouncement(id);
  if (existing.kind !== "incident") fail(`${id} n'est pas un incident.`);
  const { db, FieldValue } = firebase();
  if (
    await write(`Marquer l'incident ${id} résolu (« ${existing.title?.fr} »).`, () =>
      db
        .collection("announcements")
        .doc(id)
        .update({ resolved: true, updatedAt: FieldValue.serverTimestamp(), updatedVia: VIA }),
    )
  ) {
    out([`Incident résolu : ${id}`], { id, resolved: true });
  }
};

commands["info:supprimer"] = async ([id]) => {
  if (!id) fail("usage : info:supprimer <id>");
  const existing = await getAnnouncement(id);
  if (
    await write(`Supprimer définitivement ${id} (« ${existing.title?.fr} »).`, () =>
      firebase().db.collection("announcements").doc(id).delete(),
    )
  ) {
    out([`Information supprimée : ${id}`], { id, deleted: true });
  }
};

/**
 * Un GET HTTP par curl, qui suit le relais réseau de la machine
 * (HTTPS_PROXY) : le `fetch` de Node l'ignore, et dans une session cloud de
 * Claude il sort alors en direct, depuis une adresse partagée dont le quota
 * GitHub anonyme est épuisé (403). `fetch` seulement si curl manque.
 * Rend { status, text }, status 0 si rien n'a répondu.
 */
async function httpGet(url, headers) {
  const args = ["-s", "-L", "-w", "\n%{http_code}"];
  for (const [name, value] of Object.entries(headers)) args.push("-H", `${name}: ${value}`);
  try {
    const raw = execFileSync("curl", [...args, url], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 10 * 1024 * 1024,
    });
    const cut = raw.lastIndexOf("\n");
    return { status: Number(raw.slice(cut + 1)) || 0, text: raw.slice(0, cut) };
  } catch (error) {
    if (error?.code !== "ENOENT") return { status: 0, text: "" };
  }
  const response = await fetch(url, { headers }).catch(() => null);
  return response
    ? { status: response.status, text: await response.text() }
    : { status: 0, text: "" };
}

/**
 * Le texte de la release GitHub d'une version : par `gh` s'il est là (CI,
 * poste), sinon par l'API REST de GitHub, que le dépôt public ouvre sans
 * jeton (une session cloud de Claude n'a pas `gh`). GH_TOKEN est passé s'il
 * existe, pour la limite de requêtes.
 */
async function releaseBody(version) {
  const path = `repos/${REPO}/releases/tags/v${version}`;
  try {
    return execFileSync("gh", ["api", path, "--jq", '.body // ""'], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (error) {
    if (error?.code !== "ENOENT") fail(`release GitHub v${version} introuvable (gh api).`);
  }
  const url = `https://api.github.com/${path}`;
  const accept = { Accept: "application/vnd.github+json" };
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  let response = await httpGet(
    url,
    token ? { ...accept, Authorization: `Bearer ${token}` } : accept,
  );
  // Un jeton refusé : en session cloud, GH_TOKEN vaut « proxy-injected », une
  // valeur que seul le relais GitHub de la session remplace. Le dépôt étant
  // public, on relit sans jeton.
  if (token && (response.status === 401 || response.status === 403)) {
    response = await httpGet(url, accept);
  }
  if (response.status === 0) fail("api.github.com injoignable.");
  if (response.status === 404) fail(`release GitHub v${version} introuvable.`);
  if (response.status !== 200) {
    const reason = /rate limit/i.test(response.text) ? " (quota de requêtes GitHub épuisé)" : "";
    fail(`api.github.com a répondu ${response.status}${reason}.`);
  }
  return JSON.parse(response.text).body ?? "";
}

/**
 * La note de version d'un tag en information « Mise à jour ». Idempotent :
 * l'information s'appelle `release-vX.Y.Z`, une release modifiée la met à
 * jour (texte, traductions) sans toucher à sa date ni à sa publication.
 */
commands["info:depuis-release"] = async () => {
  const version = versionOf(opts.tag ?? opts.version);
  if (!version) fail("--tag vX.Y.Z (ou --version X.Y.Z avec --fichier) requis.");
  let body = "";
  if (opts.fichier) {
    body = readFileSync(opts.fichier, "utf8");
  } else {
    body = await releaseBody(version);
  }
  const input = releaseAnnouncement(version, body);
  if (!input) {
    out([`La release v${version} n'a pas de texte français : pas d'information.`], {
      skipped: true,
      version,
    });
    return;
  }
  const id = releaseAnnouncementId(version);
  const snap = await firebase().db.collection("announcements").doc(id).get();
  const existing = snap.exists ? snap.data() : null;
  const fields = announcementFields({
    ...input,
    linkLabel: { fr: "" },
    published: existing ? existing.published === true : opts.brouillon !== true,
    notify: opts.notifier === true || existing?.notify === true,
  });
  const verb = existing ? "Mettre à jour" : "Créer";
  const summary = `${verb} l'information ${id} (« ${fields.title.fr} », ${fields.published ? "publiée" : "brouillon"}${dateNote()}, langues : ${Object.keys(fields.body).join(", ")}). ${notifyNote(fields, existing)}`;
  if (await write(summary, () => saveAnnouncement(id, fields, existing))) {
    out([`${existing ? "Mise à jour" : "Créée"} : ${id}`, notifyNote(fields, existing)], {
      id,
      ...fields,
    });
  }
};

// ---- Chiourim ------------------------------------------------------------------

async function getChiour(slug) {
  const snap = await firebase().db.collection("chiourim").doc(slug).get();
  if (!snap.exists) fail(`chiour introuvable : ${slug}`);
  return snap.data();
}

async function getAuteur(auteurId) {
  const snap = await firebase().db.collection("auteurs").doc(auteurId).get();
  if (!snap.exists) fail(`auteur introuvable : ${auteurId} (voir auteur:liste)`);
  return { id: snap.id, ...snap.data() };
}

async function checkSerie(serieId, auteurId) {
  const snap = await firebase().db.collection("series").doc(serieId).get();
  if (!snap.exists) fail(`série introuvable : ${serieId} (voir auteur:voir ${auteurId})`);
  if (snap.data().auteurId !== auteurId) fail(`la série ${serieId} n'est pas de ${auteurId}.`);
}

function describeChiour(c) {
  const minutes = c.duration ? `${Math.round(c.duration / 60)} min` : "?";
  return `${c.slug}  [${c.published ? "publié" : "brouillon"}]  ${c.auteur ?? "sans auteur"}  ${minutes}  ${c.views ?? 0} vues  ${c.name}`;
}

commands["chiour:liste"] = async () => {
  const snap = await firebase().db.collection("chiourim").get();
  let list = snap.docs.map((d) => d.data());
  const filters = {
    brouillons: (c) => !c.published,
    publies: (c) => c.published,
    "sans-auteur": (c) => !c.auteurId,
    "sans-serie": (c) => !c.serieId,
  };
  if (opts.filtre) {
    if (!filters[opts.filtre]) fail(`--filtre : ${Object.keys(filters).join(", ")}`);
    list = list.filter(filters[opts.filtre]);
  }
  if (opts.auteur) list = list.filter((c) => c.auteurId === opts.auteur);
  if (opts.recherche) {
    const term = opts.recherche.toLowerCase();
    list = list.filter((c) => `${c.name} ${c.auteur ?? ""}`.toLowerCase().includes(term));
  }
  list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  out(list.length ? list.map(describeChiour) : ["Aucun chiour."], list);
};

commands["chiour:voir"] = async ([slug]) => {
  if (!slug) fail("usage : chiour:voir <slug>");
  const c = await getChiour(slug);
  out(
    [
      describeChiour(c),
      `Série : ${c.serieId ?? "-"}${c.episode ? ` (épisode ${c.episode})` : ""}`,
      `Catégories : ${(c.categories ?? []).join(", ") || "-"}`,
      `Audio : ${c.mediaUrl ?? "-"}`,
      "",
      c.description ?? "",
    ],
    c,
  );
};

async function setPublished(slugs, published) {
  if (slugs.length === 0) fail(`usage : chiour:${published ? "publier" : "depublier"} <slug>…`);
  const docs = await Promise.all(slugs.map(getChiour));
  const { db, FieldValue } = firebase();
  const names = docs.map((c) => `« ${c.name} »`).join(", ");
  if (
    await write(
      `${published ? "Publier" : "Dépublier"} ${slugs.length} chiour(im) : ${names}.`,
      async () => {
        const batch = db.batch();
        for (const slug of slugs) {
          batch.update(db.collection("chiourim").doc(slug), {
            published,
            updatedAt: FieldValue.serverTimestamp(),
            updatedVia: VIA,
          });
        }
        await batch.commit();
      },
    )
  ) {
    out([`${published ? "Publié(s)" : "Dépublié(s)"} : ${slugs.join(", ")}`], { slugs, published });
  }
}

commands["chiour:publier"] = (slugs) => setPublished(slugs, true);
commands["chiour:depublier"] = (slugs) => setPublished(slugs, false);

commands["chiour:modifier"] = async ([slug]) => {
  if (!slug) fail("usage : chiour:modifier <slug> [options]");
  const c = await getChiour(slug);
  const fields = {};
  if (opts.titre !== undefined) fields.name = opts.titre.trim();
  if (opts.description !== undefined) fields.description = opts.description.trim();
  if (opts.categories !== undefined) fields.categories = parseList(opts.categories);
  if (opts.niveau !== undefined) fields.niveau = opts.niveau.trim() || null;
  if (opts.episode !== undefined) fields.episode = episodeOf(opts.episode);
  const auteurId = opts.auteur ?? c.auteurId ?? null;
  if (opts.auteur) {
    const auteur = await getAuteur(opts.auteur);
    fields.auteurId = auteur.id;
    fields.auteur = auteur.name;
  }
  if (opts["sans-serie"]) {
    fields.serieId = null;
    fields.episode = null;
  } else if (opts.serie) {
    await checkSerie(opts.serie, auteurId);
    fields.serieId = opts.serie;
  }
  if (opts.publier) fields.published = true;
  if (opts.depublier) fields.published = false;
  if (fields.name === "") fail("le titre ne peut pas être vide.");
  if (Object.keys(fields).length === 0) fail("rien à modifier (voir `aide`).");
  const { db, FieldValue } = firebase();
  if (
    await write(`Modifier ${slug} : ${JSON.stringify(fields)}.`, () =>
      db
        .collection("chiourim")
        .doc(slug)
        .update({ ...fields, updatedAt: FieldValue.serverTimestamp(), updatedVia: VIA }),
    )
  ) {
    out([`Chiour modifié : ${slug}`], { slug, ...fields });
  }
};

/** La durée d'un fichier audio en secondes, par ffprobe s'il est installé. */
function probeDuration(path) {
  try {
    const raw = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
      { encoding: "utf8" },
    );
    const seconds = Number.parseFloat(raw.trim());
    return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null;
  } catch {
    return null;
  }
}

/**
 * Ajoute un chiour avec son audio, comme le dépose le studio d'un auteur
 * (functions/src/studio.ts, studioSubmitChiour) : fichier sous
 * `chiourim/{slug}/audio.{ext}` avec un jeton de téléchargement permanent,
 * document au même slug, en brouillon sauf --publier.
 */
commands["chiour:ajouter"] = async ([file]) => {
  if (!file || !existsSync(file))
    fail("usage : chiour:ajouter <fichier audio> --titre … --auteur <id>");
  const ext = audioExtension(file);
  const name = opts.titre?.trim();
  if (!name) fail("--titre requis.");
  if (!opts.auteur) fail("--auteur <id> requis (voir auteur:liste).");
  const auteur = await getAuteur(opts.auteur);
  if (opts.serie) await checkSerie(opts.serie, auteur.id);
  const base = slugify(name);
  if (!base) fail("titre invalide.");
  const { db, FieldValue, bucket } = firebase();
  let slug = base;
  for (let i = 2; (await db.collection("chiourim").doc(slug).get()).exists; i += 1) {
    slug = `${base}-${i}`;
  }
  const duration = opts.duree ? Math.round(Number(opts.duree)) : probeDuration(file);
  const fileSize = statSync(file).size;
  const audioPath = `chiourim/${slug}/audio.${ext}`;
  const published = opts.publier === true;
  const summary = `Ajouter le chiour ${slug} (« ${name} », ${auteur.name}, ${duration ? `${Math.round(duration / 60)} min` : "durée inconnue"}, ${(fileSize / 1048576).toFixed(1)} Mo, ${published ? "publié" : "brouillon"}) : envoi de ${basename(file)} vers ${audioPath}.`;
  const done = await write(summary, async () => {
    const token = randomUUID();
    await bucket.upload(file, {
      destination: audioPath,
      metadata: {
        contentType: AUDIO_CONTENT_TYPES[ext],
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
    const mediaUrl = downloadUrl(
      bucket.name,
      audioPath,
      token,
      process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? null,
    );
    await db
      .collection("chiourim")
      .doc(slug)
      .set({
        slug,
        name,
        description: opts.description?.trim() ?? "",
        auteur: auteur.name,
        auteurId: auteur.id,
        categories: parseList(opts.categories),
        niveau: opts.niveau?.trim() || null,
        serieId: opts.serie ?? null,
        episode: episodeOf(opts.episode),
        audioPath,
        mediaUrl,
        duration,
        fileSize,
        published,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedVia: VIA,
      });
  });
  if (done) {
    out([`Chiour ajouté : ${slug}`, `Fiche : https://petite-jerusalem.fr/admin/chiourim/${slug}`], {
      slug,
      published,
    });
  }
};

// ---- Auteurs et séries ---------------------------------------------------------

commands["auteur:liste"] = async () => {
  const { db } = firebase();
  const [auteurs, tokens, chiourim] = await Promise.all([
    db.collection("auteurs").get(),
    db.collection("studioTokens").where("active", "==", true).get(),
    db.collection("chiourim").get(),
  ]);
  const linked = new Set(tokens.docs.map((d) => d.data().auteurId));
  const rows = auteurs.docs
    .map((d) => {
      const own = chiourim.docs.map((c) => c.data()).filter((c) => c.auteurId === d.id);
      return {
        id: d.id,
        name: d.data().name,
        published: own.filter((c) => c.published).length,
        drafts: own.filter((c) => !c.published).length,
        studioLink: linked.has(d.id),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  out(
    rows.length
      ? rows.map(
          (a) =>
            `${a.id}  ${a.name}  ${a.published} publié(s), ${a.drafts} brouillon(s)  ${a.studioLink ? "lien studio actif" : "SANS lien studio"}`,
        )
      : ["Aucun auteur."],
    rows,
  );
};

commands["auteur:voir"] = async ([auteurId]) => {
  if (!auteurId) fail("usage : auteur:voir <id>");
  const auteur = await getAuteur(auteurId);
  const series = await firebase().db.collection("series").where("auteurId", "==", auteurId).get();
  out(
    [
      `${auteur.id}  ${auteur.name}`,
      "Séries :",
      ...(series.empty ? ["  (aucune)"] : series.docs.map((d) => `  ${d.id}  ${d.data().name}`)),
    ],
    { ...auteur, series: series.docs.map((d) => ({ id: d.id, ...d.data() })) },
  );
};

/** Un lien studio neuf : 32 octets aléatoires, le document EST le secret. */
async function createStudioToken(auteurId, auteurName) {
  const { db, FieldValue } = firebase();
  const token = randomBytes(32).toString("hex");
  await db.collection("studioTokens").doc(token).set({
    auteurId,
    auteurName,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  return token;
}

commands["auteur:creer"] = async (words) => {
  const name = words.join(" ").trim();
  if (!name) fail('usage : auteur:creer "Nom de l\'auteur"');
  const slug = slugify(name);
  const { db, FieldValue } = firebase();
  if ((await db.collection("auteurs").doc(slug).get()).exists)
    fail(`l'auteur ${slug} existe déjà.`);
  let token = null;
  const done = await write(`Créer l'auteur ${slug} (« ${name} ») et son lien studio.`, async () => {
    await db.collection("auteurs").doc(slug).set({
      name,
      slug,
      bio: "",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    token = await createStudioToken(slug, name);
  });
  if (done) {
    out(
      [
        `Auteur créé : ${slug}`,
        `Lien studio (à transmettre à l'auteur, il ne se remontre pas) : ${studioLink(token)}`,
      ],
      { id: slug, name, studioLink: studioLink(token) },
    );
  }
};

/** Remplace le lien studio d'un auteur : l'ancien cesse de fonctionner. */
commands["auteur:lien"] = async ([auteurId]) => {
  if (!auteurId) fail("usage : auteur:lien <id>");
  const auteur = await getAuteur(auteurId);
  const { db } = firebase();
  const existing = await db.collection("studioTokens").where("auteurId", "==", auteurId).get();
  let token = null;
  const done = await write(
    `Nouveau lien studio pour ${auteur.name} (${existing.size} ancien(s) lien(s) supprimé(s)).`,
    async () => {
      const batch = db.batch();
      existing.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      token = await createStudioToken(auteur.id, auteur.name);
    },
  );
  if (done) {
    out([`Nouveau lien studio : ${studioLink(token)}`], { studioLink: studioLink(token) });
  }
};

commands["serie:creer"] = async ([auteurId, ...words]) => {
  const name = words.join(" ").trim();
  if (!auteurId || !name) fail('usage : serie:creer <auteurId> "Nom de la série"');
  await getAuteur(auteurId);
  const serieId = `${auteurId}--${slugify(name)}`;
  const { db, FieldValue } = firebase();
  if ((await db.collection("series").doc(serieId).get()).exists)
    fail(`la série ${serieId} existe déjà.`);
  if (
    await write(`Créer la série ${serieId} (« ${name} »).`, () =>
      db.collection("series").doc(serieId).set({
        name,
        slug: serieId,
        auteurId,
        description: "",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
    )
  ) {
    out([`Série créée : ${serieId}`], { id: serieId, name });
  }
};

// ---- Sessions (modération) -----------------------------------------------------

async function openReports(sessionId = null) {
  let query = firebase().db.collection("reports").where("status", "==", "open");
  if (sessionId) query = query.where("sessionId", "==", sessionId);
  return (await query.get()).docs;
}

commands["session:signalements"] = async () => {
  const reports = await openReports();
  const bySession = new Map();
  for (const r of reports) {
    const data = r.data();
    const list = bySession.get(data.sessionId) ?? [];
    list.push({ id: r.id, ...data });
    bySession.set(data.sessionId, list);
  }
  const lines = [];
  for (const [sessionId, list] of bySession) {
    lines.push(`${sessionId}  « ${list[0].sessionName} »  ${list.length} signalement(s)`);
    for (const r of list) lines.push(`    ${r.reason}${r.details ? ` : ${r.details}` : ""}`);
  }
  out(lines.length ? lines : ["Aucun signalement ouvert."], Object.fromEntries(bySession));
};

commands["session:masquer"] = async ([sessionId]) => {
  if (!sessionId) fail("usage : session:masquer <id>");
  const { db, FieldValue } = firebase();
  const snap = await db.collection("sessions").doc(sessionId).get();
  if (!snap.exists) fail(`session introuvable : ${sessionId}`);
  if (
    await write(`Masquer la session ${sessionId} (« ${snap.data().name} »).`, () =>
      snap.ref.update({
        hidden: true,
        hiddenAt: FieldValue.serverTimestamp(),
        hiddenReason: "admin",
      }),
    )
  ) {
    out([`Session masquée : ${sessionId}`], { sessionId, hidden: true });
  }
};

/** Démasque et résout ses signalements ouverts, comme adminService.unhideSession. */
commands["session:demasquer"] = async ([sessionId]) => {
  if (!sessionId) fail("usage : session:demasquer <id>");
  const { db } = firebase();
  const snap = await db.collection("sessions").doc(sessionId).get();
  if (!snap.exists) fail(`session introuvable : ${sessionId}`);
  const reports = await openReports(sessionId);
  if (
    await write(
      `Démasquer la session ${sessionId} (« ${snap.data().name} ») et résoudre ${reports.length} signalement(s).`,
      async () => {
        const batch = db.batch();
        batch.update(snap.ref, { hidden: false, reportsCount: 0 });
        reports.forEach((r) => batch.update(r.ref, { status: "resolved" }));
        await batch.commit();
      },
    )
  ) {
    out([`Session démasquée : ${sessionId}`], { sessionId, hidden: false });
  }
};

// ---- État ----------------------------------------------------------------------

/** Ce que la vue d'ensemble du backoffice met dans « À traiter ». */
commands.etat = async () => {
  const { db } = firebase();
  const [chiourim, reports, announcements, tokens, auteurs] = await Promise.all([
    db.collection("chiourim").get(),
    db.collection("reports").where("status", "==", "open").get(),
    db.collection("announcements").get(),
    db.collection("studioTokens").where("active", "==", true).get(),
    db.collection("auteurs").get(),
  ]);
  const list = chiourim.docs.map((d) => d.data());
  const anns = announcements.docs.map((d) => ({ id: d.id, ...d.data() }));
  const incidents = anns.filter((a) => a.kind === "incident" && a.published && !a.resolved);
  const linked = new Set(tokens.docs.map((d) => d.data().auteurId));
  const state = {
    chiourimPublished: list.filter((c) => c.published).length,
    chiourimDrafts: list.filter((c) => !c.published).map((c) => c.slug),
    chiourimWithoutAuthor: list.filter((c) => !c.auteurId).map((c) => c.slug),
    reportedSessions: [...new Set(reports.docs.map((r) => r.data().sessionId))],
    ongoingIncidents: incidents.map((a) => a.id),
    announcementDrafts: anns.filter((a) => !a.published).map((a) => a.id),
    authorsWithoutStudioLink: auteurs.docs.filter((d) => !linked.has(d.id)).map((d) => d.id),
  };
  out(
    [
      `Cible : ${target}`,
      `Chiourim en ligne : ${state.chiourimPublished}`,
      `À relire : ${state.chiourimDrafts.length}${state.chiourimDrafts.length ? `  (${state.chiourimDrafts.join(", ")})` : ""}`,
      `Sans auteur : ${state.chiourimWithoutAuthor.length}`,
      `Sessions signalées : ${state.reportedSessions.length}`,
      `Incidents en cours : ${incidents.length ? incidents.map((a) => `${a.id} « ${a.title?.fr} »`).join(", ") : "aucun"}`,
      `Informations en brouillon : ${state.announcementDrafts.length}`,
      `Auteurs sans lien studio : ${state.authorsWithoutStudioLink.length}`,
    ],
    state,
  );
};

// ---- Aide ----------------------------------------------------------------------

commands.aide = () => {
  console.log(`Backoffice en ligne de commande (voir docs/backoffice-cli.md).

  node scripts/admin.mjs <commande> [arguments] [options]

Une commande qui écrit n'est qu'un essai sans --confirmer.
--emulateur vise les émulateurs locaux ; --json pour une sortie lisible par un script.

État
  etat

Informations
  info:liste
  info:voir <id>
  info:creer --type nouveaute|mise-a-jour|incident|question --titre … --texte …
             [--texte-fichier f.md] [--titre-en … --texte-en …] [--titre-he … --texte-he …]
             [--lien /page|https://… --lien-texte …] [--version X.Y.Z]
             [--publier] [--notifier] [--date AAAA-MM-JJ]
  info:modifier <id> [mêmes options] [--publier|--depublier] [--resolu|--en-cours] [--notifier]
  info:resoudre <id>
  info:supprimer <id>
  info:depuis-release --tag vX.Y.Z [--brouillon] [--notifier] [--date …]
  info:depuis-release --version X.Y.Z --fichier note.md

Chiourim
  chiour:liste [--filtre brouillons|publies|sans-auteur|sans-serie] [--auteur <id>] [--recherche …]
  chiour:voir <slug>
  chiour:publier <slug>…     chiour:depublier <slug>…
  chiour:modifier <slug> [--titre … --description … --auteur <id> --serie <id>|--sans-serie
                  --episode N --categories a,b --niveau … --publier|--depublier]
  chiour:ajouter <fichier.mp3> --titre … --auteur <id> [--description … --categories a,b
                 --serie <id> --episode N --niveau … --duree <secondes> --publier]

Auteurs et séries
  auteur:liste
  auteur:voir <id>
  auteur:creer "Nom"
  auteur:lien <id>           (nouveau lien studio, l'ancien cesse de marcher)
  serie:creer <auteurId> "Nom de la série"

Sessions
  session:signalements
  session:masquer <id>       session:demasquer <id>`);
};

// ---- Lancement -----------------------------------------------------------------

const run = commands[command];
if (!run || opts.aide) {
  commands.aide();
  process.exit(run || opts.aide ? 0 : 1);
}
try {
  await run(args);
} catch (error) {
  if (error instanceof BackofficeInputError) fail(error.message);
  const message = String(error?.message ?? error);
  // Identifiants valides mais sans les droits : un rôle manquant, ou tout
  // juste accordé (Google met quelques minutes à l'appliquer).
  if (error?.code === 7 || /PERMISSION_DENIED|insufficient permissions/i.test(message)) {
    fail(
      "accès refusé : le compte utilisé n'a pas les droits (roles/datastore.user, et roles/storage.objectAdmin pour les audios). Un rôle tout juste accordé met quelques minutes à s'appliquer (voir docs/backoffice-cli.md).",
    );
  }
  // Firestore injoignable : émulateurs éteints, ou réseau filtré (une
  // session cloud de Claude Code qui n'autorise pas *.googleapis.com).
  if (error?.code === 14 || /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|UNAVAILABLE/.test(message)) {
    fail(
      opts.emulateur
        ? "émulateurs injoignables : lancer `npm run dev:local` (ou `npm run emulators`)."
        : "Firestore injoignable : pas de réseau, ou accès à *.googleapis.com bloqué (session cloud : voir docs/backoffice-cli.md).",
    );
  }
  if (/Could not load the default credentials|invalid_grant|reauth/i.test(message)) {
    fail(
      process.env.PJ_ADMIN_SERVICE_ACCOUNT
        ? "la clé PJ_ADMIN_SERVICE_ACCOUNT est refusée (révoquée ou sans les droits ?), voir docs/backoffice-cli.md."
        : "identifiants Google absents ou expirés : `gcloud auth application-default login` avec admin@phenixel.fr, ou PJ_ADMIN_SERVICE_ACCOUNT (voir docs/backoffice-cli.md).",
    );
  }
  throw error;
}
