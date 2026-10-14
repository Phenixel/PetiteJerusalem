/**
 * Mon parcours : ce qu'on se donne à faire, et ce qu'on a fait.
 *
 * Quatre sortes d'objectifs, une seule journée :
 *
 *  - un **programme** finit un texte à une date : le séder Moed d'ici Roch
 *    Hachana, le traité Avot en six semaines. Il se découpe en portions,
 *    chaque jour ou chaque semaine, et se rattrape quand on prend du retard ;
 *  - une **habitude** revient certains jours, à son moment : Chema al hamita
 *    au coucher, les tefilin avec Cha'harit, garder sa langue ;
 *  - un **cycle** suit le calendrier : les Tehilim du jour (le livre en un
 *    mois), la paracha de la semaine en chnei mikra ;
 *  - un **texte du jour** se relit chaque jour en entier : un psaume, une
 *    page qu'on aime. C'est la lecture du jour d'avant Mon parcours, qui y
 *    entre telle quelle (voir legacyDailyReading.ts).
 *
 * Tout se déclare : on coche ce qu'on a fait, aujourd'hui ou après coup, et
 * rien ne se compte contre soi. Chabbat et les fêtes sont des pauses.
 *
 * Ce module ne fait que décrire. Les calculs vivent à côté (plan.ts pour les
 * portions, schedule.ts pour les journées), le stockage dans deviceStore.ts
 * (l'appareil) et cloud.ts (le compte), que composables/useParcours.ts réunit.
 * Vue d'ensemble : docs/parcours.md.
 */

/** Jour civil local, « YYYY-MM-DD » : la clé de dateService.localDayKey. */
export type DayKey = string;

/**
 * Les moments de la journée. Un objectif s'y range, et le paquet de
 * l'accueil s'ouvre sur celui de l'heure. « anytime » : dans la journée, sans
 * heure à soi (garder sa langue).
 */
export type MomentId = "morning" | "afternoon" | "evening" | "bedtime" | "anytime";

export const MOMENTS: readonly MomentId[] = [
  "morning",
  "afternoon",
  "evening",
  "bedtime",
  "anytime",
];

/**
 * Le rythme d'un programme : chaque jour, chaque jour sauf Chabbat et les
 * fêtes, ou à la semaine (une portion par semaine, lue quand on veut).
 *
 * Pas de rythme au mois : une portion mensuelle se remet au lendemain jusqu'à
 * la fin du mois, et un programme ainsi découpé s'abandonne. Voir
 * docs/design.md, « Un programme se lit au jour ou à la semaine ».
 */
export type Rhythm = "daily" | "weekdays" | "weekly";

export const RHYTHMS: readonly Rhythm[] = ["daily", "weekdays", "weekly"];

/** Ce qu'un programme peut finir. */
export type ProgramCorpus = "michna" | "talmud" | "tanakh" | "tehilim";

/** L'unité d'une portion : une michna, un côté de daf, un chapitre, un psaume. */
export type UnitKind = "mishna" | "amud" | "chapter" | "psalm";

/**
 * Ce qu'on a pris à l'étape 2, tel qu'on l'a pris : un séder entier
 * (« seder:moed »), un texte du catalogue (« text:47 »), ou tout le corpus
 * (« all »). Le volume de l'étagère se nomme d'après eux.
 */
export type ProgramPart = string;

/**
 * Les façons de rattraper un retard (la feuille « Rattraper ») :
 *
 *  - `week` : le répartir sur les jours qui restent de la semaine ;
 *  - `remaining` : le répartir sur tout le temps qui reste ;
 *  - `oneDay` : le lire d'un coup, le prochain dimanche (ou demain) ;
 *  - `pushEnd` : repousser la fin, au même rythme qu'avant ;
 *  - `done` : c'est déjà lu, ailleurs ou sans l'avoir coché.
 */
export type CatchUpOption = "week" | "remaining" | "oneDay" | "pushEnd" | "done";

