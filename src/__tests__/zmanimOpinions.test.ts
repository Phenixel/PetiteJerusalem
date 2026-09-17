import { afterEach, describe, expect, it } from "vitest";
import { GeoLocation, HDate, months, Zmanim } from "@hebcal/core";
import { DEFAULT_ZMANIM_OPINION, opinionZmanim } from "../services/zmanimOpinions";
import {
  computeZmanim,
  DEFAULT_PLACE,
  opinionContext,
  restPeriodAt,
  setZmanimOpinion,
  zmanimOpinion,
  type ZmanimPlace,
} from "../services/zmanimService";

/**
 * Les deux opinions du calcul des horaires (voir services/zmanimOpinions).
 *
 * Ce qui se tient ici n'est pas la valeur d'un zman, qui dépend du moteur
 * solaire, mais les RAPPORTS qui définissent chaque opinion : combien de
 * minutes zmaniyot avant le lever, dans quel ordre les horaires tombent, et
 * que le défaut de l'application n'a pas bougé.
 *
 * L'avis du Rav Ovadia Yossef a deux modes, et c'est le LIEU qui tranche :
 * le luah Or Ha'Haïm en Israël, le luah Amudei Horaah ailleurs (voir
 * `docs/plan-horaires-2026-09.md`, principe directeur). Chaque mode a donc sa
 * section, avec le lieu qui le déclenche.
 *
 * Repère : le 21 mars 2027 à Paris, un jour d'équinoxe, où l'heure zmanit vaut
 * presque soixante minutes ; et le 21 juin, où elle en vaut bien plus.
 */

const place = DEFAULT_PLACE;

/** Jérusalem : c'est son fuseau qui fait basculer l'avis sur l'Or Ha'Haïm. */
const jerusalem: ZmanimPlace = {
  source: "city",
  latitude: 31.7683,
  longitude: 35.2137,
  tzid: "Asia/Jerusalem",
  city: "Jérusalem",
};

/** Londres, hors d'Israël, plus au nord que Paris. */
const london: ZmanimPlace = {
  source: "city",
  latitude: 51.5074,
  longitude: -0.1278,
  tzid: "Europe/London",
  city: "Londres",
};

/** Helsinki : au-delà de Lille, l'avis par degrés n'a plus d'aube l'été. */
const helsinki: ZmanimPlace = {
  source: "city",
  latitude: 60.1699,
  longitude: 24.9384,
  tzid: "Europe/Helsinki",
  city: "Helsinki",
};

const glocOf = (p: ZmanimPlace) => new GeoLocation(p.city, p.latitude, p.longitude, 0, p.tzid);
const zmanimAt = (day: Date, p: ZmanimPlace = place) => new Zmanim(glocOf(p), day, false);
const ctxAt = (day: Date, p: ZmanimPlace = place) => opinionContext(p, day);

/** Minutes entre deux instants, au centième près. */
const minutesBetween = (from: Date, to: Date) =>
  Math.round(((to.getTime() - from.getTime()) / 60_000) * 100) / 100;

/** L'heure zmanit du jour, en minutes. */
const dayMinutes = (z: Zmanim) => minutesBetween(z.sunrise(), z.sunset()) / 12;

/** L'heure au lieu, en heures et minutes, pour comparer à un luah imprimé. */
const clock = (p: ZmanimPlace, date: Date) =>
  date.toLocaleTimeString("fr-FR", { timeZone: p.tzid, hour: "2-digit", minute: "2-digit" });

afterEach(() => setZmanimOpinion(DEFAULT_ZMANIM_OPINION));

