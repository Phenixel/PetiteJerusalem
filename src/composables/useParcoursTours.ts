import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { TourStep } from "../components/FeatureTour.vue";

/**
 * Le tutoriel de Mon parcours : une visite par écran, à la première visite,
 * qui éclaire où toucher (FeatureTour, voir useFeatureTips). Mon parcours a
 * ses gestes (glisser une carte, tirer la pile, l'appui long sur un volume,
 * pincer le mur) : personne ne les devine.
 *
 * Les commandes se trouvent par leur repère `data-tour`, posé sur elles dans
 * leur composant ; un pas dont la commande n'est pas à l'écran (pas de
 * retard, pas de suite à lire) se saute de lui-même. Aussi sur le site
 * (`web`) : on y vient avec un compte, et les gestes y sont les mêmes.
 */

const byTour = (name: string) => () => document.querySelector<HTMLElement>(`[data-tour="${name}"]`);

export function useParcoursTours() {
  const { t } = useI18n();

  const step = (key: string, target: string | null, radius = 18): TourStep => ({
    key,
    title: t(`tips.parcours.${key}.title`),
    text: t(`tips.parcours.${key}.text`),
    target: target ? byTour(target) : undefined,
    radius,
  });

  /** L'accueil : la pile, la barre de la journée, la lumière, l'étagère. */
  const home = computed<TourStep[]>(() => [
    {
      ...step("deck", null),
      target: () => document.querySelector<HTMLElement>(".dk"),
      radius: 22,
    },
    {
      ...step("dayBar", null),
      target: () => document.querySelector<HTMLElement>(".day-bar"),
      radius: 14,
    },
    step("lamp", "home-lamp", 9999),
    {
      ...step("shelf", null),
      target: () => document.querySelector<HTMLElement>(".volume-shelf"),
      radius: 14,
    },
  ]);

  /** Mon parcours : la lumière, le mur, l'étagère, un objectif de plus. */
  const page = computed<TourStep[]>(() => [
    step("light", "parcours-light", 24),
    step("wall", "parcours-wall", 14),
    {
      ...step("volumes", null),
      target: () => document.querySelector<HTMLElement>(".volume-shelf"),
      radius: 14,
    },
    step("new", "parcours-new", 14),
  ]);

  /** Nouvel objectif : choisir en haut, la suite se déplie dessous. */
  const create = computed<TourStep[]>(() => [
    step("books", "create-books", 14),
    step("cycles", "create-cycles", 14),
    step("habits", "create-habits", 14),
  ]);

  /** Un programme : la portion, rattraper, la suite, les réglages. */
  const program = computed<TourStep[]>(() => [
    step("portion", "program-portion", 22),
    step("catchUp", "program-catch-up", 9999),
    step("ahead", "program-ahead", 9999),
    step("edit", "program-edit", 9999),
  ]);

  return { home, page, create, program };
}
