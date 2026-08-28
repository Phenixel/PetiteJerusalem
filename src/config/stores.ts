/**
 * Les fiches de l'app sur les stores.
 *
 * Utilisées par le site web seulement, pour proposer le téléchargement (voir
 * components/AppDownloadButton.vue) : dans l'app native, l'app est déjà là.
 *
 * L'identifiant Apple est numérique et n'a rien à voir avec le bundle id : il
 * est attribué par App Store Connect à la création de la fiche. Le lien s'écrit
 * sans préfixe de pays ni titre décoratif : Apple redirige de lui-même vers la
 * boutique du visiteur, un `/fr/` figé enverrait un visiteur américain sur une
 * page qu'il ne peut pas acheter.
 *
 * Doit rester exécutable côté navigateur ET côté Node (prerender via jiti),
 * comme site.ts : aucune API spécifique à un environnement ici.
 */

/** Bundle id iOS et applicationId Android : le même des deux côtés. */
export const APP_BUNDLE_ID = "fr.petitejerusalem.app";

/** Identifiant numérique de la fiche App Store (App Store Connect). */
export const APPLE_APP_ID = "6798778029";

export const APP_STORE_URL = `https://apps.apple.com/app/id${APPLE_APP_ID}`;
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${APP_BUNDLE_ID}`;
