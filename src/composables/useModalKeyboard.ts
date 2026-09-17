import { onMounted, onUnmounted } from "vue";

/**
 * Le clavier logiciel et les fenêtres modales.
 *
 * Un clavier qui s'ouvre ne rétrécit pas la fenêtre : il se pose PAR-DESSUS.
 * Une fenêtre modale, elle, est `position: fixed` et couvre toute la hauteur
 * de la page (voir `.modal-overlay` dans main.css) : son cadre reste centré
 * sur une fenêtre dont la moitié basse est cachée, et le champ où l'on écrit
 * se retrouve sous le clavier. On tape sans voir ce qu'on écrit.
 *
 * Deux réponses, ensemble :
 *
 *  - La fenêtre modale prend la hauteur de ce qui reste VISIBLE
 *    (`visualViewport`), posée à son sommet : elle se recentre d'elle-même
 *    au-dessus du clavier, et le voile ne couvre plus que ce qu'on voit. Les
 *    deux mesures passent par des variables CSS, le style fait le reste.
 *  - Le champ qui prend le clavier est ramené dans la fenêtre, au moment où
 *    il le prend et à chaque fois que la fenêtre change de taille : le
 *    clavier met un instant à se poser, et la place disponible n'est connue
 *    qu'après.
 *
 * Le suivi ne tourne que pendant qu'on écrit dans une fenêtre modale : les
 * évènements du viewport visuel arrivent à chaque image d'un défilement
 * (la barre d'adresse qui se replie), et une variable CSS posée sur la racine
 * à cette cadence ferait recalculer le style de la page entière pour rien.
 */
const HEIGHT_VAR = "--modal-viewport-height";
const TOP_VAR = "--modal-viewport-top";

/** Le temps que le clavier finisse de se poser, avant de viser le champ. */
const SETTLE_MS = 300;

/**
 * Le champ où l'on écrit, quand c'est bien de cela qu'il s'agit : un champ de
 * saisie, dans une fenêtre modale. Un bouton ou une case à cocher n'ouvrent
 * pas de clavier, et un champ de page ordinaire est déjà dans le fil, que le
 * navigateur sait faire défiler tout seul.
 */
const FIELDS = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

function fieldInModal(node: unknown): HTMLElement | null {
  if (!(node instanceof HTMLElement)) return null;
  if (!node.closest(".modal-overlay")) return null;
  return node.matches(FIELDS) ? node : null;
}

let tracking = false;
let frame = 0;
/** Les dernières mesures posées, pour n'écrire que ce qui a changé. */
let lastHeight = 0;
let lastTop = -1;

/** Ramène le champ qui a le clavier dans la fenêtre, s'il y en a un. */
function revealFocused(): void {
  const field = fieldInModal(document.activeElement);
  // `scrollIntoView` manque à jsdom, et le champ peut avoir quitté la page.
  field?.scrollIntoView?.({ block: "center", behavior: "smooth" });
}

function apply(): void {
  frame = 0;
  const viewport = window.visualViewport;
  if (!viewport) return;
  const height = Math.round(viewport.height);
  const top = Math.round(viewport.offsetTop);
  if (height === lastHeight && top === lastTop) return;
  // La fenêtre rapetisse : c'est le clavier qui se pose, et le champ peut être
  // passé dessous. Le premier relevé ne compte pas, il n'a rien à comparer.
  const shrunk = lastHeight !== 0 && height < lastHeight;
  lastHeight = height;
  lastTop = top;
  const root = document.documentElement;
  root.style.setProperty(HEIGHT_VAR, `${height}px`);
  root.style.setProperty(TOP_VAR, `${top}px`);
  if (shrunk) revealFocused();
}

function schedule(): void {
  if (frame) return;
  frame = requestAnimationFrame(apply);
}

function startTracking(): void {
  if (tracking) return;
  tracking = true;
  window.visualViewport?.addEventListener("resize", schedule);
  window.visualViewport?.addEventListener("scroll", schedule);
  schedule();
}

/**
 * Fin de la saisie : les mesures sont retirées, et la fenêtre modale reprend
 * la hauteur de la page (les valeurs de repli du style). Sans ce retrait, une
 * fenêtre rouverte plus tard garderait la taille qu'avait le clavier.
 */
function stopTracking(): void {
  if (!tracking) return;
  tracking = false;
  window.visualViewport?.removeEventListener("resize", schedule);
  window.visualViewport?.removeEventListener("scroll", schedule);
  if (frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  lastHeight = 0;
  lastTop = -1;
  document.documentElement.style.removeProperty(HEIGHT_VAR);
  document.documentElement.style.removeProperty(TOP_VAR);
}

function onFocusIn(event: FocusEvent): void {
  if (!fieldInModal(event.target)) return;
  startTracking();
  window.setTimeout(revealFocused, SETTLE_MS);
}

/**
 * Le clavier se ferme, ou passe à autre chose. On attend avant de tout rendre :
 * d'un champ au suivant, le focus passe par un instant sans personne, et le
 * clavier ne se ferme pas entre les deux.
 */
function onFocusOut(): void {
  window.setTimeout(() => {
    if (!fieldInModal(document.activeElement)) stopTracking();
  }, SETTLE_MS);
}

/**
 * Posé une fois pour toute l'application (App.vue) : les fenêtres modales sont
 * écrites de plusieurs façons (AppModal, ou leur propre voile), et c'est la
 * classe `.modal-overlay` qu'elles ont toutes en commun.
 */
export function useModalKeyboard(): void {
  onMounted(() => {
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
  });
  onUnmounted(() => {
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
    stopTracking();
  });
}
