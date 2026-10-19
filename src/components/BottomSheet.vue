<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { bottomSheetSlot } from "../composables/useBottomChrome";

/**
 * The bottom sheet of the phone: a panel that rises from the bottom of the
 * screen, over the tab bar, with its handle.
 *
 * It is the form a phone gives to what accompanies a screen without leaving
 * it (a passage's commands, its commentaries): you pull it by the handle to
 * enlarge it, push it down to close it, and a decisive downward gesture
 * closes it at once. It does not veil the page: you read and touch the text
 * above.
 *
 * `snaps` gives its detents, as a share of the screen height (0.55: half
 * height); without detents, it takes the height of its content and is only
 * pulled down. The handle and the header (`header` slot) carry the gesture;
 * the body scrolls.
 *
 * `docked` places it elsewhere, with no handle and no gesture: the caller
 * says where (the study panel makes it a column on a wide screen).
 *
 * A sheet at the height of its content (a passage's commands) can be pulled
 * from anywhere, not only by its handle: the gesture only starts beyond a few
 * pixels, so a tap stays a tap on a button. When `expandable`, pulling it up
 * opens what follows (`expand`): the passage's commentaries, without having
 * to aim at their button. An area that scrolls by itself (the phonetics of a
 * long passage) is marked `data-sheet-nodrag`.
 *
 * It moves like a system sheet: the caller wraps it in
 * `<Transition name="bottom-sheet">`, and it slides up from below the screen
 * when it opens and back down when it closes. Pushed below its lowest
 * resting height, it is translated (a compositor move, no layout) rather
 * than shrunk, so it follows the finger and, released low enough, keeps
 * going down from where it was let go.
 */
const props = withDefaults(
  defineProps<{
    /** Le nom du volet, pour qui ne voit pas l'écran. */
    label: string;
    /** Les crans, croissants, en part de la hauteur de l'écran. */
    snaps?: number[];
    /** Le cran d'ouverture. */
    initialSnap?: number;
    /** Posé ailleurs qu'au bas de l'écran : ni poignée, ni geste, ni crans. */
    docked?: boolean;
    /** Tiré vers le haut, le volet s'ouvre sur la suite (`expand`). */
    expandable?: boolean;
  }>(),
  { snaps: () => [], initialSnap: 0, docked: false, expandable: false },
);

const emit = defineEmits<{ (e: "close"): void; (e: "expand"): void }>();

const sheet = ref<HTMLElement | null>(null);
const snapIndex = ref(Math.min(props.initialSnap, Math.max(0, props.snaps.length - 1)));
/** Pendant le geste, la hauteur suit le doigt ; null le reste du temps. */
const dragHeight = ref<number | null>(null);
/** How far the sheet is pushed below its lowest resting height, in px. */
const dragOffset = ref(0);
/** Under the finger: no easing, the sheet follows. */
const dragging = ref(false);

const height = computed(() => {
  if (props.docked) return undefined;
  if (dragHeight.value !== null) return `${dragHeight.value}px`;
  const snap = props.snaps[snapIndex.value];
  return snap ? `${snap * 100}dvh` : undefined;
});

/** Un geste plus rapide que cela (px/ms) décide seul, quelle que soit la hauteur. */
const FLICK = 0.6;

let start: {
  y: number;
  height: number;
  floor: number;
  pointer: number;
  active: boolean;
} | null = null;
let last = { y: 0, t: 0, vy: 0 };
/** Where the finger would put the top of the sheet: the height it asks for. */
let reach = 0;

/** Un doigt bouge toujours un peu : en deçà, c'est un appui, pas un geste. */
const SLOP = 6;
/** Tiré de tant au-dessus de sa hauteur, le volet s'ouvre sur la suite. */
const EXPAND_PULL = 48;

/** Le clic qui suit un geste n'est pas un appui sur le bouton où il a fini. */
function swallowNextClick(): void {
  const swallow = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 400);
}

