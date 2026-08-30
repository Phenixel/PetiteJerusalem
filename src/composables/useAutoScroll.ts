import {
  computed,
  onBeforeUnmount,
  onMounted,
  readonly,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import { analyticsService } from "../services/analyticsService";

/**
 * Défilement automatique des pages de texte.
 *
 * Lire un long passage demande de relancer le défilement tous les deux
 * versets, une main occupée en permanence. Un double appui sur le texte le
 * fait avancer tout seul, à une allure de lecture ; un second double appui
 * l'arrête, comme la pastille du bas (AutoScrollPill).
 *
 * Le geste n'existe que devant un texte ouvert : pas sur la liste des
 * chapitres d'un traité, pas pendant qu'on compose sa lecture du jour. Ces
 * écrans-là se parcourent, ils ne se lisent pas, et un double appui y
 * lancerait une descente que personne n'a demandée.
 *
 * L'état vit dans le module, pas dans la page : la pastille est posée une
 * fois pour toutes dans App.vue et ne se montre que pendant le défilement,
 * qui ne peut lui-même démarrer que là où `useAutoScroll` est actif.
 */

export type AutoScrollSpeedId = "slow" | "medium" | "fast";

export interface AutoScrollSpeed {
  id: AutoScrollSpeedId;
  /** Pixels parcourus par seconde : l'allure d'une lecture posée. */
  pixelsPerSecond: number;
}

/** Les trois allures proposées, de la plus lente à la plus rapide. */
export const AUTO_SCROLL_SPEEDS: AutoScrollSpeed[] = [
  { id: "slow", pixelsPerSecond: 12 },
  { id: "medium", pixelsPerSecond: 26 },
  { id: "fast", pixelsPerSecond: 48 },
];

const STORAGE_KEY = "pj-autoscroll-speed";
const DEFAULT_SPEED: AutoScrollSpeedId = "slow";

function readStoredSpeed(): AutoScrollSpeedId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return AUTO_SCROLL_SPEEDS.some((speed) => speed.id === stored)
      ? (stored as AutoScrollSpeedId)
      : DEFAULT_SPEED;
  } catch {
    return DEFAULT_SPEED;
  }
}

const running = ref(false);
const speedId = ref<AutoScrollSpeedId>(readStoredSpeed());

/** Position visée, en flottant : sous-multiples de pixel compris, sinon l'allure lente saccade. */
let position = 0;
let frame = 0;
let lastFrameAt = 0;
let startedAt = 0;

const currentSpeed = computed(
  () => AUTO_SCROLL_SPEEDS.find((speed) => speed.id === speedId.value) ?? AUTO_SCROLL_SPEEDS[0],
);

/** La pastille du bas et les pages lisent cet état ; elles ne l'écrivent pas directement. */
export const isAutoScrolling = readonly(running);
export const autoScrollSpeedId = readonly(speedId);

function maxScroll(): number {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

function step(now: number): void {
  if (!running.value) return;
  const elapsed = lastFrameAt ? now - lastFrameAt : 0;
  lastFrameAt = now;

  // La page a bougé sans nous (le lecteur a fait défiler à la main, un lien
  // a sauté ailleurs) : on repart d'où elle est, plutôt que de la ramener.
  if (Math.abs(window.scrollY - position) > 2) position = window.scrollY;

  const limit = maxScroll();
  position = Math.min(position + (currentSpeed.value.pixelsPerSecond * elapsed) / 1000, limit);
  // La position visée reste flottante (l'allure lente avance de moins d'un
  // pixel par image), mais la page se pose sur un pixel entier : un décalage
  // fractionnaire fait vibrer tout ce qui est en position fixe, la barre du
  // haut et la pastille du bas les premières.
  window.scrollTo(0, Math.round(position));

  // Fin du texte : le défilement s'arrête de lui-même, il n'y a plus rien à lire.
  if (position >= limit) {
    stopAutoScroll("bottom");
    return;
  }
  frame = requestAnimationFrame(step);
}

/** Lance le défilement (le double appui sur le texte, seule porte d'entrée). */
export function startAutoScroll(): void {
  if (running.value || typeof window === "undefined") return;
  // Rien à faire défiler (page courte, ou déjà tout en bas).
  if (window.scrollY >= maxScroll() - 1) return;
  running.value = true;
  position = window.scrollY;
  lastFrameAt = 0;
  startedAt = Date.now();
  analyticsService.capture("auto_scroll_started", { speed: speedId.value });
  frame = requestAnimationFrame(step);
}

/**
 * Arrête le défilement. `reason` sépare l'arrêt demandé de la fin du texte et
 * du départ de la page : c'est ce qui dira si l'allure proposée tient la
 * lecture ou si elle est toujours reprise en main.
 */
export function stopAutoScroll(reason: "user" | "bottom" | "leave"): void {
  if (!running.value) return;
  running.value = false;
  cancelAnimationFrame(frame);
  frame = 0;
  analyticsService.capture("auto_scroll_stopped", {
    reason,
    speed: speedId.value,
    duration_ms: Date.now() - startedAt,
  });
}

/** Change d'allure, défilement en cours ou non ; le choix est gardé sur l'appareil. */
export function setAutoScrollSpeed(id: AutoScrollSpeedId): void {
  if (!AUTO_SCROLL_SPEEDS.some((speed) => speed.id === id) || id === speedId.value) return;
  const previous = speedId.value;
  speedId.value = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Stockage indisponible : l'allure vaut pour la lecture en cours.
  }
  analyticsService.capture("auto_scroll_speed_changed", {
    speed: id,
    previous_speed: previous,
    running: running.value,
  });
}

