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

/** Un objectif écrit par la personne. */
export interface DailyGoal {
  /** `g-` suivi d'un identifiant aléatoire : jamais une clé d'action. */
  id: string;
  label: string;
  /** Epoch ms de la création, l'ordre d'affichage. */
  createdAt: number;
  /**
   * Objectif à fréquence : tant de fois par semaine (1 à 6). Absent ou nul,
   * l'objectif est de chaque jour et compte dans la journée ; à fréquence, il
   * se suit à la semaine (voir dailyHistory.weeklyCount) et n'y compte pas.
   */
  perWeek?: number | null;
}

/** Un objectif de chaque jour, celui qui compte dans la journée. */
export function isDailyGoal(goal: DailyGoal): boolean {
  return !goal.perWeek;
}

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
export function activeActionKeys(actions: string[], goals: DailyGoal[]): string[] {
  const chosen = new Set(actions);
  return [
    ...DAILY_ACTION_KEYS.filter((key) => chosen.has(key)),
    ...[...goals]
      .filter(isDailyGoal)
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
