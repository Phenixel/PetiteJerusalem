import { SITE_URL } from "./site";

/**
 * Le site de l'environnement de ce build : petite-jerusalem.fr en
 * production, petite-jerusalem-staging.web.app en staging (PJ_ENV, voir
 * scripts/lib/environments.mjs et docs/staging.md).
 *
 * C'est l'adresse de ce que l'app lit et de ce qu'elle partage : les textes
 * qu'elle n'embarque pas (offlineTextStore), les liens d'un passage, d'une
 * session, d'un chiour, d'un sondage. Le staging vit ainsi tout seul : son app
 * lit les fichiers que son site sert (une nouveauté y est visible avant la
 * production), et une session de staging partagée s'ouvre là où elle existe.
 *
 * Les adresses canoniques et les données structurées, elles, restent celles
 * de la production (SITE_URL) : le staging copie le site, il ne doit pas en
 * être une seconde adresse aux yeux d'un moteur de recherche.
 *
 * Hors d'un build Vite (prérendu par jiti), `__PJ_ENV__` n'existe pas : c'est
 * alors la production.
 */
export const APP_SITE_URL: string =
  typeof __PJ_ENV__ !== "undefined" ? __PJ_ENV__.siteUrl : SITE_URL;