describe("opinion par défaut", () => {
  const ctx = ctxAt(new Date(2027, 2, 21, 12));

  it("reste celle du Rav Posen", () => {
    expect(DEFAULT_ZMANIM_OPINION).toBe("posen");
    expect(zmanimOpinion()).toBe("posen");
  });

  it("calcule l'aube et la sortie des étoiles aux degrés de hebcal", () => {
    const z = zmanimAt(new Date(2027, 2, 21, 12));
    const posen = opinionZmanim("posen");

    expect(posen.alotHaShachar(z, ctx).getTime()).toBe(z.alotHaShachar().getTime()); // 16,1°
    expect(posen.misheyakir(z, ctx).getTime()).toBe(z.misheyakir().getTime()); // 11,5°
    expect(posen.tzeit(z, ctx).getTime()).toBe(z.tzeit().getTime()); // 8,5°
    // Rabbénou Tam : 72 minutes FIXES après la chkia, en toute saison. hebcal
    // arrondit l'heure décalée à la minute, d'où l'arrondi ici.
    for (const day of [new Date(2027, 2, 21, 12), new Date(2027, 5, 21, 12)]) {
      const season = zmanimAt(day);
      expect(Math.round(minutesBetween(season.sunset(), posen.rabbenouTam(season, ctx)))).toBe(72);
    }
  });

  it("ne change rien d'un pays à l'autre", () => {
    // L'avis du Rav Posen est un jeu de degrés, pas un luah par région : ses
    // fonctions ignorent le contexte, et Jérusalem ne le déplace pas.
    const posen = opinionZmanim("posen");
    const z = zmanimAt(new Date(2027, 2, 21, 12), jerusalem);
    const here = ctxAt(new Date(2027, 2, 21, 12), jerusalem);

    expect(posen.tzeit(z, here).getTime()).toBe(posen.tzeit(z, ctx).getTime());
    expect(posen.restEnd(z, here).getTime()).toBe(posen.restEnd(z, ctx).getTime());
  });

  it("compte le Maguen Avraham sur l'aube qu'elle affiche, et non sur 72 minutes", () => {
    const posen = opinionZmanim("posen");

    for (const day of [new Date(2027, 2, 21, 12), new Date(2027, 5, 21, 12)]) {
      const z = zmanimAt(day);
      // Le jour du Maguen Avraham court de 16,1° avant le lever à 16,1° après
      // la chkia : les mêmes degrés que l'aube du cadre, sans quoi la page
      // afficherait une aube et en calculerait une autre.
      const alot = posen.alotHaShachar(z, ctx);
      const nightfall = z.timeAtAngle(16.1, false);
      const hour = (nightfall.getTime() - alot.getTime()) / 12;

      expect(posen.sofZmanShmaMGA(z, ctx).getTime()).toBeCloseTo(alot.getTime() + hour * 3, -3);
      expect(posen.sofZmanTfillaMGA(z, ctx).getTime()).toBeCloseTo(alot.getTime() + hour * 4, -3);
      // L'aube à 72 minutes fixes tombe bien plus tard sous nos latitudes :
      // c'est l'écart d'une douzaine de minutes que l'on corrigeait ici.
      expect(posen.sofZmanShmaMGA(z, ctx).getTime()).toBeLessThan(z.sofZmanShmaMGA().getTime());
    }
  });

  it("finit les jeûnes à trois étoiles moyennes, avant la sortie du Chabbat", () => {
    const z = zmanimAt(new Date(2027, 2, 21, 12));
    const posen = opinionZmanim("posen");

    expect(posen.fastEnd(z, ctx).getTime()).toBe(z.tzeit(7.083).getTime());
    // La marge du Chabbat, celle qui faisait attendre dix minutes de trop.
    expect(posen.fastEnd(z, ctx).getTime()).toBeLessThan(posen.restEnd(z, ctx).getTime());
    expect(minutesBetween(posen.fastEnd(z, ctx), posen.tzeit(z, ctx))).toBeGreaterThan(4);
  });
});

