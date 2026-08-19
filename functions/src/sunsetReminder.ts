/**
 * Le rappel « dernier appel » avant la chkia : quand il doit partir.
 *
 * Ce module ne dépend que du calendrier, ni Firestore, ni FCM, pour que la
 * décision se teste depuis la suite du site (src/__tests__/sunsetReminder.test.ts),
 * côte à côte avec les horaires qu'affiche l'application.
 *
 * Côté application c'est `@hebcal/core` qui donne les zmanim (voir
 * src/services/zmanimService.ts). Il est publié en ESM seul, quand ce paquet
 * de Cloud Functions est compilé en CommonJS : plutôt que de convertir tout
 * `functions/` pour un seul horaire, l'algorithme solaire NOAA est repris ici.
 * C'est celui-là même que `@hebcal/core` applique, via `@hebcal/noaa`, et
 * les deux implémentations sont comparées dans ce test (moins d'une seconde
 * d'écart, de Melbourne à Jérusalem).
 */

const rad = (degrees: number): number => (degrees * Math.PI) / 180;
const deg = (radians: number): number => (radians * 180) / Math.PI;

/** Jour julien à minuit UTC, pour une date du calendrier grégorien. */
function julianDayOf(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045 -
    0.5
  );
}

/** Siècles juliens écoulés depuis J2000, l'unité de temps des séries NOAA. */
const julianCenturies = (julianDay: number): number => (julianDay - 2451545) / 36525;

/** Longitude moyenne du soleil (degrés). */
function meanLongitude(t: number): number {
  const longitude = (280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360;
  return longitude < 0 ? longitude + 360 : longitude;
}

/** Anomalie moyenne du soleil (degrés). */
const meanAnomaly = (t: number): number => 357.52911 + t * (35999.05029 - 0.0001537 * t);

/** Excentricité de l'orbite terrestre. */
const eccentricity = (t: number): number => 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

/** Équation du centre : l'écart de l'orbite réelle à un cercle parfait. */
function equationOfCenter(t: number): number {
  const m = rad(meanAnomaly(t));
  return (
    Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m) * 0.000289
  );
}

/** Longitude apparente du soleil (degrés), nutation et aberration comprises. */
const apparentLongitude = (t: number): number =>
  meanLongitude(t) + equationOfCenter(t) - 0.00569 - 0.00478 * Math.sin(rad(125.04 - 1934.136 * t));

