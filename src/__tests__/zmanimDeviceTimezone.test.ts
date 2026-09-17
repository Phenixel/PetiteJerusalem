// @vitest-environment node
import { describe, it, expect, afterAll } from "vitest";
import {
  computeZmanim,
  DEFAULT_PLACE,
  formatMarkerDay,
  formatZmanDay,
  setZmanimOpinion,
  type ZmanKey,
} from "../services/zmanimService";

/**
 * Les horaires ne dépendent pas du fuseau de l'appareil.
 *
 * Un horaire est un INSTANT : il ne regarde que le lieu affiché et la date.
 * Le fuseau du navigateur ne sert qu'à l'écrire en heure locale. Pourtant,
 * jusqu'au correctif posé sur `@hebcal/core` (voir `patches/`), un appareil
 * réglé sur un fuseau américain lisait certains horaires de Paris avec une
 * heure d'écart, le jour du retour à l'heure d'hiver de CET APPAREIL.
 *
 * Cause : `zdtToDate` faisait `res.setMilliseconds(0)` sur la `Date` obtenue
 * de l'instant exact. Les setters de `Date` recalculent l'instant depuis les
 * champs LOCAUX de la machine ; à l'heure ambiguë du retour à l'heure d'hiver,
 * qui existe deux fois, JavaScript choisit l'autre occurrence, et l'instant
 * recule d'une heure. Voir `docs/audit-horaires-2026-09.md`, point 3.1.
 *
 * Node relit `process.env.TZ` à l'affectation : ce test change donc le fuseau
 * de la machine sous les pieds du calcul, et exige les mêmes instants.
 */

/** Dimanche 1er novembre 2026 : jour du retour à l'heure d'hiver en Amérique. */
const NOVEMBER = new Date(Date.UTC(2026, 10, 1, 12));
/** Dimanche 29 mars 2026 : jour du passage à l'heure d'été en Europe. */
const MARCH = new Date(Date.UTC(2026, 2, 29, 12));

/**
 * Les fuseaux d'appareil éprouvés. Le 1er novembre 2026, l'heure ambiguë est
 * 1 h à 2 h à New York (5 h à 7 h UTC) et à Los Angeles (8 h à 10 h UTC) :
 * les horaires de Paris qui y tombent sont justement le lever du soleil et les
 * deux limites du Gaon de Vilna.
 */
const DEVICE_TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/Paris"];

const ORIGINAL_TZ = process.env.TZ;

/**
 * Les horaires de Paris tels que le fuseau de la machine ne doit jamais les
 * déplacer, en UTC.
 *
 * Calculés par `@hebcal/core` pour Paris (48,85341 / 2,3488), au niveau de la
 * mer, avec le moteur solaire NOAA, et recoupés par PyEphem et kosher-zmanim
 * lors de l'audit (section 2 : moins de six secondes d'écart).
 *
 * Ce sont les heures COUPÉES à la minute, celles que la page affiche : les
 * limites vers le bas, les fins vers le haut (voir ZmanRounding). L'instant
 * exact est donné en commentaire, puisque c'est lui qui justifie la coupe. Un
 * décalage de fuseau, lui, vaut une heure entière : la minute ne le cache pas.
 */
const EXPECTED: { day: Date; label: string; times: Partial<Record<ZmanKey, string>> }[] = [
  {
    day: NOVEMBER,
    label: "Paris, dimanche 1er novembre 2026",
    times: {
      // Aube du Rav Posen : soleil à 16,1° sous l'horizon le matin (05:01:46).
      alotHaShachar: "2026-11-01T05:01:00.000Z",
      // Talith : soleil à 11,5° (05:29:57). Un DÉBUT : minute supérieure.
      misheyakir: "2026-11-01T05:30:00.000Z",
      // Lever du soleil (bord supérieur, 0,833° au-dessus de l'horizon) :
      // 06:37:17 UTC, soit 07:37 à Paris, et 06:38 une fois monté. C'est
      // l'horaire que New York lisait 05:37 UTC, une heure trop tôt.
      sunrise: "2026-11-01T06:38:00.000Z",
      // Fin du Chéma du Gaon de Vilna : trois heures zmaniyot du lever au
      // coucher (09:05:32). Los Angeles la lisait 08:05 UTC.
      sofZmanShma: "2026-11-01T09:05:00.000Z",
      // Fin de la Amida du Gaon de Vilna : quatre heures zmaniyot (09:54:58).
      sofZmanTfilla: "2026-11-01T09:54:00.000Z",
      // Coucher du soleil (16:30:18).
      sunset: "2026-11-01T16:30:00.000Z",
      // Sortie des étoiles du Rav Posen : soleil à 8,5° sous l'horizon
      // (17:19:02). Une FIN : elle monte à la minute supérieure.
      tzeit: "2026-11-01T17:20:00.000Z",
    },
  },
  {
    day: MARCH,
    label: "Paris, dimanche 29 mars 2026",
    times: {
      // Le passage à l'heure d'été laisse un TROU dans l'heure locale (2 h à
      // 3 h n'existe pas) : un setter y saute aussi. Aucun horaire de Paris n'y
      // tombe ce jour-là, mais les instants doivent rester les mêmes partout.
      alotHaShachar: "2026-03-29T03:58:00.000Z", // 03:58:13
      sunrise: "2026-03-29T05:35:00.000Z", // 05:34:46, un DÉBUT : minute supérieure
      sofZmanShma: "2026-03-29T08:45:00.000Z", // 08:45:17
      sunset: "2026-03-29T18:16:00.000Z", // 18:16:50
      tzeit: "2026-03-29T19:05:00.000Z", // 19:04:24, une FIN : minute supérieure
    },
  },
];

