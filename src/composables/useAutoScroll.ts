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
import { autoScrollRunning } from "./autoScrollState";
import { hasOpenOverlay } from "./useOverlayStack";

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
 * The slowest one was raised from 12 to 16 px/s, for smoothness, not speed.
 * Browsers refuse fractional scroll positions, Chromium (Android) as well as
 * WebKit (iOS): a page can only move by a whole pixel at a time. At 12 px/s,
 * it moved one pixel every 83 ms, one frame in five, and the text jumped
 * instead of gliding. At 16, the step falls to 62 ms, one frame in four,
 * while the pace remains that of a calm reading (a line of text goes by in a
 * little over a second and a half). It is also why the first notch of the
 * fine setting is this pace, and nothing slower.
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

const running = autoScrollRunning;
const level = ref(readStoredLevel());

/**
 * Distance due but not travelled yet, under a pixel: a page only moves by
 * whole pixels (see step), the rest waits for the next frame.
 */
let owed = 0;
/** Where the page stood after our last step: the reader's scrolls are told apart by it. */
let appliedPosition = 0;
let frame = 0;
let lastFrameAt = 0;
let startedAt = 0;

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
 * The reader's hand.
 *
 * On iPhone, it is not the script that scrolls the page but the system's
 * scroller (the UIScrollView of the web view), in another process. What
 * WebKit does with a script's scroll, read in its sources:
 *  - `scrollTo` sends an absolute position, computed in the page from a
 *    `scrollY` that lags behind the screen, and the web view applies it with
 *    `setContentOffset` WITHOUT stopping the finger's drag nor the momentum
 *    that follows it (WKWebView `_scrollToContentScrollPosition`, called
 *    with `interruptAnimation` off). Each frame, the page was thus brought
 *    back to where the script believed it was, then pushed on again by iOS:
 *    the back-and-forth reported as frantic scrolling;
 *  - `scrollY` is an integer (`roundedIntPoint` in WebPage), and so is a
 *    position set by `scrollTo` (`IntPoint` in LocalDOMWindow).
 *
 * Hence three rules.
 *
 * 1. As long as the page belongs to the reader, we set nothing at all. It
 *    is theirs as long as a finger touches it, then until the momentum of
 *    their swipe has died out, and during a burst of wheel or keyboard.
 *
 * 2. The end of the momentum is read from the `scroll` events, not from two
 *    frames that read the same `scrollY`. A fast swipe coasts for close to
 *    three seconds (the system loses 0.2 % of its speed per millisecond),
 *    and for the last of them the page moves less than a pixel per frame:
 *    the integer `scrollY` stays the same from one frame to the next while
 *    the page still slides. The old code took that for a page at rest (or
 *    gave up waiting after two seconds), took the page back, and the fight
 *    started again: only after fast swipes, never slow ones. The page is now
 *    handed back once no scroll has been seen for a while (SCROLL_QUIET_MS).
 *
 * 3. We move the page by a step (`scrollBy`), never to a position. WebKit
 *    sends a step as a delta (`ScrollRequestType::DeltaUpdate`), added in
 *    the web view to where the page really is: even sent while the system
 *    still moves the page, it never pulls it back. And no stale position is
 *    held against the page: a jump made elsewhere (an anchor, a restored
 *    position, the reader's own scrolling) is simply where the next step
 *    starts from.
 */

/** Fingers on the screen. One is enough for the page to no longer be ours. */
let fingers = 0;
/** We hold back at least until then (timestamp). */
let settleUntil = 0;
/** Then we wait for the page to be still: the iOS momentum is still running. */
let waitForStill = false;
/** Position seen on the previous frame, to judge whether the page is still. */
let lastSeenY = 0;
/**
 * The last scroll seen while the page belongs to the reader, or the moment
 * their finger left it (timestamp): the momentum is over once this is old
 * enough (SCROLL_QUIET_MS).
 */
let lastHeldScrollAt = 0;
/**
 * The last scroll the reader made (timestamp): while the auto-scroll is
 * stopped, every scroll; while it runs, a scroll that took the page away
 * from where we put it. The double tap waits for a still page by it (see
 * onGestureTouchStart), and our own scrolling must not count there.
 */
let lastUserScrollAt = 0;

/** Time for iOS to start its deceleration: before that, the page may wrongly seem still. */
const TOUCH_SETTLE_MS = 150;
/** Wheel and keyboard scroll in bursts, with their own inertia. */
const WHEEL_SETTLE_MS = 300;
/** Below this, from one frame to the next, the page no longer moves. */
const STILL_PX = 0.5;
/**
 * No scroll for this long: the momentum is over. iOS sends a `scroll` event
 * on every frame while the page coasts, so a quarter of a second without one
 * is a page at rest, not a page between two events.
 */
const SCROLL_QUIET_MS = 250;
/**
 * While the page is held, a scroll that leaves it this far from where we put
 * it was made by the reader. Closer than that, it may be the late `scroll`
 * event of our own last frame, or the lag of `scrollY` on iOS.
 */
const READER_MOVE_PX = 4;
/** A frame longer than this is a lost frame: its distance is not counted. */
const MAX_FRAME_MS = 50;

/** A scroll gesture just happened: the page belongs to the reader. */
function noteUserScroll(settleMs: number): void {
  const now = Date.now();
  settleUntil = Math.max(settleUntil, now + settleMs);
  waitForStill = true;
  lastHeldScrollAt = Math.max(lastHeldScrollAt, now);
  lastSeenY = window.scrollY;
}

/** Is the page held by the reader (finger, momentum, burst of wheel)? */
function readerHolds(): boolean {
  return fingers > 0 || waitForStill || Date.now() < settleUntil;
}

/** Every scroll of the page; the ones that are not ours are remembered. */
function onPageScroll(): void {
  const now = Date.now();
  if (!running.value) {
    lastUserScrollAt = now;
    return;
  }
  // Running and not held: the scroll is ours.
  if (!readerHolds()) return;
  lastHeldScrollAt = now;
  if (Math.abs(window.scrollY - appliedPosition) > READER_MOVE_PX) lastUserScrollAt = now;
}

function onUserTouch(event: TouchEvent): void {
  fingers = event.touches.length;
  // The last finger leaves: the momentum, if any, starts now.
  if (fingers === 0) noteUserScroll(TOUCH_SETTLE_MS);
}

function onUserWheel(): void {
  noteUserScroll(WHEEL_SETTLE_MS);
}

/** The keys that scroll a page; the others are none of our business. */
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
  // A space typed in a field, or pressing a button, scrolls nothing: it has
  // no reason to interrupt the scrolling (see isInteractive).
  if (SCROLL_KEYS.has(event.key) && !isInteractive(event.target)) {
    noteUserScroll(WHEEL_SETTLE_MS);
  }
}

