import citiesJson from "../datas/cities.json";
import { KNOWN_PLACE_KM, type City, type NearbyPlace } from "./zmanimService";
import { haversineKm } from "./geo";

/**
 * Nommer une position à partir du catalogue de villes embarqué.
 *
 * Aucun géocodage inverse : la position ne sort pas de l'appareil, c'est la
 * promesse tenue par toute la page des horaires. On se contente donc de la
 * ville connue la plus proche, dense en France et en Israël, plus lâche
 * ailleurs, d'où le libellé prudent au-delà de quelques kilomètres (voir
 * describeNearby).
 *
 * Ce module est chargé à la demande (il embarque le catalogue) : il n'entre
 * pas dans le bundle de l'accueil.
 */

const cities = citiesJson as City[];

/** Distance orthodromique (voir geo.ts) ; gardé sous ce nom pour les tests. */
export const distanceKm = haversineKm;

/**
 * La ville connue la plus proche, ou `null` si la plus proche est si loin
 * qu'elle ne dit plus rien du lieu (plein océan, région sans communauté
 * répertoriée).
 */
export function nearestCity(latitude: number, longitude: number): NearbyPlace | null {
  let closest: City | null = null;
  let closestKm = Infinity;
  for (const city of cities) {
    const km = distanceKm(latitude, longitude, city.lat, city.lon);
    if (km < closestKm) {
      closestKm = km;
      closest = city;
    }
  }
  if (!closest || closestKm > KNOWN_PLACE_KM) return null;
  return { city: closest.name, country: closest.country, km: Math.round(closestKm) };
}
