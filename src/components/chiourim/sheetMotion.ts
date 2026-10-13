/**
 * Le passage de la barre du lecteur au plein écran, et retour : la barre
 * s'agrandit jusqu'à couvrir l'écran, le plein écran se réduit jusqu'à
 * redevenir la barre (voir GlobalAudioPlayer et NowPlayingSheet). Les deux
 * ont la même teinte : il suffit de découper le plein écran au rectangle de
 * la barre (clip-path), puis de l'ouvrir en grand.
 *
 * Le mouvement répond au geste (docs/design.md) : un appui, un glissement. Il
 * disparaît quand l'appareil demande moins de mouvement. Pas en mode allégé
 * (`perf-lite`, voir useDevicePerf), qui coupe ce qui coûte en continu (le
 * mur de pierre, les flous) : celui-ci dure 0,4 s, au geste, et il dit d'où
 * vient le plein écran et où il repart. Or le mode allégé s'allume sur une
 * bonne part des téléphones Android (4 Go de mémoire déclarés suffisent) :
 * on leur retirerait le geste lui-même.
 */
import { shallowRef } from "vue";

export interface BarShape {
  top: number;
  right: number;
  bottom: number;
  left: number;
  radius: number;
}

/** La barre telle qu'elle était à l'ouverture : le plein écran en part, et y revient. */
export const barShape = shallowRef<BarShape | null>(null);

/** Mesure la barre avant d'ouvrir le plein écran. */
export function rememberBar(el: HTMLElement | null): void {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  barShape.value = {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    radius: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0,
  };
}

/** Le plein écran découpé à la forme de la barre ; à défaut, une bande en bas d'écran. */
export function barClip(): string {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const shape = barShape.value ?? {
    top: height - 72,
    right: width,
    bottom: height,
    left: 0,
    radius: 0,
  };
  const top = Math.max(0, shape.top);
  const right = Math.max(0, width - shape.right);
  const bottom = Math.max(0, height - shape.bottom);
  const left = Math.max(0, shape.left);
  return `inset(${top}px ${right}px ${bottom}px ${left}px round ${shape.radius}px)`;
}

/** Le plein écran entier, sous la même forme, pour que le navigateur interpole de l'un à l'autre. */
export const FULL_CLIP = "inset(0px 0px 0px 0px round 0px)";

/** La courbe des deux sens : un départ vif, une arrivée douce. */
export const SHEET_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

/** Vrai sauf quand l'appareil demande moins de mouvement (voir plus haut pour le mode allégé). */
export function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
