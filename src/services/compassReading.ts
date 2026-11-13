/**
 * Ce que la boussole dit d'elle-même, en plus du cap : la confiance qu'on peut
 * lui faire, et la façon dont on la tient.
 *
 * Une boussole de téléphone se trompe de deux façons qu'on ne voit pas sur le
 * cadran. Son magnétomètre n'est pas étalonné (un téléphone sorti d'un étui
 * aimanté, passé près d'une enceinte) : la flèche est stable, et fausse de
 * plusieurs dizaines de degrés. Ou on la tient debout : le cap se lit dans le
 * plan de l'écran, et la flèche tourne avec l'inclinaison de la main. Le
 * cadran (KotelCompass.vue) montre l'une et l'autre ; ici vivent les calculs,
 * sans API, qui se testent seuls.
 */

/**
 * La précision estimée du cap : bonne, moyenne, faible (il faut étalonner),
 * ou inconnue quand l'appareil ne la donne pas (Chrome sur le site : il donne
 * le cap, rien sur l'étalonnage).
 */
export type CompassAccuracy = "high" | "medium" | "low" | "unknown";

/** Au-delà de cet écart, la flèche ne mène plus vers Jérusalem. */
const HIGH_MAX_DEGREES = 15;
const MEDIUM_MAX_DEGREES = 30;

/**
 * La précision de Safari (`webkitCompassAccuracy`), en degrés de part et
 * d'autre du cap. Négative, elle dit que le cap n'est pas fiable du tout :
 * le magnétomètre attend d'être étalonné.
 */
export function accuracyFromDegrees(degrees: number): CompassAccuracy {
  if (!Number.isFinite(degrees) || degrees < 0) return "low";
  if (degrees <= HIGH_MAX_DEGREES) return "high";
  if (degrees <= MEDIUM_MAX_DEGREES) return "medium";
  return "low";
}

/**
 * L'étalonnage du magnétomètre selon Android (`SensorManager`), que l'app
 * lit par son plugin natif PjCompass : 3 haute, 2 moyenne, 1 basse,
 * 0 inutilisable ; -1 (capteur sans contact) et toute autre valeur ne disent
 * rien.
 */
export function accuracyFromAndroidStatus(status: number): CompassAccuracy {
  if (status === 3) return "high";
  if (status === 2) return "medium";
  if (status === 1 || status === 0) return "low";
  return "unknown";
}

/**
 * L'écart dessiné de part et d'autre de la flèche, en degrés : celui que donne
 * l'appareil quand il le chiffre (Safari), sinon une valeur typique de son
 * niveau (Android ne donne qu'un niveau). Rien quand on ne sait pas : un
 * secteur inventé ferait croire à une mesure.
 */
const SPREAD_OF_LEVEL: Record<Exclude<CompassAccuracy, "unknown">, number> = {
  high: 10,
  medium: 20,
  low: 40,
};

export function accuracySpread(level: CompassAccuracy, degrees: number | null): number | null {
  if (level === "unknown") return null;
  const spread = degrees !== null && degrees >= 0 ? degrees : SPREAD_OF_LEVEL[level];
  return Math.min(60, Math.max(5, spread));
}

/** L'inclinaison de l'appareil, telle que la donne l'événement d'orientation. */
export interface DeviceTilt {
  /** Avant-arrière : positif quand le haut du téléphone se relève. */
  beta: number;
  /** Gauche-droite : positif quand le bord droit s'abaisse. */
  gamma: number;
}

/**
 * En deçà de cet angle sur chaque axe, le téléphone est à plat : la main
 * tremble toujours d'un ou deux degrés, et c'est assez pour le magnétomètre.
 */
const FLAT_DEGREES = 8;

export function isFlat(tilt: DeviceTilt): boolean {
  return Math.abs(tilt.beta) <= FLAT_DEGREES && Math.abs(tilt.gamma) <= FLAT_DEGREES;
}

/**
 * L'inclinaison la plus forte qu'on donne au cadran : au-delà, il deviendrait
 * une ligne, et l'on ne verrait plus la flèche qu'on cherche à suivre.
 */
const MAX_DIAL_TILT = 55;

function clamp(value: number): number {
  return Math.min(MAX_DIAL_TILT, Math.max(-MAX_DIAL_TILT, value));
}

