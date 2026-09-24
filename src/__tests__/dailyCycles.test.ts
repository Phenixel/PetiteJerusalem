import { describe, it, expect } from "vitest";
import {
  adjacentParasha,
  getWeekdayTorahParasha,
  getWeeklyParasha,
  getParashaForShabbat,
  getTehilimOfDay,
  shabbatOfWeek,
  TEHILIM_MONTHLY,
} from "../services/dailyCycles";

describe("getWeeklyParasha", () => {
  it("résout une paracha du catalogue pour chaque semaine sur 4 ans", () => {
    // Chaque samedi (ou la semaine de fête qui le suit) doit correspondre à
    // une ou deux entrées du catalogue : le mapping hebcal → catalogue est
    // complet, alias compris.
    const start = Date.UTC(2025, 0, 1);
    const end = Date.UTC(2029, 0, 1);
    for (let ts = start; ts < end; ts += 7 * 24 * 3600 * 1000) {
      const parasha = getWeeklyParasha(new Date(ts));
      expect(parasha).not.toBeNull();
      expect(parasha!.weekKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(parasha!.entries.length).toBe(parasha!.names.length);
      expect(parasha!.entries.length).toBeGreaterThanOrEqual(1);
      expect(parasha!.entries.length).toBeLessThanOrEqual(2);
      for (const entry of parasha!.entries) {
        expect(String(entry.type)).toBe("Tanakh");
      }
    }
  });

  it("donne la même paracha toute la semaine (dimanche → samedi)", () => {
    // Semaine ordinaire : 2 au 8 novembre 2025 (dimanche → samedi suivant).
    // Dates locales (et non UTC) : minuit UTC tombe la veille à l'ouest de
    // Greenwich, ce qui décalait la semaine testée d'un cran.
    const reference = getWeeklyParasha(new Date(2025, 10, 2, 12));
    for (let day = 3; day <= 8; day++) {
      const parasha = getWeeklyParasha(new Date(2025, 10, day, 12));
      expect(parasha?.names).toEqual(reference?.names);
    }
  });
});

describe("getParashaForShabbat", () => {
  it("donne la paracha du samedi demandé", () => {
    // Chabbat 8 août 2026 : Re'eh.
    const parasha = getParashaForShabbat(new Date(2026, 7, 8, 22, 0, 0));
    expect(parasha?.names).toEqual(["Re'eh"]);
    expect(parasha?.weekKey).toBe("2026-08-08");
  });

  it("ne renvoie rien quand ce Chabbat tombe un jour de fête", () => {
    // 3 octobre 2026 : Chemini Atseret, un Chabbat sans paracha ordinaire.
    // getWeeklyParasha anticiperait sur la suivante, pas getParashaForShabbat.
    const shabbat = new Date(2026, 9, 3, 22, 0, 0);
    expect(getWeeklyParasha(shabbat)).not.toBeNull();
    expect(getParashaForShabbat(shabbat)).toBeNull();
  });

  it("suit le cycle d'Israël quand on le lui demande", () => {
    // Les deux cycles divergent six Chabbats par an dès qu'un dernier jour de
    // Yom Tov tombe un Chabbat en diaspora : Chavou'ot 5786 s'achève le
    // samedi 23 mai 2026, qu'Israël a déjà passé. Israël lit Nasso ce
    // jour-là ; la diaspora, qui est encore en fête, n'a pas de paracha, et
    // ne rattrape qu'au Chabbat du 27 juin, en doublant Houkat et Balak.
    expect(getParashaForShabbat(new Date(2026, 4, 23, 22), true)?.names).toEqual(["Nasso"]);
    expect(getParashaForShabbat(new Date(2026, 4, 23, 22))).toBeNull();
    expect(getParashaForShabbat(new Date(2026, 5, 27, 22), true)?.names).toEqual(["Balak"]);
    expect(getParashaForShabbat(new Date(2026, 5, 27, 22))?.names).toEqual(["Chukat", "Balak"]);
    // Les deux cycles se rejoignent ensuite, et ne se quittent plus de l'année.
    expect(getParashaForShabbat(new Date(2026, 6, 4, 22), true)?.names).toEqual(
      getParashaForShabbat(new Date(2026, 6, 4, 22))?.names,
    );
  });

  it("suit le samedi, pas la date d'aujourd'hui", () => {
    // Deux Chabbats consécutifs : chacun sa paracha.
    expect(getParashaForShabbat(new Date(2026, 7, 8, 22, 0, 0))?.names).toEqual(["Re'eh"]);
    expect(getParashaForShabbat(new Date(2026, 7, 15, 22, 0, 0))?.names).toEqual(["Shoftim"]);
  });
});

describe("getWeekdayTorahParasha", () => {
  // La lecture du lundi et du jeudi matin : le début de la paracha du Chabbat
  // qui vient, sauf avant Souccot, où c'est Vezot Haberakha.
  it("lit Vezot Haberakha entre Kippour et Souccot", () => {
    // Jeudi 24 septembre 2026, 13 Tichri 5787 : le Chabbat qui vient est
    // Souccot. Le chnei mikra, lui, anticipe Berechit.
    const jeudi = new Date(2026, 8, 24, 12);
    expect(getWeekdayTorahParasha(jeudi)?.names).toEqual(["Vezot Haberakhah"]);
    expect(getWeekdayTorahParasha(jeudi)?.entries[0]?.name).toBe("V'Zot HaBerachah");
    expect(getWeekdayTorahParasha(jeudi)?.weekKey).toBe("2026-09-26");
    expect(getWeeklyParasha(jeudi)?.names).toEqual(["Bereshit"]);
  });

  it("garde Ha'azinou quand un Chabbat ordinaire sépare Kippour de Souccot", () => {
    // Jeudi 20 septembre 2029, 11 Tichri 5790 : Kippour est tombé un
    // mercredi, le Chabbat qui vient lit Ha'azinou.
    expect(getWeekdayTorahParasha(new Date(2029, 8, 20, 12))?.names).toEqual(["Ha'azinu"]);
  });

  it("lit Vezot Haberakha la semaine où Kippour tombe un Chabbat", () => {
    // Roch Hachana 5789 tombe un jeudi : Kippour est le Chabbat 30 septembre
    // 2028. Le lundi 25 (5 Tichri) et le jeudi 28 (8 Tichri) lisent donc
    // déjà Vezot Haberakha.
    expect(getWeekdayTorahParasha(new Date(2028, 8, 25, 12))?.names).toEqual(["Vezot Haberakhah"]);
    expect(getWeekdayTorahParasha(new Date(2028, 8, 28, 12))?.names).toEqual(["Vezot Haberakhah"]);
  });

  it("reprend au Berechit après Sim'hat Torah", () => {
    // Lundi 5 octobre 2026, 24 Tichri.
    expect(getWeekdayTorahParasha(new Date(2026, 9, 5, 12))?.names).toEqual(["Bereshit"]);
  });

  it("suit la paracha de la semaine le reste de l'année", () => {
    // Jeudi 6 août 2026 : Re'eh, lue le Chabbat 8 août.
    expect(getWeekdayTorahParasha(new Date(2026, 7, 6, 12))?.names).toEqual(["Re'eh"]);
  });
});

describe("adjacentParasha", () => {
  // Les flèches du chnei mikra, en tête du Tanakh : elles feuillettent les
  // parachiot une à une, dans les deux sens.
  it("passe à la paracha suivante et à la précédente", () => {
    expect(adjacentParasha("2026-08-08", 1)?.names).toEqual(["Shoftim"]);
    expect(adjacentParasha("2026-08-08", -1)?.names).toEqual(["Eikev"]);
  });

  it("enjambe les Chabbats de fête, qui n'ont pas de paracha ordinaire", () => {
    // Chabbat 26 septembre 2026 : premier jour de Souccot. Le suivant
    // (3 octobre) est Chemini Atseret, la paracha d'après est Berechit, le 10.
    expect(getParashaForShabbat(new Date(2026, 9, 3, 12))).toBeNull();
    const next = adjacentParasha("2026-09-26", 1);
    expect(next?.names).toEqual(["Bereshit"]);
    expect(next?.weekKey).toBe("2026-10-10");
  });

  it("revient sur ses pas : avancer puis reculer ramène au point de départ", () => {
    // Sur deux ans, y compris les semaines de fête et les parachiot doubles.
    let week = "2025-01-04";
    for (let step = 0; step < 104; step++) {
      const next = adjacentParasha(week, 1);
      expect(next).not.toBeNull();
      expect(adjacentParasha(next!.weekKey, -1)?.weekKey).toBe(week);
      week = next!.weekKey;
    }
  });

  it("le Chabbat d'une semaine est bien un samedi", () => {
    expect(shabbatOfWeek("2026-08-08").getDay()).toBe(6);
  });
});

describe("cycles de Tehilim", () => {
  it("le cycle mensuel couvre les 150 psaumes sans trou", () => {
    const seen = new Set<number>();
    for (const [from, to] of TEHILIM_MONTHLY) {
      expect(from).toBeLessThanOrEqual(to);
      for (let n = from; n <= to; n++) seen.add(n);
    }
    expect(seen.size).toBe(150);
    expect(TEHILIM_MONTHLY.length).toBe(30);
  });

  it("résout chaque psaume du jour vers une entrée du catalogue", () => {
    // 40 jours consécutifs : couvre un mois hébraïque entier, y compris le
    // cas du mois de 29 jours.
    for (let day = 0; day < 40; day++) {
      const date = new Date(2026, 0, 1 + day);
      const cycle = getTehilimOfDay(date);
      expect(cycle.psalms.length).toBeGreaterThan(0);
      expect(cycle.entries.length).toBe(cycle.psalms.length);
    }
  });
});
