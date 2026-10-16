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
import { devicePreference } from "../services/devicePreference";

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
 * l'appareil, et deux fois plutôt qu'une (voir devicePreference) : un réglage
 * posé pour ne PLUS être surpris ne doit pas revenir tout seul au prochain
 * lancement.
 */

export type AutoScrollSpeedId = "slow" | "medium" | "fast" | "veryFast";

interface AutoScrollSpeed {
  id: AutoScrollSpeedId;
  /** Le cran du curseur où tombe cette allure (voir AUTO_SCROLL_MAX_LEVEL). */
  level: number;
  /** Pixels parcourus par seconde : l'allure d'une lecture posée. */
  pixelsPerSecond: number;
}

/**
 * Les allures nommées, de la plus lente à la plus rapide. Elles étaient les
 * seuls crans du curseur ; elles en sont devenues les repères (voir
 * AUTO_SCROLL_MAX_LEVEL), et leurs vitesses n'ont pas bougé : une allure
 * choisie avant le réglage fin se relit au pixel près. L'ordre du tableau se
 * lit du plus lent au plus rapide, et rien ne doit l'y ranger autrement.
 *
 * La quatrième a été ajoutée pour qui lit vite, et parce que trois crans font
 * un curseur trop court pour qu'on le prenne pour un curseur. Elle reste une
 * allure de lecture, pas un survol : une ligne y passe en un peu plus d'un
 * tiers de seconde.
 *
 * La plus lente a été relevée de 12 à 16 px/s, et c'est une affaire de
 * fluidité, pas de vitesse. Chromium (donc Android) refuse les positions de
 * défilement fractionnaires : une page ne peut bouger que d'un pixel entier à
 * la fois. À 12 px/s, elle avançait donc d'un pixel toutes les 83 ms, une
 * image sur cinq, et le texte sautait au lieu de glisser. À 16, le pas tombe à
 * 62 ms, une image sur quatre, sans que l'allure cesse d'être celle d'une
 * lecture posée (une ligne de texte passe en un peu plus d'une seconde et
 * demie). C'est aussi pourquoi le premier cran du réglage fin est cette
 * allure-là, et rien de plus lent.
 */
export const AUTO_SCROLL_SPEEDS: AutoScrollSpeed[] = [
  { id: "slow", level: 1, pixelsPerSecond: 16 },
  { id: "medium", level: 6, pixelsPerSecond: 26 },
  { id: "fast", level: 13, pixelsPerSecond: 48 },
  { id: "veryFast", level: 20, pixelsPerSecond: 72 },
];

/**
 * Le réglage fin : vingt crans, de 1 à 20, au lieu des quatre allures. Quatre
 * crans laissaient entre « moyen » et « rapide » un saut du simple au double,
 * trop grossier pour qui cherchait la sienne (retour d'un lecteur Android,
 * version 3.10.9).
 *
 * Les bouts restent ceux d'avant (16 et 72 px/s) et les quatre allures
 * nommées tombent chacune sur un cran. Entre deux repères, la vitesse croît
 * d'un même rapport à chaque cran plutôt que d'un même nombre de pixels :
 * l'oeil juge une allure en proportion, et deux pixels de plus se sentent à
 * 16 px/s, pas à 70. D'où des écarts serrés en bas de l'échelle, plus larges
 * en haut, et un cran qui change toujours quelque chose.
 */
export const AUTO_SCROLL_MIN_LEVEL = AUTO_SCROLL_SPEEDS[0].level;
export const AUTO_SCROLL_MAX_LEVEL = AUTO_SCROLL_SPEEDS[AUTO_SCROLL_SPEEDS.length - 1].level;

function clampLevel(level: number): number {
  return Math.min(AUTO_SCROLL_MAX_LEVEL, Math.max(AUTO_SCROLL_MIN_LEVEL, Math.round(level)));
}

