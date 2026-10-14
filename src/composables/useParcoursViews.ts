import { HDate } from "@hebcal/core";
import { useI18n } from "vue-i18n";
import type { RouteLocationRaw } from "vue-router";
import type { CardArtSpec } from "../components/CardArt.vue";
import type { VolumeFormat } from "../components/parcours/ProgramVolume.vue";
import { corpusOf, hubPath } from "../content/etudeTexts";
import { bindingOf } from "../config/bindings";
import { texteOf, texteTitle } from "../services/chiourTexte";
import { getWeeklyParasha, parashaTitle, tehilimOfCycle } from "../services/dailyCycles";
import { localDayFrom } from "../services/dateService";
import type {
  CycleObjective,
  DayKey,
  HabitObjective,
  MomentId,
  Objective,
  ProgramObjective,
  Rhythm,
  UnitKind,
} from "../services/parcours/model";
import { portionMinutes, studySlots } from "../services/parcours/plan";
import {
  TEFILOT_STEPS,
  isSkipped,
  taskProgress,
  type Task,
  type TaskProgress,
} from "../services/parcours/schedule";
import {
  partRef,
  placeOf,
  portionLabel,
  readingRoute,
  textName,
  unitOf,
  type PartRef,
} from "../services/parcours/texts";
import { habitAnchor } from "../services/parcours/create";
import { tefilaPath } from "../services/sidourService";
import { formatHebrewDate, isIsraelPlace } from "../services/zmanimService";
import { dateTimeFormat } from "../services/intlCache";
import { psalmsLabel } from "./useTehilimDay";
import { useParcours } from "./useParcours";
import { useZmanimLocation } from "./useZmanimLocation";

/**
 * Ce que Mon parcours dit à l'écran : le nom d'un objectif, ce qu'une tâche
 * demande aujourd'hui, où la toucher mène, l'objet qu'elle porte. Une seule
 * façon de le dire, pour l'accueil, Ma journée, le mur et les pages d'un
 * objectif.
 */

/** Le dessin d'un volume de l'étagère. */
export interface VolumeLook {
  color: string;
  format: VolumeFormat;
  lines: string[];
  sub: string;
}

/** Une tâche telle qu'une carte ou une ligne la montre. */
export interface TaskView {
  /** Unique sur la journée : la tâche et son jour. */
  key: string;
  task: Task;
  objective: Objective;
  day: DayKey;
  /** Ce qu'on fait : « Séder Moed », « Min'ha », « Chema al hamita ». */
  title: string;
  /** Ce qu'il y a à lire, ou le rappel de l'objectif : « Chabbat 7:1 à 7:3 · 3 michnayot ». */
  meta: string;
  /** Le moment : « Ce soir », « Cette semaine ». */
  kicker: string;
  /** Où la toucher mène ; null : elle n'a pas de page, le toucher ouvre sa fiche. */
  route: RouteLocationRaw | null;
  /** L'objet dessiné de sa carte. */
  art: CardArtSpec | null;
  progress: TaskProgress;
  skipped: boolean;
}

/** Le Chema al hamita, dans le Sidour. */
const CHEMA_AL_HAMITA_ID = 348;
/** Birkat Hamazon, dans les brahot. */
const BIRKAT_HAMAZON_ID = 342;

/** Le nom court d'un séder, dans la langue de l'écran. */
const SEDER_KEYS = {
  zeraim: "parcours.sedarim.zeraim",
  moed: "parcours.sedarim.moed",
  nachim: "parcours.sedarim.nachim",
  nezikin: "parcours.sedarim.nezikin",
  kodachim: "parcours.sedarim.kodachim",
  toharot: "parcours.sedarim.toharot",
} as const;

