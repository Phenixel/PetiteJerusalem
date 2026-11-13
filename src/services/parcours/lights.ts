/**
 * Les lumières de la série : plus la série monte, plus ce qui éclaire est
 * grand. On commence à la vieille lampe de terre cuite ; viennent la bougie,
 * la lanterne, la ménorah, le phare, la lune, le soleil, les étoiles, la
 * galaxie, la supernova, le quasar, et, au bout d'une année, la lumière du
 * premier jour (celle que le monde a reçue avant le soleil, gardée pour les
 * justes).
 *
 * - **Ce qu'on voit** suit la série en cours : la lumière du palier qu'elle
 *   a atteint (`lightOf`).
 * - **Ce qu'on a gagné** suit le record, et ne se perd pas : une série qui
 *   retombe laisse ses lumières dans « Mes lumières » (`earnedLights`).
 *   Rien ne se compte contre soi (docs/design.md).
 * - **Ce qui vient** reste dans l'ombre : on sait dans combien de jours,
 *   pas ce que c'est (`nextLight`).
 *
 * Fonctions pures, sans Vue : tenues par src/__tests__/parcoursLights.test.ts.
 */

export type LightId =
  | "lamp"
  | "candle"
  | "lantern"
  | "menorah"
  | "lighthouse"
  | "moon"
  | "sun"
  | "stars"
  | "galaxy"
  | "supernova"
  | "quasar"
  | "first-light";

export interface Light {
  id: LightId;
  /** Les jours d'affilée qui l'allument. */
  from: number;
}

/** Les paliers, du plus petit au plus grand : une semaine, un mois, une année. */
export const LIGHTS: readonly Light[] = [
  { id: "lamp", from: 0 },
  { id: "candle", from: 3 },
  { id: "lantern", from: 7 },
  { id: "menorah", from: 14 },
  { id: "lighthouse", from: 21 },
  { id: "moon", from: 30 },
  { id: "sun", from: 50 },
  { id: "stars", from: 75 },
  { id: "galaxy", from: 100 },
  { id: "supernova", from: 150 },
  { id: "quasar", from: 250 },
  { id: "first-light", from: 365 },
];

/** La lumière d'une série de `days` jours : le plus haut palier atteint. */
export function lightOf(days: number): Light {
  let found = LIGHTS[0];
  for (const light of LIGHTS) if (days >= light.from) found = light;
  return found;
}

/** La lumière suivante, encore dans l'ombre ; null tout en haut. */
export function nextLight(days: number): Light | null {
  return LIGHTS.find((light) => light.from > days) ?? null;
}

/** Les lumières gagnées par un record de `best` jours : elles restent. */
export function earnedLights(best: number): Light[] {
  return LIGHTS.filter((light) => light.from <= best);
}

/**
 * Le plus grand pas d'un record entre deux regards : un jour coché, ou
 * quelques jours comblés après coup depuis le mur.
 */
const MAX_STEP = 3;

/**
 * Les lumières que le record vient d'allumer depuis `seen`, le dernier record
 * qu'on a fêté : à fêter, une fois. Un record qui saute de plusieurs jours
 * d'un coup (le compte relu sur un nouvel appareil) n'en fête aucune : on
 * ne célèbre que ce qu'on vient de faire.
 */
export function lightsToCelebrate(seen: number, best: number): Light[] {
  if (best <= seen || best - seen > MAX_STEP) return [];
  return LIGHTS.filter((light) => light.from > seen && light.from <= best && light.from > 0);
}