function onPointerDown(event: PointerEvent): void {
  if (props.docked || event.button > 0 || !sheet.value) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest("[data-sheet-nodrag]")) return;
  // Un volet à crans défile : seuls sa poignée et son en-tête se tirent, et
  // leurs boutons (la croix) gardent leur appui.
  if (props.snaps.length && (!target?.closest(".sheet-grip") || target.closest("button"))) {
    return;
  }
  const height = sheet.value.getBoundingClientRect().height;
  start = {
    y: event.clientY,
    height,
    // Below this height, the sheet slides down instead of shrinking: its
    // first detent, or its own height when it fits its content.
    floor: props.snaps.length ? Math.min(height, props.snaps[0] * window.innerHeight) : height,
    pointer: event.pointerId,
    active: false,
  };
  last = { y: event.clientY, t: event.timeStamp, vy: 0 };
}

function onPointerMove(event: PointerEvent): void {
  if (!start || event.pointerId !== start.pointer) return;
  if (!start.active) {
    if (Math.abs(event.clientY - start.y) < SLOP) return;
    start.active = true;
    dragging.value = true;
    sheet.value?.setPointerCapture?.(event.pointerId);
  }
  const vh = window.innerHeight;
  const max = props.snaps.length
    ? Math.max(...props.snaps) * vh
    : start.height + (props.expandable ? vh * 0.3 : 0);
  reach = Math.min(max, Math.max(0, start.height - (event.clientY - start.y)));
  dragHeight.value = Math.max(reach, start.floor);
  dragOffset.value = Math.max(0, start.floor - reach);
  const dt = event.timeStamp - last.t;
  if (dt > 0) last = { y: event.clientY, t: event.timeStamp, vy: (event.clientY - last.y) / dt };
}

/** Back to rest: the height of the detent, no offset, eased by the CSS. */
function settle(): void {
  dragging.value = false;
  dragHeight.value = null;
  dragOffset.value = 0;
}

function onPointerUp(event: PointerEvent): void {
  if (!start || event.pointerId !== start.pointer) return;
  const moved = reach;
  const startHeight = start.height;
  const active = start.active;
  start = null;
  // A tap, not a gesture: the button touched answers as usual.
  if (!active) {
    settle();
    return;
  }
  swallowNextClick();
  // Tiré vers le haut : la suite (les commentaires du passage).
  if (
    props.expandable &&
    !props.snaps.length &&
    (moved > startHeight + EXPAND_PULL || (last.vy < -FLICK && moved > startHeight + SLOP))
  ) {
    settle();
    emit("expand");
    return;
  }
  const vh = window.innerHeight;
  const heights = props.snaps.length ? props.snaps.map((s) => s * vh) : [startHeight];
  const lowest = heights[0];
  const flickDown = last.vy > FLICK && moved < startHeight;
  // Closed: pushed below two thirds of the first detent, or by a decisive
  // downward gesture from the first detent. Higher up, the same gesture
  // brings it down one detent: a Tossafot read in full screen is lowered
  // without being lost.
  if (moved < lowest * 0.66 || (flickDown && snapIndex.value === 0)) {
    // The height and the offset stay as they are: the leave transition
    // carries the sheet down from where the finger let it go. It is told
    // once the sheet has dropped `sheet-dragging`: removed with it, the
    // sheet would have no transition and would vanish at once.
    dragging.value = false;
    void nextTick(() => emit("close"));
    return;
  }
  settle();
  if (!props.snaps.length) return;
  if (flickDown) snapIndex.value = Math.max(0, snapIndex.value - 1);
  else if (last.vy < -FLICK) snapIndex.value = Math.min(heights.length - 1, snapIndex.value + 1);
  else {
    let nearest = 0;
    heights.forEach((h, i) => {
      if (Math.abs(h - moved) < Math.abs(heights[nearest] - moved)) nearest = i;
    });
    snapIndex.value = nearest;
  }
}

/**
 * La hauteur du volet, annoncée à ce qui flotte au bas de l'écran (la pastille
 * du défilement automatique, les toasts, voir useBottomChromeHeight) pour
 * qu'il passe au-dessus de lui. Un volet posé ailleurs (`docked`) n'en a pas.
 */
const announce = bottomSheetSlot();
let sizes: ResizeObserver | null = null;
function publish(): void {
  announce(props.docked ? null : (sheet.value?.getBoundingClientRect().height ?? null));
}
onMounted(() => {
  publish();
  if (typeof ResizeObserver !== "undefined" && sheet.value) {
    sizes = new ResizeObserver(publish);
    sizes.observe(sheet.value);
  }
});
watch(() => props.docked, publish);

