import { ref, type Ref } from "vue";
import { DEFAULT_PLACE, type ZmanimPlace } from "../services/zmanimService";
import { isNativeApp } from "./useNativeApp";

/**
 * Lieu de calcul des horaires : Paris par défaut, la position de l'appareil
 * si l'utilisateur la partage.
 *
 * La position n'est jamais envoyée nulle part : elle sert au calcul local des
 * zmanim et reste dans le localStorage de l'appareil, pour ne pas redemander
 * la permission à chaque visite et pour que la page fonctionne hors ligne.
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

function readStoredPlace(): ZmanimPlace | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ZmanimPlace>;
    if (typeof parsed.latitude !== "number" || typeof parsed.longitude !== "number") return null;
    if (typeof parsed.tzid !== "string" || !parsed.tzid) return null;
    return {
      source: "device",
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      tzid: parsed.tzid,
      city: null,
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

/** Position via le plugin Capacitor (app native) : demande la permission système. */
async function nativePosition(): Promise<{ latitude: number; longitude: number }> {
  const { Geolocation } = await import("@capacitor/geolocation");
  const permission = await Geolocation.requestPermissions();
  if (permission.location === "denied" && permission.coarseLocation === "denied") {
    throw new Error("permission denied");
  }
  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: false,
    timeout: 10_000,
  });
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}

export function useZmanimLocation() {
  /**
   * Demande la position de l'appareil. En cas de refus ou d'échec, le lieu
   * courant est conservé (Paris au premier lancement) : la page reste utile.
   */
  async function useDevicePlace(): Promise<boolean> {
    status.value = "loading";
    try {
      const coords = isNativeApp ? await nativePosition() : (await browserPosition()).coords;
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
      return true;
    } catch (error) {
      const denied =
        typeof error === "object" &&
        error !== null &&
        ("code" in error ? (error as GeolocationPositionError).code === 1 : false);
      status.value = denied || String(error).includes("denied") ? "denied" : "unavailable";
      return false;
    }
  }

  /** Retour au repli parisien : la position mémorisée est effacée. */
  function useDefaultPlace(): void {
    place.value = DEFAULT_PLACE;
    status.value = "idle";
    persist(null);
  }

  return { place, status, useDevicePlace, useDefaultPlace };
}