export const CATCH_UP_OPTIONS: readonly CatchUpOption[] = [
  "week",
  "remaining",
  "oneDay",
  "pushEnd",
  "done",
];

/** Ce que partagent tous les objectifs. */
interface ObjectiveBase {
  /** Identifiant stable, choisi à la création (ou déduit, pour la lecture du jour d'avant). */
  id: string;
  /** Création (ms) : l'ordre des objectifs. */
  createdAt: number;
  /** Le jour où l'objectif commence à compter dans les journées. */
  since: DayKey;
  moment: MomentId;
  /**
   * En pause depuis ce jour : il ne donne plus rien à faire, sans rien perdre.
   * Les journées d'avant la pause gardent leur état.
   */
  pausedFrom?: DayKey;
  /** Dernière modification (ms) : la plus récente gagne d'un appareil à l'autre. */
  updatedAt: number;
  /**
   * Retiré (ms). L'objectif reste gardé, invisible, pour que les journées
   * passées gardent leur état et que la suppression gagne sur un autre
   * appareil qui ne l'aurait pas encore vue.
   */
  deletedAt?: number;
}

/** Finir un texte à une date. */
export interface ProgramObjective extends ObjectiveBase {
  kind: "program";
  corpus: ProgramCorpus;
  parts: ProgramPart[];
  /**
   * Les textes, dans l'ordre de lecture (ids du catalogue), résolus à la
   * création et gardés : ce que la personne a choisi ne bouge plus.
   */
  texts: number[];
  /** Unités au total. */
  total: number;
  rhythm: Rhythm;
  /** La date qu'on s'est donnée pour finir. */
  end: DayKey;
  /**
   * Le départ du rythme : d'où l'on part, et à quelle position. Remis au
   * jour où l'on rattrape en répartissant le reste ou en repoussant la fin.
   */
  base: { day: DayKey; position: number };
  /**
   * Le rattrapage posé sur des créneaux précis (jour, ou semaine pour le
   * rythme à la semaine) : des unités de plus ce jour-là.
   */
  extra?: Record<DayKey, number>;
  /** Unités déclarées lues sans jour (« Déjà fait ») : la position avance d'autant. */
  credit?: number;
  /** « La prochaine fois, faire ainsi sans demander ». */
  autoCatchUp?: CatchUpOption;
  /**
   * À la semaine : les jours (0 dimanche à 5 vendredi) où la carte de la
   * semaine vient sur l'accueil, tant qu'elle n'est pas finie. Absent : tous
   * les jours, comme avant.
   */
  cardDays?: number[];
  /**
   * Le repère choisi sur le fil du jour (la barre de P2-Habitude), d'où se
   * déduit `moment` : la carte de la portion passe en tête de l'accueil à ce
   * moment-là, sans jamais attendre (l'étude se fait quand on peut). Absent :
   * le moment seul, comme avant.
   */
  anchor?: HabitAnchor;
}

/**
 * Les habitudes, chacune avec son nom, son moment et ce qu'elle ouvre. La
 * création n'en propose qu'une partie (voir StepKind) : les tefilin et
 * Birkat Hamazon n'y sont plus, mais une habitude déjà prise se lit encore.
 */
export type HabitPreset =
  | "tefilot"
  | "tefilin"
  | "chema-al-hamita"
  | "birkat-hamazon"
  | "tsedaka"
  | "chmirat-halachon"
  | "limoud"
  | "custom";

export const HABIT_PRESETS: readonly HabitPreset[] = [
  "tefilot",
  "tefilin",
  "chema-al-hamita",
  "birkat-hamazon",
  "tsedaka",
  "chmirat-halachon",
  "limoud",
  "custom",
];

/**
 * Une habitude sans texte à ouvrir : la tsédaka, garder sa langue, une
 * habitude à soi. Sa carte dit « votre engagement à vous ».
 */
export const isOwnHabit = (preset: HabitPreset): boolean =>
  preset === "tsedaka" || preset === "chmirat-halachon" || preset === "custom";

