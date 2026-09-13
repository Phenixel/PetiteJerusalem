import { describe, it, expect } from "vitest";
import { HDate } from "@hebcal/core";
import {
  DEFAULT_PLACE,
  fastAt,
  fastNear,
  formatZmanDay,
  formatZmanTime,
  type ZmanimPlace,
} from "../services/zmanimService";

// Les jeûnes publics sur la page des horaires : leurs heures, en cadre dès
// la veille (voir FastTimes.vue).

const israel: ZmanimPlace = {
  source: "city",
  latitude: 31.76904,
  longitude: 35.21633,
  tzid: "Asia/Jerusalem",
  city: "Jérusalem",
};

const hd = (y: number, m: number, d: number) => new HDate(new Date(y, m - 1, d, 12));
const at = (place: ZmanimPlace, date: Date) => formatZmanTime(date, place.tzid, "fr");
const on = (place: ZmanimPlace, date: Date) => formatZmanDay(date, place.tzid, "fr");

describe("fastAt", () => {
  it("donne un petit jeûne de l'aube à la sortie des étoiles", () => {
    // 14 septembre 2026 = 3 Tichri 5787, Tzom Guedalia.
    const fast = fastAt(DEFAULT_PLACE, hd(2026, 9, 14), "fr")!;
    expect(fast.name).toContain("Guedalyah");
    expect(fast.fromEve).toBe(false);
    expect(on(DEFAULT_PLACE, fast.start)).toBe("lundi 14 septembre");
    expect(on(DEFAULT_PLACE, fast.end)).toBe("lundi 14 septembre");
    // Aube à 16,1° (Rav Posen), sortie des étoiles à 8,5°.
    expect(at(DEFAULT_PLACE, fast.start)).toBe("05:48");
    expect(at(DEFAULT_PLACE, fast.end)).toBe("20:53");
  });

  it("fait commencer Tich'a beAv la veille au coucher du soleil", () => {
    // 23 juillet 2026 = 9 Av 5786.
    const fast = fastAt(DEFAULT_PLACE, hd(2026, 7, 23), "fr")!;
    expect(fast.name).toContain("beAv");
    expect(fast.fromEve).toBe(true);
    expect(on(DEFAULT_PLACE, fast.start)).toBe("mercredi 22 juillet");
    expect(on(DEFAULT_PLACE, fast.end)).toBe("jeudi 23 juillet");
  });

  it("ne compte pas la veille de Tich'a beAv comme un jeûne", () => {
    expect(fastAt(DEFAULT_PLACE, hd(2026, 7, 22), "fr")).toBeNull();
  });

  it("laisse Kippour à son cadre de repos", () => {
    // 21 septembre 2026 = 10 Tichri 5787.
    expect(fastAt(DEFAULT_PLACE, hd(2026, 9, 21), "fr")).toBeNull();
  });

  it("rend un jour ordinaire sans rien", () => {
    expect(fastAt(DEFAULT_PLACE, hd(2026, 9, 15), "fr")).toBeNull();
  });

  it("nomme le jeûne dans la langue demandée", () => {
    expect(fastAt(israel, hd(2026, 9, 14), "en")!.name).toContain("Gedaliah");
    expect(fastAt(israel, hd(2026, 9, 14), "he")!.name).toContain("צוֹם");
  });
});

describe("fastNear", () => {
  /** Un instant à Paris, en UTC : les tests tournent sous n'importe quel fuseau. */
  const paris = (m: number, d: number, h: number) => new Date(Date.UTC(2026, m - 1, d, h));

  it("annonce le jeûne du lendemain dès la veille", () => {
    // Dimanche 13 septembre 2026, midi : Tzom Guedalia est le lendemain.
    const fast = fastNear(DEFAULT_PLACE, paris(9, 13, 10), "fr")!;
    expect(on(DEFAULT_PLACE, fast.start)).toBe("lundi 14 septembre");
  });

  it("garde le jeûne du jour tant qu'il n'est pas fini", () => {
    // Lundi 14 septembre, 15 h à Paris.
    const fast = fastNear(DEFAULT_PLACE, paris(9, 14, 13), "fr")!;
    expect(on(DEFAULT_PLACE, fast.start)).toBe("lundi 14 septembre");
  });

  it("ne l'annonce plus une fois sorti", () => {
    // Lundi 14 septembre, 23 h à Paris : la sortie des étoiles est passée.
    expect(fastNear(DEFAULT_PLACE, paris(9, 14, 21), "fr")).toBeNull();
  });

  it("garde le jeûne d'un jour parcouru, quelle que soit l'heure", () => {
    // Le même lundi soir, lu comme une journée entière (flèches).
    const fast = fastNear(DEFAULT_PLACE, paris(9, 14, 21), "fr", null)!;
    expect(on(DEFAULT_PLACE, fast.start)).toBe("lundi 14 septembre");
  });

  it("ne cherche pas au-delà du lendemain", () => {
    // Samedi 12 septembre : le jeûne est dans deux jours.
    expect(fastNear(DEFAULT_PLACE, paris(9, 12, 10), "fr")).toBeNull();
  });
});