/** Un double appui de plus arrête ce qu'un double appui a lancé. */
function toggleAutoScroll(): void {
  if (running.value) stopAutoScroll("user");
  else startAutoScroll();
}

/** Un double appui sur un bouton, un lien ou un champ ne lance rien. */
function isInteractive(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("a, button, input, select, textarea, [role='button'], [contenteditable]") !==
      null
  );
}

/** Le geste vient d'être pris en compte : les évènements qui suivent sont le même geste. */
const GESTURE_GAP_MS = 400;
/** Deux appuis rapprochés valent un double appui (les doigts ne visent pas au pixel). */
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_RADIUS = 40;

/**
 * À appeler dans les vues de lecture. `reading` dit quand un texte est
 * réellement ouvert : le geste ne vaut que là, et le défilement s'arrête dès
 * que la vue passe à autre chose (retour à la liste des chapitres, passage en
 * mode « gérer ma liste ») comme quand elle est quittée.
 */
export function useAutoScroll(reading: MaybeRefOrGetter<boolean> = true): void {
  let lastGestureAt = 0;
  let lastTap = { time: 0, x: 0, y: 0 };
  let listening = false;

  function accept(): void {
    const now = Date.now();
    // `dblclick` suit le double appui tactile sur la plupart des navigateurs :
    // sans ce garde-fou, le second geste annulerait aussitôt le premier.
    if (now - lastGestureAt < GESTURE_GAP_MS) return;
    lastGestureAt = now;
    // Le double clic a sélectionné un mot : il resterait surligné pendant
    // toute la descente.
    window.getSelection()?.removeAllRanges();
    toggleAutoScroll();
  }

  function onDoubleClick(event: MouseEvent) {
    if (isInteractive(event.target)) return;
    accept();
  }

  // Tactile : le double appui n'arrive pas partout jusqu'à `dblclick` (il vaut
  // zoom sur le web mobile), on le reconnaît donc nous-mêmes.
  function onTouchEnd(event: TouchEvent) {
    const touch = event.changedTouches[0];
    if (!touch || event.touches.length > 0 || isInteractive(event.target)) return;
    const now = Date.now();
    const isDouble =
      now - lastTap.time < DOUBLE_TAP_MS &&
      Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y) < DOUBLE_TAP_RADIUS;
    lastTap = { time: now, x: touch.clientX, y: touch.clientY };
    if (isDouble) {
      lastTap.time = 0; // Un triple appui ne vaut pas deux gestes.
      accept();
    }
  }

  function listen(): void {
    if (listening) return;
    listening = true;
    document.addEventListener("dblclick", onDoubleClick);
    document.addEventListener("touchend", onTouchEnd, { passive: true });
  }

  function unlisten(): void {
    if (!listening) return;
    listening = false;
    document.removeEventListener("dblclick", onDoubleClick);
    document.removeEventListener("touchend", onTouchEnd);
    // Le texte n'est plus à l'écran : ce qui descendait n'a plus de raison de
    // descendre, et la pastille s'en va avec.
    stopAutoScroll("leave");
  }

  onMounted(() => {
    if (toValue(reading)) listen();
  });

  watch(
    () => toValue(reading),
    (open) => (open ? listen() : unlisten()),
  );

  onBeforeUnmount(unlisten);
}
