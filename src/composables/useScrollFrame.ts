import { getCurrentScope, onScopeDispose, readonly, shallowRef, type Ref } from "vue";

/**
 * La géométrie du défilement, mesurée une fois par image pour toute l'app.
 *
 * Le bouton de remontée, le menu de lecture et la barre de progression
 * posaient chacun leur écouteur `scroll`, et le menu lisait `scrollHeight` à
 * chaque événement : une mesure forcée (reflow) par événement et par
 * composant, en plein défilement. Ici un seul écouteur passif, un seul
 * `requestAnimationFrame`, et une seule lecture de la hauteur du document,
 * faite dans l'image et non dans le gestionnaire.
 *
 * L'écouteur n'est posé que tant qu'un composant lit la mesure : compté à
 * l'appel, retiré quand le dernier abonné disparaît.
 */
export interface ScrollFrame {
  scrollY: number;
  /** Hauteur de la fenêtre. */
  viewport: number;
  /** Hauteur du document entier. */
  docHeight: number;
  /** Part parcourue du défilement possible, de 0 à 1. */
  progress: number;
  /** Tout en bas, à `BOTTOM_GAP` près : la fin de la page est sous les yeux. */
  atBottom: boolean;
}

/** Marge sous laquelle on se tient pour « tout en bas ». */
const BOTTOM_GAP = 24;

const frame = shallowRef<ScrollFrame>({
  scrollY: 0,
  viewport: 0,
  docHeight: 0,
  progress: 0,
  atBottom: false,
});

let subscribers = 0;
let raf = 0;

function measure(): void {
  raf = 0;
  const scrollY = window.scrollY;
  const viewport = window.innerHeight;
  const docHeight = document.documentElement.scrollHeight;
  const max = docHeight - viewport;
  frame.value = {
    scrollY,
    viewport,
    docHeight,
    progress: max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0,
    atBottom: scrollY + viewport >= docHeight - BOTTOM_GAP,
  };
}

function schedule(): void {
  if (!raf) raf = requestAnimationFrame(measure);
}

function attach(): void {
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  schedule();
}

function detach(): void {
  window.removeEventListener("scroll", schedule);
  window.removeEventListener("resize", schedule);
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

/**
 * La mesure courante, partagée. À appeler dans `setup` : l'abonnement suit
 * la vie du composant.
 */
export function useScrollFrame(): Readonly<Ref<ScrollFrame>> {
  if (typeof window !== "undefined") {
    if (subscribers++ === 0) attach();
    if (getCurrentScope()) {
      onScopeDispose(() => {
        if (--subscribers === 0) detach();
      });
    }
  }
  return readonly(frame) as Readonly<Ref<ScrollFrame>>;
}

/**
 * Redemande une mesure sans attendre un défilement : pour une page dont le
 * contenu vient de changer de hauteur (texte chargé, bloc replié).
 */
export function refreshScrollFrame(): void {
  if (subscribers > 0) schedule();
}
