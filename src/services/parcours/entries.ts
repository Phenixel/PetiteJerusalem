import type { TextStudyJsonEntry } from "../../models/models";
import { texteOf } from "../chiourTexte";
import { getWeeklyParasha, tehilimOfCycle } from "../dailyCycles";
import { localDayFrom } from "../dateService";
import type { DayKey, Objective } from "./model";
import type { Task } from "./schedule";
import { placeOf } from "./texts";

const known = (entries: (TextStudyJsonEntry | null)[]): TextStudyJsonEntry[] =>
  entries.filter((entry): entry is TextStudyJsonEntry => entry !== null);

/**
 * Les textes qu'une tâche fait lire ce jour-là, en entrées du catalogue :
 * ceux qui doivent être sur l'appareil pour la lire sans connexion. La
 * portion d'un programme, un texte du jour, les psaumes du jour du mois, la
 * paracha de la semaine (au calendrier d'Israël si `il`). Une habitude n'a
 * pas de texte à télécharger : le Sidour vient avec l'app.
 */
export function taskEntries(
  task: Task,
  objective: Objective,
  day: DayKey,
  il: boolean,
): TextStudyJsonEntry[] {
  switch (objective.kind) {
    case "program": {
      const slot = task.slot;
      if (!slot || slot.to <= slot.from) return [];
      const first = placeOf(objective.texts, slot.from);
      const last = placeOf(objective.texts, slot.to - 1);
      if (!first || !last) return [];
      const ids = objective.texts.slice(
        objective.texts.indexOf(first.textId),
        objective.texts.indexOf(last.textId) + 1,
      );
      return known(ids.map((id) => texteOf(id)));
    }
    case "text":
      return known([texteOf(objective.textId)]);
    case "cycle": {
      const date = localDayFrom(day) ?? new Date();
      return objective.cycle === "parasha"
        ? (getWeeklyParasha(date, il)?.entries ?? [])
        : tehilimOfCycle(objective.cycle, date).entries;
    }
    default:
      return [];
  }
}
