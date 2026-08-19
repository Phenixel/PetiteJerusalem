import { ref, type Ref } from "vue";
import {
  DEFAULT_PLACE,
  placeFromCity,
  type City,
  type NearbyPlace,
  type ZmanimPlace,
} from "../services/zmanimService";
import { isNativeApp } from "./useNativeApp";

/**
 * Lieu de calcul des horaires : Paris par défaut, une ville choisie dans la
 * liste, ou la position de l'appareil si l'utilisateur la partage.
 *
 * La position n'est jamais envoyée nulle part : elle sert au calcul local des
 * zmanim et reste dans le localStorage de l'appareil, pour ne pas redemander
 * la permission à chaque visite et pour que le lieu soit connu même sans
 * réseau.
 * Le bouton « Revenir à Paris » l'efface.
 *
 * Web et app native ne demandent pas la position de la même façon : le
 * navigateur a `navigator.geolocation`, l'app passe par le plugin Capacitor
 * (qui déclenche la demande de permission système). Le plugin est chargé à la
 * demande pour rester hors du bundle du site.
 */

const STORAGE_KEY = "pj_zmanim_place";

/** État de la dernière demande de position. */
export type GeoStatus = "idle" | "loading" | "denied" | "unavailable";

/** Ville proche mémorisée : `undefined` tant qu'aucune recherche n'a eu lieu. */
function readStoredNearby(value: unknown): NearbyPlace | null | undefined {
  if (value === null) return null; // recherche faite, rien d'assez proche
  if (typeof value !== "object" || value === null) return undefined;
  const nearby = value as Partial<NearbyPlace>;
  if (typeof nearby.city !== "string" || typeof nearby.country !== "string") return undefined;
  if (typeof nearby.km !== "number") return undefined;
  return { city: nearby.city, country: nearby.country, km: nearby.km };
}

function readStoredPlace(): ZmanimPlace | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ZmanimPlace>;
    if (typeof parsed.latitude !== "number" || typeof parsed.longitude !== "number") return null;
    if (typeof parsed.tzid !== "string" || !parsed.tzid) return null;
    return {
      // Une valeur écrite par une version antérieure n'avait que « device ».
      source: parsed.source === "city" ? "city" : "device",
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      tzid: parsed.tzid,
      city: typeof parsed.city === "string" ? parsed.city : null,
      nearby: readStoredNearby(parsed.nearby),
    };
  } catch {
    return null;
  }
}

const place: Ref<ZmanimPlace> = ref(readStoredPlace() ?? DEFAULT_PLACE);
const status: Ref<GeoStatus> = ref("idle");

/** Fuseau de l'appareil : celui dans lequel l'utilisateur lit ses horaires. */
function deviceTzid(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_PLACE.tzid;
}

function persist(value: ZmanimPlace | null): void {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Stockage indisponible : le lieu vaut pour la session en cours.
  }
}

/** Position via le navigateur (site web, et webview si la permission est déjà accordée). */
function browserPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false, // le quartier suffit : une minute d'arc ≈ 4 s d'écart
      timeout: 10_000,
      maximumAge: 10 * 60 * 1000,
    });
  });
}

/** Refus explicite de l'utilisateur, à distinguer d'une panne technique. */
class PermissionDeniedError extends Error {}

/**
 * Position via le plugin Capacitor (app native) : demande la permission
 * système au besoin.
 *
 * Seul un refus franc interrompt la démarche. Le reste (API de permissions
 * absente, `requestPermissions` non implémenté, c'est le cas de la
 * plateforme web du plugin) ne prouve rien : `getCurrentPosition` sait aussi
 * déclencher la demande, on le laisse essayer plutôt que d'abandonner.
 */
async function nativePosition(): Promise<{ latitude: number; longitude: number }> {
  const { Geolocation } = await import("@capacitor/geolocation");

  let granted = false;
  try {
    const current = await Geolocation.checkPermissions();
    granted = current.location === "granted" || current.coarseLocation === "granted";
  } catch {
    // Statut inconnu : on demandera quand même.
  }
  if (!granted) {
    try {
      const asked = await Geolocation.requestPermissions();
      if (asked.location === "denied" && asked.coarseLocation === "denied") {
        throw new PermissionDeniedError();
      }
    } catch (error) {
      if (error instanceof PermissionDeniedError) throw error;
    }
  }

  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: false,
    timeout: 10_000,
  });
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}