/** Pixels par seconde d'un cran ; un cran hors de l'échelle est ramené à son bout. */
export function autoScrollPixelsPerSecond(level: number): number {
  const clamped = clampLevel(level);
  const index = AUTO_SCROLL_SPEEDS.findIndex((speed) => speed.level >= clamped);
  const upper = AUTO_SCROLL_SPEEDS[index];
  if (upper.level === clamped) return upper.pixelsPerSecond;
  const lower = AUTO_SCROLL_SPEEDS[index - 1];
  const share = (clamped - lower.level) / (upper.level - lower.level);
  const value = lower.pixelsPerSecond * (upper.pixelsPerSecond / lower.pixelsPerSecond) ** share;
  // Arrondi au dixième : rien ne se voit en deçà, et la valeur reste lisible.
  return Math.round(value * 10) / 10;
}

/** L'allure nommée la plus proche d'un cran : le seul réglage des anciennes versions. */
export function nearestAutoScrollSpeedId(level: number): AutoScrollSpeedId {
  const clamped = clampLevel(level);
  let nearest = AUTO_SCROLL_SPEEDS[0];
  for (const speed of AUTO_SCROLL_SPEEDS) {
    if (Math.abs(speed.level - clamped) < Math.abs(nearest.level - clamped)) nearest = speed;
  }
  return nearest.id;
}

/**
 * Deux clés sur l'appareil. `pj-autoscroll-level` porte le cran, et c'est elle
 * qu'on lit d'abord. `pj-autoscroll-speed` porte, comme avant, le nom d'une
 * allure : elle est relue quand la première manque, pour qui avait réglé son
 * allure avant le réglage fin, et elle continue d'être écrite (l'allure nommée
 * la plus proche) pour qu'une version plus ancienne de l'app, réinstallée sur
 * le même appareil, y trouve encore une valeur qu'elle connaît.
 */
const STORAGE_KEY = "pj-autoscroll-speed";
const LEVEL_STORAGE_KEY = "pj-autoscroll-level";
/** Où l'appareil garde l'interrupteur du geste. */
const ENABLED_KEY = "pj-autoscroll-enabled";
const DEFAULT_LEVEL = AUTO_SCROLL_MIN_LEVEL;

/** Un cran lu du stockage : un entier de l'échelle, ou rien. */
function parseLevel(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const level = Number(value);
  return level >= AUTO_SCROLL_MIN_LEVEL && level <= AUTO_SCROLL_MAX_LEVEL ? level : null;
}

function readStoredLevel(): number {
  try {
    const level = parseLevel(localStorage.getItem(LEVEL_STORAGE_KEY));
    if (level !== null) return level;
    // Une allure réglée avant les vingt crans : elle se relit à l'identique.
    const legacy = localStorage.getItem(STORAGE_KEY);
    return AUTO_SCROLL_SPEEDS.find((speed) => speed.id === legacy)?.level ?? DEFAULT_LEVEL;
  } catch {
    return DEFAULT_LEVEL;
  }
}

/** L'interrupteur lu d'un stockage : « 1 » ou « 0 », rien d'autre. */
function parseEnabled(value: string | null): boolean | null {
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
}

const enabledStore = devicePreference(ENABLED_KEY, parseEnabled, (value) => (value ? "1" : "0"));

const storedEnabled = enabledStore.read();
const enabled = ref(storedEnabled ?? true);

/** Le choix est-il déjà celui d'une personne ? Sinon, le natif a son mot à dire. */
let enabledRestored = storedEnabled !== null;

const running = ref(false);
const level = ref(readStoredLevel());

/** Position visée, en flottant : c'est elle qui est posée telle quelle (voir step). */
let position = 0;
/** Dernière position réellement posée : sert à reconnaître un saut venu d'ailleurs. */
let appliedPosition = 0;
let frame = 0;
let lastFrameAt = 0;
let startedAt = 0;
/** La page a bougé sans nous : la prochaine image active repart d'où elle est. */
let needsSync = false;

const currentPixelsPerSecond = computed(() => autoScrollPixelsPerSecond(level.value));
const speedId = computed(() => nearestAutoScrollSpeedId(level.value));

