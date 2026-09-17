import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import { createI18n } from "vue-i18n";
import { GeoLocation, HDate, months, Zmanim } from "@hebcal/core";
import fr from "../locales/fr";
import ChametzTimes from "../views/Zmanim/ChametzTimes.vue";
import {
  chametzAt,
  chametzNear,
  DEFAULT_PLACE,
  formatZmanDay,
  formatZmanTime,
  opinionContext,
  roundMinute,
  setZmanimOpinion,
} from "../services/zmanimService";
import { DEFAULT_ZMANIM_OPINION, opinionZmanim } from "../services/zmanimOpinions";

/**
 * Les limites du 'hamets, la veille de Pessah (voir ChametzTimes.vue).
 *
 * Deux heures, et non une : on cesse de MANGER le 'hamets à la fin de la
 * quatrième heure du jour, d'en POSSÉDER à la fin de la cinquième. Ce sont les
 * mêmes heures zmaniyot que le reste de la page, données selon les deux avis.
 *
 * Le cas à ne pas manquer est celui du 14 Nissan qui tombe un Chabbat, en 5785
 * puis en 5805 : on ne brûle pas le 'hamets un Chabbat, la destruction se fait
 * le vendredi, et la cinquième heure du Chabbat devient celle de l'annulation.
 */

const hd = (day: number, year: number) => new HDate(day, months.NISAN, year);
const at = (date: Date) => formatZmanTime(date, DEFAULT_PLACE.tzid, "fr");
const on = (date: Date) => formatZmanDay(date, DEFAULT_PLACE.tzid, "fr");
const gloc = new GeoLocation(
  null,
  DEFAULT_PLACE.latitude,
  DEFAULT_PLACE.longitude,
  0,
  DEFAULT_PLACE.tzid,
);

afterEach(() => setZmanimOpinion(DEFAULT_ZMANIM_OPINION));

