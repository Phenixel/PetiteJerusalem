import { afterEach, describe, expect, it } from "vitest";
import { GeoLocation, Zmanim } from "@hebcal/core";
import { DEFAULT_ZMANIM_OPINION, opinionZmanim } from "../services/zmanimOpinions";
import {
  computeZmanim,
  DEFAULT_PLACE,
  restPeriodAt,
  setZmanimOpinion,
  zmanimOpinion,
} from "../services/zmanimService";
import { HDate, months } from "@hebcal/core";

/**
 * Les deux opinions du calcul des horaires (voir services/zmanimOpinions).
 *
 * Ce qui se tient ici n'est pas la valeur d'un zman, qui dépend du moteur
 * solaire, mais les RAPPORTS qui définissent chaque opinion : combien de
 * minutes zmaniyot avant le lever, dans quel ordre les horaires tombent, et
 * que le défaut de l'application n'a pas bougé.
 *
 * Repère : le 21 mars 2027 à Paris, un jour d'équinoxe, où l'heure zmanit vaut
 * presque soixante minutes ; et le 21 juin, où elle en vaut bien plus.
 */

const place = DEFAULT_PLACE;
const gloc = new GeoLocation(null, place.latitude, place.longitude, 0, place.tzid);

const zmanimAt = (day: Date) => new Zmanim(gloc, day, false);

/** Minutes entre deux instants, au centième près. */
const minutesBetween = (from: Date, to: Date) =>
  Math.round(((to.getTime() - from.getTime()) / 60_000) * 100) / 100;

/** L'heure zmanit du jour, en minutes. */
const dayMinutes = (z: Zmanim) => minutesBetween(z.sunrise(), z.sunset()) / 12;

afterEach(() => setZmanimOpinion(DEFAULT_ZMANIM_OPINION));

describe("opinion par défaut", () => {
  it("reste celle du Rav Posen", () => {
    expect(DEFAULT_ZMANIM_OPINION).toBe("posen");
    expect(zmanimOpinion()).toBe("posen");
  });

  it("calcule l'aube et la sortie des étoiles aux degrés de hebcal", () => {
    const z = zmanimAt(new Date(2027, 2, 21, 12));
    const posen = opinionZmanim("posen");

    expect(posen.alotHaShachar(z).getTime()).toBe(z.alotHaShachar().getTime()); // 16,1°
    expect(posen.misheyakir(z).getTime()).toBe(z.misheyakir().getTime()); // 11,5°
    expect(posen.tzeit(z).getTime()).toBe(z.tzeit().getTime()); // 8,5°
    // Rabbénou Tam : 72 minutes FIXES après la chkia, en toute saison. hebcal
    // arrondit l'heure décalée à la minute, d'où l'arrondi ici.
    for (const day of [new Date(2027, 2, 21, 12), new Date(2027, 5, 21, 12)]) {
      const season = zmanimAt(day);
      expect(Math.round(minutesBetween(season.sunset(), posen.rabbenouTam(season)))).toBe(72);
    }
  });
});

describe("opinion du Rav Ovadia Yossef", () => {
  const ovadia = opinionZmanim("ovadia");

  it.each([
    ["équinoxe", new Date(2027, 2, 21, 12)],
    ["solstice d'été", new Date(2027, 5, 21, 12)],
    ["solstice d'hiver", new Date(2027, 11, 21, 12)],
  ])("compte en minutes zmaniyot (%s)", (_label, day) => {
    const z = zmanimAt(day);
    const zmanit = dayMinutes(z);

    // 72 minutes zmaniyot avant le lever, 66 pour le talith, 13,5 après la
    // chkia pour la sortie des étoiles, 72 pour Rabbénou Tam.
    expect(minutesBetween(ovadia.alotHaShachar(z), z.sunrise()) / zmanit).toBeCloseTo(72 / 60, 2);
    expect(minutesBetween(ovadia.misheyakir(z), z.sunrise()) / zmanit).toBeCloseTo(66 / 60, 2);
    expect(minutesBetween(z.sunset(), ovadia.tzeit(z)) / zmanit).toBeCloseTo(13.5 / 60, 2);
    expect(minutesBetween(z.sunset(), ovadia.rabbenouTam(z)) / zmanit).toBeCloseTo(72 / 60, 2);
    // Plag hamin'ha : une heure et quart zmanit avant la sortie (Yalkout Yossef).
    expect(minutesBetween(ovadia.plagHaMincha(z), ovadia.tzeit(z)) / zmanit).toBeCloseTo(
      75 / 60,
      2,
    );
  });

  it("place la fin du Chéma du Maguen Avraham à trois heures du jour élargi", () => {
    const z = zmanimAt(new Date(2027, 2, 21, 12));
    const alot = ovadia.alotHaShachar(z);
    const nightfall = ovadia.rabbenouTam(z);
    const hour = (nightfall.getTime() - alot.getTime()) / 12;

    expect(ovadia.sofZmanShmaMGA(z).getTime()).toBeCloseTo(alot.getTime() + hour * 3, -3);
    expect(ovadia.sofZmanTfillaMGA(z).getTime()).toBeCloseTo(alot.getTime() + hour * 4, -3);
  });

  it("retient la plus tardive des deux demi-heures pour min'ha guedola", () => {
    // En été, la demi-heure zmanit passe les trente minutes : c'est elle.
    const summer = zmanimAt(new Date(2027, 5, 21, 12));
    expect(minutesBetween(summer.chatzot(), ovadia.minchaGedola(summer))).toBeGreaterThan(30);
    // En hiver, elle est plus courte : ce sont les trente minutes fixes.
    const winter = zmanimAt(new Date(2027, 11, 21, 12));
    expect(minutesBetween(winter.chatzot(), ovadia.minchaGedola(winter))).toBe(30);
  });

  it("sort le Chabbat quarante minutes après la chkia, et non à la sortie des étoiles", () => {
    // La sortie des étoiles de cette opinion, très tôt, ne finit pas le repos.
    const z = zmanimAt(new Date(2027, 2, 21, 12));
    expect(minutesBetween(z.sunset(), ovadia.restEnd(z))).toBe(40);
    expect(ovadia.restEnd(z).getTime()).toBeGreaterThan(ovadia.tzeit(z).getTime());
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
    expect(ovadia.end.getTime()).not.toBe(posen.end.getTime());
    expect(ovadia.endRabbenouTam!.getTime()).toBeGreaterThan(ovadia.end.getTime());
  });
});