/** La pastille du bas et les pages lisent cet état ; elles ne l'écrivent pas directement. */
export const isAutoScrolling = readonly(running);
/** Le cran du curseur, de AUTO_SCROLL_MIN_LEVEL à AUTO_SCROLL_MAX_LEVEL. */
export const autoScrollLevel = readonly(level);
/** L'allure nommée la plus proche du cran : ce que lit le suivi d'audience. */
export const autoScrollSpeedId = speedId;
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

/**
 * La main du lecteur.
 *
 * Sur iPhone, ce n'est pas le script qui fait défiler la page mais le
 * défileur du système, sur son propre fil. Poser une position pendant qu'un
 * doigt glisse lui arrache la page ; il la reprend à l'image suivante, le
 * script la reprend à la sienne, et les deux se la disputent soixante fois
 * par seconde : c'est le défilement frénétique remonté, et c'est pire encore
 * quand on essaie de faire défiler pendant que la descente est lancée.
 *
 * Le même fil explique un deuxième à-coup, celui qu'on voit sans toucher à
 * rien : `window.scrollY`, lu depuis le fil principal, est en retard d'une
 * image ou deux sur la position réelle. L'ancien garde-fou resynchronisait
 * dès deux pixels d'écart, donc sur une valeur périmée, et ramenait la page
 * en arrière à chaque image un peu longue.
 *
 * D'où la règle : tant que la page est au lecteur, on ne pose rien du tout.
 * Elle lui est tant qu'un doigt la touche, puis le temps que l'élan du
 * glissement retombe (iOS continue de la faire défiler bien après que le
 * doigt soit parti), et pendant une salve de molette ou de clavier.
 */

/** Doigts posés sur l'écran. Un seul suffit pour que la page ne soit plus à nous. */
let fingers = 0;
/** On s'abstient au moins jusque-là (horodatage). */
let settleUntil = 0;
/** Puis on attend que la page soit immobile : l'élan d'iOS court encore. */
let waitForStill = false;
/** Sauf à ce que l'attente s'éternise : au-delà, on reprend la main. */
let stillDeadline = 0;
/** Position vue à l'image précédente, pour juger de l'immobilité. */
let lastSeenY = 0;

/** Le temps qu'iOS lance sa décélération : avant, la page peut sembler immobile à tort. */
const TOUCH_SETTLE_MS = 150;
/** Molette et clavier défilent par salves, avec leur propre inertie. */
const WHEEL_SETTLE_MS = 300;
/** En deçà, d'une image à l'autre, la page ne bouge plus. */
const STILL_PX = 0.5;
/** Plafond de l'attente d'un élan : rien ne décélère aussi longtemps. */
const MOMENTUM_CAP_MS = 2000;
/** Au-delà, la page a été déplacée par autre chose que nous (ancre, restauration). */
const EXTERNAL_JUMP_PX = 24;
/** Une image plus longue que ça est une image perdue : on ne lui compte pas sa distance. */
const MAX_FRAME_MS = 50;

/** Un geste de défilement vient d'avoir lieu : la page est au lecteur. */
function noteUserScroll(settleMs: number): void {
  const now = Date.now();
  settleUntil = Math.max(settleUntil, now + settleMs);
  waitForStill = true;
  stillDeadline = now + MOMENTUM_CAP_MS;
  lastSeenY = window.scrollY;
}

function onUserTouch(event: TouchEvent): void {
  fingers = event.touches.length;
  // Le dernier doigt part : l'élan, s'il y en a un, commence maintenant.
  if (fingers === 0) noteUserScroll(TOUCH_SETTLE_MS);
}

function onUserWheel(): void {
  noteUserScroll(WHEEL_SETTLE_MS);
}

/** Les touches qui font défiler une page ; les autres ne nous regardent pas. */
const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
  "Spacebar",
]);

