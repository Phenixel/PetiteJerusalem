import { computed, getCurrentScope, onScopeDispose, shallowRef } from "vue";

/**
 * Le passage choisi dans un texte, et ce qu'on en fait.
 *
 * Sur un texte, le menu du système (copier, rechercher, partager, traduire)
 * n'est ni le nôtre ni celui de personne : il propose la traduction
 * automatique d'un verset et la recherche web d'un mot d'hébreu, et il
 * s'ouvre par-dessus tout ce qu'on poserait à côté. Les passages des lecteurs
 * coupent donc la sélection du système (classe `reading-pick`, voir main.css)
 * et se choisissent d'un appui : la bulle de commandes (ReadingSelectionMenu)
 * vient se poser dessus avec les trois gestes qui ont un sens devant un texte,
 * partager le passage, en lire la phonétique, signaler une erreur.
 *
 * Le choix se fait au passage, pas au mot : c'est la seule unité que les trois
 * commandes savent nommer. Un lien mène à un verset, pas à trois mots ; la
 * phonétique se calcule sur le texte tel qu'il se dit ; et un signalement qui
 * dit « Tehilim 23 · verset 4 » se retrouve, là où trois mots copiés se
 * cherchent.
 *
 * L'état vit dans le module, comme celui de la boussole ou du formulaire de
 * support : la bulle est posée une fois pour toutes dans App.vue, et deux
 * lecteurs de la même page (la lecture du jour en pose un par texte) ne
 * peuvent pas en ouvrir deux.
 */
export interface ReadingPassage {
  /**
   * Ce qui distingue le passage de tous les autres de la page : le fil s'en
   * sert pour le surligner, et un second appui dessus le relâche.
   */
  key: string;
  /** L'élément du passage : la bulle se pose contre lui et le suit. */
  el: HTMLElement;
  /** Le texte hébreu du passage, tel qu'il se lit aujourd'hui. */
  hebrew: string;
  /** Où le passage se trouve, en clair : « Tehilim 23 · verset 4 ». */
  place: string;
  /** L'adresse publique qui ramène à ce passage, et à lui seul. */
  url: string;
  /**
   * Le marque-page du passage : `null` là où le texte n'en prend pas (une
   * brakha, un office, un daf ne se reprennent pas à un verset).
   */
  bookmarked?: boolean | null;
  /** Pose ou retire le marque-page du passage. */
  toggleBookmark?: () => void;
}

/**
 * `shallowRef` : la valeur porte un élément du DOM, qu'un proxy réactif
 * abîmerait (Vue envelopperait ses propriétés une à une).
 */
export const readingPassage = shallowRef<ReadingPassage | null>(null);

/** La clé du passage choisi, pour que le fil sache lequel surligner. */
export const selectedPassageKey = computed(() => readingPassage.value?.key ?? null);

/** Un appui choisit le passage, un second appui dessus le relâche. */
export function selectPassage(passage: ReadingPassage): void {
  readingPassage.value = readingPassage.value?.key === passage.key ? null : passage;
}

/** Plus de passage choisi : on a touché ailleurs, ou quitté la page. */
export function clearPassage(): void {
  readingPassage.value = null;
}

/**
 * L'appui long, à installer là où des passages se lisent.
 *
 * Couper la sélection du système coupe aussi le geste qui l'ouvrait : sur un
 * téléphone, appuyer longuement sur un verset ne faisait plus rien du tout, ni
 * menu du système ni bulle, et le geste que tout le monde connaît devenait un
 * geste mort. Il est donc rendu : un appui long sur un passage ouvre la bulle,
 * comme un appui bref.
 *
 * Le geste est reconnu ici plutôt que sur chaque passage : les écouteurs sont
 * posés sur le document, une fois pour toute l'app (comptés à l'appel, retirés
 * avec le dernier lecteur monté), et ils ne regardent que ce qui porte
 * `reading-pick`. Le passage est ouvert par un clic envoyé sur lui, de sorte
 * que c'est son propre gestionnaire qui répond : le fil n'a rien à savoir du
 * geste qui l'a déclenché.
 */

/** Le temps au bout duquel un doigt posé devient un appui long. */
const LONG_PRESS_MS = 420;
/** Un doigt bouge toujours un peu ; au-delà, c'est un défilement. */
const MOVE_TOLERANCE = 12;
/**
 * Selon les navigateurs, relâcher après un appui long envoie un clic ou non.
 * Celui qui vient est le même geste : sans cette fenêtre, il refermerait
 * aussitôt la bulle que l'appui long vient d'ouvrir.
 */
const SAME_GESTURE_MS = 900;

let pressSubscribers = 0;
let pressTimer = 0;
let pressStart: { x: number; y: number; el: HTMLElement } | null = null;
let firedOn: HTMLElement | null = null;
let firedAt = 0;

function cancelPress(): void {
  if (pressTimer) clearTimeout(pressTimer);
  pressTimer = 0;
  pressStart = null;
}

function onTouchStart(event: TouchEvent): void {
  cancelPress();
  firedOn = null;
  const touch = event.touches[0];
  if (!touch || event.touches.length !== 1) return;
  const el =
    event.target instanceof Element ? event.target.closest<HTMLElement>(".reading-pick") : null;
  if (!el) return;
  pressStart = { x: touch.clientX, y: touch.clientY, el };
  pressTimer = window.setTimeout(() => {
    pressTimer = 0;
    const pressed = pressStart?.el;
    pressStart = null;
    if (!pressed) return;
    // Le clic est envoyé AVANT de marquer le geste : le garde ci-dessous
    // écoute à la capture, il avalerait sinon le clic qu'on vient d'envoyer.
    pressed.click();
    firedOn = pressed;
    firedAt = Date.now();
  }, LONG_PRESS_MS);
}

function onTouchMove(event: TouchEvent): void {
  const touch = event.touches[0];
  if (!pressStart || !touch) return;
  const moved = Math.hypot(touch.clientX - pressStart.x, touch.clientY - pressStart.y);
  if (moved > MOVE_TOLERANCE) cancelPress();
}

/** Le clic du relâchement est le même geste : il ne rejoue pas le choix. */
function onClickCapture(event: MouseEvent): void {
  if (!firedOn) return;
  const same = event.target instanceof Node && firedOn.contains(event.target);
  firedOn = Date.now() - firedAt > SAME_GESTURE_MS ? null : firedOn;
  if (!firedOn || !same) return;
  event.stopPropagation();
  event.preventDefault();
  firedOn = null;
}

function listenPress(): void {
  document.addEventListener("touchstart", onTouchStart, { passive: true });
  document.addEventListener("touchmove", onTouchMove, { passive: true });
  document.addEventListener("touchend", cancelPress, { passive: true });
  document.addEventListener("touchcancel", cancelPress, { passive: true });
  document.addEventListener("click", onClickCapture, true);
}

function unlistenPress(): void {
  cancelPress();
  firedOn = null;
  document.removeEventListener("touchstart", onTouchStart);
  document.removeEventListener("touchmove", onTouchMove);
  document.removeEventListener("touchend", cancelPress);
  document.removeEventListener("touchcancel", cancelPress);
  document.removeEventListener("click", onClickCapture, true);
}

/** À appeler dans `setup` d'une vue qui pose des passages. */
export function usePassageLongPress(): void {
  if (typeof document === "undefined") return;
  if (pressSubscribers++ === 0) listenPress();
  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (--pressSubscribers === 0) unlistenPress();
    });
  }
}