/**
 * L'inclinaison du cadran à l'écran, en degrés, pour `rotateX` puis
 * `rotateY` : le cadran reste à l'horizontale, comme la rose d'une boussole
 * de marine sur son cardan, et c'est le téléphone qui penche autour de lui.
 * Le haut du téléphone relevé, le haut du cadran s'enfonce dans l'écran ; le
 * bord droit abaissé, le bord droit du cadran vient vers soi. Le cadran se
 * présente de face quand le téléphone est à plat, et c'est l'envie de le
 * redresser qui fait poser le téléphone.
 */
export function dialTilt(tilt: DeviceTilt): { x: number; y: number } {
  // Au-delà de la verticale (le téléphone renversé vers soi), l'inclinaison
  // reste au plus fort : le cadran ne se retourne pas.
  const x = Math.abs(tilt.beta) > 90 ? Math.sign(tilt.beta) * MAX_DIAL_TILT : clamp(tilt.beta);
  const y = clamp(-tilt.gamma);
  // `+ 0` : un zéro négatif écrirait « -0deg » dans le style.
  return { x: Math.round(x) + 0, y: Math.round(y) + 0 };
}

/**
 * The guidance toward the Kotel: how far the arrow is from the top of the
 * phone, and what the dial and the motor make of it. Turning until the arrow
 * points straight ahead should be felt as much as seen: notches as it comes
 * close, a lock when it is there.
 */

/**
 * The arrow's angle on screen, brought back to (-180, 180]: 0 when it points
 * straight ahead, negative to the left, positive to the right.
 */
export function arrowOffset(angle: number): number {
  const turned = ((angle % 360) + 360) % 360;
  return turned > 180 ? turned - 360 : turned;
}

/**
 * Facing the Kotel: within 5° to get in, 10° to get out. The gap keeps the
 * hand that trembles around the threshold from locking and unlocking at every
 * reading, which would make the phone buzz without end.
 */
const ALIGN_ENTER_DEGREES = 5;
const ALIGN_LEAVE_DEGREES = 10;

export function isAligned(offset: number, wasAligned: boolean): boolean {
  return Math.abs(offset) <= (wasAligned ? ALIGN_LEAVE_DEGREES : ALIGN_ENTER_DEGREES);
}

/** Within this angle, the dial starts filling and the notches are felt. */
const NEAR_DEGREES = 45;
/** One notch every ten degrees, like the clicks of a dial. */
const NOTCH_DEGREES = 10;
/** How far past a notch the arrow must go before it counts as crossed. */
const NOTCH_MARGIN_DEGREES = 2;

/**
 * The notch the arrow is in, from 1 (the last ten degrees) to 5, or null when
 * it is too far for any. A notch only changes once the arrow is clearly past
 * its edge: the heading moves by whole degrees, and an offset that hesitates
 * between 9.6° and 10.6° must not tick on every reading.
 */
export function nextNotch(offset: number, previous: number | null): number | null {
  const away = Math.abs(offset);
  if (away > NEAR_DEGREES) {
    return previous !== null && away <= NEAR_DEGREES + NOTCH_MARGIN_DEGREES ? previous : null;
  }
  const notch = Math.max(1, Math.ceil(away / NOTCH_DEGREES));
  if (previous === null || notch === previous) return notch;
  // Moving away: past the outer edge of the previous notch, by the margin.
  if (notch > previous)
    return away >= previous * NOTCH_DEGREES + NOTCH_MARGIN_DEGREES ? notch : previous;
  // Coming closer: past its inner edge, by the margin.
  return away <= (previous - 1) * NOTCH_DEGREES - NOTCH_MARGIN_DEGREES ? notch : previous;
}

/**
 * How full the dial is, from 0 to 1. It rises as the arrow comes within 45°,
 * to a little under half, then fills at once when it locks: the jump is what
 * says "there", the slow rise before it says "warmer".
 */
const NEAR_FILL = 0.45;

export function fillLevel(offset: number, aligned: boolean): number {
  if (aligned) return 1;
  const away = Math.abs(offset);
  if (away >= NEAR_DEGREES) return 0;
  return NEAR_FILL * (1 - away / NEAR_DEGREES);
}
