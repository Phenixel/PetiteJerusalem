import { onUnmounted, ref, type Ref } from "vue";
import {
  accuracyFromDegrees,
  type CompassAccuracy,
  type DeviceTilt,
} from "../services/compassReading";
import { watchNativeCompassAccuracy } from "../services/nativeCompassAccuracy";

/**
 * Le cap de l'appareil, en degrés : ce vers quoi pointe le haut du téléphone.
 *
 * C'est le nord de la boussole, magnétique sur la plupart des appareils, là où
 * le cap vers le Kotel se compte depuis le nord géographique. L'écart (la
 * déclinaison) est de l'ordre du degré en Europe de l'Ouest et en Israël, mais
 * d'une dizaine en Amérique du Nord : le cadran vivant approche, la valeur en
 * degrés, elle, reste exacte.
 *
 * Il sert à faire vivre la flèche du Kotel. Sans lui, la flèche reste juste :
 * elle vaut alors pour un cadran nord en haut, et c'est au lecteur de savoir
 * où est le nord. C'est pourquoi rien ici ne fait échouer l'affichage : un
 * appareil sans magnétomètre, un navigateur qui ne donne pas l'orientation
 * absolue, une permission refusée, tout cela ramène simplement au cadran fixe.
 *
 * iOS exige un geste de l'utilisateur : `DeviceOrientationEvent.requestPermission`
 * n'aboutit que depuis un clic. Les fenêtres démarrent donc la boussole
 * dans le geste même qui les ouvre (un `watch` synchrone, comme le miroir des
 * téfilines), et `start` appelle `requestPermission` avant tout `await` : un
 * tour de boucle plus tard, Safari refuse sans rien demander, et la fenêtre
 * réclamait un second appui sur « Activer la boussole » alors qu'on venait
 * d'appuyer. Le bouton ne reste que pour le cas où ce premier geste n'a pas
 * suffi (`locked`).
 *
 * Avec le cap viennent deux choses que le cadran montre aussi : la précision
 * estimée (Safari la donne avec le cap, l'app Android la lit au système), et
 * l'inclinaison du téléphone, qui dit s'il est tenu à plat.
 */

/**
 * État de la boussole, tel que la fenêtre doit le raconter. `locked` : la
 * plateforme attend un geste pour donner l'orientation, la fenêtre doit le
 * demander.
 */
export type CompassStatus = "idle" | "asking" | "locked" | "live" | "denied" | "unavailable";

/** Le `requestPermission` d'iOS, absent des types du DOM. */
interface OrientationPermission {
  requestPermission?: () => Promise<"granted" | "denied" | "prompt">;
}

/** L'événement d'orientation, plus le cap déjà calculé de Safari et sa précision. */
interface CompassEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

/**
 * Permission déjà accordée dans cette session : iOS ne la redemande pas, et
 * la fenêtre peut donc rallumer la boussole d'elle-même à la réouverture, au
 * lieu de réclamer un second appui sur le bouton.
 */
let granted = false;

function orientationApi(): OrientationPermission | undefined {
  return (globalThis as { DeviceOrientationEvent?: OrientationPermission }).DeviceOrientationEvent;
}

/** Le cap porté par un événement, ou null s'il n'en porte pas d'absolu. */
function headingOf(event: CompassEvent): number | null {
  // Safari calcule le cap lui-même, et c'est le seul qu'il donne.
  if (typeof event.webkitCompassHeading === "number" && !Number.isNaN(event.webkitCompassHeading)) {
    return event.webkitCompassHeading;
  }
  // Ailleurs, alpha ne vaut que s'il est rapporté au nord et non à
  // l'orientation qu'avait l'appareil au premier événement.
  if (!event.absolute || typeof event.alpha !== "number") return null;
  return (360 - event.alpha) % 360;
}

/**
 * Délai au bout duquel un appareil muet est déclaré sans boussole : les
 * événements d'orientation arrivent en quelques dizaines de millisecondes
 * quand ils arrivent ; passé deux secondes, il n'y a rien à attendre.
 */
const SILENCE_MS = 2000;

