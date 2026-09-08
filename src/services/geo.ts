/**
 * Distance orthodromique entre deux points du globe, en kilomètres (formule
 * de haversine, Terre sphérique de 6371 km).
 *
 * Une seule copie pour trois usages : la ville la plus proche d'une position
 * (nearestCity), la distance au Kotel (kotelDirection) et les villes voisines
 * des pages horaires prérendues (zmanimSeoPages). Le module est pur, sans
 * dépendance : il sert aussi côté Node, au prérendu.
 */

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export function haversineKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const dLat = toRadians(latitudeB - latitudeA);
  const dLon = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}
