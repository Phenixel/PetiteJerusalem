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
import { isNativeApp } from "./useNativeApp";

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
 *
 * Le geste se coupe. Deux appuis rapprochés sur un écran, cela arrive sans
 * qu'on l'ait voulu, et voir le texte se mettre à descendre tout seul pendant
 * qu'on lit n'a rien d'agréable quand on ne sait pas d'où cela vient. Les
 * réglages portent donc un interrupteur (voir composants settings) : coupé, ni
 * le double appui ni rien d'autre ne lance la descente. Il est gardé sur
 * l'appareil, et deux fois plutôt qu'une, comme la taille du texte : un
 * réglage posé pour ne PLUS être surpris ne doit pas revenir tout seul au
 * prochain lancement.
 */

export type AutoScrollSpeedId = "slow" | "medium" | "fast";

interface AutoScrollSpeed {
  id: AutoScrollSpeedId;
  /** Pixels parcourus par seconde : l'allure d'une lecture posée. */
  pixelsPerSecond: number;
}

/**
 * Les trois allures proposées, de la plus lente à la plus rapide.
 *
 * La plus lente a été relevée de 12 à 16 px/s, et c'est une affaire de
 * fluidité, pas de vitesse. Chromium (donc Android) refuse les positions de
 * défilement fractionnaires : une page ne peut bouger que d'un pixel entier à
 * la fois. À 12 px/s, elle avançait donc d'un pixel toutes les 83 ms, une
 * image sur cinq, et le texte sautait au lieu de glisser. À 16, le pas tombe à
 * 62 ms, une image sur quatre, sans que l'allure cesse d'être celle d'une
 * lecture posée (une ligne de texte passe en un peu plus d'une seconde et
 * demie).
 */
export const AUTO_SCROLL_SPEEDS: AutoScrollSpeed[] = [
  { id: "slow", pixelsPerSecond: 16 },
  { id: "medium", pixelsPerSecond: 26 },
  { id: "fast", pixelsPerSecond: 48 },
];

const STORAGE_KEY = "pj-autoscroll-speed";
/** Où l'appareil garde l'interrupteur du geste. */
const ENABLED_KEY = "pj-autoscroll-enabled";
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

/** L'interrupteur lu d'un stockage : « 1 » ou « 0 », rien d'autre. */
function parseEnabled(value: string | null): boolean | null {
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
}

function readStoredEnabled(): boolean | null {
  try {
    return parseEnabled(localStorage.getItem(ENABLED_KEY));
  } catch {
    return null; // Stockage indisponible (navigation privée).
  }
}

const storedEnabled = readStoredEnabled();
const enabled = ref(storedEnabled ?? true);

/** Le choix est-il déjà celui d'une personne ? Sinon, le natif a son mot à dire. */
let enabledRestored = storedEnabled !== null;

const running = ref(false);
const speedId = ref<AutoScrollSpeedId>(readStoredSpeed());

/** Position visée, en flottant : c'est elle qui est posée telle quelle (voir step). */
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
/** Le geste est-il proposé ? Les réglages le lisent et l'écrivent (voir setAutoScrollEnabled). */
export const autoScrollEnabled = readonly(enabled);