describe("chametzAt", () => {
  it("ne répond que le 14 Nissan", () => {
    expect(chametzAt(DEFAULT_PLACE, hd(13, 5786))).toBeNull();
    expect(chametzAt(DEFAULT_PLACE, hd(15, 5786))).toBeNull();
    expect(chametzAt(DEFAULT_PLACE, new HDate(14, months.IYYAR, 5786))).toBeNull();
    expect(chametzAt(DEFAULT_PLACE, hd(14, 5786))).not.toBeNull();
  });

  it("donne les quatre heures de la veille de Pessah 5786 à Paris", () => {
    // 14 Nissan 5786 = mercredi 1er avril 2026.
    const chametz = chametzAt(DEFAULT_PLACE, hd(14, 5786))!;
    expect(on(chametz.eating)).toBe("mercredi 1 avril");
    expect(at(chametz.eatingMGA)).toBe("11:13");
    expect(at(chametz.eating)).toBe("11:46");
    expect(at(chametz.disposalMGA)).toBe("12:34");
    expect(at(chametz.disposal)).toBe("12:50");
    // Une année ordinaire, la destruction se fait le jour même.
    expect(chametz.onShabbat).toBe(false);
    expect(chametz.burningEve).toBeNull();
    expect(chametz.burningEveMGA).toBeNull();
  });

  it("place la consommation à la quatrième heure et la destruction à la cinquième", () => {
    for (const year of [5786, 5787, 5788]) {
      const day = hd(14, year);
      const chametz = chametzAt(DEFAULT_PLACE, day)!;
      const zmanim = new Zmanim(gloc, day.greg(), false);

      // Les quatre heures sont des LIMITES : elles descendent à la minute
      // (voir ZmanRounding). La référence se coupe donc du même côté.
      const down = (date: Date) => roundMinute(date, "down").getTime();

      // Le Gaon de Vilna : quatre puis cinq douzièmes du jour depuis le lever.
      expect(chametz.eating.getTime()).toBe(down(zmanim.sofZmanTfilla()));
      expect(chametz.disposal.getTime()).toBe(down(zmanim.sofZmanBiurChametzGRA()));

      // Le Maguen Avraham : la quatrième heure est celle de la fin de la Amida,
      // et la cinquième tombe exactement une heure de son jour plus tard.
      const rules = opinionZmanim("posen");
      // L'avis du Rav Posen ignore le contexte de lieu (voir zmanimOpinions) :
      // celui du jour calculé suffit à l'appeler.
      const ctx = opinionContext(DEFAULT_PLACE, day.greg());
      expect(chametz.eatingMGA.getTime()).toBe(down(rules.sofZmanTfillaMGA(zmanim, ctx)));
      // Une heure du jour du Maguen Avraham sépare sa troisième de sa
      // quatrième : la cinquième doit en être à la même distance. L'écart se
      // lit ici entre deux heures coupées à la minute, et peut donc s'écarter
      // d'une minute de celui des instants exacts.
      const mgaHour =
        rules.sofZmanTfillaMGA(zmanim, ctx).getTime() - rules.sofZmanShmaMGA(zmanim, ctx).getTime();
      const gap = chametz.disposalMGA.getTime() - chametz.eatingMGA.getTime();
      expect(Math.abs(gap - mgaHour)).toBeLessThan(60_000);

      // Et les deux avis se suivent toujours dans le même ordre.
      expect(chametz.eatingMGA.getTime()).toBeLessThan(chametz.eating.getTime());
      expect(chametz.eating.getTime()).toBeLessThan(chametz.disposalMGA.getTime());
      expect(chametz.disposalMGA.getTime()).toBeLessThan(chametz.disposal.getTime());
    }
  });

  it("suit l'avis choisi, comme le reste de la page", () => {
    const posen = chametzAt(DEFAULT_PLACE, hd(14, 5786))!;
    setZmanimOpinion("ovadia");
    const ovadia = chametzAt(DEFAULT_PLACE, hd(14, 5786))!;

    // Les heures du Gaon de Vilna ne dépendent pas de l'avis : elles se
    // comptent du lever au coucher, que les deux partagent.
    expect(ovadia.eating.getTime()).toBe(posen.eating.getTime());
    expect(ovadia.disposal.getTime()).toBe(posen.disposal.getTime());
    // Celles du Maguen Avraham, si : le jour élargi n'est pas le même.
    expect(ovadia.eatingMGA.getTime()).not.toBe(posen.eatingMGA.getTime());
    expect(ovadia.disposalMGA.getTime()).not.toBe(posen.disposalMGA.getTime());
  });

  it("renvoie au vendredi quand la veille de Pessah tombe un Chabbat", () => {
    // 14 Nissan 5785 = samedi 12 avril 2025 : on ne brûle pas le 'hamets ce
    // jour-là, la destruction se fait le vendredi 11.
    const chametz = chametzAt(DEFAULT_PLACE, hd(14, 5785))!;
    expect(chametz.onShabbat).toBe(true);
    expect(on(chametz.eating)).toBe("samedi 12 avril");
    expect(on(chametz.burningEve!)).toBe("vendredi 11 avril");
    expect(on(chametz.burningEveMGA!)).toBe("vendredi 11 avril");
    // Le feu précède le Chabbat, et la cinquième heure du Chabbat, devenue
    // celle de l'annulation, reste donnée.
    expect(chametz.burningEve!.getTime()).toBeLessThan(chametz.eating.getTime());
    expect(chametz.disposal.getTime()).toBeGreaterThan(chametz.eating.getTime());
  });

  it("ne renvoie au vendredi que ces années-là", () => {
    // Le 14 Nissan ne tombe un Chabbat qu'en 5785 et 5805 sur vingt ans :
    // Pessah ne commence jamais un lundi, un mercredi ni un vendredi.
    const shabbatYears: number[] = [];
    for (let year = 5785; year <= 5805; year++) {
      const chametz = chametzAt(DEFAULT_PLACE, hd(14, year))!;
      expect(chametz.onShabbat).toBe(chametz.burningEve !== null);
      if (chametz.onShabbat) shabbatYears.push(year);
    }
    expect(shabbatYears).toEqual([5785, 5805]);
  });
});

