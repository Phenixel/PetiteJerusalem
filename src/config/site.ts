/**
 * Identité publique du site, sans aucune dépendance.
 *
 * Vit dans son propre module minuscule : plusieurs vues (DetailSession,
 * DetailChiour, ProfilePage…) n'ont besoin que de l'URL canonique pour
 * construire des liens de partage, importer `content/seoPages.ts` (~94 kB de
 * contenu éditorial) pour une constante gonflait leurs chunks pour rien.
 * `seoPages.ts` ré-exporte ces constantes pour le prerender et les pages SEO.
 *
 * Doit rester exécutable côté navigateur ET côté Node (prerender via jiti) :
 * aucune API spécifique à un environnement ici.
 */

export const SITE_URL = "https://petite-jerusalem.fr";
export const SITE_NAME = "Petite Jérusalem";
/** The general share banner, in French; each section has its own (src/content/ogBanners.ts). */
export const OG_IMAGE = `${SITE_URL}/og/site-fr.png`;
/** The whole logo, square, for the Organization structured data. Not the
 *  favicon, which is the star alone (the logo is a smudge at tab size), nor
 *  the og-image, a wide 1200×630 banner unfit for the `logo` field. */
export const LOGO_IMAGE = `${SITE_URL}/logo.png`;
