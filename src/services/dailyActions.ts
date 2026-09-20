import { localDayKey } from "./dateService";

/**
 * Les objectifs du jour qui ne sont pas des lectures.
 *
 * Deux sortes. Les **actions** proposées par l'application : des gestes de
 * la journée qu'on veut se voir faire chaque jour (les trois offices, les
 * tefilin, la tsédaka…), dont une liste fermée, chacune avec une clé stable
 * et, quand l'application a le texte, le chemin qui y mène. Et les
 * **objectifs personnels**, que la personne écrit elle-même (« dix minutes de
 * moussar », « appeler mes parents ») : un libellé libre, un id.
 *
 * Les deux se cochent chaque jour comme une lecture, comptent dans la
 * progression du jour et dans la série de jours (dailyStreak). Les clés des
 * actions et les ids des objectifs vivent dans le même espace,
 * `completedActions` du suivi du jour : les clés des actions sont des mots,
 * les ids des objectifs commencent par `g-`, ils ne peuvent pas se croiser.
 */

export const DAILY_ACTION_KEYS = [
  "chaharit",
  "minha",
  "arvit",
  "tefilin",
  "tsedaka",
  "chema-al-hamita",
  "etude",
] as const;
export type DailyActionKey = (typeof DAILY_ACTION_KEYS)[number];

/**
 * Le moment de la journée où l'action se fait : la page range les actions par
 * moment, et pose sur les offices la fin de leur plage horaire.
 */
export type DayMoment = "morning" | "afternoon" | "evening" | "any";
export const DAY_MOMENTS: DayMoment[] = ["morning", "afternoon", "evening", "any"];

export interface DailyActionMeta {
  key: DailyActionKey;
  /** Clés de traduction du titre et de la description (dailyReading.actions.*). */
  titleKey: string;
  descriptionKey: string;
  /** Le texte de la bibliothèque qui accompagne l'action, quand il existe. */
  path: string | null;
  moment: DayMoment;
  /** L'office dont la plage horaire borne l'action (voir sidourService). */
  tefila?: "chaharit" | "minha" | "arvit";
}

export const DAILY_ACTIONS: DailyActionMeta[] = [
  {
    key: "chaharit",
    titleKey: "dailyReading.actions.chaharitTitle",
    descriptionKey: "dailyReading.actions.chaharitDescription",
    path: "/bibliotheque/sidour/chaharit",
    moment: "morning",
    tefila: "chaharit",
  },
  {
    key: "minha",
    titleKey: "dailyReading.actions.minhaTitle",
    descriptionKey: "dailyReading.actions.minhaDescription",
    path: "/bibliotheque/sidour/minha",
    moment: "afternoon",
    tefila: "minha",
  },
  {
    key: "arvit",
    titleKey: "dailyReading.actions.arvitTitle",
    descriptionKey: "dailyReading.actions.arvitDescription",
    path: "/bibliotheque/sidour/arvit",
    moment: "evening",
    tefila: "arvit",
  },
  {
    key: "tefilin",
    titleKey: "dailyReading.actions.tefilinTitle",
    descriptionKey: "dailyReading.actions.tefilinDescription",
    path: null,
    moment: "morning",
  },
  {
    key: "tsedaka",
    titleKey: "dailyReading.actions.tsedakaTitle",
    descriptionKey: "dailyReading.actions.tsedakaDescription",
    path: null,
    moment: "any",
  },
  {
    key: "chema-al-hamita",
    titleKey: "dailyReading.actions.chemaTitle",
    descriptionKey: "dailyReading.actions.chemaDescription",
    path: "/bibliotheque/sidour/chema-al-hamita",
    moment: "evening",
  },
  {
    key: "etude",
    titleKey: "dailyReading.actions.etudeTitle",
    descriptionKey: "dailyReading.actions.etudeDescription",
    path: "/bibliotheque",
    moment: "any",
  },
];

export function isDailyActionKey(key: string): key is DailyActionKey {
  return (DAILY_ACTION_KEYS as readonly string[]).includes(key);
}

/**
 * La période d'un objectif : chaque jour, tant de fois par semaine, par
 * mois, par an, ou un programme sur N jours (le Pérek Chira en quarante
 * jours). Les semaines vont du dimanche au Chabbat ; les mois et les années
 * sont ceux du calendrier hébraïque (voir goalPeriods).
 */
export type GoalPeriod = "day" | "week" | "month" | "year" | "custom";
export const GOAL_PERIODS: GoalPeriod[] = ["day", "week", "month", "year", "custom"];

/** Un objectif écrit par la personne. */
export interface DailyGoal {
  /** `g-` suivi d'un identifiant aléatoire : jamais une clé d'action. */
  id: string;
  label: string;
  /** Epoch ms de la création, l'ordre d'affichage. */
  createdAt: number;
  /** La période ; absente, l'objectif est de chaque jour. */
  period?: GoalPeriod;
  /** Combien de fois par période (semaine, mois, an) ; 1 par défaut. */
  times?: number;
  /** Programme sur N jours : sa longueur, et le jour où il a commencé. */
  days?: number;
  start?: string;
  /**
   * Forme d'avant les périodes : tant de fois par semaine. Lue comme
   * `period: "week"`, `times: perWeek`.
   */
  perWeek?: number | null;
}

