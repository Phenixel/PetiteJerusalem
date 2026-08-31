/**
 * La direction du Kotel : le cap à suivre, depuis n'importe où, pour prier
 * face au mur Occidental.
 *
 * La 'Amida se dit face à Jérusalem : hors d'Israël on se tourne vers le
 * pays, en Israël vers Jérusalem, à Jérusalem vers le lieu du Temple. Le
 * cadran de la boussole (KotelCompass.vue) affiche ce cap ; ici vit le calcul,
 * qui ne dépend d'aucune API et se teste seul.
 *
 * Le cap est l'orthodromie (le grand cercle), pas la ligne droite d'une carte
 * plate : depuis Paris, la différence dépasse déjà dix degrés, et une
 * projection de Mercator ferait regarder trop au sud.
 */

/**
 * Le Kotel, esplanade de la prière, à Jérusalem : 31,7767 N, 35,2345 E.
 */
export const KOTEL = { latitude: 31.7767, longitude: 35.2345 } as const;

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Rayon moyen de la Terre, en kilomètres. */
const EARTH_RADIUS_KM = 6371;

/** Un angle ramené dans [0, 360[. */
function normalize(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Le cap initial vers le Kotel, en degrés depuis le nord géographique, dans
 * le sens des aiguilles d'une montre (0 = nord, 90 = est).
 */
export function bearingToKotel(latitude: number, longitude: number): number {
  const from = latitude * RAD;
  const to = KOTEL.latitude * RAD;
  const delta = (KOTEL.longitude - longitude) * RAD;
  const y = Math.sin(delta) * Math.cos(to);
  const x = Math.cos(from) * Math.sin(to) - Math.sin(from) * Math.cos(to) * Math.cos(delta);
  return normalize(Math.atan2(y, x) * DEG);
}

/** La distance jusqu'au Kotel, en kilomètres, à la surface du globe. */
export function distanceToKotelKm(latitude: number, longitude: number): number {
  const from = latitude * RAD;
  const to = KOTEL.latitude * RAD;
  const dLat = to - from;
  const dLon = (KOTEL.longitude - longitude) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(from) * Math.cos(to) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Les huit aires de vent, dans l'ordre du cadran. */
export const COMPASS_POINTS = ["n", "ne", "e", "se", "s", "so", "o", "no"] as const;

export type CompassPoint = (typeof COMPASS_POINTS)[number];

/**
 * L'aire de vent d'un cap (« nord-est »…) : un cap de 121° ne dit rien à qui
 * le lit, « sud-est » se comprend d'un coup d'oeil.
 */
export function compassPoint(bearing: number): CompassPoint {
  const index = Math.round(normalize(bearing) / 45) % COMPASS_POINTS.length;
  return COMPASS_POINTS[index];
}

/**
 * L'angle dont il faut tourner la flèche à l'écran : le cap, moins le cap de
 * l'appareil quand la boussole le donne. Sans boussole, le cadran garde le
 * nord en haut et la flèche vaut pour le nord.
 */
export function arrowAngle(bearing: number, heading: number | null): number {
  return normalize(bearing - (heading ?? 0));
}