/** Obliquité corrigée de l'écliptique (degrés). */
const obliquity = (t: number): number =>
  23 +
  (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60 +
  0.00256 * Math.cos(rad(125.04 - 1934.136 * t));

/** Déclinaison du soleil (degrés) : sa hauteur au-dessus de l'équateur céleste. */
const declination = (t: number): number =>
  deg(Math.asin(Math.sin(rad(obliquity(t))) * Math.sin(rad(apparentLongitude(t)))));

/** Équation du temps (minutes) : l'écart entre midi solaire vrai et midi moyen. */
function equationOfTime(t: number): number {
  const y = Math.tan(rad(obliquity(t)) / 2) ** 2;
  const l0 = rad(meanLongitude(t));
  const e = eccentricity(t);
  const m = rad(meanAnomaly(t));
  const value =
    y * Math.sin(2 * l0) -
    2 * e * Math.sin(m) +
    4 * e * y * Math.sin(m) * Math.cos(2 * l0) -
    0.5 * y * y * Math.sin(4 * l0) -
    1.25 * e * e * Math.sin(2 * m);
  return deg(value) * 4;
}

/**
 * Angle horaire du coucher (radians, négatif), au zénith de 90°50′ : le demi-
 * degré du disque solaire plus la réfraction atmosphérique, comme la halakha
 * le retient pour la chkia. `null` quand le soleil ne se couche pas ce jour-là
 * (nuit ou jour polaire).
 */
function sunsetHourAngle(latitude: number, solarDeclination: number): number | null {
  const ZENITH = 90 + 50 / 60;
  const lat = rad(latitude);
  const dec = rad(solarDeclination);
  const cosine =
    Math.cos(rad(ZENITH)) / (Math.cos(lat) * Math.cos(dec)) - Math.tan(lat) * Math.tan(dec);
  if (cosine < -1 || cosine > 1) return null;
  return -Math.acos(cosine);
}

/**
 * La chkia d'un jour civil (année/mois/jour tels qu'ils sont vécus au lieu),
 * pour une position en degrés décimaux, latitude nord et longitude est
 * positives. `null` aux latitudes extrêmes, où le soleil ne se couche pas.
 */
export function sunsetOn(
  year: number,
  month: number,
  day: number,
  latitude: number,
  longitude: number,
): Date | null {
  const julianDay = julianDayOf(year, month, day);

  /** Minutes écoulées depuis minuit UTC jusqu'au coucher. */
  const minutesUTC = (t: number): number | null => {
    const hourAngle = sunsetHourAngle(latitude, declination(t));
    if (hourAngle === null) return null;
    return 720 + 4 * (-longitude - deg(hourAngle)) - equationOfTime(t);
  };

  // Deux passes : la première situe le coucher dans la journée, la seconde
  // reprend le calcul à cet instant-là plutôt qu'à minuit, la déclinaison
  // bouge assez en douze heures pour que l'écart se voie.
  const approx = minutesUTC(julianCenturies(julianDay));
  if (approx === null) return null;
  const minutes = minutesUTC(julianCenturies(julianDay + approx / 1440));
  if (minutes === null || !Number.isFinite(minutes)) return null;

  return new Date((julianDay - 2440587.5) * 86_400_000 + minutes * 60_000);
}

/** Minutes avant la chkia, même valeur que SUNSET_REMINDER_OFFSET_MINUTES côté client. */
export const SUNSET_OFFSET_MINUTES = 20;

/** Cadence du scheduler : tout se décide par créneaux de 5 minutes. */
export const SLOT_MINUTES = 5;

/** Lieu du calcul de la chkia (arrondi côté client, voir coarsePlace). */
export interface ReminderPlace {
  latitude: number;
  longitude: number;
  /** Fuseau IANA : il dit de quel jour civil la chkia est calculée. */
  tzid: string;
}

/** Paris : le repli du client quand l'utilisateur n'a rien choisi (DEFAULT_PLACE). */
export const DEFAULT_PLACE: ReminderPlace = {
  latitude: 48.85341,
  longitude: 2.3488,
  tzid: "Europe/Paris",
};

/** Un lieu tel qu'il a été écrit dans les préférences, ou Paris s'il est inutilisable. */
export function readPlace(value: unknown): ReminderPlace {
  if (typeof value !== "object" || value === null) return DEFAULT_PLACE;
  const place = value as Partial<ReminderPlace>;
  if (typeof place.latitude !== "number" || typeof place.longitude !== "number") {
    return DEFAULT_PLACE;
  }
  if (typeof place.tzid !== "string" || !place.tzid) return DEFAULT_PLACE;
  return { latitude: place.latitude, longitude: place.longitude, tzid: place.tzid };
}

/**
 * L'instant du rappel d'avant-chkia pour aujourd'hui, au lieu donné.
 *
 * Le jour dont on calcule la chkia est celui qu'il est **au lieu** : à minuit
 * passé à Paris, un utilisateur à New York est encore la veille, et ce serait
 * la chkia du lendemain qu'on viserait. `null` aux latitudes extrêmes, où le
 * soleil ne se couche pas, et pour un fuseau que le serveur ne connaît pas.
 */
export function sunsetReminderAt(place: ReminderPlace, now: Date): Date | null {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: place.tzid,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
  } catch {
    return null;
  }
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const sunset = sunsetOn(get("year"), get("month"), get("day"), place.latitude, place.longitude);
  return sunset ? new Date(sunset.getTime() - SUNSET_OFFSET_MINUTES * 60_000) : null;
}

/**
 * Le rappel tombe-t-il dans le créneau en cours ?
 *
 * Le scheduler ne repasse que dans 5 minutes : on envoie dès que l'instant visé
 * est dans le créneau, quitte à prendre jusqu'à 5 minutes d'avance, et une
 * seule fois, puisque les créneaux ne se chevauchent pas. `now` est calé sur le
 * début du créneau, un déclenchement en retard de quelques secondes ne devant
 * pas décaler la fenêtre.
 */
export function isInCurrentSlot(target: Date, now: Date): boolean {
  const slot = SLOT_MINUTES * 60_000;
  const slotStart = Math.floor(now.getTime() / slot) * slot;
  return target.getTime() >= slotStart && target.getTime() < slotStart + slot;
}