/** Does the page belong to the reader? */
function userHasControl(): boolean {
  if (fingers > 0) return true;
  const now = Date.now();
  if (now < settleUntil) return true;
  if (!waitForStill) return false;
  // The iOS momentum dies out by itself: we let it finish rather than cut it
  // short, and take over once the page has stopped moving. Both signs count:
  // a recent scroll event, or a position that changed since the last frame.
  const y = window.scrollY;
  const moving = Math.abs(y - lastSeenY) > STILL_PX;
  lastSeenY = y;
  if (moving || now - lastHeldScrollAt < SCROLL_QUIET_MS) return true;
  waitForStill = false;
  return false;
}

/**
 * The touch listeners are set at capture: a component that stops a touch
 * from bubbling must not hide from us a finger that took the page.
 */
const WATCH = { passive: true, capture: true } as const;

function watchUserScroll(): void {
  fingers = 0;
  settleUntil = 0;
  waitForStill = false;
  window.addEventListener("touchstart", onUserTouch, WATCH);
  window.addEventListener("touchmove", onUserTouch, WATCH);
  window.addEventListener("touchend", onUserTouch, WATCH);
  window.addEventListener("touchcancel", onUserTouch, WATCH);
  window.addEventListener("wheel", onUserWheel, { passive: true });
  window.addEventListener("keydown", onUserKey, { passive: true });
}