describe("Rav Ovadia Yossef en Israël : le luah Or Ha'Haïm", () => {
  const ovadia = opinionZmanim("ovadia");

  it.each([
    ["équinoxe", new Date(2027, 2, 21, 12)],
    ["solstice d'été", new Date(2027, 5, 21, 12)],
    ["solstice d'hiver", new Date(2027, 11, 21, 12)],
  ])("compte en minutes zmaniyot (%s)", (_label, day) => {
    const z = zmanimAt(day, jerusalem);
    const ctx = ctxAt(day, jerusalem);
    const zmanit = dayMinutes(z);

    // 72 minutes zmaniyot avant le lever, 60 pour le talith, 13,5 après la
    // chkia pour la sortie des étoiles, 72 pour Rabbénou Tam.
    expect(minutesBetween(ovadia.alotHaShachar(z, ctx), z.sunrise()) / zmanit).toBeCloseTo(
      72 / 60,
      2,
    );
    expect(minutesBetween(ovadia.misheyakir(z, ctx), z.sunrise()) / zmanit).toBeCloseTo(60 / 60, 2);
    expect(minutesBetween(z.sunset(), ovadia.tzeit(z, ctx)) / zmanit).toBeCloseTo(13.5 / 60, 2);
    expect(minutesBetween(z.sunset(), ovadia.rabbenouTam(z, ctx)) / zmanit).toBeCloseTo(72 / 60, 2);
    // Plag hamin'ha : une heure et quart zmanit avant la sortie (Yalkout Yossef).
    expect(
      minutesBetween(ovadia.plagHaMincha(z, ctx), ovadia.tzeit(z, ctx)) / zmanit,
    ).toBeCloseTo(75 / 60, 2);
  });

  it("donne le talith à 60 minutes zmaniyot, non aux 66 du grand besoin", () => {
    // `getMisheyakir66ZmaniyotMinutes` porte, dans le calendrier source, la
    // mention « THIS TIME SHOULD ONLY BE USED FOR PEOPLE IN GREAT NEED », et
    // sa liste du jour affiche `getMisheyakir60ZmaniyotMinutes`. Les 66
    // plaçaient le talith six minutes zmaniyot trop tôt.
    const day = new Date(2026, 5, 21, 12);
    const z = zmanimAt(day, jerusalem);
    const ctx = ctxAt(day, jerusalem);
    const zmanit = dayMinutes(z);
    const sixtySix = new Date(z.sunrise().getTime() - (66 / 60) * zmanit * 60_000);

    expect(ovadia.misheyakir(z, ctx).getTime()).toBeGreaterThan(sixtySix.getTime());
    expect(minutesBetween(sixtySix, ovadia.misheyakir(z, ctx)) / zmanit).toBeCloseTo(6 / 60, 2);
  });

  it("place la fin du Chéma du Maguen Avraham à trois heures du jour élargi", () => {
    const day = new Date(2027, 2, 21, 12);
    const z = zmanimAt(day, jerusalem);
    const ctx = ctxAt(day, jerusalem);
    const alot = ovadia.alotHaShachar(z, ctx);
    const nightfall = ovadia.rabbenouTam(z, ctx);
    const hour = (nightfall.getTime() - alot.getTime()) / 12;

    expect(ovadia.sofZmanShmaMGA(z, ctx).getTime()).toBeCloseTo(alot.getTime() + hour * 3, -3);
    expect(ovadia.sofZmanTfillaMGA(z, ctx).getTime()).toBeCloseTo(alot.getTime() + hour * 4, -3);
  });

  it("retient la plus tardive des deux demi-heures pour min'ha guedola", () => {
    // En été, la demi-heure zmanit passe les trente minutes : c'est elle.
    const summer = new Date(2027, 5, 21, 12);
    const winter = new Date(2027, 11, 21, 12);
    expect(
      minutesBetween(
        zmanimAt(summer, jerusalem).chatzot(),
        ovadia.minchaGedola(zmanimAt(summer, jerusalem), ctxAt(summer, jerusalem)),
      ),
    ).toBeGreaterThan(30);
    // En hiver, elle est plus courte : ce sont les trente minutes fixes.
    expect(
      minutesBetween(
        zmanimAt(winter, jerusalem).chatzot(),
        ovadia.minchaGedola(zmanimAt(winter, jerusalem), ctxAt(winter, jerusalem)),
      ),
    ).toBe(30);
  });

  it("sort le Chabbat trente minutes après la chkia, et non quarante", () => {
    // Trente, ce que le Rav Ovadia Yossef tenait pour Israël et ce que le
    // calendrier source y pose (`setAteretTorahSunsetOffset(30)`). Les
    // quarante minutes d'avant relâchaient le Chabbat dix minutes trop tard,
    // toute l'année.
    const day = new Date(2027, 2, 21, 12);
    const z = zmanimAt(day, jerusalem);
    const ctx = ctxAt(day, jerusalem);

    expect(minutesBetween(z.sunset(), ovadia.restEnd(z, ctx))).toBe(30);
    expect(ovadia.restEnd(z, ctx).getTime()).toBeGreaterThan(ovadia.tzeit(z, ctx).getTime());
    expect(ovadia.restEndRule(ctx)).toEqual({ kind: "fixed", minutes: 30 });
  });

  it("finit les jeûnes à vingt minutes ZMANIYOT, non fixes", () => {
    // `getTzeitLChumra()` compte `20 * (shaahZmanisGra / 60)` : des minutes
    // zmaniyot. Vingt minutes fixes rompaient le jeûne jusqu'à sept minutes
    // trop tôt l'été, et le faisaient attendre six minutes de trop l'hiver ;
    // à l'équinoxe l'écart est nul, ce qui l'avait caché.
    for (const day of [new Date(2027, 2, 21, 12), new Date(2027, 5, 21, 12)]) {
      const z = zmanimAt(day, jerusalem);
      const ctx = ctxAt(day, jerusalem);
      const zmanit = dayMinutes(z);

      expect(minutesBetween(z.sunset(), ovadia.fastEnd(z, ctx)) / zmanit).toBeCloseTo(20 / 60, 3);
      expect(ovadia.fastEnd(z, ctx).getTime()).toBeGreaterThan(ovadia.tzeit(z, ctx).getTime());
      expect(ovadia.fastEnd(z, ctx).getTime()).toBeLessThan(ovadia.restEnd(z, ctx).getTime());
      expect(ovadia.fastEndRule(ctx)).toEqual({ kind: "zmaniyot", minutes: 20 });
    }
    // L'été, vingt minutes zmaniyot dépassent nettement vingt minutes d'horloge.
    const summer = new Date(2027, 5, 21, 12);
    const z = zmanimAt(summer, jerusalem);
    expect(minutesBetween(z.sunset(), ovadia.fastEnd(z, ctxAt(summer, jerusalem)))).toBeGreaterThan(
      21,
    );
  });

  it("sort le Chabbat de Jérusalem à 19:19 le 12 septembre 2026, non à 19:29", () => {
    // Chkia 18:49:14 ce samedi-là : plus trente minutes, 19:19:14. Les
    // quarante minutes d'avant donnaient 19:29:14, dix minutes trop tard,
    // toute l'année.
    const day = new Date(2026, 8, 12, 12);
    const z = zmanimAt(day, jerusalem);
    const end = ovadia.restEnd(z, ctxAt(day, jerusalem));

    expect(clock(jerusalem, end)).toBe("19:19");
    expect(minutesBetween(z.sunset(), end)).toBe(30);
  });

  it("porte cette règle jusque dans le bloc de repos", () => {
    // Le 12 septembre 2026 est à la fois Chabbat et Roch Hachana : le bloc
    // court jusqu'au dimanche 13, et c'est LA CHKIA DU DIMANCHE qui donne la
    // sortie. Un Chabbat ordinaire, lui, sort le samedi.
    setZmanimOpinion("ovadia");
    const rosh = restPeriodAt(jerusalem, new HDate(new Date(2026, 8, 12)), "fr")!;
    expect(rosh.last.greg().getDate()).toBe(13);
    expect(rosh.endRule).toEqual({ kind: "fixed", minutes: 30 });

    // Chabbat ordinaire du 19 septembre 2026 à Jérusalem : chkia 18:40:02,
    // plus trente minutes, 19:10:02, et la sortie monte à 19:11 (voir
    // ZmanRounding). Les quarante minutes d'avant donnaient 19:21.
    const plain = restPeriodAt(jerusalem, new HDate(new Date(2026, 8, 19)), "fr")!;
    expect(plain.last.greg().getDate()).toBe(19);
    expect(clock(jerusalem, plain.end!)).toBe("19:11");
  });
});

