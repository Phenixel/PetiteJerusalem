/**
 * Notes de version (« Nouveautés ») communes aux deux stores.
 *
 * Source unique de vérité, par ordre de priorité :
 * 1. Le corps de la release GitHub du tag, si l'utilisateur en a rédigé un
 *    (récupéré par la CI via `gh api`, passé aux scripts en fichier). Rédigé
 *    en français : il n'alimente que la locale française, les autres reçoivent
 *    la phrase par défaut (Play : retombée sur la langue par défaut de la
 *    console ; App Store : chaque langue doit avoir son texte).
 * 2. Sinon, la phrase par défaut ci-dessous, rien d'autre : les anciens
 *    `release_notes.txt` (iOS) et `changelogs/default.txt` (Android) ont été
 *    supprimés pour ne pas maintenir deux sources.
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
  const lang = locale.toLowerCase().split(/[-_]/)[0];
  if (lang === "iw") return DEFAULT_NOTES.he;
  return DEFAULT_NOTES[lang] ?? DEFAULT_NOTES.en;
}

/** La locale que le corps de la release GitHub (rédigé en français) alimente. */
export const RELEASE_BODY_LANG = "fr";

/** Vrai si le corps de release s'applique à cette locale de store. */
export function releaseBodyApplies(locale) {
  return locale.toLowerCase().split(/[-_]/)[0] === RELEASE_BODY_LANG;
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
