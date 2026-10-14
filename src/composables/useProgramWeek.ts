import { useI18n } from "vue-i18n";
import type { WeekBar } from "../components/parcours/WeekBars.vue";
import { localDayFrom } from "../services/dateService";
import { dateTimeFormat } from "../services/intlCache";
import { addDays } from "../services/parcours/days";
import type { DayKey, DayLog, ProgramObjective } from "../services/parcours/model";
import { programPlan, type RestCalendar } from "../services/parcours/plan";
import { useWallLabels } from "./useWallLabels";

/**
 * Ce qu'un programme demande dans les jours qui viennent, pour l'histogramme
 * de sa page et l'aperçu de la feuille « Rattraper » : sept jours, ou six
 * semaines au rythme hebdomadaire.
 */
export function useProgramWeek() {
  const { locale } = useI18n();
  const labels = useWallLabels();

  function bars(
    program: ProgramObjective,
    days: Record<DayKey, DayLog>,
    isRest: RestCalendar,
    today: DayKey,
  ): WeekBar[] {
    const plan = programPlan(program, days, isRest);
    const weekly = program.rhythm === "weekly";
    const count = weekly ? 6 : 7;
    const format = dateTimeFormat(locale.value, { weekday: "short" });
    return Array.from({ length: count }, (_, i) => {
      const day = addDays(today, weekly ? i * 7 : i);
      const state = plan.state(day);
      const extra = program.extra?.[state.slot] ?? 0;
      return {
        key: state.slot,
        label: weekly
          ? labels.weekLabel(state.slot)
          : format.format(localDayFrom(day) ?? new Date()).replace(".", ""),
        units: state.quota,
        extra,
        today: i === 0,
        rest: !state.study,
      };
    });
  }

  return { bars };
}
