import { afterEach, describe, it, expect } from "vitest";
import { HDate, months } from "@hebcal/core";
import {
  DEFAULT_PLACE,
  dayHighlights,
  fastAt,
  fastNear,
  formatZmanDay,
  formatZmanTime,
  nightfallOf,
  restPeriodAt,
  setZmanimOpinion,
  type ZmanimPlace,
} from "../services/zmanimService";
import { DEFAULT_ZMANIM_OPINION } from "../services/zmanimOpinions";

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

afterEach(() => setZmanimOpinion(DEFAULT_ZMANIM_OPINION));

describe("fastAt", () => {
  it("donne un petit jeûne de l'aube à la sortie des étoiles", () => {
    // 14 septembre 2026 = 3 Tichri 5787, Tzom Guedalia.
    const fast = fastAt(DEFAULT_PLACE, hd(2026, 9, 14), "fr")!;
    expect(fast.name).toContain("Guedalyah");
    expect(fast.fromEve).toBe(false);
    expect(on(DEFAULT_PLACE, fast.start!)).toBe("lundi 14 septembre");
    expect(on(DEFAULT_PLACE, fast.end)).toBe("lundi 14 septembre");
    // Aube à 16,1° (Rav Posen), fin du jeûne à 7,08° : trois étoiles
    // MOYENNES, quand la sortie du Chabbat en attend trois petites (8,5°).
    // Le début est une LIMITE (05:48:46, donc 05:48, on ne mange pas
    // quatorze secondes de plus), la fin une FIN (20:44:19, donc 20:45 : à
    // 20:44 le jeûne se romprait dix-neuf secondes trop tôt).
    expect(at(DEFAULT_PLACE, fast.start!)).toBe("05:48");
    expect(at(DEFAULT_PLACE, fast.end)).toBe("20:45");
    // La règle voyage avec l'heure : la note du cadre dit donc bien les
    // 7,083° que le calcul vient d'employer (voir zmanimOpinions, EndRule).
    expect(fast.endRule).toEqual({ kind: "degrees", degrees: 7.083 });
  });

  it("finit le jeûne avant la sortie des étoiles, sans la marge du Chabbat", () => {
    // C'est là qu'était l'erreur : le jeûne se terminait à l'heure du Chabbat,
    // une dizaine de minutes trop tard pour qui le lisait pour manger.
    const fast = fastAt(DEFAULT_PLACE, hd(2026, 9, 14), "fr")!;
    const tzeit = nightfallOf(DEFAULT_PLACE, hd(2026, 9, 14))!;
    const gap = (tzeit.getTime() - fast.end.getTime()) / 60_000;

    expect(gap).toBeGreaterThan(5);
    expect(gap).toBeLessThan(20);
  });

  it("suit l'avis choisi, et le luah que le lieu commande, chez le Rav Ovadia", () => {
    setZmanimOpinion("ovadia");
    // Paris est hors d'Israël : l'avis y suit le luah Amudei Horaah, qui
    // mesure la fin des jeûnes sur 5,075° à l'équinoxe. Chkia 20:05:50,
    // fin 20:33:09, donc 20:34 une fois montée à la minute. Les vingt
    // minutes FIXES d'avant donnaient 20:25:50, sept minutes trop tôt.
    const paris = fastAt(DEFAULT_PLACE, hd(2026, 9, 14), "fr")!;
    expect(at(DEFAULT_PLACE, paris.end)).toBe("20:34");
    expect(paris.endRule).toEqual({ kind: "equinoxDegrees", degrees: 5.075 });

    // En Israël, le même avis suit l'Or Ha'Haïm : vingt minutes ZMANIYOT.
    expect(fastAt(israel, hd(2026, 9, 14), "fr")!.endRule).toEqual({
      kind: "zmaniyot",
      minutes: 20,
    });
  });

  it("laisse la sortie de Kippour où elle était", () => {
    // Kippour est un Yom Tov autant qu'un jeûne : il sort comme le Chabbat, à
    // la sortie des étoiles, et la fin des jeûnes ne doit pas l'avoir avancé.
    // 21 septembre 2026 = 10 Tichri 5787.
    const kippour = restPeriodAt(DEFAULT_PLACE, hd(2026, 9, 21), "fr")!;
    expect(kippour.end!.getTime()).toBe(nightfallOf(DEFAULT_PLACE, hd(2026, 9, 21))!.getTime());
  });

  it("fait commencer Tich'a beAv la veille au coucher du soleil", () => {
    // 23 juillet 2026 = 9 Av 5786.
    const fast = fastAt(DEFAULT_PLACE, hd(2026, 7, 23), "fr")!;
    expect(fast.name).toContain("beAv");
    expect(fast.fromEve).toBe(true);
    expect(on(DEFAULT_PLACE, fast.start!)).toBe("mercredi 22 juillet");
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

  it("ne retient que les six jeûnes publics de l'année", () => {
    // hebcal range aussi parmi les jeûnes le Yom Kippour Katan (la veille de
    // chaque Roch Hodech) et le Ta'anit BeHaB (usage achkénaze d'après Pessah
    // et Soukkot) : une quinzaine de jours par an que l'application ne suit
    // pas, et que sa page du calendrier n'a jamais montrés.
    for (const year of [5786, 5787, 5788]) {
      const names: string[] = [];
      const start = new HDate(1, months.TISHREI, year).abs();
      const end = new HDate(1, months.TISHREI, year + 1).abs();
      for (let abs = start; abs < end; abs++) {
        const fast = fastAt(DEFAULT_PLACE, new HDate(abs), "en");
        if (fast) names.push(fast.name);
      }
      // hebcal rend ces noms avec l'apostrophe typographique.
      expect(names).toEqual([
        "Tzom Gedaliah",
        "Asara B\u2019Tevet",
        "Ta\u2019anit Esther",
        "Ta\u2019anit Bechorot",
        "Tzom Tammuz",
        "Tish\u2019a B\u2019Av",
      ]);
    }
  });

  it("ne met ni Yom Kippour Katan ni BeHaB parmi les reliefs du jour", () => {
    // Ni le cadre du jeûne ni la ligne des reliefs ne les nomment, un an durant.
    const start = new HDate(1, months.TISHREI, 5787).abs();
    const end = new HDate(1, months.TISHREI, 5788).abs();
    const found: string[] = [];
    for (let abs = start; abs < end; abs++) {
      for (const name of dayHighlights(DEFAULT_PLACE, new HDate(abs), "en")) {
        if (name.includes("BeHaB") || name.includes("Yom Kippur Katan")) found.push(name);
      }
    }
    expect(found).toEqual([]);
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
    expect(on(DEFAULT_PLACE, fast.start!)).toBe("lundi 14 septembre");
  });

  it("garde le jeûne du jour tant qu'il n'est pas fini", () => {
    // Lundi 14 septembre, 15 h à Paris.
    const fast = fastNear(DEFAULT_PLACE, paris(9, 14, 13), "fr")!;
    expect(on(DEFAULT_PLACE, fast.start!)).toBe("lundi 14 septembre");
  });

  it("ne l'annonce plus une fois sorti", () => {
    // Lundi 14 septembre, 23 h à Paris : la sortie des étoiles est passée.
    expect(fastNear(DEFAULT_PLACE, paris(9, 14, 21), "fr")).toBeNull();
  });

  it("garde le jeûne d'un jour parcouru, quelle que soit l'heure", () => {
    // Le même lundi soir, lu comme une journée entière (flèches).
    const fast = fastNear(DEFAULT_PLACE, paris(9, 14, 21), "fr", null)!;
    expect(on(DEFAULT_PLACE, fast.start!)).toBe("lundi 14 septembre");
  });

  it("ne cherche pas au-delà du lendemain", () => {
    // Samedi 12 septembre : le jeûne est dans deux jours.
    expect(fastNear(DEFAULT_PLACE, paris(9, 12, 10), "fr")).toBeNull();
  });
});
