import { isNativeApp } from "../composables/useNativeApp";

/**
 * Les retours au toucher : le téléphone répond quand quelque chose se fait.
 *
 * - `done` : une tâche faite, un texte marqué lu, un objectif ajouté ; deux
 *   battements, le « succès » du système.
 * - `undo` : défaite, ou remise à plus tard ; un battement léger.
 * - `tick` : un seuil franchi pendant un geste (lâché, il agira ; la pile
 *   s'ouvrira ; le rond passe d'un repère à l'autre ; un bloc change de
 *   place) ; à peine.
 * - `press` : un appui long qui ouvre (la fiche d'une carte, le réglage de
 *   l'accueil) ; un battement franc.
 *
 * Dans l'app, le moteur du téléphone (@capacitor/haptics), qui suit le
 * réglage du système ; sur le site, la vibration du navigateur, là où elle
 * existe (Android) : l'iPhone ne la donne pas au web, le geste y reste muet.
 * Un retour qui échoue se tait : il n'empêche jamais ce qu'il accompagne.
 * Voir docs/design.md, « Touch answers ».
 */
export type HapticKind = "done" | "undo" | "tick" | "press";

/** Sur le site : des durées en millisecondes, et un silence entre deux battements. */
export const WEB_PATTERNS: Record<HapticKind, number | number[]> = {
  done: [12, 60, 24],
  undo: 14,
  tick: 6,
  press: 20,
};

/** Les seuils se franchissent vite : un battement au plus toutes les 60 ms. */
const TICK_GAP_MS = 60;
let lastTick = -Infinity;

async function nativeHaptic(kind: HapticKind): Promise<void> {
  // Le plugin se déstructure sur place, jamais rendu par une promesse
  // (docs/app-native.md, « A plugin never goes through a promise »).
  const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
  if (kind === "done") await Haptics.notification({ type: NotificationType.Success });
  else if (kind === "press") await Haptics.impact({ style: ImpactStyle.Medium });
  else await Haptics.impact({ style: ImpactStyle.Light });
}

export function haptic(kind: HapticKind): void {
  if (typeof window === "undefined") return;
  if (kind === "tick") {
    const now = performance.now();
    if (now - lastTick < TICK_GAP_MS) return;
    lastTick = now;
  }
  if (isNativeApp) {
    nativeHaptic(kind).catch(() => {
      // Le moteur ne répond pas (plugin absent d'une version, appareil sans) : rien.
    });
    return;
  }
  try {
    navigator.vibrate?.(WEB_PATTERNS[kind]);
  } catch {
    // Le navigateur refuse (pas encore de geste de l'utilisateur) : rien.
  }
}