function unwatchUserScroll(): void {
  window.removeEventListener("touchstart", onUserTouch, WATCH);
  window.removeEventListener("touchmove", onUserTouch, WATCH);
  window.removeEventListener("touchend", onUserTouch, WATCH);
  window.removeEventListener("touchcancel", onUserTouch, WATCH);
  window.removeEventListener("wheel", onUserWheel);
  window.removeEventListener("keydown", onUserKey);
}

function step(now: number): void {
  if (!running.value) return;
  // Scheduled first: the early return below must not end the loop, it skips
  // its turn. `stopAutoScroll` cancels this one.
  frame = requestAnimationFrame(step);

  // The page belongs to the reader (finger down, momentum of their swipe,
  // wheel): we set nothing. Setting anything here is snatching it from
  // their hands (see above), and the time does not count either: what they
  // scrolled is not reading late to be caught up.
  if (userHasControl()) {
    lastFrameAt = 0;
    owed = 0;
    return;
  }

  // A lost frame (long layout, app back in the foreground) is not caught up
  // in one leap: the text would jump several lines at once.
  const elapsed = lastFrameAt ? Math.min(now - lastFrameAt, MAX_FRAME_MS) : 0;
  lastFrameAt = now;

  // Whole pixels only: Chromium and WebKit both refuse fractional scroll
  // positions, and a step of a fraction would be lost. The fraction is kept
  // for the next frame, so that the pace stays exact; it is also why the
  // slowest pace was raised (see AUTO_SCROLL_SPEEDS). Vertical only: the
  // horizontal scroll stays where it is (Hebrew, a page zoomed by pinching).
  owed += (currentPixelsPerSecond.value * elapsed) / 1000;
  const pixels = Math.floor(owed);
  const before = window.scrollY;
  if (pixels >= 1) {
    owed -= pixels;
    window.scrollBy({ top: pixels, behavior: "instant" });
  }
  const after = window.scrollY;
  appliedPosition = after;

  // End of the text: the scrolling stops by itself, there is nothing left
  // to read. A step that moved nothing measures the page again: it may have
  // changed size without us seeing it, or end on a fraction of a pixel that
  // the page cannot reach.
  if (after >= limit) {
    stopAutoScroll("bottom");
  } else if (pixels >= 1 && after === before) {
    remeasure();
    if (after >= limit - 1) stopAutoScroll("bottom");
  }
}

