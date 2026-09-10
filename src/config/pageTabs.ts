import type { PageTab } from "../components/PageTabs.vue";

/**
 * Les jeux d'onglets de l'app native (voir PageTabs.vue). Ils vivent ici pour
 * que les deux pages d'un même jeu déclarent exactement la même chose : un
 * libellé ou une adresse qui divergeraient donneraient deux barres d'onglets
 * différentes selon la page ouverte.
 *
 * Les horaires ne sont pas ici : leurs adresses sont traduites (/horaires,
 * /en/times…), elles se construisent donc dans la page, avec localePath.
 */
export const LIBRARY_TABS: PageTab[] = [
  { id: "reading", to: "/bibliotheque", labelKey: "study.tabs.reading" },
  { id: "sharing", to: "/share-reading", labelKey: "study.tabs.sharing" },
];
