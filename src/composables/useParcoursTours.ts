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

  const step = (
    key: string,
    icon: TourStep["icon"],
    target: string | null,
    radius = 18,
  ): TourStep => ({
    key,
    icon,
    title: t(`tips.parcours.${key}.title`),
    text: t(`tips.parcours.${key}.text`),
    target: target ? byTour(target) : undefined,
    radius,
  });

  /** L'accueil : la pile, la barre de la journée, la lumière, l'étagère. */
  const home = computed<TourStep[]>(() => [
    {
      ...step("deck", "books", null),
      target: () => document.querySelector<HTMLElement>(".dk"),
      radius: 22,
    },
    {
      ...step("dayBar", "list", null),
      target: () => document.querySelector<HTMLElement>(".day-bar"),
      radius: 14,
    },
    step("lamp", "candle", "home-lamp", 9999),
    {
      ...step("shelf", "book", null),
      target: () => document.querySelector<HTMLElement>(".volume-shelf"),
      radius: 14,
    },
  ]);

  /** Mon parcours : la lumière, le mur, l'étagère, un objectif de plus. */
  const page = computed<TourStep[]>(() => [
    step("light", "candle", "parcours-light", 24),
    step("wall", "calendar", "parcours-wall", 14),
    {
      ...step("volumes", "book", null),
      target: () => document.querySelector<HTMLElement>(".volume-shelf"),
      radius: 14,
    },
    step("new", "plus", "parcours-new", 14),
  ]);

  /** Nouvel objectif : choisir en haut, la suite se déplie dessous. */
  const create = computed<TourStep[]>(() => [
    step("books", "book", "create-books", 14),
    step("cycles", "calendar", "create-cycles", 14),
    step("habits", "check", "create-habits", 14),
  ]);

  /** Un programme : la portion, rattraper, la suite, les réglages. */
  const program = computed<TourStep[]>(() => [
    step("portion", "book-open", "program-portion", 22),
    step("catchUp", "rotate", "program-catch-up", 9999),
    step("ahead", "chevron-right", "program-ahead", 9999),
    step("edit", "settings", "program-edit", 9999),
  ]);

  return { home, page, create, program };
}