describe("Rav Ovadia Yossef hors d'Israël : le luah Amudei Horaah", () => {
  const ovadia = opinionZmanim("ovadia");

  it("mesure l'aube en degrés à l'équinoxe, et non en minutes zmaniyot d'Israël", () => {
    // Paris, 21 juin 2026 : lever 05:46:57. Les 72 minutes zmaniyot d'Israël
    // placent l'aube 97 minutes avant le lever ; le luah Amudei Horaah, qui
    // mesure 16,04° à l'équinoxe au lieu même, en met 126. C'est la courbure
    // de la Terre que les minutes zmaniyot seules oublient.
    const day = new Date(2026, 5, 21, 12);
    const z = zmanimAt(day);
    const ctx = ctxAt(day);
    const zmanit = dayMinutes(z);
    const israelAlot = new Date(z.sunrise().getTime() - (72 / 60) * zmanit * 60_000);

    const before = minutesBetween(ovadia.alotHaShachar(z, ctx), z.sunrise());
    expect(before).toBeGreaterThan(120);
    expect(before).toBeLessThan(132);
    expect(minutesBetween(israelAlot, z.sunrise())).toBeLessThan(100);
  });

  it("retombe sur l'Or Ha'Haïm là où il s'applique : Jérusalem, à l'équinoxe", () => {
    // La méthode est calibrée pour cela : au 17 mars, la part d'heure zmanit
    // que couvre 16,04° VAUT les 72 minutes zmaniyot. Les deux calculs se
    // rejoignent donc à moins d'une minute, et c'est ce qui rend la bascule
    // d'un luah à l'autre continue à la frontière.
    const day = new Date(2026, 2, 17, 12);
    const z = zmanimAt(day, jerusalem);
    const zmanit = dayMinutes(z);
    const israelAlot = new Date(z.sunrise().getTime() - (72 / 60) * zmanit * 60_000);
    // Le contexte est forcé hors d'Israël pour comparer les deux calculs au
    // même endroit : dans l'application, Jérusalem suit toujours l'Or Ha'Haïm.
    const asDiaspora = { ...ctxAt(day, jerusalem), il: false };

    const gap = Math.abs(minutesBetween(israelAlot, ovadia.alotHaShachar(z, asDiaspora)));
    expect(gap).toBeLessThan(1);
  });

  it("garde le talith aux dix douzièmes de l'aube", () => {
    const day = new Date(2026, 5, 21, 12);
    const z = zmanimAt(day);
    const ctx = ctxAt(day);
    const alot = minutesBetween(ovadia.alotHaShachar(z, ctx), z.sunrise());
    const talith = minutesBetween(ovadia.misheyakir(z, ctx), z.sunrise());

    expect(talith / alot).toBeCloseTo(60 / 72, 4);
  });

  it("sort le Chabbat à 7,165°, et jamais moins de vingt minutes après la chkia", () => {
    setZmanimOpinion("ovadia");
    // Samedi 27 juin 2026, le plus long des étés : chkia 21:58:14 à Paris, le
    // soleil à 7,165° à 22:51:11. Les quarante minutes fixes d'avant
    // donnaient 22:38, treize minutes AVANT le luah cité.
    const june = restPeriodAt(place, new HDate(new Date(2026, 5, 27)), "fr")!;
    expect(clock(place, june.end!)).toBe("22:52");
    expect(june.endRule).toEqual({ kind: "amudeiHoraah", degrees: 7.165, floorMinutes: 20 });

    // Londres, le même samedi : 22:21:22, quand les quarante minutes donnaient
    // 22:01, vingt minutes trop tôt.
    expect(clock(london, restPeriodAt(london, new HDate(new Date(2026, 5, 27)), "fr")!.end!)).toBe(
      "22:22",
    );

    // L'hiver, l'écart change de sens : 17:44:25 le 26 décembre, quand les
    // quarante minutes donnaient 17:39.
    expect(
      clock(place, restPeriodAt(place, new HDate(new Date(2026, 11, 26)), "fr")!.end!),
    ).toBe("17:45");
  });

  it("ne sort jamais le Chabbat avant vingt minutes après la chkia", () => {
    const ovadiaRules = opinionZmanim("ovadia");
    // Sous les tropiques, le crépuscule est court : 7,165° peut tomber moins
    // de vingt minutes après la chkia, et le plancher du Rav Dahan s'applique.
    const singapore: ZmanimPlace = {
      source: "city",
      latitude: 1.3521,
      longitude: 103.8198,
      tzid: "Asia/Singapore",
      city: "Singapour",
    };
    for (const day of [new Date(2026, 2, 21, 12), new Date(2026, 8, 21, 12)]) {
      const z = zmanimAt(day, singapore);
      const after = minutesBetween(z.sunset(), ovadiaRules.restEnd(z, ctxAt(day, singapore)));
      expect(after).toBeGreaterThanOrEqual(20);
    }
  });

  it("finit les jeûnes sur 5,075° mesurés à l'équinoxe, plus tard qu'en Israël", () => {
    // Paris, Tzom Guedalia du lundi 14 septembre 2026 : chkia 20:05:50. Les
    // vingt minutes zmaniyot de l'Or Ha'Haïm donneraient 20:26:57 ; le luah
    // Amudei Horaah, qui mesure 5,075° à l'équinoxe, donne 20:33:09. Les
    // vingt minutes FIXES d'avant donnaient 20:25:50, sept minutes trop tôt.
    const day = new Date(2026, 8, 14, 12);
    const z = zmanimAt(day);
    const ctx = ctxAt(day);
    const zmanit = dayMinutes(z);
    const israelEnd = new Date(z.sunset().getTime() + (20 / 60) * zmanit * 60_000);

    expect(clock(place, ovadia.fastEnd(z, ctx))).toBe("20:33");
    expect(ovadia.fastEnd(z, ctx).getTime()).toBeGreaterThan(israelEnd.getTime());
    expect(ovadia.fastEndRule(ctx)).toEqual({ kind: "equinoxDegrees", degrees: 5.075 });
  });

  it("imprime pour Rabbénou Tam la plus tôt des deux, comme le luah", () => {
    // Paris, samedi 27 juin 2026 : 72 minutes fixes donnent 23:10, 72 minutes
    // zmaniyot 23:35. Le luah Amudei Horaah imprime la première ; en Israël,
    // l'Or Ha'Haïm garde les zmaniyot.
    const day = new Date(2026, 5, 27, 12);
    const z = zmanimAt(day);
    const ctx = ctxAt(day);

    expect(clock(place, ovadia.rabbenouTam(z, ctx))).toBe("23:10");
    expect(ovadia.rabbenouTamRule(ctx)).toBe("earliest");
    expect(ovadia.rabbenouTamRule(ctxAt(day, jerusalem))).toBe("zmaniyot");
  });

  it("donne une aube et une nuit là où l'avis par degrés n'en a pas", () => {
    // Helsinki, 21 juin : le soleil ne descend ni à 16,1° ni à 8,5°, et l'avis
    // du Rav Posen n'a rien à afficher. À l'équinoxe, en revanche, il atteint
    // bien 16,04° : la part mesurée existe, et l'Amudei Horaah donne l'heure.
    const day = new Date(2026, 5, 21, 12);
    const z = zmanimAt(day, helsinki);
    const ctx = ctxAt(day, helsinki);
    const posen = opinionZmanim("posen");

    expect(Number.isNaN(posen.alotHaShachar(z, ctx).getTime())).toBe(true);
    expect(Number.isNaN(posen.tzeit(z, ctx).getTime())).toBe(true);
    expect(Number.isNaN(ovadia.alotHaShachar(z, ctx).getTime())).toBe(false);
    expect(Number.isNaN(ovadia.tzeit(z, ctx).getTime())).toBe(false);
  });

  it("n'invente rien quand l'équinoxe lui-même n'atteint pas l'angle", () => {
    // Au-delà du cercle polaire, la part ne se mesure plus : l'horaire manque,
    // et `zmanimGap` l'explique, plutôt qu'une heure tirée de nulle part.
    const northPole: ZmanimPlace = {
      source: "device",
      latitude: 84,
      longitude: 0,
      tzid: "UTC",
      city: null,
    };
    const day = new Date(2026, 5, 21, 12);
    expect(
      Number.isNaN(ovadia.alotHaShachar(zmanimAt(day, northPole), ctxAt(day, northPole)).getTime()),
    ).toBe(true);
  });
});

