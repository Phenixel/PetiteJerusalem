import type { TextStudyJsonEntry } from "../../models/models";
import { texteOf } from "../chiourTexte";
import { getWeeklyParasha, tehilimOfCycle } from "../dailyCycles";
import { dafYomiOn } from "../dafYomi";
import { localDayFrom } from "../dateService";
import type { DayKey, Objective } from "./model";
import type { Task } from "./schedule";
import { placeOf } from "./texts";

const known = (entries: (TextStudyJsonEntry | null)[]): TextStudyJsonEntry[] =>
  entries.filter((entry): entry is TextStudyJsonEntry => entry !== null);

/**
 * The texts a task has one read that day, as catalog entries: the ones that
 * must be on the device to read it offline. A program's portion, a daily
 * text, the psalms of the day of the month, the parasha of the week (on the
 * calendar of Israel if `il`), the tractate of the day's daf. A habit has no
 * text to download: the Sidour comes with the app.
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
      if (objective.cycle === "parasha") return getWeeklyParasha(date, il)?.entries ?? [];
      // The Daf Yomi: the tractate of the day's daf.
      if (objective.cycle === "daf-yomi") {
        const daf = dafYomiOn(date);
        return daf ? [daf.entry] : [];
      }
      return tehilimOfCycle(objective.cycle, date).entries;
    }
    default:
      return [];
  }
}