function onUserKey(event: KeyboardEvent): void {
  // Une espace tapée dans un champ, ou qui appuie sur un bouton, ne fait rien
  // défiler : elle n'a pas à interrompre la descente (voir isInteractive).
  if (SCROLL_KEYS.has(event.key) && !isInteractive(event.target)) {
    noteUserScroll(WHEEL_SETTLE_MS);
  }
}

/** La page est-elle au lecteur ? */
function userHasControl(): boolean {
  if (fingers > 0) return true;
  const now = Date.now();
  if (now < settleUntil) return true;
  if (!waitForStill) return false;
  // L'élan d'iOS s'éteint de lui-même : on le laisse finir plutôt que de le
  // couper net, et on reprend dès que la page ne bouge plus.
  const y = window.scrollY;
  const moving = Math.abs(y - lastSeenY) > STILL_PX;
  lastSeenY = y;
  if (moving && now < stillDeadline) return true;
  waitForStill = false;
  return false;
}

function watchUserScroll(): void {
  fingers = 0;
  settleUntil = 0;
  waitForStill = false;
  window.addEventListener("touchstart", onUserTouch, { passive: true });
  window.addEventListener("touchmove", onUserTouch, { passive: true });
  window.addEventListener("touchend", onUserTouch, { passive: true });
  window.addEventListener("touchcancel", onUserTouch, { passive: true });
  window.addEventListener("wheel", onUserWheel, { passive: true });
  window.addEventListener("keydown", onUserKey, { passive: true });
}

function unwatchUserScroll(): void {
  window.removeEventListener("touchstart", onUserTouch);
  window.removeEventListener("touchmove", onUserTouch);
  window.removeEventListener("touchend", onUserTouch);
  window.removeEventListener("touchcancel", onUserTouch);
  window.removeEventListener("wheel", onUserWheel);
  window.removeEventListener("keydown", onUserKey);
}

function step(now: number): void {
  if (!running.value) return;
  // Programmée d'abord : la sortie anticipée ci-dessous ne doit pas éteindre
  // la boucle, elle passe son tour. `stopAutoScroll` annule celle-ci.
  frame = requestAnimationFrame(step);

  // La page est au lecteur (doigt posé, élan de son glissement, molette) : on
  // ne pose rien. Poser quoi que ce soit ici, c'est la lui arracher des mains
  // (voir plus haut), et le temps ne se compte pas non plus : ce qu'il a
  // parcouru n'est pas de la lecture en retard à rattraper.
  if (userHasControl()) {
    lastFrameAt = 0;
    needsSync = true;
    return;
  }

  // Reprise après un geste, ou saut venu d'ailleurs (lien d'ancre, position
  // restaurée) : on repart de la page telle qu'elle est, plutôt que de la
  // ramener. La limite est remesurée du même coup, le saut a pu suivre une
  // page qui a changé de taille.
  if (needsSync || Math.abs(window.scrollY - appliedPosition) > EXTERNAL_JUMP_PX) {
    needsSync = false;
    position = window.scrollY;
    remeasure();
  }

  // Une image perdue (mise en page longue, app revenue au premier plan) ne se
  // rattrape pas d'un bond : le texte sauterait de plusieurs lignes d'un coup.
  const elapsed = lastFrameAt ? Math.min(now - lastFrameAt, MAX_FRAME_MS) : 0;
  lastFrameAt = now;

  position = Math.min(position + (currentPixelsPerSecond.value * elapsed) / 1000, limit);
  // La position part telle quelle, fraction comprise : WebKit (donc l'app iOS)
  // défile en sous-multiples de pixel, et le mouvement y est continu. Chromium
  // arrondit, lui, et c'est pour lui que l'allure lente a été relevée (voir
  // AUTO_SCROLL_SPEEDS) : rien, du côté du script, ne peut lui faire avancer
  // une page de moins d'un pixel.
  //
  // L'abscisse est celle de la page, pas zéro : en hébreu, et sur une page
  // zoomée au pincement, la remettre à zéro à chaque image collait la page
  // contre un bord et se battait avec tout geste horizontal.
  window.scrollTo(window.scrollX, position);
  appliedPosition = position;

  // Fin du texte : le défilement s'arrête de lui-même, il n'y a plus rien à lire.
  if (position >= limit) stopAutoScroll("bottom");
}