function measureMaxScroll(): number {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

/**
 * La limite du défilement, mesurée au départ puis quand la page change de
 * taille : la lire à chaque image forçait une mise en page par image, pendant
 * tout le défilement. Le ResizeObserver sur le corps suit le document qui
 * grandit (un texte qui finit de se charger), `resize` la fenêtre.
 */
let limit = 0;
let bodyObserver: ResizeObserver | null = null;

function remeasure(): void {
  limit = measureMaxScroll();
}

function watchPageSize(): void {
  remeasure();
  window.addEventListener("resize", remeasure, { passive: true });
  if (typeof ResizeObserver !== "undefined") {
    bodyObserver = new ResizeObserver(remeasure);
    bodyObserver.observe(document.body);
  }
}

function unwatchPageSize(): void {
  window.removeEventListener("resize", remeasure);
  bodyObserver?.disconnect();
  bodyObserver = null;
}

function step(now: number): void {
  if (!running.value) return;
  const elapsed = lastFrameAt ? now - lastFrameAt : 0;
  lastFrameAt = now;

  // La page a bougé sans nous (le lecteur a fait défiler à la main, un lien
  // a sauté ailleurs) : on repart d'où elle est, plutôt que de la ramener.
  if (Math.abs(window.scrollY - position) > 2) position = window.scrollY;

  position = Math.min(position + (currentSpeed.value.pixelsPerSecond * elapsed) / 1000, limit);
  // La position part telle quelle, fraction comprise : WebKit (donc l'app iOS)
  // défile en sous-multiples de pixel, et le mouvement y est continu. Chromium
  // arrondit, lui, et c'est pour lui que l'allure lente a été relevée (voir
  // AUTO_SCROLL_SPEEDS) : rien, du côté du script, ne peut lui faire avancer
  // une page de moins d'un pixel.
  window.scrollTo(0, position);

  // Fin du texte : le défilement s'arrête de lui-même, il n'y a plus rien à lire.
  if (position >= limit) {
    stopAutoScroll("bottom");
    return;
  }
  frame = requestAnimationFrame(step);
}

/** Lance le défilement (le double appui sur le texte, seule porte d'entrée). */
function startAutoScroll(): void {
  if (!enabled.value || running.value || typeof window === "undefined") return;
  // Rien à faire défiler (page courte, ou déjà tout en bas).
  if (window.scrollY >= measureMaxScroll() - 1) return;
  running.value = true;
  watchPageSize();
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
  unwatchPageSize();
  cancelAnimationFrame(frame);
  frame = 0;
  analyticsService.capture("auto_scroll_stopped", {
    reason,
    speed: speedId.value,
    duration_ms: Date.now() - startedAt,
  });
}

/**
 * Propose le geste, ou le retire. Le retirer arrête ce qui descend : le
 * réglage doit prendre effet sous les yeux, pas à la page suivante.
 *
 * Le choix est écrit deux fois, comme la taille du texte : dans le
 * `localStorage`, seul lisible en synchrone, donc avant le premier double
 * appui possible ; et dans les préférences natives, qui survivent au vidage du
 * cache de l'app (voir docs/app-native.md).
 */
export function setAutoScrollEnabled(value: boolean): void {
  enabledRestored = true;
  if (value === enabled.value) return;
  enabled.value = value;
  if (!value) stopAutoScroll("user");
  persistEnabled(value);
  analyticsService.capture("auto_scroll_enabled_changed", { enabled: value });
}

function persistEnabled(value: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, value ? "1" : "0");
  } catch {
    // Stockage indisponible : le réglage vaut pour la lecture en cours.
  }
  if (!isNativeApp) return;
  void import("@capacitor/preferences")
    .then(({ Preferences }) => Preferences.set({ key: ENABLED_KEY, value: value ? "1" : "0" }))
    .catch(() => {
      // Plugin absent (vieux binaire) : le localStorage fait seul, comme avant.
    });
}

/**
 * Reprend l'interrupteur gardé par le natif quand le localStorage n'a rien.
 * Appelé à l'ouverture d'un texte et à l'ouverture des réglages, jamais au
 * lancement : le plugin n'a pas à peser sur le démarrage de l'app.
 */
export async function restoreAutoScrollFromDevice(): Promise<void> {
  if (enabledRestored || !isNativeApp) return;
  enabledRestored = true;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const saved = parseEnabled((await Preferences.get({ key: ENABLED_KEY })).value);
    if (saved === null) return;
    enabled.value = saved;
    if (!saved) stopAutoScroll("user");
    // Remis en place pour le prochain lancement : la lecture synchrone
    // retrouvera le réglage sans attendre le plugin.
    persistEnabled(saved);
  } catch {
    // Plugin absent : rien à reprendre.
  }
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
 * Le suivi du geste vit dans le module, pas dans la vue : le temps d'une
 * transition de page, deux vues de lecture sont montées ensemble, et un double
 * appui compté par chacune se serait annulé lui-même (lancé, puis arrêté).
 * C'est le même doigt, il ne compte qu'une fois.
 */
let lastGestureAt = 0;
let lastTap = { time: 0, x: 0, y: 0 };

/**
 * À appeler dans les vues de lecture. `reading` dit quand un texte est
 * réellement ouvert : le geste ne vaut que là, et le défilement s'arrête dès
 * que la vue passe à autre chose (retour à la liste des chapitres, passage en
 * mode « gérer ma liste ») comme quand elle est quittée.
 */
export function useAutoScroll(reading: MaybeRefOrGetter<boolean> = true): void {
  void restoreAutoScrollFromDevice();
  let listening = false;

  function accept(): void {
    // Le geste a été coupé dans les réglages : on ne touche à rien, pas même
    // à la sélection du double clic.
    if (!enabled.value) return;
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
