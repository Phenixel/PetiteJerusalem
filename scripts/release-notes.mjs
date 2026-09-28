/**
 * Notes de version (« Nouveautés ») communes aux deux stores.
 *
 * Source unique de vérité, par ordre de priorité :
 * 1. Le corps de la release GitHub du tag, si l'utilisateur en a rédigé un
 *    (récupéré par la CI via `gh api`, passé aux scripts en fichier). Il peut
 *    porter une section par langue, chacune sous un titre au nom de la langue
 *    (voir splitReleaseNotes) : chaque store reçoit alors, dans chaque langue,
 *    le texte de sa section. Sans aucun de ces titres, le corps entier est du
 *    français, comme avant.
 * 2. Pour une langue sans texte : la phrase par défaut ci-dessous côté App
 *    Store (chaque langue y doit avoir son texte), la langue par défaut de la
 *    console côté Play. Les anciens `release_notes.txt` (iOS) et
 *    `changelogs/default.txt` (Android) ont été supprimés pour ne pas
 *    maintenir deux sources.
 */

const DEFAULT_NOTES = {
  fr: "Correction de bugs mineurs.",
  en: "Minor bug fixes.",
  he: "תיקוני באגים קלים.",
};

/**
 * Phrase par défaut pour une locale de store (« fr-FR », « en-US », « he »,
 * « iw-IL »…, Play utilise encore l'ancien code ISO « iw » pour l'hébreu).
 */
export function defaultReleaseNotes(locale) {
  return DEFAULT_NOTES[langOf(locale)] ?? DEFAULT_NOTES.en;
}

/** La langue d'une locale de store : « fr-FR » → fr, « iw-IL » → he. */
function langOf(locale) {
  const lang = locale.toLowerCase().split(/[-_]/)[0];
  return lang === "iw" ? "he" : lang;
}

/**
 * Les titres qui ouvrent la section d'une langue dans le corps de la release,
 * comparés sans casse ni accent : `## Français`, `## English`, `## עברית`
 * (ou leurs noms dans une autre langue, ou le code de la langue).
 */
const LANGUAGE_HEADINGS = {
  fr: ["francais", "french", "fr"],
  en: ["english", "anglais", "en"],
  he: ["עברית", "hebreu", "hebrew", "ivrit", "he"],
};

const normalize = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

function headingLang(line) {
  const title = line.match(/^#{1,3}\s+(.+?)\s*#*\s*$/)?.[1];
  if (!title) return null;
  const name = normalize(title);
  return Object.keys(LANGUAGE_HEADINGS).find((lang) => LANGUAGE_HEADINGS[lang].includes(name)) ?? null;
}

/**
 * Découpe le corps d'une release en notes par langue, en texte brut.
 *
 * Une section commence à un titre au nom d'une langue et court jusqu'au titre
 * de langue suivant ; ce qui précède le premier est ignoré. Sans aucun titre
 * de langue, le corps entier est du français. Une section vide ne compte pas.
 *
 * @returns {Partial<Record<"fr" | "en" | "he", string>>}
 */
export function splitReleaseNotes(body) {
  const lines = (body ?? "").replace(/\r/g, "").split("\n");
  if (!lines.some(headingLang)) {
    const whole = markdownToPlain(body ?? "");
    return whole ? { fr: whole } : {};
  }
  const sections = {};
  let current = null;
  for (const line of lines) {
    const lang = headingLang(line);
    if (lang) {
      current = lang;
      sections[lang] ??= [];
    } else if (current) {
      sections[current].push(line);
    }
  }
  const notes = {};
  for (const [lang, sectionLines] of Object.entries(sections)) {
    const text = markdownToPlain(sectionLines.join("\n"));
    if (text) notes[lang] = text;
  }
  return notes;
}

/**
 * Les notes rédigées pour une locale de store, ou null si le corps de la
 * release n'a rien pour sa langue (l'appelant décide alors du repli).
 */
export function releaseNotesFor(notes, locale) {
  return notes[langOf(locale)] ?? null;
}

/**
 * Les stores affichent du texte brut : allège le markdown d'une release
 * GitHub (titres, puces, gras, liens).
 */
export function markdownToPlain(text) {
  return text
    .replace(/\r/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\*\*|__/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
