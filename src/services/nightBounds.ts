import { computeZmanim, placeDayAfter, type ZmanimPlace } from "./zmanimService";

/**
 * La nuit de l'app, une seule règle pour tous les écrans (l'accueil, la page
 * du Sidour, Mon parcours, le lecteur) : elle court du soir jusqu'à l'aube,
 * et la journée suivante ne commence qu'à l'aube, ni à minuit ni à 'hatsot.
 *
 * Ce qui se dit la nuit se propose jusque-là : Arvit (de préférence avant
 * 'hatsot, permise jusqu'à l'aube, Choul'han 'Aroukh 235, 3 ; le lecteur dit
 * la nuance) et le Chema du coucher. Passé minuit, la nuit appartient encore
 * au soir d'avant : Arvit ou le Chema dits à 2 h comptent pour ce soir-là, et
 * ne sont pas dus de nouveau avant la nuit suivante.
 *
 * L'aube est alot hacha'har, selon l'avis suivi. Là où le soleil ne descend
 * pas assez pour elle (les nuits d'été du Nord, avec un avis en degrés), le
 * lever du soleil en tient lieu ; sans lever du soleil, la journée change à
 * minuit, faute de mieux.
 *
 * Tenu par src/__tests__/nightBounds.test.ts.
 */

/** L'aube du jour civil de `day`, celle de son matin ; null sans soleil. */
export function dawnOf(place: ZmanimPlace, day: Date): Date | null {
  const times = computeZmanim(place, day);
  const dawn =
    times.find((z) => z.key === "alotHaShachar") ?? times.find((z) => z.key === "sunrise");
  return dawn?.date ?? null;
}

/**
 * Le jour dont la journée ou la soirée est en cours : celui de `now`, ou la
 * veille entre minuit et l'aube. Ses horaires sont ceux de la nuit qui court.
 */
export function liturgicalDay(place: ZmanimPlace, now: Date): Date {
  const dawn = dawnOf(place, now);
  return dawn && now.getTime() < dawn.getTime() ? placeDayAfter(place, now, -1) : now;
}

/** L'aube qui clôt la nuit du soir de `day`, au matin du lendemain. */
export function nightEndOf(place: ZmanimPlace, day: Date): Date | null {
  return dawnOf(place, placeDayAfter(place, day, 1));
}