export function goalPeriod(goal: DailyGoal): GoalPeriod {
  if (goal.period) return goal.period;
  return goal.perWeek ? "week" : "day";
}

/** Combien de fois par période l'objectif demande. */
export function goalTimes(goal: DailyGoal): number {
  if (goal.period === "custom") return goal.days ?? 1;
  return Math.max(1, goal.times ?? goal.perWeek ?? 1);
}

/** La fenêtre d'un programme sur N jours : du premier jour au dernier (compris). */
export function customWindow(
  goal: DailyGoal,
): { start: string; last: string; days: number } | null {
  if (goalPeriod(goal) !== "custom" || !goal.start || !goal.days) return null;
  const start = new Date(goal.start + "T12:00:00");
  if (Number.isNaN(start.getTime())) return null;
  const last = new Date(start);
  last.setDate(last.getDate() + goal.days - 1);
  return { start: goal.start, last: localDayKey(last), days: goal.days };
}

/**
 * Un objectif qui compte dans la journée : ceux de chaque jour, et un
 * programme sur N jours tant qu'on est dans sa fenêtre.
 */
export function isDailyGoal(goal: DailyGoal, today: string = localDayKey()): boolean {
  const period = goalPeriod(goal);
  if (period === "day") return true;
  if (period !== "custom") return false;
  const window = customWindow(goal);
  return !!window && today >= window.start && today <= window.last;
}

/** Un objectif suivi à la période (semaine, mois, an), hors décompte du jour. */
export function isPeriodGoal(goal: DailyGoal): boolean {
  const period = goalPeriod(goal);
  return period === "week" || period === "month" || period === "year";
}

/**
 * Les objectifs que l'application propose, à ajouter d'un geste : chacun
 * montre ce qu'une période permet. Le Pérek Chira se lit quarante jours de
 * suite ; la bénédiction de la lune se dit une fois par mois.
 */
export interface GoalPreset {
  id: string;
  labelKey: string;
  period: GoalPeriod;
  times?: number;
  days?: number;
}

export const GOAL_PRESETS: GoalPreset[] = [
  {
    id: "perek-chira",
    labelKey: "dailyReading.goals.presets.perekChira",
    period: "custom",
    days: 40,
  },
  { id: "birkat-halevana", labelKey: "dailyReading.goals.presets.birkatHalevana", period: "month" },
  { id: "chiour", labelKey: "dailyReading.goals.presets.chiour", period: "week", times: 2 },
  { id: "parents", labelKey: "dailyReading.goals.presets.parents", period: "week", times: 3 },
  { id: "tehilim-mois", labelKey: "dailyReading.goals.presets.tehilimMois", period: "month" },
  { id: "mezouzot", labelKey: "dailyReading.goals.presets.mezouzot", period: "year" },
];

/** Au plus vingt objectifs personnels, et des libellés courts. */
export const MAX_DAILY_GOALS = 20;
export const MAX_GOAL_LABEL_LENGTH = 80;

/** Un id d'objectif, unique à l'échelle d'un compte. */
export function newGoalId(): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `g-${random}`;
}

/** Le libellé tel qu'il s'enregistre : sans espaces superflus, borné ; "" s'il ne reste rien. */
export function normalizeGoalLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim().slice(0, MAX_GOAL_LABEL_LENGTH);
}

/**
 * Tout ce qui se coche aujourd'hui hors lectures : les actions choisies, dans
 * l'ordre de la liste proposée, puis les objectifs personnels de chaque jour
 * dans l'ordre de leur création. C'est la liste que compte la progression du
 * jour ; les objectifs à fréquence se suivent à part, à la semaine.
 */
export function activeActionKeys(
  actions: string[],
  goals: DailyGoal[],
  today: string = localDayKey(),
): string[] {
  const chosen = new Set(actions);
  return [
    ...DAILY_ACTION_KEYS.filter((key) => chosen.has(key)),
    ...[...goals]
      .filter((goal) => isDailyGoal(goal, today))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((goal) => goal.id),
  ];
}

/**
 * Les parcours de départ : trois listes prêtes, pour qui arrive sans savoir
 * par où commencer. « Lire », « Faire », « Progresser » : la question posée à
 * l'entrée, et une réponse qu'on modifie ensuite.
 */
export interface StarterPack {
  id: "lire" | "faire" | "progresser";
  titleKey: string;
  descriptionKey: string;
  options: string[];
  actions: DailyActionKey[];
  /** Objectifs personnels proposés, par clé de traduction du libellé. */
  goalKeys: string[];
}

export const STARTER_PACKS: StarterPack[] = [
  {
    id: "lire",
    titleKey: "dailyReading.packs.lireTitle",
    descriptionKey: "dailyReading.packs.lireDescription",
    options: ["tehilim-jour", "parasha"],
    actions: [],
    goalKeys: [],
  },
  {
    id: "faire",
    titleKey: "dailyReading.packs.faireTitle",
    descriptionKey: "dailyReading.packs.faireDescription",
    options: [],
    actions: ["chaharit", "minha", "arvit", "tefilin"],
    goalKeys: [],
  },
  {
    id: "progresser",
    titleKey: "dailyReading.packs.progresserTitle",
    descriptionKey: "dailyReading.packs.progresserDescription",
    options: ["daf-yomi"],
    actions: ["etude", "tsedaka"],
    goalKeys: ["dailyReading.packs.progresserGoal"],
  },
];
