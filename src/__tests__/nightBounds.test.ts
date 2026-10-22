import { describe, expect, it } from "vitest";
import { dawnOf, liturgicalDay, nightEndOf } from "../services/nightBounds";
import { currentTefilaWindow } from "../services/sidourService";
import { sidourMoment } from "../services/sidourMoment";
import { DEFAULT_PLACE, placeDayKey } from "../services/zmanimService";

/**
 * La règle de la nuit (services/nightBounds.ts), la même pour l'accueil, la
 * page du Sidour, Mon parcours et le lecteur : la nuit court jusqu'à l'aube,
 * et la journée suivante ne commence qu'à l'aube.
 *
 * Paris, nuit du mercredi 21 au jeudi 22 octobre 2026 : sortie des étoiles
 * vers 19 h 37 le 21, 'hatsot de la nuit à 1 h 36, aube vers 6 h 47.
 */
const at = (iso: string) => new Date(iso);
const dayKey = (date: Date) => placeDayKey(DEFAULT_PLACE, date);

describe("la règle de la nuit", () => {
  it("l'aube est alot hacha'har du matin", () => {
    const dawn = dawnOf(DEFAULT_PLACE, at("2026-10-22T12:00:00+02:00"));
    expect(dawn?.toISOString()).toMatch(/^2026-10-22T04:4\d/);
  });

  it("avant l'aube, le jour est encore la veille ; à l'aube, il change", () => {
    expect(dayKey(liturgicalDay(DEFAULT_PLACE, at("2026-10-21T23:30:00+02:00")))).toBe(
      "2026-10-21",
    );
    expect(dayKey(liturgicalDay(DEFAULT_PLACE, at("2026-10-22T01:40:00+02:00")))).toBe(
      "2026-10-21",
    );
    expect(dayKey(liturgicalDay(DEFAULT_PLACE, at("2026-10-22T06:30:00+02:00")))).toBe(
      "2026-10-21",
    );
    expect(dayKey(liturgicalDay(DEFAULT_PLACE, at("2026-10-22T07:00:00+02:00")))).toBe(
      "2026-10-22",
    );
  });

  it("la nuit d'un soir finit à l'aube du lendemain", () => {
    const end = nightEndOf(DEFAULT_PLACE, at("2026-10-21T12:00:00+02:00"));
    expect(end?.getTime()).toBe(dawnOf(DEFAULT_PLACE, at("2026-10-22T12:00:00+02:00"))?.getTime());
  });

  it("Arvit se propose jusqu'à l'aube, passé 'hatsot", () => {
    const window = currentTefilaWindow(DEFAULT_PLACE, at("2026-10-22T01:40:00+02:00"));
    expect(window?.tefila).toBe("arvit");
    expect(dayKey(window!.start)).toBe("2026-10-21");
    expect(window?.end.getTime()).toBe(nightEndOf(DEFAULT_PLACE, window!.start)?.getTime());
    expect(currentTefilaWindow(DEFAULT_PLACE, at("2026-10-22T07:00:00+02:00"))).toBeNull();
  });

  it("à 1 h 40, Arvit dite : le Chema du coucher de mercredi soir", () => {
    // Une nuit de la lune : elle est bénie, il reste le Chema.
    const moment = sidourMoment(DEFAULT_PLACE, at("2026-10-22T01:40:00+02:00"), {
      office: () => true,
      moon: () => true,
    });
    expect(moment.hero?.kind).toBe("chema");
    expect(dayKey(moment.hero!.evening!)).toBe("2026-10-21");
  });
});
