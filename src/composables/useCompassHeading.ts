import { onUnmounted, ref, type Ref } from "vue";

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
 * n'aboutit que depuis un clic. La boussole est donc démarrée à l'ouverture de
 * la fenêtre là où c'est possible, et derrière un bouton là où iOS le demande.
 */

/** État de la boussole, tel que la fenêtre doit le raconter. */
export type CompassStatus = "idle" | "asking" | "live" | "denied" | "unavailable";

/** Le `requestPermission` d'iOS, absent des types du DOM. */
interface OrientationPermission {
  requestPermission?: () => Promise<"granted" | "denied" | "prompt">;
}

/** L'événement d'orientation, plus le cap déjà calculé de Safari. */
interface CompassEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

/**
 * Permission déjà accordée dans cette session : iOS ne la redemande pas, et
 * la fenêtre peut donc rallumer la boussole d'elle-même à la réouverture, au
 * lieu de réclamer un second appui sur le bouton.
 */
let granted = false;

/** Vrai si la plateforme réclame un geste avant de donner l'orientation. */
export function compassNeedsPermission(): boolean {
  const api = (globalThis as { DeviceOrientationEvent?: OrientationPermission })
    .DeviceOrientationEvent;
  return typeof api?.requestPermission === "function" && !granted;
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

export function useCompassHeading(): {
  heading: Ref<number | null>;
  status: Ref<CompassStatus>;
  start: () => Promise<void>;
  stop: () => void;
} {
  const heading = ref<number | null>(null);
  const status = ref<CompassStatus>("idle");

  let listening = false;
  let silence: ReturnType<typeof setTimeout> | null = null;

  function onOrientation(event: Event): void {
    const value = headingOf(event as CompassEvent);
    if (value === null) return;
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
    if (!listening) return;
    window.removeEventListener("deviceorientationabsolute", onOrientation);
    window.removeEventListener("deviceorientation", onOrientation);
    listening = false;
  }

  async function start(): Promise<void> {
    if (listening) return;
    const api = (globalThis as { DeviceOrientationEvent?: OrientationPermission })
      .DeviceOrientationEvent;
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
        // Appel hors geste de l'utilisateur, ou API absente à l'exécution :
        // le cadran fixe reste juste, il n'y a rien à signaler d'autre.
        status.value = "unavailable";
        return;
      }
    }
    // Les deux événements : Chrome ne donne le nord que sur
    // « deviceorientationabsolute », Safari le donne sur « deviceorientation ».
    window.addEventListener("deviceorientationabsolute", onOrientation);
    window.addEventListener("deviceorientation", onOrientation);
    listening = true;
    status.value = "asking";
    // L'écoute continue au-delà du délai : un magnétomètre lent (un capteur
    // qui s'étalonne) doit encore pouvoir réveiller le cadran, la fenêtre
    // disant en attendant qu'il n'y a pas de nord.
    silence = setTimeout(() => {
      if (heading.value === null) status.value = "unavailable";
      silence = null;
    }, SILENCE_MS);
  }

  onUnmounted(stop);

  return { heading, status, start, stop };
}
