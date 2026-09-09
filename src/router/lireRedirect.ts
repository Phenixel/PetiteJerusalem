import type { LocationQuery, RouteLocationRaw } from "vue-router";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson } from "../models/models";
import { hubPath, sectionPath } from "../content/etudeTexts";

/**
 * Un lien public /lire/:textId (sans chaîne de lecture) est renvoyé vers la
 * page canonique de la bibliothèque : une seule adresse indexable par texte.
 *
 * La redirection vivait dans le composant, au montage : le routeur réutilise
 * la même vue pour /lire et /bibliotheque, le `router.replace` ne remontait
 * donc rien, et la page restait blanche. Elle se joue maintenant dans un
 * garde de route, avant que la vue n'existe.
 *
 * `null` : rien à rediriger (lecture dans une chaîne, texte inconnu), la vue
 * se rend telle quelle.
 */
const allTexts = (textStudiesJson as TextStudiesJson).textStudies;

export function lireRedirect(
  textId: string,
  section: string | undefined,
  query: LocationQuery,
): RouteLocationRaw | null {
  // `?session=` vide compte pour rien : c'est le slug qui fait la chaîne.
  if (query.session) return null;
  const entry = allTexts.find((text) => String(text.id) === textId);
  if (!entry) return null;
  const index = section !== undefined ? Number(section) : undefined;
  const path =
    index !== undefined && Number.isInteger(index) ? sectionPath(entry, index) : hubPath(entry);
  return { path, query };
}