onBeforeUnmount(() => {
  start = null;
  sizes?.disconnect();
  announce(null);
});
</script>

<template>
  <section
    ref="sheet"
    class="bottom-sheet"
    :class="{
      'sheet-dragging': dragging,
      'sheet-pushed': dragOffset > 0,
      'sheet-fit': !snaps.length && !docked,
      'sheet-docked': docked,
    }"
    role="dialog"
    aria-modal="false"
    :aria-label="label"
    :style="{ height, '--sheet-offset': dragOffset ? `${dragOffset}px` : undefined }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div class="sheet-grip">
      <span v-if="!docked" class="sheet-handle" aria-hidden="true"></span>
      <slot name="header" />
    </div>
    <div class="sheet-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
/* Au-dessus de la barre d'onglets (z-50), sous les fenêtres modales (60) :
   le partage d'un passage s'ouvre par-dessus son volet. */
.bottom-sheet {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 55;
  display: flex;
  max-height: 92dvh;
  flex-direction: column;
  padding-bottom: var(--safe-bottom, 0px);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-pop);
  /* The curve of the system sheets (see sheetMotion.ts): a quick start, a
     soft landing. */
  transition:
    height 0.36s cubic-bezier(0.32, 0.72, 0, 1),
    transform 0.36s cubic-bezier(0.32, 0.72, 0, 1);
}

/* Pushed below its lowest height: it slides, it does not shrink. No
   transform at rest, so that the sheet does not become the containing block
   of what is fixed inside it. */
.sheet-pushed {
  transform: translateY(var(--sheet-offset, 0px));
}

/* Dans l'app, le volet se pose sur la barre d'onglets (3,5 rem, plus la zone
   des gestes), qui reste visible : c'est le menu de l'app, on ne le perd pas
   en lisant un commentaire. Il passe sous la barre, dont le bouton rond des
   horaires déborde au-dessus de son bord, et lui garde une marge en bas. */
:global(.native-app .bottom-sheet) {
  bottom: calc(3.5rem + var(--safe-bottom, 0px));
  z-index: 45;
  max-height: calc(92dvh - 3.5rem - var(--safe-bottom, 0px));
  padding-bottom: 1.25rem;
}

/* Sous le doigt, aucune inertie : le volet suit. */
.sheet-dragging {
  transition: none;
}

/* La poignée et l'en-tête : la zone qu'on tire. Le geste est le nôtre, pas
   un défilement de la page. */
.sheet-grip {
  flex-shrink: 0;
  padding-top: 0.5rem;
  touch-action: none;
  cursor: grab;
}

.sheet-handle {
  display: block;
  width: 2.25rem;
  height: 0.3rem;
  margin: 0 auto 0.35rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 18%, transparent);
}

.sheet-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* Docked as a column, it neither slides nor eases: closed, it goes at once
   (an inherited transition would keep it on screen for its duration). */
.sheet-docked {
  transition: none;
}

.sheet-docked .sheet-grip {
  padding-top: 0;
  touch-action: auto;
  cursor: auto;
}

/* Un volet à la hauteur de son contenu se tire de partout : le geste est le
   nôtre sur toute sa surface, sauf là où le contenu défile lui-même. */
.sheet-fit {
  touch-action: none;
}

.sheet-fit [data-sheet-nodrag] {
  touch-action: pan-y;
}

/* À la hauteur du contenu : le corps ne s'étire pas. */
.sheet-fit .sheet-body {
  flex: 0 1 auto;
}

@media (prefers-reduced-motion: reduce) {
  .bottom-sheet {
    transition: none;
  }
}
</style>

<style>
/* The caller's <Transition name="bottom-sheet">: it rises from below the
   screen and goes back down, from where the finger let it go
   (`--sheet-offset`). A sheet docked as a column does not slide. Unscoped,
   because the classes are the Transition's. */
.bottom-sheet.bottom-sheet-enter-from:not(.sheet-docked),
.bottom-sheet.bottom-sheet-leave-to:not(.sheet-docked) {
  transform: translateY(calc(100% + var(--sheet-offset, 0px)));
}

.bottom-sheet.bottom-sheet-leave-active:not(.sheet-docked) {
  pointer-events: none;
}
</style>
