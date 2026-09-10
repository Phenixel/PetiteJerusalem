import type { PageTab } from "../components/PageTabs.vue";
import type { SeoSection } from "../content/seoLocales";

/**
 * Les jeux d'onglets de l'app native (voir PageTabs.vue). Ils vivent ici pour
 * que les deux pages d'un même jeu déclarent exactement la même chose : un
 * libellé ou une adresse qui divergeraient donneraient deux barres d'onglets
 * différentes selon la page ouverte.
 *
 * Les horaires y sont aussi, mais en fabrique : leurs adresses sont traduites
 * (/horaires, /en/times…), c'est la page qui apporte son `localePath`.
 */
export const LIBRARY_TABS: PageTab[] = [
  { id: "reading", to: "/bibliotheque", labelKey: "study.tabs.reading" },
  { id: "sharing", to: "/share-reading", labelKey: "study.tabs.sharing" },
];

export function zmanimTabs(localePath: (section: SeoSection) => string): PageTab[] {
  return [
    { id: "times", to: localePath("horaires"), labelKey: "zmanim.navTitle" },
    { id: "calendar", to: localePath("calendrier"), labelKey: "calendar.navTitle" },
  ];
}