/** Lance le défilement (le double appui sur le texte, seule porte d'entrée). */
function startAutoScroll(): void {
  if (!enabled.value || running.value || typeof window === "undefined") return;
  // Rien à faire défiler (page courte, ou déjà tout en bas).
  if (window.scrollY >= measureMaxScroll() - 1) return;
  running.value = true;
  watchPageSize();
  watchUserScroll();
  owed = 0;
  appliedPosition = window.scrollY;
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

/**
 * A double tap on a button, a link or a field starts nothing; nor on a
 * control that owns its gestures (`data-own-gestures`), such as the progress
 * bar, where two touches in a row are two slides, not a request to scroll;
 * nor anywhere while a window is open over the text: a double tap on a
 * parchment's photo zooms into it, it does not scroll the text behind.
 */
function isInteractive(target: EventTarget | null): boolean {
  if (hasOpenOverlay()) return true;
  return (
    target instanceof Element &&
    target.closest(
      "a, button, input, select, textarea, [role='button'], [contenteditable], [data-own-gestures]",
    ) !== null
  );
}

/** The gesture has just been taken into account: the events that follow are the same gesture. */
const GESTURE_GAP_MS = 400;
/** Two taps close together make a double tap (fingers do not aim to the pixel). */
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_RADIUS = 40;
/**
 * What makes a touch a tap rather than the start of a scroll: a finger that
 * barely moves (a finger is never perfectly still) and is lifted quickly (a
 * long press opens the passage, see useReadingSelection).
 */
const TAP_SLOP_PX = 12;
const TAP_MAX_MS = 300;
/**
 * The page must have been still for this long before the first tap: the
 * touch that stops a coasting page is a brake, not a tap.
 */
const STILL_BEFORE_TAP_MS = 300;
/**
 * A touch this recent means the `dblclick` comes from the finger: the touch
 * listeners have already judged it, with their stricter rules.
 */
const TOUCH_CLICK_MS = 1000;
/** The `dblclick` of a double tap follows its second touch by a few milliseconds. */
const TOUCH_DOUBLE_CLICK_MS = 500;

/**
 * The tracking of the gesture lives in the module, not in the view: during a
 * page transition, two reading views are mounted together, and a double tap
 * counted by each would have cancelled itself (started, then stopped). It is
 * the same finger, it only counts once; the listeners are therefore set once
 * for the whole app, while at least one reading view wants them.
 */
let gestureViews = 0;
let lastGestureAt = 0;
let lastTouchEndAt = 0;
/** When the touch listeners last saw two real taps (timestamp). */
let lastTouchDoubleAt = 0;

/** The finger on the screen, as long as it may still be a tap. */
let touchTrack: { start: number; x: number; y: number; moved: boolean; still: boolean } | null =
  null;
/** The last tap, waiting for its second one. */
let lastTap: { start: number; time: number; x: number; y: number } | null = null;

function accept(): void {
  // The gesture was turned off in the settings: we touch nothing, not even
  // the selection of the double click.
  if (!enabled.value) return;
  const now = Date.now();
  // A double tap may also reach `dblclick`: without this guard, the second
  // event would cancel the first one at once.
  if (now - lastGestureAt < GESTURE_GAP_MS) return;
  lastGestureAt = now;
  // The double click selected a word: it would stay highlighted throughout
  // the scrolling.
  window.getSelection()?.removeAllRanges();
  toggleAutoScroll();
}

/**
 * The double click. The one that follows a double tap on a phone (most
 * browsers send it) only counts if the touch listeners saw two real taps
 * (see onGestureTouchEnd): the browser is more lenient, and two quick swipes
 * must not get through by this door. It still has its use: the first tap of
 * a double tap on a verse opens the passage's sheet, and the second one,
 * judged while the sheet is open, is refused by isInteractive; the
 * `dblclick` comes after the second click has closed the sheet again. A
 * mouse's double click, for its part, waits for a page that the wheel no
 * longer moves.
 */
function onDoubleClick(event: MouseEvent): void {
  if (isInteractive(event.target)) return;
  const now = Date.now();
  if (now - lastTouchEndAt < TOUCH_CLICK_MS) {
    if (now - lastTouchDoubleAt > TOUCH_DOUBLE_CLICK_MS) return;
  } else if (now - lastUserScrollAt < STILL_BEFORE_TAP_MS + DOUBLE_TAP_MS) {
    return;
  }
  accept();
}

/**
 * Touch: the double tap does not reach `dblclick` everywhere (it means zoom
 * on the mobile web), so we recognize it ourselves.
 *
 * It used to be enough for two fingers to be lifted close together, in time
 * and space. That is also what two quick swipes in a row look like: people
 * scrolling a little fast started the auto-scroll without wanting to. A
 * double tap is now two real taps on a still page:
 *  - each touch is a tap: the finger barely moved and was lifted quickly, so
 *    a swipe, however short, is never one;
 *  - the page was still before the first tap and did not move until the
 *    second: the touch that catches a coasting page is not a tap, and
 *    neither is the one that follows it too closely.
 * While the auto-scroll runs, only the reader's own scrolling counts (see
 * onPageScroll): the page moving by itself does not prevent stopping it.
 */
function onGestureTouchStart(event: TouchEvent): void {
  const touch = event.touches[0];
  // A second finger: a pinch, not a tap. The first tap does not survive it.
  if (!touch || event.touches.length !== 1) {
    touchTrack = null;
    lastTap = null;
    return;
  }
  const now = Date.now();
  touchTrack = {
    start: now,
    x: touch.clientX,
    y: touch.clientY,
    moved: false,
    still: now - lastUserScrollAt >= STILL_BEFORE_TAP_MS,
  };
}

function onGestureTouchMove(event: TouchEvent): void {
  const touch = event.touches[0];
  if (!touchTrack || !touch) return;
  if (Math.hypot(touch.clientX - touchTrack.x, touch.clientY - touchTrack.y) > TAP_SLOP_PX) {
    touchTrack.moved = true;
  }
}

function onGestureTouchEnd(event: TouchEvent): void {
  const now = Date.now();
  lastTouchEndAt = now;
  const track = touchTrack;
  const touch = event.changedTouches[0];
  if (event.touches.length > 0) return;
  touchTrack = null;
  if (!track || !touch) return;
  const isTap =
    !track.moved &&
    track.still &&
    now - track.start <= TAP_MAX_MS &&
    Math.hypot(touch.clientX - track.x, touch.clientY - track.y) <= TAP_SLOP_PX;
  if (!isTap) {
    lastTap = null;
    return;
  }
  const first = lastTap;
  const isDouble =
    first !== null &&
    now - first.time < DOUBLE_TAP_MS &&
    Math.hypot(touch.clientX - first.x, touch.clientY - first.y) < DOUBLE_TAP_RADIUS &&
    // Nothing scrolled the page between the two taps.
    lastUserScrollAt < first.start;
  if (isDouble) {
    lastTap = null; // A triple tap is not two gestures.
    lastTouchDoubleAt = now;
    if (!isInteractive(event.target)) accept();
  } else {
    lastTap = { start: track.start, time: now, x: touch.clientX, y: touch.clientY };
  }
}

/** A touch taken back by the system (a pinch, a system gesture) was not a tap. */
function onGestureTouchCancel(): void {
  touchTrack = null;
  lastTap = null;
}

const GESTURE_TOUCH = { passive: true, capture: true } as const;

function retainGesture(): void {
  if (gestureViews++ > 0) return;
  touchTrack = null;
  lastTap = null;
  document.addEventListener("dblclick", onDoubleClick);
  document.addEventListener("touchstart", onGestureTouchStart, GESTURE_TOUCH);
  document.addEventListener("touchmove", onGestureTouchMove, GESTURE_TOUCH);
  document.addEventListener("touchend", onGestureTouchEnd, GESTURE_TOUCH);
  document.addEventListener("touchcancel", onGestureTouchCancel, GESTURE_TOUCH);
  // The page's scrolls: the double tap waits for a still page, and the
  // auto-scroll for the end of the reader's momentum (see onPageScroll).
  window.addEventListener("scroll", onPageScroll, { passive: true });
}

function releaseGesture(): void {
  if (gestureViews === 0 || --gestureViews > 0) return;
  touchTrack = null;
  lastTap = null;
  document.removeEventListener("dblclick", onDoubleClick);
  document.removeEventListener("touchstart", onGestureTouchStart, GESTURE_TOUCH);
  document.removeEventListener("touchmove", onGestureTouchMove, GESTURE_TOUCH);
  document.removeEventListener("touchend", onGestureTouchEnd, GESTURE_TOUCH);
  document.removeEventListener("touchcancel", onGestureTouchCancel, GESTURE_TOUCH);
  window.removeEventListener("scroll", onPageScroll);
}

/**
 * To be called in the reading views. `reading` says when a text is really
 * open: the gesture only applies there, and the scrolling stops as soon as
 * the view moves on to something else (back to the list of chapters,
 * switching to "manage my list" mode) as when it is left.
 */
export function useAutoScroll(reading: MaybeRefOrGetter<boolean> = true): void {
  void restoreAutoScrollFromDevice();
  let listening = false;

  function listen(): void {
    if (listening) return;
    listening = true;
    retainGesture();
  }

  function unlisten(): void {
    if (!listening) return;
    listening = false;
    releaseGesture();
    // The text is no longer on screen: what was scrolling has no reason to
    // keep scrolling, and the pill goes away with it.
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
