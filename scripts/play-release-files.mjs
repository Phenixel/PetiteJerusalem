#!/usr/bin/env node
/**
 * Les AAB que la publication Play Store envoie dans la release, dans la forme
 * exacte que `r0adkll/upload-google-play` attend.
 *
 * Deux pièges tiennent dans cette seule chaîne :
 *
 *   1. la forme. L'action fait `getInput('releaseFiles').split(',')` avant de
 *      passer le résultat à fast-glob : une seule ligne, des virgules et rien
 *      d'autre. Un bloc YAML multiligne devient un motif unique portant un
 *      retour à la ligne, et une espace après la virgule fait le même effet.
 *      Le tag v3.9.3 est mort là-dessus ;
 *   2. le contenu. L'AAB de la montre n'a sa place dans la release que si la
 *      fiche Play déclare le facteur de forme « Wear OS ». Sinon, Google
 *      refuse la release entière au moment de valider l'édition, sur un
 *      « Internal error encountered » qui ne dit pas lequel des deux
 *      artefacts le gêne. Le tag v3.9.4 est mort là-dessus, les deux AAB
 *      pourtant signés, envoyés et acceptés.
 *
 * D'où la variable de repo SHIP_WATCH_APPS : tant qu'elle ne vaut pas
 * « true », seul le téléphone entre dans la release, et la montre s'arrête à
 * l'artefact de l'onglet Actions. Voir docs/app-watch.md.
 *
 * Usage (le workflow lit la sortie standard) :
 *   SHIP_WATCH_APPS=true node scripts/play-release-files.mjs
 */

/** L'AAB du téléphone, toujours publié. */
export const PHONE_AAB = "android/app/build/outputs/bundle/release/app-release.aab";
/** L'AAB de la montre, publié seulement quand la fiche Play l'accepte. */
export const WEAR_AAB = "android/wear/build/outputs/bundle/release/wear-release.aab";

/**
 * @param {{ shipWatchApps?: boolean }} options
 * @returns {string} la valeur du champ `releaseFiles` de l'action.
 */
export function playReleaseFiles({ shipWatchApps = false } = {}) {
  return shipWatchApps ? `${PHONE_AAB},${WEAR_AAB}` : PHONE_AAB;
}

/** La variable de repo, absente ou vide valant « non ». */
export function shipWatchAppsFromEnv(env = process.env) {
  return env.SHIP_WATCH_APPS?.trim().toLowerCase() === "true";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(playReleaseFiles({ shipWatchApps: shipWatchAppsFromEnv() }));
}
