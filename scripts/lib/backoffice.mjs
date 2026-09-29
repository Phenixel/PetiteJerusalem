/**
 * Le backoffice sans l'interface : la partie pure de scripts/admin.mjs
 * (validation, mise en forme des documents), sans dépendance à Firebase,
 * pour être tenue par les tests unitaires (src/__tests__/backofficeCli.test.ts).
 *
 * Les règles sont celles des pages /admin : une information écrite ici est
 * exactement celle qu'écrirait AdminAnnouncementEditPage, un chiour ajouté
 * ici est celui que déposerait le studio d'un auteur. Voir docs/backoffice-cli.md.
 */
import { splitReleaseNotes } from "../release-notes.mjs";

/** Les natures d'une information, et les mots acceptés pour chacune. */
export const ANNOUNCEMENT_KIND_ALIASES = {
  news: ["news", "nouveaute", "nouveauté"],
  release: ["release", "mise-a-jour", "mise-à-jour", "maj", "version"],
  incident: ["incident"],
  question: ["question"],
};

/** « mise-a-jour » → release ; null si le mot n'est pas reconnu. */
export function parseKind(value) {
  const word = String(value ?? "")
    .trim()
    .toLowerCase();
  for (const [kind, aliases] of Object.entries(ANNOUNCEMENT_KIND_ALIASES)) {
    if (aliases.includes(word)) return kind;
  }
  return null;
}

/** Une erreur de saisie : le CLI l'affiche telle quelle et sort en 1. */
export class BackofficeInputError extends Error {}

const TITLE_MAX = 120;
const BODY_MAX = 5000;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Un texte par langue, les langues vides omises ; le français est exigé ailleurs.
 *
 * @returns {{ fr: string, en?: string, he?: string }}
 */
export function localizedText(fr, en, he) {
  /** @type {{ fr: string, en?: string, he?: string }} */
  const text = { fr: clean(fr) };
  if (clean(en)) text.en = clean(en);
  if (clean(he)) text.he = clean(he);
  return text;
}

/** Un lien d'annonce : une page de l'app (« /… ») ou une adresse https. */
export function isValidLink(url) {
  return url.startsWith("/") || /^https?:\/\//i.test(url);
}

/**
 * Les champs d'une information à écrire, validés comme le fait le formulaire
 * du backoffice. `input` : { kind, title{fr,en,he}, body{…}, link, linkLabel{…},
 * version, resolved, published, notify }.
 */
export function announcementFields(input) {
  const kind = input.kind;
  if (!ANNOUNCEMENT_KIND_ALIASES[kind]) throw new BackofficeInputError(`Type inconnu : ${kind}.`);
  const title = input.title;
  const body = input.body;
  if (!title?.fr) throw new BackofficeInputError("Le titre en français est obligatoire.");
  if (!body?.fr) throw new BackofficeInputError("Le texte en français est obligatoire.");
  for (const [lang, value] of Object.entries(title)) {
    if (value.length > TITLE_MAX) {
      throw new BackofficeInputError(
        `Titre (${lang}) trop long : ${TITLE_MAX} caractères au plus.`,
      );
    }
  }
  for (const [lang, value] of Object.entries(body)) {
    if (value.length > BODY_MAX) {
      throw new BackofficeInputError(`Texte (${lang}) trop long : ${BODY_MAX} caractères au plus.`);
    }
  }
  const url = clean(input.link);
  if (url && !isValidLink(url)) {
    throw new BackofficeInputError(
      "Le lien doit commencer par « / » (une page de l'app) ou par https://.",
    );
  }
  return {
    kind,
    title,
    body,
    link: url ? { url, label: input.linkLabel ?? { fr: "" } } : null,
    version: kind === "release" && clean(input.version) ? clean(input.version) : null,
    resolved: kind === "incident" ? input.resolved === true : false,
    published: input.published === true,
    notify: input.notify === true,
  };
}

/** « v3.11.0 » ou « 3.11.0 » → « 3.11.0 » ; null si ce n'est pas une version. */
export function versionOf(tag) {
  const match = /^v?(\d+\.\d+\.\d+)$/.exec(String(tag ?? "").trim());
  return match ? match[1] : null;
}

/** L'identifiant d'une information de version : stable, pour la mettre à jour. */
export function releaseAnnouncementId(version) {
  return `release-v${version}`;
}

const RELEASE_TITLES = {
  fr: (v) => `Version ${v} : les nouveautés`,
  en: (v) => `Version ${v}: what's new`,
  he: (v) => `גרסה ${v}: מה חדש`,
};

/**
 * L'information « Mise à jour » d'une version, depuis le texte de sa release
 * GitHub (trois sections ## Français, ## English, ## עברית, voir
 * docs/notes-de-version.md). null si la release n'a pas de texte français :
 * on n'annonce pas une version avec la phrase par défaut des stores.
 */
export function releaseAnnouncement(version, releaseBody) {
  const notes = splitReleaseNotes(releaseBody ?? "");
  if (!notes.fr) return null;
  /** @type {{ fr: string, en?: string, he?: string }} */
  const title = { fr: RELEASE_TITLES.fr(version) };
  /** @type {{ fr: string, en?: string, he?: string }} */
  const body = { fr: notes.fr };
  for (const lang of ["en", "he"]) {
    if (notes[lang]) {
      title[lang] = RELEASE_TITLES[lang](version);
      body[lang] = notes[lang];
    }
  }
  return { kind: "release", title, body, version, link: "", resolved: false };
}

/** Les formats audio acceptés, ceux du studio des auteurs. */
export const AUDIO_EXTENSIONS = ["mp3", "m4a", "wav", "ogg", "aac"];

export const AUDIO_CONTENT_TYPES = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  aac: "audio/aac",
};

/** L'extension d'un fichier audio accepté, sinon une erreur. */
export function audioExtension(path) {
  const ext = String(path).split(".").pop()?.toLowerCase() ?? "";
  if (!AUDIO_EXTENSIONS.includes(ext)) {
    throw new BackofficeInputError(
      `Format audio non pris en charge (.${ext}) : ${AUDIO_EXTENSIONS.join(", ")}.`,
    );
  }
  return ext;
}

/**
 * Le slug d'un chiour ou d'un auteur : la même règle que le studio
 * (functions/src/studio.ts) et que chiourService, sans quoi l'adresse de la
 * page ne retrouverait pas le document.
 */
export function slugify(name) {
  return String(name)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[/'"“”‘’`?#]/g, "");
}

/** « a, b ,c » → ["a", "b", "c"]. */
export function parseList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** L'adresse publique du studio d'un auteur, pour un lien secret. */
export function studioLink(token) {
  return `https://petite-jerusalem.fr/studio/${token}`;
}

/**
 * L'adresse de téléchargement permanente d'un fichier de Storage.
 *
 * @param {string} bucketName
 * @param {string} path
 * @param {string} token
 * @param {string | null} [emulatorHost]
 */
export function downloadUrl(bucketName, path, token, emulatorHost = null) {
  const base = emulatorHost ? `http://${emulatorHost}` : "https://firebasestorage.googleapis.com";
  return `${base}/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}