export function useCompassHeading(options: { accuracy?: boolean } = {}): {
  heading: Ref<number | null>;
  status: Ref<CompassStatus>;
  accuracy: Ref<CompassAccuracy>;
  accuracyDegrees: Ref<number | null>;
  tilt: Ref<DeviceTilt | null>;
  start: (retry?: boolean) => Promise<void>;
  stop: () => void;
} {
  const heading = ref<number | null>(null);
  const status = ref<CompassStatus>("idle");
  /** La précision estimée du cap ; `unknown` tant que rien ne la donne. */
  const accuracy = ref<CompassAccuracy>("unknown");
  /** L'écart chiffré, en degrés, quand l'appareil le donne (Safari). */
  const accuracyDegrees = ref<number | null>(null);
  /** L'inclinaison de l'appareil ; null tant qu'il ne l'a pas donnée. */
  const tilt = ref<DeviceTilt | null>(null);

  let listening = false;
  let silence: ReturnType<typeof setTimeout> | null = null;
  let unwatchAccuracy: (() => void) | null = null;

  function readTilt(event: CompassEvent): void {
    if (typeof event.beta !== "number" || typeof event.gamma !== "number") return;
    // Au degré, comme le cap : la main tremble, le cadran n'a pas à trembler
    // avec elle.
    const beta = Math.round(event.beta);
    const gamma = Math.round(event.gamma);
    if (tilt.value?.beta === beta && tilt.value?.gamma === gamma) return;
    tilt.value = { beta, gamma };
  }

  function readAccuracy(event: CompassEvent): void {
    const degrees = event.webkitCompassAccuracy;
    if (typeof degrees !== "number" || Number.isNaN(degrees)) return;
    accuracy.value = accuracyFromDegrees(degrees);
    accuracyDegrees.value = degrees >= 0 ? Math.round(degrees) : null;
  }

  function onOrientation(event: Event): void {
    const compassEvent = event as CompassEvent;
    // L'inclinaison vient aussi des événements sans nord : elle ne dépend
    // que de la pesanteur.
    readTilt(compassEvent);
    const value = headingOf(compassEvent);
    if (value === null) return;
    readAccuracy(compassEvent);
    if (silence) {
      clearTimeout(silence);
      silence = null;
    }
    // Le cadran ne tremble pas pour un dixième de degré : la valeur affichée
    // est arrondie au degré, ce qui suffit pour se tourner vers Jérusalem.
    heading.value = Math.round(value);
    status.value = "live";
  }

  function stop(): void {
    if (silence) {
      clearTimeout(silence);
      silence = null;
    }
    unwatchAccuracy?.();
    unwatchAccuracy = null;
    if (!listening) return;
    window.removeEventListener("deviceorientationabsolute", onOrientation);
    window.removeEventListener("deviceorientation", onOrientation);
    listening = false;
  }

  /**
   * Démarre l'écoute, dans un geste de l'utilisateur là où la plateforme
   * l'exige : l'ouverture de la fenêtre, ou le bouton « Activer la boussole »
   * (`retry`), après quoi un échec n'a plus de geste à attendre.
   */
  async function start(retry = false): Promise<void> {
    if (listening) return;
    const api = orientationApi();
    if (!api || typeof window === "undefined") {
      status.value = "unavailable";
      return;
    }
    if (typeof api.requestPermission === "function" && !granted) {
      status.value = "asking";
      try {
        if ((await api.requestPermission()) !== "granted") {
          status.value = "denied";
          return;
        }
        granted = true;
      } catch {
        // Appel hors geste : Safari rejette au lieu de demander. La fenêtre
        // propose alors le bouton ; depuis le bouton même, il n'y a plus
        // rien à attendre, le cadran fixe reste juste.
        status.value = retry ? "unavailable" : "locked";
        return;
      }
    }
    if (listening) return;
    tilt.value = null;
    accuracy.value = "unknown";
    accuracyDegrees.value = null;
    // Les deux événements : Chrome ne donne le nord que sur
    // « deviceorientationabsolute », Safari le donne sur « deviceorientation ».
    window.addEventListener("deviceorientationabsolute", onOrientation);
    window.addEventListener("deviceorientation", onOrientation);
    listening = true;
    status.value = "asking";
    // Le magnétomètre natif ne s'allume que pour une fenêtre qui montre la
    // précision.
    if (options.accuracy) {
      unwatchAccuracy = watchNativeCompassAccuracy((level) => {
        accuracy.value = level;
        accuracyDegrees.value = null;
      });
    }
    // L'écoute continue au-delà du délai : un magnétomètre lent (un capteur
    // qui s'étalonne) doit encore pouvoir réveiller le cadran, la fenêtre
    // disant en attendant qu'il n'y a pas de nord.
    silence = setTimeout(() => {
      if (heading.value === null) status.value = "unavailable";
      silence = null;
    }, SILENCE_MS);
  }

  onUnmounted(stop);

  return { heading, status, accuracy, accuracyDegrees, tilt, start, stop };
}
