import { describe, expect, it } from "vitest";
import { HDate, months } from "@hebcal/core";
import { hiloulotKeys, hiloulotOn, loadHiloulot, type HiloulotIndex } from "../services/hiloulot";

/**
 * Les hiloulot du jour (voir services/hiloulot).
 *
 * Deux choses se tiennent ici : la façon dont une date de l'année en cours
 * retrouve ce que la liste a inscrit (Adar, le 30 d'un mois court), et la
 * bonne santé des deux fichiers de données, que personne ne relit à la main.
 *
 * Repères : 5786 est une année ordinaire (douze mois), 5787 en compte treize.
 */

describe("hiloulotKeys", () => {
  it("lit le mois et le jour de la date", () => {
    expect(hiloulotKeys(new HDate(5, months.AV, 5786))).toEqual(["0505"]);
  });

  it("réunit les deux Adar les années ordinaires, et les sépare les autres", () => {
    // Année ordinaire : l'unique Adar porte ce qui est inscrit dans les deux,
    // sinon cent vingt noms disparaîtraient deux années sur trois.
    expect(HDate.isLeapYear(5786)).toBe(false);
    expect(hiloulotKeys(new HDate(7, months.ADAR_I, 5786))).toEqual(["1207", "1307"]);
    // Année à treize mois : chaque Adar garde les siens, comme le calendrier
    // d'origine les inscrit.
    expect(HDate.isLeapYear(5787)).toBe(true);
    expect(hiloulotKeys(new HDate(7, months.ADAR_I, 5787))).toEqual(["1207"]);
    expect(hiloulotKeys(new HDate(7, months.ADAR_II, 5787))).toEqual(["1307"]);
  });

  it("ramène le 30 au dernier jour d'un mois qui n'en compte que 29", () => {
    // 'Hechvan a 29 jours en 5786 : le 29 porte aussi ce qui est inscrit au 30.
    expect(HDate.daysInMonth(months.CHESHVAN, 5786)).toBe(29);
    expect(hiloulotKeys(new HDate(29, months.CHESHVAN, 5786))).toEqual(["0829", "0830"]);
    // En 5787 il en a 30 : le 29 ne porte que le sien.
    expect(HDate.daysInMonth(months.CHESHVAN, 5787)).toBe(30);
    expect(hiloulotKeys(new HDate(29, months.CHESHVAN, 5787))).toEqual(["0829"]);
  });
});

describe("hiloulotOn", () => {
  const index: HiloulotIndex = { "1207": ["Rav A", "Rav B"], "1307": ["Rav B", "Rav C"] };

  it("réunit les clés du jour sans répéter un nom", () => {
    expect(hiloulotOn(index, new HDate(7, months.ADAR_I, 5786))).toEqual([
      "Rav A",
      "Rav B",
      "Rav C",
    ]);
  });

  it("ne rend rien pour un jour que la liste ignore", () => {
    expect(hiloulotOn(index, new HDate(1, months.AV, 5786))).toEqual([]);
  });
});

describe("les listes livrées", () => {
  it.each(["fr", "he"])("couvrent les 384 jours de l'année hébraïque (%s)", async (locale) => {
    const index = (await loadHiloulot(locale))!;
    expect(index).not.toBeNull();

    const days = Object.keys(index);
    expect(days).toHaveLength(384);
    const malformed = days.filter((key) => !/^(0[1-9]|1[0-3])(0[1-9]|[12]\d|30)$/.test(key));
    expect(malformed, "clés hors du format MMJJ").toEqual([]);
    expect(
      days.filter((key) => index[key].length === 0),
      "jours sans nom",
    ).toEqual([]);
  });

  it.each(["fr", "he"])(
    "donne un nom pour chaque jour de l'année, ou presque (%s)",
    async (locale) => {
      const index = (await loadHiloulot(locale))!;
      // 5787 a treize mois : c'est l'année qui expose le plus de jours.
      let day = new HDate(1, months.TISHREI, 5787);
      const end = new HDate(1, months.TISHREI, 5788);
      const empty: string[] = [];
      while (day.abs() < end.abs()) {
        if (hiloulotOn(index, day).length === 0) empty.push(day.toString());
        day = day.next();
      }
      // Le seul jour vide, et il l'est à la source : le calendrier d'origine
      // n'inscrit que 29 jours en Adar, et Adar I en compte 30 les années à
      // treize mois. La section ne s'affiche pas ce jour-là, plutôt que de
      // répéter les noms de la veille.
      expect(empty).toEqual(["30 Adar I 5787"]);
    },
  );

  it("porte les hiloulot que tout le monde connaît", async () => {
    const index = (await loadHiloulot("fr"))!;
    const namesOn = (date: HDate) => hiloulotOn(index, date).join(" | ");

    // Rabbi Chimon bar Yohaï, le 18 Iyar (Lag baOmer).
    expect(namesOn(new HDate(18, months.IYYAR, 5786))).toContain("Shimon bar Yochai");
    // Le Ari zal, le 5 Av.
    expect(namesOn(new HDate(5, months.AV, 5786))).toContain("Arizal");
    // Le Rambam, le 20 Tevet.
    expect(namesOn(new HDate(20, months.TEVET, 5786))).toContain("Maimonides");
  });
});