export function useParcoursViews() {
  const { t, locale } = useI18n();
  const store = useParcours();
  const { place } = useZmanimLocation();

  /** « 3 michnayot », « 1 chapitre ». */
  function unitsLabel(unit: UnitKind, n: number): string {
    return t(`parcours.units.${unit}`, { n }, n);
  }

  function momentLabel(moment: MomentId): string {
    return t(`parcours.moments.${moment}`);
  }

  /** Quand revient un objectif : son moment, ou les trois offices des tefilot. */
  function whenLabel(objective: Objective): string {
    if (objective.kind === "habit" && objective.preset === "tefilot") {
      return TEFILOT_STEPS.map(({ step }) => t(`parcours.tefilot.${step}`)).join(", ");
    }
    return momentLabel(objective.moment);
  }

  function partName(ref: PartRef, corpus: ProgramObjective["corpus"]): string {
    if (ref.kind === "seder") return t(SEDER_KEYS[ref.seder]);
    if (ref.kind === "text") return textName(ref.textId, locale.value);
    return t(`parcours.volume.all.${corpus}`);
  }

  /** Le nom d'un programme : « Séder Moed », « Moed et Nachim », « Avot », « Tout le Chass ». */
  function programTitle(program: ProgramObjective): string {
    const refs = program.parts.map(partRef).filter((ref): ref is PartRef => ref !== null);
    if (refs.length === 0) return t(`parcours.volume.all.${program.corpus}`);
    const names = refs.map((ref) => partName(ref, program.corpus));
    if (refs.length === 1 && refs[0].kind === "seder") {
      return t("parcours.volume.seder", { name: names[0] });
    }
    if (names.length === 1) return names[0];
    if (names.length === 2) return t("parcours.volume.two", { a: names[0], b: names[1] });
    return t("parcours.volume.more", { a: names[0], n: names.length - 1 }, names.length - 1);
  }

  /** Le titre court de la couverture : « Moed », « Avot », « Michna ». */
  function coverLabel(objective: Objective): string {
    if (objective.kind === "program") {
      const first = partRef(objective.parts[0] ?? "all");
      return first && first.kind !== "all"
        ? partName(first, objective.corpus)
        : t(`parcours.corpus.${objective.corpus}`);
    }
    if (objective.kind === "cycle") return t(`parcours.cycles.${objective.cycle}.cover`);
    if (objective.kind === "text") return textName(objective.textId, locale.value);
    return "";
  }

  function habitTitle(habit: HabitObjective): string {
    return habit.name.trim() || t(`parcours.habits.${habit.preset}`);
  }

  function objectiveTitle(objective: Objective): string {
    switch (objective.kind) {
      case "program":
        return programTitle(objective);
      case "habit":
        return habitTitle(objective);
      case "cycle":
        return t(`parcours.cycles.${objective.cycle}.title`);
      case "text": {
        const entry = texteOf(objective.textId);
        return entry ? texteTitle(entry, locale.value) : "";
      }
      default:
        return "";
    }
  }

  /** La reliure d'un objectif qui se lit : celle de son corpus. */
  function objectiveColor(objective: Objective): string {
    if (objective.kind === "program") return bindingOf(objective.corpus);
    if (objective.kind === "cycle") {
      return bindingOf(objective.cycle === "parasha" ? "tanakh" : "tehilim");
    }
    if (objective.kind === "text") {
      const entry = texteOf(objective.textId);
      return bindingOf(entry ? corpusOf(entry) : "michna");
    }
    return bindingOf("michna");
  }

  function objectiveArt(objective: Objective, step?: string): CardArtSpec | null {
    if (objective.kind === "habit") {
      const withSidour =
        objective.preset === "tefilot" ||
        objective.preset === "tefilin" ||
        objective.preset === "chema-al-hamita" ||
        objective.preset === "birkat-hamazon";
      return withSidour || step ? { kind: "siddur" } : null;
    }
    return { kind: "volume", color: objectiveColor(objective), label: coverLabel(objective) };
  }

  /** Ce que lit un cycle un jour donné : les psaumes du jour du mois, la paracha de la semaine. */
  function cycleReading(cycle: CycleObjective["cycle"], day: DayKey): string {
    const date = localDayFrom(day) ?? new Date();
    date.setHours(12);
    if (cycle !== "parasha") return psalmsLabel(tehilimOfCycle(cycle, date).psalms, t);
    return parashaTitle(getWeeklyParasha(date, isIsraelPlace(place.value)));
  }

  function route(task: Task, objective: Objective, day: DayKey): RouteLocationRaw | null {
    switch (objective.kind) {
      case "program": {
        const start = task.slot ? placeOf(objective.texts, task.slot.from) : null;
        if (!start) return null;
        const target = readingRoute(start);
        return { ...target, query: { ...target.query, objectif: objective.id } };
      }
      case "habit": {
        if (task.step) return tefilaPath(task.step);
        if (objective.preset === "chema-al-hamita") {
          const entry = texteOf(CHEMA_AL_HAMITA_ID);
          return entry ? hubPath(entry) : null;
        }
        if (objective.preset === "birkat-hamazon") {
          const entry = texteOf(BIRKAT_HAMAZON_ID);
          return entry ? hubPath(entry) : null;
        }
        // Un temps d'étude : la bibliothèque, on y lit ce qu'on veut.
        if (objective.preset === "limoud") return "/bibliotheque";
        return null;
      }
      case "cycle": {
        if (objective.cycle === "tehilim-month") return "/bibliotheque/tehilim-du-jour";
        if (objective.cycle === "parasha") return "/bibliotheque/chnei-mikra";
        // Les Tehilim de la semaine : le premier psaume du jour, la tâche au bas.
        const date = localDayFrom(day) ?? new Date();
        date.setHours(12);
        const first = tehilimOfCycle(objective.cycle, date).entries[0];
        return first ? { path: hubPath(first), query: { objectif: objective.id } } : null;
      }
      case "text": {
        const entry = texteOf(objective.textId);
        return entry ? { path: hubPath(entry), query: { objectif: objective.id } } : null;
      }
      default:
        return null;
    }
  }

  /** La portion d'un programme, seule : « Chabbat 7:1 à 7:3 ». */
  function portionText(task: Task, objective: ProgramObjective): string {
    const slot = task.slot;
    if (!slot) return "";
    return portionLabel(objective.texts, slot.from, slot.to, locale.value, (a, b) =>
      t("parcours.portion.range", { from: a, to: b }),
    );
  }

  function meta(task: Task, objective: Objective, day: DayKey): string {
    switch (objective.kind) {
      case "program": {
        const slot = task.slot;
        if (!slot) return "";
        const units = Math.max(0, slot.to - slot.from);
        return t("parcours.portion.meta", {
          portion: portionText(task, objective),
          units: unitsLabel(unitOf(objective.corpus), units),
        });
      }
      case "habit":
        if (objective.preset === "tefilin") return t("parcours.hub.withChaharit");
        if (objective.preset === "birkat-hamazon") return t("parcours.hub.afterMeal");
        if (objective.preset === "chema-al-hamita") return t("parcours.hub.beforeSleep");
        if (objective.preset === "limoud") return t("parcours.hub.studyMeta");
        return momentLabel(task.moment);
      case "cycle":
        return cycleReading(objective.cycle, day);
      case "text":
        return t("parcours.task.everyDay");
      default:
        return "";
    }
  }

  function title(task: Task, objective: Objective): string {
    if (objective.kind === "habit" && task.step) return t(`parcours.tefilot.${task.step}`);
    return objectiveTitle(objective);
  }

  /** Le moment d'une carte : « Ce soir », « Cette semaine », ou le repère d'une habitude. */
  function kicker(task: Task, objective: Objective): string {
    if (task.weekly) return t("parcours.kicker.weekly");
    const anchor =
      objective.kind === "habit" && !task.step
        ? habitAnchor(objective)
        : objective.kind === "program"
          ? (objective.anchor ?? null)
          : null;
    if (anchor) return t(`parcours.anchorKicker.${anchor}`);
    return t(`parcours.kicker.${task.moment}`);
  }

  /** Une tâche d'un jour, prête à montrer. */
  function taskView(task: Task, day: DayKey): TaskView {
    const data = store.data.value;
    const objective = data.objectives[task.objectiveId];
    return {
      key: `${day}:${task.id}`,
      task,
      objective,
      day,
      title: title(task, objective),
      meta: meta(task, objective, day),
      kicker: kicker(task, objective),
      route: route(task, objective, day),
      art: objectiveArt(objective, task.step),
      progress: taskProgress(data, task, day),
      skipped: isSkipped(data.days[day], task.id),
    };
  }

  /**
   * Le volume d'un objectif (docs/design.md, « Un objectif, un volume ») : sa
   * taille dit sa longueur (un traité seul, un petit livre ; plusieurs
   * sedarim, un volume épais ; tout le corpus, le plus gros), son titre ce
   * qu'on a pris, sur une ou deux lignes.
   */
  function volumeOf(objective: Objective): VolumeLook {
    const color = objectiveColor(objective);
    if (objective.kind !== "program") {
      return {
        color,
        format: objective.kind === "text" ? "small" : "regular",
        lines: [coverLabel(objective)],
        sub:
          objective.kind === "cycle"
            ? t(`parcours.cycles.${objective.cycle}.sub`)
            : t("parcours.task.everyDay"),
      };
    }
    const refs = objective.parts.map(partRef).filter((ref): ref is PartRef => ref !== null);
    const sub = t(`parcours.corpus.${objective.corpus}`);
    if (refs.some((ref) => ref.kind === "all")) {
      return { color, format: "large", lines: [coverLabel(objective)], sub };
    }
    const names = refs.map((ref) => partName(ref, objective.corpus));
    if (names.length === 1) {
      return { color, format: refs[0].kind === "text" ? "small" : "regular", lines: names, sub };
    }
    const lines =
      names.length === 2
        ? names
        : [names[0], t("parcours.volume.others", { n: names.length - 1 }, names.length - 1)];
    return { color, format: "thick", lines, sub };
  }

  /** Un jour en clair, hébraïque puis civil : « 29 Elul 5787, 1 octobre 2027 ». */
  function dayLabel(day: DayKey): string {
    const date = localDayFrom(day) ?? new Date();
    date.setHours(12);
    const civil = dateTimeFormat(locale.value, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
    return t("parcours.date.both", {
      hebrew: formatHebrewDate(new HDate(date), locale.value),
      civil,
    });
  }

  /**
   * Ce que chaque rythme demanderait pour lire `units` de `start` à `end` :
   * « 3 michnayot par jour, 12 min environ ». L'étape « pour quand » et les
   * réglages d'un programme le montrent sous chaque option.
   */
  function paceLabels(
    corpus: ProgramObjective["corpus"],
    units: number,
    start: DayKey,
    end: DayKey,
  ): Record<Rhythm, string> {
    const unit = unitOf(corpus);
    const label = (rhythm: Rhythm): string => {
      const slots = Math.max(1, studySlots(rhythm, start, end, store.isRest.value).length);
      const per = Math.max(1, Math.ceil(units / slots));
      return t(`parcours.pace.${rhythm}`, {
        units: unitsLabel(unit, per),
        minutes: portionMinutes(unit, per),
      });
    };
    return { daily: label("daily"), weekdays: label("weekdays"), weekly: label("weekly") };
  }

  /** Les minutes d'une portion de programme, pour « 12 min environ ». */
  function portionTime(program: ProgramObjective, units: number): string {
    return t("parcours.portion.minutes", { n: portionMinutes(unitOf(program.corpus), units) });
  }

  return {
    unitsLabel,
    momentLabel,
    whenLabel,
    objectiveTitle,
    objectiveColor,
    objectiveArt,
    coverLabel,
    taskView,
    portionText,
    portionTime,
    dayLabel,
    volumeOf,
    paceLabels,
  };
}
