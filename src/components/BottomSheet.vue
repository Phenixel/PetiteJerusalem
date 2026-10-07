<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";

/**
 * Le bottom sheet de l'app native : un volet qui monte du bas de l'écran,
 * par-dessus la barre d'onglets, avec sa poignée.
 *
 * C'est la forme qu'un téléphone donne à ce qui accompagne un écran sans le
 * quitter (les commandes d'un passage, ses commentaires) : on le tire par la
 * poignée pour l'agrandir, on le pousse vers le bas pour le fermer, un geste
 * franc vers le bas le ferme d'un coup. Il ne voile pas la page : on lit,
 * on touche le texte au-dessus.
 *
 * `snaps` donne ses crans, en part de la hauteur de l'écran (0,55 : à
 * mi-hauteur) ; sans crans, il prend la hauteur de son contenu et ne se tire
 * que vers le bas. La poignée et l'en-tête (slot `header`) portent le geste ;
 * le corps défile.
 *
 * `docked` le pose autrement, sans poignée ni geste : c'est à l'appelant de
 * dire où (le panneau d'étude en fait une colonne sur un écran large).
 *
 * Un volet à la hauteur de son contenu (les commandes d'un passage) se tire
 * de partout, pas seulement par sa poignée : le geste ne commence qu'au-delà
 * de quelques pixels, un simple appui reste un appui sur un bouton. S'il est
 * `expandable`, le tirer vers le haut l'ouvre sur la suite (`expand`) : les
 * commentaires du passage, sans avoir à viser leur bouton. Une zone qui
 * défile elle-même (la phonétique d'un long passage) se marque
 * `data-sheet-nodrag`.
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

const height = computed(() => {
  if (props.docked) return undefined;
  if (dragHeight.value !== null) return `${dragHeight.value}px`;
  const snap = props.snaps[snapIndex.value];
  return snap ? `${snap * 100}dvh` : undefined;
});

/** Un geste plus rapide que cela (px/ms) décide seul, quelle que soit la hauteur. */
const FLICK = 0.6;

let start: { y: number; height: number; pointer: number; active: boolean } | null = null;
let last = { y: 0, t: 0, vy: 0 };

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
  start = {
    y: event.clientY,
    height: sheet.value.getBoundingClientRect().height,
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
    sheet.value?.setPointerCapture?.(event.pointerId);
  }
  const vh = window.innerHeight;
  const max = props.snaps.length
    ? Math.max(...props.snaps) * vh
    : start.height + (props.expandable ? vh * 0.3 : 0);
  dragHeight.value = Math.min(max, Math.max(0, start.height - (event.clientY - start.y)));
  const dt = event.timeStamp - last.t;
  if (dt > 0) last = { y: event.clientY, t: event.timeStamp, vy: (event.clientY - last.y) / dt };
}

function onPointerUp(event: PointerEvent): void {
  if (!start || event.pointerId !== start.pointer) return;
  const moved = dragHeight.value;
  const startHeight = start.height;
  const active = start.active;
  start = null;
  dragHeight.value = null;
  // Un appui, pas un geste : le bouton touché répond comme d'habitude.
  if (!active || moved === null) return;
  swallowNextClick();
  // Tiré vers le haut : la suite (les commentaires du passage).
  if (
    props.expandable &&
    !props.snaps.length &&
    (moved > startHeight + EXPAND_PULL || (last.vy < -FLICK && moved > startHeight + SLOP))
  ) {
    emit("expand");
    return;
  }
  const vh = window.innerHeight;
  const heights = props.snaps.length ? props.snaps.map((s) => s * vh) : [startHeight];
  const lowest = heights[0];
  const flickDown = last.vy > FLICK && moved < startHeight;
  // Fermé : poussé sous les deux tiers du premier cran, ou d'un geste franc
  // vers le bas depuis le premier cran. Plus haut, le même geste le ramène
  // d'un cran : on redescend un Tossafot lu en plein écran sans le perdre.
  if (moved < lowest * 0.66 || (flickDown && snapIndex.value === 0)) {
    emit("close");
    return;
  }
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

onBeforeUnmount(() => {
  start = null;
});
</script>

<template>
  <section
    ref="sheet"
    class="bottom-sheet"
    :class="{
      'sheet-dragging': dragHeight !== null,
      'sheet-fit': !snaps.length && !docked,
      'sheet-docked': docked,
    }"
    role="dialog"
    aria-modal="false"
    :aria-label="label"
    :style="{ height }"
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
  transition: height 0.25s cubic-bezier(0.2, 0.8, 0.3, 1);
  animation: sheet-in 0.25s cubic-bezier(0.2, 0.8, 0.3, 1);
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

@keyframes sheet-in {
  from {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bottom-sheet {
    transition: none;
    animation: none;
  }
}
</style>