/**
 * Une habitude dont on choisit le moment sur la barre des repères : un temps
 * d'étude, une habitude à soi. Les autres ont le leur, d'office, qu'on ne
 * redemande pas : les tefilot chaque office à son heure, le Chéma au
 * coucher, la tsédaka et garder sa langue toute la journée.
 */
export const choosesItsTime = (preset: HabitPreset): boolean =>
  preset === "limoud" || preset === "custom";

/**
 * Le repère d'une habitude sur le fil du jour (P2-Habitude) : au réveil,
 * après Cha'harit, à midi, avant Min'ha, après Arvit, au coucher. Il dit
 * quand, plus finement que le moment, qui s'en déduit.
 */
export type HabitAnchor = "wake" | "chaharit" | "noon" | "minha" | "arvit" | "bedtime";

export const HABIT_ANCHORS: readonly HabitAnchor[] = [
  "wake",
  "chaharit",
  "noon",
  "minha",
  "arvit",
  "bedtime",
];

/** Le moment d'un repère. */
export const ANCHOR_MOMENT: Record<HabitAnchor, MomentId> = {
  wake: "morning",
  chaharit: "morning",
  noon: "afternoon",
  minha: "afternoon",
  arvit: "evening",
  bedtime: "bedtime",
};

/** Revenir certains jours, à son moment. */
export interface HabitObjective extends ObjectiveBase {
  kind: "habit";
  preset: HabitPreset;
  /** Le nom que la personne lui donne ; vide, celui du modèle. */
  name: string;
  /** Les jours de la semaine (0 dimanche à 6 Chabbat). */
  days: number[];
  /** Son repère sur le fil du jour ; absent, son moment suffit (une version d'avant l'ignore). */
  anchor?: HabitAnchor;
}

/** Les lectures que le calendrier donne : le jour du mois, la paracha de la semaine. */
export type CycleId = "tehilim-month" | "tehilim-week" | "parasha";

export const CYCLES: readonly CycleId[] = ["tehilim-week", "tehilim-month", "parasha"];

/** Suivre une lecture du calendrier. */
export interface CycleObjective extends ObjectiveBase {
  kind: "cycle";
  cycle: CycleId;
}

/** Relire un texte en entier, certains jours (la lecture du jour d'avant). */
export interface TextObjective extends ObjectiveBase {
  kind: "text";
  /** Id du texte dans le catalogue (textStudies.json). */
  textId: number;
  days: number[];
}

export type Objective = ProgramObjective | HabitObjective | CycleObjective | TextObjective;

export type ObjectiveKind = Objective["kind"];

/** Ce qui s'est passé un jour. */
export interface DayLog {
  /** Les tâches faites ce jour-là (identifiants de tâche, voir schedule.ts). */
  done: string[];
  /** Programmes : unités lues ce jour-là, par objectif. */
  units?: Record<string, number>;
  /** « Pas aujourd'hui » : la tâche ne compte pas ce jour-là, ni pour ni contre. */
  skipped?: string[];
  /** Dernière écriture (ms) : la plus récente gagne d'un appareil à l'autre. */
  at: number;
}

/** Tout Mon parcours, tel qu'il se garde sur l'appareil et dans le compte. */
export interface ParcoursData {
  /** Version du format. Un champ nouveau ne porte que du nouveau. */
  v: 1;
  objectives: Record<string, Objective>;
  days: Record<DayKey, DayLog>;
}

export function emptyParcours(): ParcoursData {
  return { v: 1, objectives: {}, days: {} };
}

/** Les jours de la semaine sans Chabbat : le réglage par défaut d'une habitude. */
export const WEEKDAYS_WITHOUT_CHABBAT: readonly number[] = [0, 1, 2, 3, 4, 5];

/** Tous les jours. */
export const ALL_WEEK: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

/** Un objectif encore là (ni retiré). */
export const isAlive = (objective: Objective): boolean => objective.deletedAt === undefined;

/** Un identifiant neuf, assez court pour une clé de document et assez long pour ne pas se croiser. */
export function newObjectiveId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 14);
}