describe("ce que la note annonce", () => {
  /**
   * La note du cadre de repos décrit la règle ; le cadre affiche l'heure. Les
   * deux viennent d'ici, et ce test les tient ensemble : une opinion qui
   * changerait sa sortie sans changer sa description ferait mentir la page.
   *
   * Les deux côtés de la frontière sont balayés, puisque la règle en dépend.
   */
  const day = new Date(2027, 2, 21, 12);
  const cases = [
    ["posen", place],
    ["posen", jerusalem],
    ["ovadia", place],
    ["ovadia", jerusalem],
  ] as const;

  it.each(cases)("décrit la sortie qu'elle calcule (%s, %o)", (name, where) => {
    const rules = opinionZmanim(name);
    const z = zmanimAt(day, where);
    const ctx = ctxAt(day, where);
    const rule = rules.restEndRule(ctx);
    const end = rules.restEnd(z, ctx);

    switch (rule.kind) {
      case "degrees":
        expect(end.getTime()).toBe(z.tzeit(rule.degrees).getTime());
        break;
      case "fixed":
        expect(minutesBetween(z.sunset(), end)).toBeCloseTo(rule.minutes, 5);
        break;
      case "amudeiHoraah":
        // L'angle, sauf quand le plancher de vingt minutes le rattrape.
        expect(minutesBetween(z.sunset(), end)).toBeGreaterThanOrEqual(rule.floorMinutes);
        break;
      default:
        throw new Error(`règle de sortie inattendue : ${rule.kind}`);
    }
  });

  it.each(cases)("décrit la fin des jeûnes qu'elle calcule (%s, %o)", (name, where) => {
    const rules = opinionZmanim(name);
    const z = zmanimAt(day, where);
    const ctx = ctxAt(day, where);
    const rule = rules.fastEndRule(ctx);
    const end = rules.fastEnd(z, ctx);
    const zmanit = dayMinutes(z);

    switch (rule.kind) {
      case "degrees":
        expect(end.getTime()).toBe(z.tzeit(rule.degrees).getTime());
        break;
      case "zmaniyot":
        expect(minutesBetween(z.sunset(), end) / zmanit).toBeCloseTo(rule.minutes / 60, 3);
        break;
      case "equinoxDegrees":
        // Mesurée à l'équinoxe : on ne peut pas la recalculer à l'identique
        // ici sans refaire la méthode, mais elle tombe bien après la chkia.
        expect(end.getTime()).toBeGreaterThan(z.sunset().getTime());
        break;
      default:
        throw new Error(`règle de jeûne inattendue : ${rule.kind}`);
    }
    // Dans tous les cas, un jeûne ne dure jamais plus longtemps que le repos.
    expect(end.getTime()).toBeLessThan(rules.restEnd(z, ctx).getTime());
  });

  it.each(cases)("dit juste des minutes de Rabbénou Tam (%s, %o)", (name, where) => {
    const rules = opinionZmanim(name);
    // En été, l'heure zmanit dépasse largement l'heure de l'horloge : une
    // sortie comptée en minutes zmaniyot s'écarte alors des 72 minutes fixes,
    // une sortie comptée en minutes fixes, non.
    const summer = new Date(2027, 5, 21, 12);
    const z = zmanimAt(summer, where);
    const ctx = ctxAt(summer, where);
    const gap = minutesBetween(z.sunset(), rules.rabbenouTam(z, ctx));

    switch (rules.rabbenouTamRule(ctx)) {
      case "zmaniyot":
        expect(gap).toBeGreaterThan(75);
        break;
      case "fixed":
        expect(Math.round(gap)).toBe(72);
        break;
      case "earliest":
        // La plus tôt des deux : jamais plus que les 72 minutes fixes.
        expect(Math.round(gap)).toBeLessThanOrEqual(72);
        break;
    }
  });
});