describe("chametzNear", () => {
  /** Un instant à Paris, en UTC : les tests tournent sous n'importe quel fuseau. */
  const paris = (month: number, day: number, hour: number) =>
    new Date(Date.UTC(2026, month - 1, day, hour));

  it("les annonce dès la veille", () => {
    // Mardi 31 mars 2026, midi : la veille de Pessah est le lendemain.
    const chametz = chametzNear(DEFAULT_PLACE, paris(3, 31, 10))!;
    expect(chametz).not.toBeNull();
    expect(on(chametz.eating)).toBe("mercredi 1 avril");
  });

  it("les garde tant que la cinquième heure n'est pas passée", () => {
    // Mercredi 1er avril 2026, 12 h à Paris : la destruction est à 12 h 50.
    expect(chametzNear(DEFAULT_PLACE, paris(4, 1, 10))).not.toBeNull();
  });

  it("ne les annonce plus une fois passées", () => {
    // Le même jour à 14 h : les deux limites sont derrière.
    expect(chametzNear(DEFAULT_PLACE, paris(4, 1, 12))).toBeNull();
  });

  it("les garde toute la journée d'un jour parcouru avec les flèches", () => {
    expect(chametzNear(DEFAULT_PLACE, paris(4, 1, 12), null)).not.toBeNull();
  });

  it("ne cherche pas au-delà du lendemain", () => {
    // Lundi 30 mars 2026 : la veille de Pessah est dans deux jours.
    expect(chametzNear(DEFAULT_PLACE, paris(3, 30, 10))).toBeNull();
  });

  it("annonce le vendredi de la destruction les années où le 14 est un Chabbat", () => {
    // Vendredi 11 avril 2025, 9 h à Paris : c'est ce jour-là qu'il faut brûler.
    const friday = new Date(Date.UTC(2025, 3, 11, 7));
    const chametz = chametzNear(DEFAULT_PLACE, friday)!;
    expect(chametz.onShabbat).toBe(true);
    expect(on(chametz.burningEve!)).toBe("vendredi 11 avril");
  });
});

describe("le cadre des limites du 'hamets", () => {
  const mounted: App[] = [];

  /** Monte le cadre pour cette veille de Pessah, et rend le texte affiché. */
  async function textFor(year: number): Promise<string> {
    const chametz = chametzAt(DEFAULT_PLACE, hd(14, year))!;
    const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = createApp({
      render: () => h(ChametzTimes, { chametz, tzid: DEFAULT_PLACE.tzid }),
    });
    app.use(i18n);
    app.mount(host);
    mounted.push(app);
    await nextTick();
    return host.textContent ?? "";
  }

  afterEach(() => {
    for (const app of mounted.splice(0)) app.unmount();
    document.body.innerHTML = "";
  });

  it("affiche les quatre heures d'une année ordinaire", async () => {
    const text = await textFor(5786);
    expect(text).toContain("Limites du 'hamets");
    expect(text).toContain("Fin de la consommation (Maguen Avraham)");
    expect(text).toContain("11:13");
    expect(text).toContain("Fin de la consommation (Gaon de Vilna)");
    expect(text).toContain("11:46");
    expect(text).toContain("Fin de la destruction (Maguen Avraham)");
    expect(text).toContain("12:34");
    expect(text).toContain("Fin de la destruction (Gaon de Vilna)");
    expect(text).toContain("12:50");
    // Ni annulation ni vendredi : la destruction se fait le jour même.
    expect(text).not.toContain("annulation");
    expect(text).not.toContain("vendredi");
  });

  it("parle du vendredi et de l'annulation quand le 14 tombe un Chabbat", async () => {
    const text = await textFor(5785);
    // Le vendredi vient en tête : c'est l'heure qu'on cherche la veille.
    expect(text.indexOf("Destruction, le vendredi")).toBeLessThan(
      text.indexOf("Fin de la consommation"),
    );
    expect(text).toContain("vendredi 11 avril");
    expect(text).toContain("samedi 12 avril");
    // La cinquième heure du Chabbat est celle de l'annulation, pas du feu.
    expect(text).toContain("Fin de l'annulation (Maguen Avraham)");
    expect(text).toContain("Fin de l'annulation (Gaon de Vilna)");
    expect(text).not.toContain("Fin de la destruction");
    expect(text).toContain("on ne brûle pas le 'hamets un Chabbat");
  });
});