/**
 * Pose le fuseau de la machine et vide ce qui a été calculé sous l'ancien :
 * `setZmanimOpinion` est le seul point d'entrée qui purge la mémoïsation, et
 * il ne fait rien quand l'opinion ne change pas, d'où l'aller-retour.
 */
function useDeviceTimezone(tzid: string): void {
  process.env.TZ = tzid;
  setZmanimOpinion("ovadia");
  setZmanimOpinion("posen");
}

afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
  setZmanimOpinion("ovadia");
  setZmanimOpinion("posen");
});

describe("horaires et fuseau de l'appareil", () => {
  for (const tzid of DEVICE_TIMEZONES) {
    for (const { day, label, times } of EXPECTED) {
      it(`donne les mêmes instants pour ${label} sous un appareil réglé sur ${tzid}`, () => {
        useDeviceTimezone(tzid);
        const byKey = new Map(
          computeZmanim(DEFAULT_PLACE, day).map((zman) => [zman.key, zman.date]),
        );
        for (const [key, iso] of Object.entries(times)) {
          expect(byKey.get(key as ZmanKey)?.toISOString(), `${key} sous ${tzid}`).toBe(iso);
        }
      });
    }
  }

  it("rend un marqueur de jour dans son repère, non dans celui du lieu", () => {
    // Certains champs ne portent pas une heure mais une DATE : le jour du
    // Chabbat d'un bloc, celui de l'érouv tavchilin, celui d'un jeûne dont
    // l'aube ne se calcule pas. Ils sont posés au midi LOCAL de la machine.
    //
    // Les rendre dans le fuseau du LIEU les déplace d'un jour dès que les
    // deux sont assez éloignés : le midi d'Auckland est encore la veille au
    // soir à New York. C'est le piège du point 3.1 à l'échelle du jour.
    const marker = new Date(2027, 2, 20, 12); // samedi 20 mars 2027, midi local
    expect(formatMarkerDay(marker, "fr")).toContain("20");
    expect(formatMarkerDay(marker, "fr")).toContain("samedi");
    // Le même marqueur lu dans un fuseau lointain recule d'un jour : c'est
    // exactement ce que le cadre faisait.
    const seenFromNewYork = formatZmanDay(marker, "America/New_York", "fr");
    const seenHere = formatMarkerDay(marker, "fr");
    if (new Date().getTimezoneOffset() <= -600) {
      // Machine à l'extrême est : les deux lectures divergent, et c'est le
      // marqueur qui a raison.
      expect(seenFromNewYork).not.toBe(seenHere);
    }
  });

  it("donne le même jour d'horaires sous tous les fuseaux d'appareil", () => {
    const reference = new Map<string, string>();
    for (const tzid of DEVICE_TIMEZONES) {
      useDeviceTimezone(tzid);
      for (const day of [NOVEMBER, MARCH]) {
        for (const zman of computeZmanim(DEFAULT_PLACE, day)) {
          const key = `${day.toISOString()}|${zman.key}`;
          const iso = zman.date.toISOString();
          if (tzid === DEVICE_TIMEZONES[0]) reference.set(key, iso);
          else expect(iso, `${key} sous ${tzid}`).toBe(reference.get(key));
        }
      }
    }
  });
});