describe("l'opinion suivie gouverne toute l'application", () => {
  const day = new Date(2027, 2, 21, 12);
  const timeOf = (key: string) =>
    computeZmanim(place, day).find((zman) => zman.key === key)?.date ?? null;

  it("déplace les horaires de la page dès qu'on en change", () => {
    const posen = timeOf("alotHaShachar")!;
    setZmanimOpinion("ovadia");
    const ovadia = timeOf("alotHaShachar")!;

    expect(zmanimOpinion()).toBe("ovadia");
    // Les deux aubes tombent le même matin, mais pas à la même minute : sans
    // vidage du cache, la seconde aurait rendu la première.
    expect(ovadia.getTime()).not.toBe(posen.getTime());
    expect(Math.abs(minutesBetween(posen, ovadia))).toBeLessThan(30);
  });

  it.each(["posen", "ovadia"] as const)("garde les horaires dans l'ordre (%s)", (opinion) => {
    setZmanimOpinion(opinion);
    const times = computeZmanim(place, day).map((zman) => zman.date.getTime());

    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("change aussi la sortie du Chabbat", () => {
    const shabbat = new HDate(20, months.ADAR_I, 5787);
    const posen = restPeriodAt(place, shabbat, "fr")!;
    setZmanimOpinion("ovadia");
    const ovadia = restPeriodAt(place, shabbat, "fr")!;

    expect(posen.start.getTime()).toBe(ovadia.start.getTime()); // L'allumage est un usage du lieu
    expect(ovadia.end!.getTime()).not.toBe(posen.end!.getTime());
    expect(ovadia.endRabbenouTam!.getTime()).toBeGreaterThan(ovadia.end!.getTime());
  });

  it("suit le lieu, et non un réglage, pour choisir le luah", () => {
    // Le même avis, le même jour, deux lieux : Jérusalem sort le Chabbat sur
    // trente minutes fixes, Paris sur l'angle de l'Amudei Horaah. C'est le
    // principe directeur du chantier : le lieu décide.
    setZmanimOpinion("ovadia");
    const shabbat = new HDate(new Date(2026, 5, 27));

    expect(restPeriodAt(jerusalem, shabbat, "fr")!.endRule).toEqual({ kind: "fixed", minutes: 30 });
    expect(restPeriodAt(place, shabbat, "fr")!.endRule.kind).toBe("amudeiHoraah");
  });
});
