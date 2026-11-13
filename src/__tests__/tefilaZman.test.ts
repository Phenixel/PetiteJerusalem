// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEFAULT_PLACE, formatZmanTime } from "../services/zmanimService";
import { ZMAN_MOMENTS, arcPosition, zmanPhase, zmanPlan, zmanTarget } from "../services/tefilaZman";

/**
 * The time of a moment of prayer (the pill before what is read, and its
 * sheet, see TefilaZman.vue): which window it shows, where the moment
 * stands, and which night Arvit and the Sli'hot belong to.
 */

const at = (date: Date) => formatZmanTime(date, DEFAULT_PLACE.tzid, "fr");
/** An instant in Paris, in summer time (UTC+2), on 4 August 2026. */
const paris = (hour: number, minute = 0, day = 4) =>
  new Date(Date.UTC(2026, 7, day, hour - 2, minute));

describe("l'horaire d'un moment de prière", () => {
  it("donne une fenêtre et des repères rangés dans l'ordre du jour, pour chaque moment", () => {
    for (const moment of ZMAN_MOMENTS) {
      const plan = zmanPlan(moment, DEFAULT_PLACE, paris(14));
      expect({ moment, plan: plan !== null }).toEqual({ moment, plan: true });
      expect({ moment, open: plan!.start < plan!.end }).toEqual({ moment, open: true });
      const times = plan!.marks.map((mark) => mark.date.getTime());
      expect({ moment, times }).toEqual({ moment, times: [...times].sort((a, b) => a - b) });
    }
  });

  it("Min'ha : de guedola à la chkia, avec ketana et plag entre les deux", () => {
    const plan = zmanPlan("minha", DEFAULT_PLACE, paris(16, 30))!;
    expect(plan.marks.map((mark) => mark.key)).toEqual([
      "minhaGuedola",
      "minhaKetana",
      "plag",
      "chkia",
    ]);
    expect(plan.start).toEqual(plan.marks[0].date);
    expect(plan.end).toEqual(plan.marks[3].date);
  });

  it("compte vers l'ouverture avant, vers la fermeture pendant, et se dit passé après", () => {
    const morning = zmanPlan("minha", DEFAULT_PLACE, paris(9))!;
    expect(zmanPhase(morning, paris(9))).toBe("before");
    expect(zmanTarget(morning, "before")).toEqual(morning.start);

    const afternoon = zmanPlan("minha", DEFAULT_PLACE, paris(16, 30))!;
    expect(zmanPhase(afternoon, paris(16, 30))).toBe("during");
    expect(zmanTarget(afternoon, "during")).toEqual(afternoon.end);

    const night = zmanPlan("minha", DEFAULT_PLACE, paris(22))!;
    expect(zmanPhase(night, paris(22))).toBe("after");
  });

  it("Arvit, après minuit, est encore celle de la nuit commencée la veille", () => {
    const evening = zmanPlan("arvit", DEFAULT_PLACE, paris(23))!;
    const afterMidnight = zmanPlan("arvit", DEFAULT_PLACE, paris(1, 0, 5))!;
    expect(afterMidnight.start).toEqual(evening.start);
    expect(afterMidnight.cycle).toEqual(evening.cycle);
    // Before 'hatsot, by preference; after it, until dawn.
    expect(zmanPhase(evening, paris(23))).toBe("preferred");
    expect(zmanTarget(evening, "preferred")).toEqual(evening.preferred);
    expect(zmanPhase(afterMidnight, paris(3, 0, 5))).toBe("during");
  });

  it("Arvit, l'après-midi, annonce la sortie des étoiles du soir même", () => {
    const plan = zmanPlan("arvit", DEFAULT_PLACE, paris(15))!;
    expect(zmanPhase(plan, paris(15))).toBe("before");
    expect(plan.start.getTime()).toBeGreaterThan(paris(15).getTime());
    expect(plan.start.getTime() - paris(15).getTime()).toBeLessThan(12 * 3_600_000);
  });

  it("place toute heure dans le cycle : la nuit d'avant, le jour, la nuit d'après", () => {
    const plan = zmanPlan("chaharit", DEFAULT_PLACE, paris(8))!;
    const { prevSunset, sunrise, sunset, nextSunrise } = plan.cycle;
    expect(at(sunrise)).toBe("06:28");
    expect([prevSunset, sunrise, sunset, nextSunrise].map((d) => arcPosition(plan, d))).toEqual([
      -1, 0, 1, 2,
    ]);
    // Misheyakir: a little before sunrise, at the end of the night before.
    const misheyakir = plan.marks.find((mark) => mark.key === "misheyakir")!;
    expect(arcPosition(plan, misheyakir.date)).toBeLessThan(0);
    expect(arcPosition(plan, misheyakir.date)).toBeGreaterThan(-0.2);
    // At 3 a.m., in the night before; at 11 p.m., in the night after: now always shows.
    expect(arcPosition(plan, paris(3))).toBeGreaterThan(-1);
    expect(arcPosition(plan, paris(3))).toBeLessThan(0);
    expect(arcPosition(plan, paris(23))).toBeGreaterThan(1);
    expect(arcPosition(plan, paris(23))).toBeLessThan(2);
  });

  it("met la fenêtre d'Arvit dans la nuit qui suit le jour du dessin", () => {
    const plan = zmanPlan("arvit", DEFAULT_PLACE, paris(15))!;
    expect(arcPosition(plan, plan.start)).toBeGreaterThan(1);
    expect(arcPosition(plan, plan.end)).toBeLessThan(2);
  });
});