/**
 * La position de l'appareil, par le chemin le plus sûr de la plateforme.
 *
 * Dans l'app native, le plugin d'abord : lui seul sait ouvrir la demande de
 * permission système. S'il échoue pour une raison technique, la webview reste
 * capable de géolocaliser dès que l'app détient la permission, autant s'en
 * servir plutôt que de renvoyer l'utilisateur sur Paris.
 */
async function devicePosition(): Promise<{ latitude: number; longitude: number }> {
  if (!isNativeApp) return (await browserPosition()).coords;
  try {
    return await nativePosition();
  } catch (error) {
    if (error instanceof PermissionDeniedError) throw error;
    return (await browserPosition()).coords;
  }
}

/**
 * Nomme une position d'après le catalogue de villes embarqué, pour que
 * l'utilisateur voie « Sarcelles » plutôt que deux nombres et comprenne qu'il
 * a bien été localisé.
 *
 * Le catalogue est chargé à la demande, il n'a pas sa place dans le bundle de
 * l'accueil, et son absence (chunk non téléchargé hors ligne) n'est pas une
 * panne : le lieu reste utilisable, seulement sans nom.
 */
async function lookupNearby(
  latitude: number,
  longitude: number,
): Promise<NearbyPlace | null | undefined> {
  try {
    const { nearestCity } = await import("../services/nearestCity");
    return nearestCity(latitude, longitude);
  } catch {
    return undefined; // catalogue indisponible : on retentera plus tard
  }
}

export function useZmanimLocation() {
  /**
   * Demande la position de l'appareil. En cas de refus ou d'échec, le lieu
   * courant est conservé (Paris au premier lancement) : la page reste utile.
   */
  async function useDevicePlace(): Promise<boolean> {
    status.value = "loading";
    try {
      const coords = await devicePosition();
      const devicePlace: ZmanimPlace = {
        source: "device",
        latitude: coords.latitude,
        longitude: coords.longitude,
        tzid: deviceTzid(),
        city: null,
      };
      place.value = devicePlace;
      persist(devicePlace);
      status.value = "idle";
      // Les horaires du nouveau lieu s'affichent tout de suite ; son nom suit,
      // le temps de charger le catalogue de villes.
      await ensureNearby();
      return true;
    } catch (error) {
      // PERMISSION_DENIED (code 1) côté navigateur, PermissionDeniedError côté
      // plugin : dans les deux cas l'utilisateur a dit non, le message doit le
      // dire plutôt que d'évoquer une panne.
      const denied =
        error instanceof PermissionDeniedError ||
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as GeolocationPositionError).code === 1);
      status.value = denied ? "denied" : "unavailable";
      return false;
    }
  }

  /** Une ville choisie dans la liste remplace le lieu courant. */
  function useCity(city: City): void {
    const chosen = placeFromCity(city);
    place.value = chosen;
    status.value = "idle";
    // Paris étant déjà le repli, le mémoriser n'apporte rien et laisse une
    // trace là où l'utilisateur n'a rien choisi de particulier.
    persist(chosen.city === DEFAULT_PLACE.city ? null : chosen);
  }

  /** Retour au repli parisien : le lieu mémorisé est effacé. */
  function useDefaultPlace(): void {
    place.value = DEFAULT_PLACE;
    status.value = "idle";
    persist(null);
  }

  /**
   * Nomme après coup une position mémorisée avant que la page ne sache le
   * faire : sans quoi elle resterait « Ma position » jusqu'à ce que
   * l'utilisateur redemande sa localisation.
   */
  async function ensureNearby(): Promise<void> {
    const current = place.value;
    if (current.source !== "device" || current.nearby !== undefined) return;
    const nearby = await lookupNearby(current.latitude, current.longitude);
    if (nearby === undefined || place.value !== current) return;
    const named: ZmanimPlace = { ...current, nearby };
    place.value = named;
    persist(named);
  }

  return { place, status, useDevicePlace, useCity, useDefaultPlace, ensureNearby };
}
