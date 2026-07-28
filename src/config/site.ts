/**
 * Identité publique du site, sans aucune dépendance.
 *
 * Vit dans son propre module minuscule : plusieurs vues (DetailSession,
 * DetailChiour, ProfilePage…) n'ont besoin que de l'URL canonique pour
 * construire des liens de partage — importer `content/seoPages.ts` (~94 kB de
 * contenu éditorial) pour une constante gonflait leurs chunks pour rien.
 * `seoPages.ts` ré-exporte ces constantes pour le prerender et les pages SEO.
 *
 * Doit rester exécutable côté navigateur ET côté Node (prerender via jiti) :
 * aucune API spécifique à un environnement ici.
 */

export const SITE_URL = "https://petite-jerusalem.fr";
export const SITE_NAME = "Petite Jérusalem";
export const OG_IMAGE = `${SITE_URL}/og-image.jpg`;
/** Logo carré (favicon) pour les données structurées Organization ; l'og-image
 *  est une bannière large 1200×630, inadaptée au champ `logo`. */
export const LOGO_IMAGE = `${SITE_URL}/favicon.png`;