/** Lance le défilement (le double appui sur le texte, seule porte d'entrée). */
function startAutoScroll(): void {
  if (!enabled.value || running.value || typeof window === "undefined") return;
  // Rien à faire défiler (page courte, ou déjà tout en bas).
  if (window.scrollY >= measureMaxScroll() - 1) return;
  running.value = true;
  watchPageSize();
  watchUserScroll();
  position = window.scrollY;
  appliedPosition = position;
  needsSync = false;
  lastFrameAt = 0;
  startedAt = Date.now();
  analyticsService.capture("auto_scroll_started", {
    speed: speedId.value,
    speed_level: level.value,
  });
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
  unwatchUserScroll();
  cancelAnimationFrame(frame);
  frame = 0;
  analyticsService.capture("auto_scroll_stopped", {
    reason,
    speed: speedId.value,
    speed_level: level.value,
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
  enabledStore.write(value);
  analyticsService.capture("auto_scroll_enabled_changed", { enabled: value });
}

/**
 * Reprend l'interrupteur gardé par le natif quand le localStorage n'a rien.
 * Appelé à l'ouverture d'un texte et à l'ouverture des réglages, jamais au
 * lancement : le plugin n'a pas à peser sur le démarrage de l'app.
 */
export async function restoreAutoScrollFromDevice(): Promise<void> {
  if (enabledRestored) return;
  enabledRestored = true;
  const saved = await enabledStore.restore();
  if (saved === null) return;
  enabled.value = saved;
  if (!saved) stopAutoScroll("user");
}

/**
 * Le suivi d'un changement d'allure attend que le pouce s'arrête : un curseur
 * poussé d'un bout à l'autre traverse vingt crans, et vingt événements n'en
 * diraient pas plus que le premier cran et le dernier.
 */
const SPEED_TRACK_DELAY_MS = 800;
let trackTimer: ReturnType<typeof setTimeout> | null = null;
let trackedFrom: number | null = null;

function trackSpeedChange(previous: number): void {
  if (trackedFrom === null) trackedFrom = previous;
  if (trackTimer) clearTimeout(trackTimer);
  trackTimer = setTimeout(() => {
    const from = trackedFrom ?? previous;
    trackTimer = null;
    trackedFrom = null;
    // Revenu où il était : rien n'a changé.
    if (from === level.value) return;
    analyticsService.capture("auto_scroll_speed_changed", {
      speed: speedId.value,
      previous_speed: nearestAutoScrollSpeedId(from),
      speed_level: level.value,
      previous_speed_level: from,
      running: running.value,
    });
  }, SPEED_TRACK_DELAY_MS);
}

/** Change de cran, défilement en cours ou non ; le choix est gardé sur l'appareil. */
export function setAutoScrollLevel(value: number): void {
  if (!Number.isFinite(value)) return;
  const next = clampLevel(value);
  if (next === level.value) return;
  const previous = level.value;
  level.value = next;
  try {
    localStorage.setItem(LEVEL_STORAGE_KEY, String(next));
    // L'ancienne clé suit, pour une version de l'app qui ne connaît qu'elle.
    localStorage.setItem(STORAGE_KEY, speedId.value);
  } catch {
    // Stockage indisponible : l'allure vaut pour la lecture en cours.
  }
  trackSpeedChange(previous);
}

/** Pose l'une des allures nommées, c'est-à-dire son cran ; un nom inconnu ne change rien. */
export function setAutoScrollSpeed(id: AutoScrollSpeedId): void {
  const speed = AUTO_SCROLL_SPEEDS.find((candidate) => candidate.id === id);
  if (speed) setAutoScrollLevel(speed.level);
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
