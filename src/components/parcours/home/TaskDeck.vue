<script setup lang="ts">
/**
 * Le paquet de l'accueil, tel que la maquette le dessine (P2-Accueil).
 *
 * Replié, c'est une pile : la carte du dessus, en couleur pleine, aux mesures
 * de la carte du moment du Sidour, et deux cartes qui se devinent dessous.
 * Toucher la carte ouvre sa page, directement ; glisser à droite, c'est
 * fait : une coche se pose sur la carte, elle s'envole, et celle du dessous
 * monte prendre sa place, qui se signale d'un halo. À gauche, plus tard :
 * elle s'envole de ce côté et repasse sous la pile. Tirée vers le bas, en
 * haut de page, la pile s'étale et s'ouvre en portefeuille ; un appui long
 * ouvre sa fiche.
 *
 * Ouvert, c'est le portefeuille : toutes les cartes du jour, du matin au
 * coucher, qui se chevauchent comme dans un porte-cartes. On en touche une
 * pour l'ouvrir ; glissée à droite, elle est faite, même après coup ; à
 * gauche, plus tard, ou pas faite si elle l'était. « Replier » le referme
 * (à la souris, le pousser vers le haut aussi).
 *
 * Un office dont l'heure n'est pas venue attend en retrait (`waiting`) :
 * claire et à plat, « Pas encore l'heure », elle résiste au glissé sans rien
 * marquer ; un toucher ouvre sa fiche.
 *
 * La page défile sous le doigt, même posé sur une carte : la pile ne retient
 * un geste vertical que pour se déplier, quand on la tire vers le bas en
 * haut de page (voir docs/design.md, « La pile et le défilement »).
 *
 * Chaque carte du jour garde son élément, dans l'ordre de la journée, d'un
 * état à l'autre : se déplier les fait glisser de la pile à leur place,
 * celles déjà faites sortant de sous la pile. Le clic droit, la touche du
 * menu contextuel, ouvrent la fiche comme l'appui long : chaque geste y a
 * son bouton, pour qui ne glisse pas.
 */
import { computed, onBeforeUnmount, reactive, ref, watch, type StyleValue } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import type { DeckCard } from "../../../composables/useTodayDeck";
import { haptic } from "../../../services/haptics";
import DayBar from "./DayBar.vue";
import DeckArt from "./DeckArt.vue";

const props = defineProps<{
  /** La journée, du matin au coucher, puis les cartes en plus. */
  day: DeckCard[];
  /** Ce qui reste à faire, la carte du dessus en premier. */
  pending: DeckCard[];
  count: { done: number; total: number };
  open: boolean;
  isLater: (card: DeckCard) => boolean;
  /** La carte d'une journée sans rien à faire : son moment, ce qu'elle dit. */
  rest: { kicker: string; title: string; meta: string };
}>();

const emit = defineEmits<{
  (e: "done", card: DeckCard, source: string): void;
  (e: "undo", card: DeckCard, source: string): void;
  (e: "later", card: DeckCard, source: string): void;
  (e: "sheet", card: DeckCard): void;
  (e: "opened", card: DeckCard): void;
  (e: "unfold", source: string): void;
  (e: "fold", source: string): void;
}>();

const { t } = useI18n();
const router = useRouter();

/** Le pas du portefeuille : ce qu'on voit d'une carte avant la suivante. */
const STEP = 80;
const CARD_HEIGHT = 124;
/** Au-delà, la carte lâchée agit : sur la pile, dans le portefeuille. */
const TOP_THRESHOLD = 110;
const LIST_THRESHOLD = 90;
/** Tirée de plus, la pile s'ouvre ; elle ne suit pas le doigt au-delà de PULL_MAX. */
const PULL_OPEN = 50;
const PULL_MAX = 140;
/** Le portefeuille poussé vers le haut de plus (à la souris) se replie. */
const FOLD = 60;
/** En deçà, on ne sait pas encore si le doigt glisse de côté ou tire. */
const SLOP = 8;
const LONG_PRESS_MS = 550;
/** La coche se pose sur la carte faite, puis la carte s'envole. */
const STAMP_MS = 260;
const FLY_MS = 300;
/** Le halo de la carte montée en tête. */
const ARRIVE_MS = 1400;
/** Une carte faite que le parcours n'a pas encore retirée ne revient pas avant. */
const SETTLE_MS = 1000;

type Axis = "x" | "y" | null;
const drag = reactive<{ key: string | null; dx: number; dy: number; axis: Axis }>({
  key: null,
  dx: 0,
  dy: 0,
  axis: null,
});

/**
 * La carte du dessus qui s'en va : faite, à droite, la coche s'y pose d'abord
 * (`stamp`), puis elle s'envole (`fly`) ; remise, à gauche, elle s'envole
 * aussitôt. Pendant l'envol, les cartes du dessous montent d'un cran.
 */
const leaving = ref<{
  key: string;
  side: "right" | "left";
  phase: "stamp" | "fly";
  dx: number;
} | null>(null);
/** La carte qui vient de monter en tête : elle se signale, une fois. */
const arrived = ref<string | null>(null);
/** Pour les lecteurs d'écran : ce que le geste a fait, et la carte qui suit. */
const announce = ref("");

let x0 = 0;
let y0 = 0;
/** Le clic qui suit un geste (glissé, appui long) ne compte pas. */
let suppress = false;
let pressTimer: ReturnType<typeof setTimeout> | undefined;
const timers = new Set<ReturnType<typeof setTimeout>>();

function after(run: () => void, ms: number): void {
  const id = setTimeout(() => {
    timers.delete(id);
    run();
  }, ms);
  timers.add(id);
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Une carte qui attend son heure se laisse tirer un peu, et revient. */
const resist = (dx: number) => Math.sign(dx) * Math.min(36, Math.abs(dx) * 0.25);

/**
 * Le système demande moins d'animations : tout se fait d'un coup. Une petite
 * machine (`perf-lite`) garde, elle, la coche, la montée et le halo : ils
 * disent ce qui vient de se passer, et ne coûtent qu'un instant.
 */
const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const top = computed(() => props.pending[0] ?? null);
const rankOf = computed(() => new Map(props.pending.map((card, i) => [card.key, i])));

/** Combien la pile est tirée vers le bas : les cartes du dessous suivent, plus vite. */
const pull = computed(() =>
  !props.open && top.value && drag.key === top.value.key && drag.axis === "y"
    ? clamp(drag.dy, 0, PULL_MAX)
    : 0,
);

type Mode = "top" | "ghost" | "list" | "leaving";
interface Item {
  card: DeckCard;
  mode: Mode;
  /** Ni toucher, ni focus, ni lecteur d'écran : une carte qui se devine ou qui part. */
  inert: boolean;
  classes: string[];
  style: StyleValue;
  kicker: string;
  label: string | undefined;
  art: "big" | "small" | null;
  stamp: boolean;
  /** Ce que le geste fera, accroché au bord de la carte qu'on glisse (voir cueOf). */
  cue: Cue | null;
}

/**
 * L'étiquette du geste en cours : « C'est fait » sort de sous le bord gauche
 * de la carte glissée à droite, « Plus tard » de sous son bord droit. Elle
 * suit la carte, à mi-hauteur, au lieu d'être posée sous la pile où elle
 * venait se coller au bord de la carte du dessous. Elle se fonce à la
 * couleur du thème une fois le seuil passé : lâchée, la carte agira.
 */
interface Cue {
  side: "done" | "later";
  text: string;
  strength: number;
  armed: boolean;
}

/**
 * An extra card shows in light, the title in ink: it does not count in the
 * day. Except the service whose time it is, without the « trois tefilot »
 * habit: what you come looking for takes the color, solid, counted or not.
 */
const isPlain = (card: DeckCard): boolean => card.extra && card.occasion?.kind !== "tefila";

function cueOf(card: DeckCard, threshold: number): Cue | null {
  if (drag.key !== card.key || drag.axis !== "x" || card.waiting || drag.dx === 0) return null;
  const strength = clamp(Math.abs(drag.dx) / threshold, 0, 1);
  if (drag.dx > 0) {
    return { side: "done", text: t("parcours.hub.done"), strength, armed: strength >= 1 };
  }
  const text = card.skipped
    ? t("parcours.hub.unskip")
    : card.done
      ? t("parcours.hub.undo")
      : t("parcours.hub.later");
  return { side: "later", text, strength, armed: strength >= 1 };
}

function releaseLabel(card: DeckCard): string | null {
  if (drag.key !== card.key || drag.axis !== "x" || card.waiting) return null;
  if (drag.dx > LIST_THRESHOLD) return t("parcours.hub.releaseDone");
  if (drag.dx < -LIST_THRESHOLD) {
    if (card.skipped) return t("parcours.hub.releaseUnskip");
    return card.done ? t("parcours.hub.releaseUndo") : t("parcours.hub.releaseLater");
  }
  return null;
}

function listItem(card: DeckCard, j: number): Item {
  const off = card.done || card.skipped;
  const dragging = drag.key === card.key && drag.axis === "x";
  const kicker = card.done
    ? card.doneKicker
    : card.skipped
      ? t("parcours.hub.skip")
      : props.isLater(card)
        ? t("parcours.hub.laterKicker", { kicker: card.kicker })
        : card.kicker;
  const tone = off
    ? "dk-done"
    : card.waiting
      ? "dk-plain dk-wait"
      : card.key === top.value?.key && !isPlain(card)
        ? ""
        : "dk-plain";
  return {
    card,
    mode: "list",
    inert: false,
    classes: [tone, "dk-pick"],
    style: {
      top: `${j * STEP}px`,
      zIndex: j + 1,
      ...(dragging
        ? {
            transform: `translateX(${card.waiting ? resist(drag.dx) : drag.dx}px)`,
            transition: "none",
          }
        : {}),
    },
    kicker: releaseLabel(card) ?? kicker,
    label: t(card.done ? "parcours.hub.cardLabelDone" : "parcours.hub.cardLabel", {
      title: card.title,
    }),
    art: card.art ? "small" : null,
    stamp: false,
    cue: cueOf(card, LIST_THRESHOLD),
  };
}

function topItem(card: DeckCard): Item {
  let style: StyleValue = { zIndex: 30 };
  if (drag.key === card.key && drag.axis === "x" && card.waiting) {
    style = { ...style, transform: `translateX(${resist(drag.dx)}px)`, transition: "none" };
  } else if (drag.key === card.key && drag.axis === "x") {
    style = {
      ...style,
      transform: `translateX(${drag.dx}px) rotate(${drag.dx / 30}deg)`,
      transition: "none",
    };
  } else if (pull.value) {
    style = { ...style, transform: `translateY(${pull.value * 0.3}px)`, transition: "none" };
  }
  return {
    card,
    mode: "top",
    inert: false,
    classes: [
      isPlain(card) || card.waiting ? "dk-plain" : "",
      card.waiting ? "dk-wait" : "",
      "dk-top",
      arrived.value === card.key ? "dk-arrived" : "",
    ],
    style,
    kicker: card.kicker,
    label: t(card.waiting ? "parcours.hub.waitLabel" : "parcours.hub.topLabel", {
      title: card.title,
      meta: card.meta,
    }),
    art: card.art ? "big" : null,
    stamp: false,
    cue: cueOf(card, TOP_THRESHOLD),
  };
}

/** La carte qui part : la coche posée là où on l'a lâchée, puis l'envol. */
function leavingItem(card: DeckCard): Item {
  const away = leaving.value!;
  const sign = away.side === "right" ? 1 : -1;
  return {
    card,
    mode: "leaving",
    inert: true,
    classes: [isPlain(card) ? "dk-plain" : "", "dk-top", away.phase === "fly" ? "dk-fly" : ""],
    style:
      away.phase === "stamp"
        ? {
            zIndex: 40,
            transform: `translateX(${away.dx}px) rotate(${away.dx / 30}deg)`,
            transition: "none",
          }
        : {
            zIndex: 40,
            transform: `translateX(${sign * 460}px) rotate(${sign * 14}deg)`,
            opacity: 0,
          },
    kicker: away.side === "right" ? t("parcours.hub.done") : card.kicker,
    label: undefined,
    art: card.art ? "big" : null,
    stamp: away.side === "right",
    cue: null,
  };
}

function ghostItem(card: DeckCard, i: number): Item {
  const y = i === 1 ? 12 + pull.value * 0.55 : 24 + pull.value * 1.05;
  const scale = i === 1 ? 0.95 : 0.9;
  return {
    card,
    mode: "ghost",
    inert: true,
    classes: [i === 1 ? "dk-under1" : i === 2 ? "dk-under2" : "dk-plain", "dk-ghost"],
    style: {
      zIndex: i === 1 ? 20 : i === 2 ? 10 : 0,
      transform: `translateY(${y}px) scale(${scale})`,
      ...(i > 2 ? { opacity: 0 } : {}),
      ...(pull.value ? { transition: "none" } : {}),
    },
    kicker: "",
    label: undefined,
    // Dessiné déjà, caché : il paraît quand la carte monte en tête.
    art: card.art ? "big" : null,
    stamp: false,
    cue: null,
  };
}

/** Une carte faite, ou mise de côté : rangée sous la pile, invisible. */
function stowedItem(card: DeckCard): Item {
  return {
    card,
    mode: "ghost",
    inert: true,
    classes: ["dk-plain", "dk-ghost", "dk-stowed"],
    style: { zIndex: 0, transform: "translateY(24px) scale(0.9)", opacity: 0 },
    kicker: "",
    label: undefined,
    art: card.art ? "small" : null,
    stamp: false,
    cue: null,
  };
}

/** La place d'une carte dans la pile : 0 en tête ; pendant l'envol, celles du dessous montent. */
function slotOf(card: DeckCard): number {
  const rank = rankOf.value.get(card.key);
  if (rank === undefined) return -1;
  const away = leaving.value;
  if (away?.phase === "fly" && rank > 0 && props.pending[0]?.key === away.key) return rank - 1;
  return rank;
}

/** Les cartes du jour, chacune son élément, dans l'ordre de la journée. */
const items = computed<Item[]>(() =>
  props.day.map((card, j) => {
    if (props.open) return listItem(card, j);
    if (leaving.value?.key === card.key) return leavingItem(card);
    const slot = slotOf(card);
    if (slot === 0) return topItem(card);
    if (slot > 0) return ghostItem(card, slot);
    return stowedItem(card);
  }),
);

const deckHeight = computed(() => {
  if (props.open) return Math.max(0, props.day.length - 1) * STEP + CARD_HEIGHT;
  const n = props.pending.length;
  const collapsed = n >= 3 ? 148 : n === 2 ? 136 : CARD_HEIGHT;
  return collapsed + pull.value * 1.1;
});

/**
 * Le seuil d'un geste : lâchée maintenant, la carte agirait (faite, plus
 * tard), ou la pile s'ouvrirait. Le franchir se sent au doigt.
 */
const armedGesture = computed(() => {
  if (drag.key === null || drag.axis === null) return null;
  const card = props.open ? props.day.find((c) => c.key === drag.key) : top.value;
  if (!card || card.key !== drag.key) return null;
  if (drag.axis === "y") return !props.open && drag.dy > PULL_OPEN ? "pull" : null;
  if (card.waiting) return null;
  const limit = props.open ? LIST_THRESHOLD : TOP_THRESHOLD;
  return drag.dx > limit ? "right" : drag.dx < -limit ? "left" : null;
});
watch(armedGesture, (armed, before) => {
  if (armed && armed !== before) haptic("tick");
});

// La carte faite a quitté la tête : l'envol est fini.
watch(
  () => props.pending[0]?.key,
  (key) => {
    if (leaving.value?.phase === "fly" && key !== leaving.value.key) leaving.value = null;
  },
);

function reset(): void {
  clearTimeout(pressTimer);
  drag.key = null;
  drag.dx = 0;
  drag.dy = 0;
  drag.axis = null;
}

/** La fiche, à l'appui long, au clic droit ou à la touche du menu contextuel. */
function openSheet(card: DeckCard): void {
  suppress = true;
  reset();
  emit("sheet", card);
}

function onDown(event: PointerEvent, item: Item): void {
  if (item.inert || event.button !== 0 || leaving.value) return;
  x0 = event.clientX;
  y0 = event.clientY;
  suppress = false;
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // Le pointeur est déjà relâché : rien à capturer.
  }
  clearTimeout(pressTimer);
  const card = item.card;
  pressTimer = setTimeout(() => {
    if (drag.key !== card.key || drag.axis) return;
    haptic("press");
    openSheet(card);
  }, LONG_PRESS_MS);
  drag.key = card.key;
  drag.dx = 0;
  drag.dy = 0;
  drag.axis = null;
}

/**
 * Au doigt, un geste vertical est à la page, qui défile : la pile ne le
 * garde que pour se déplier, tirée vers le bas en haut de page. La souris,
 * elle, ne fait pas défiler : tout geste lui revient.
 */
function keepsVertical(event: PointerEvent, item: Item, dy: number): boolean {
  if (event.pointerType === "mouse") return true;
  return item.mode === "top" && dy > 0 && window.scrollY <= 1;
}

function onMove(event: PointerEvent, item: Item): void {
  if (drag.key !== item.card.key) return;
  const dx = event.clientX - x0;
  const dy = event.clientY - y0;
  if (!drag.axis && (Math.abs(dx) > SLOP || Math.abs(dy) > SLOP)) {
    clearTimeout(pressTimer);
    const axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    if (axis === "y" && !keepsVertical(event, item, dy)) {
      reset();
      return;
    }
    drag.axis = axis;
    suppress = true;
  }
  drag.dx = dx;
  drag.dy = dy;
}

/** Un geste que la carte a pris retient la page ; tout autre la laisse défiler. */
function onTouchMove(event: TouchEvent): void {
  if (drag.key !== null && drag.axis !== null && event.cancelable) event.preventDefault();
}

/**
 * La carte du dessus s'en va. Faite : la coche se pose, la carte s'envole à
 * droite, la suivante monte ; le parcours la marque ensuite. Remise : elle
 * s'envole à gauche et repasse sous la pile.
 */
function fly(card: DeckCard, side: "right" | "left", dx: number): void {
  reset();
  haptic(side === "right" ? "done" : "undo");
  const calm = reducedMotion();
  const next = props.pending[1] ?? null;
  const action = t(side === "right" ? "parcours.hub.done" : "parcours.hub.later");
  announce.value = next ? t("parcours.hub.announceNext", { action, title: next.title }) : action;
  arrived.value = next?.key ?? null;
  leaving.value = { key: card.key, side, phase: side === "right" && !calm ? "stamp" : "fly", dx };

  const land = () => {
    if (side === "left") {
      leaving.value = null;
      emit("later", card, "swipe");
      return;
    }
    emit("done", card, "home_deck_swipe");
    after(() => {
      if (leaving.value?.key === card.key) leaving.value = null;
    }, SETTLE_MS);
  };
  const takeOff = () => {
    if (leaving.value?.key === card.key) leaving.value = { ...leaving.value, phase: "fly" };
    after(land, calm ? 0 : FLY_MS);
  };
  after(takeOff, leaving.value.phase === "stamp" ? STAMP_MS : 0);
  after(
    () => {
      if (arrived.value === next?.key) arrived.value = null;
    },
    calm ? 0 : STAMP_MS + FLY_MS + ARRIVE_MS,
  );
}

function onUp(item: Item): void {
  clearTimeout(pressTimer);
  if (drag.key !== item.card.key) return;
  const card = item.card;
  const { dx, dy, axis } = drag;
  reset();
  // Pas encore l'heure : le glissé de côté ne marque rien, la carte revient.
  if (card.waiting && axis === "x") return;
  if (item.mode === "top") {
    if (axis === "x" && dx > TOP_THRESHOLD) fly(card, "right", dx);
    else if (axis === "x" && dx < -TOP_THRESHOLD) fly(card, "left", dx);
    else if (axis === "y" && dy > PULL_OPEN) emit("unfold", "swipe");
    return;
  }
  if (axis === "x" && dx > LIST_THRESHOLD) {
    if (card.done) return;
    haptic("done");
    emit("done", card, "home_wallet_swipe");
  } else if (axis === "x" && dx < -LIST_THRESHOLD) {
    haptic("undo");
    if (card.done || card.skipped) emit("undo", card, "home_wallet_swipe");
    else emit("later", card, "wallet_swipe");
  } else if (axis === "y" && dy < -FOLD) {
    emit("fold", "swipe");
  }
}

function onClick(event: MouseEvent, item: Item): void {
  if (item.inert) {
    event.preventDefault();
    return;
  }
  if (suppress) {
    event.preventDefault();
    suppress = false;
    return;
  }
  const card = item.card;
  // Sans page, ou pas encore l'heure : le toucher ouvre la fiche.
  if (!card.route || card.waiting) {
    event.preventDefault();
    emit("sheet", card);
    return;
  }
  emit("opened", card);
  // Un clic avec une touche (nouvel onglet) reste au navigateur.
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  void router.push(card.route);
}

/** Une carte sans page (ou qui attend son heure) est un bouton : Entrée et Espace l'ouvrent. */
function onKeydown(event: KeyboardEvent, item: Item): void {
  if ((item.card.route && !item.card.waiting) || item.inert) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    emit("sheet", item.card);
  }
}

function onContextmenu(event: Event, item: Item): void {
  event.preventDefault();
  if (item.inert || suppress) return;
  openSheet(item.card);
}

const hrefOf = (card: DeckCard): string | undefined =>
  card.route ? router.resolve(card.route).href : undefined;

onBeforeUnmount(() => {
  clearTimeout(pressTimer);
  for (const id of timers) clearTimeout(id);
  timers.clear();
});
</script>

<template>
  <div>
    <div v-if="open" class="mt-[22px] flex items-center justify-between gap-2">
      <span class="text-[15px] font-bold">
        {{ t("parcours.hub.today", { done: count.done, total: count.total }) }}
      </span>
      <span class="flex gap-2.5">
        <button type="button" class="deck-more" @click="emit('fold', 'button')">
          {{ t("parcours.hub.fold") }}
          <svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 15l6-6 6 6"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </span>
    </div>

    <div class="deck" :class="{ 'deck-pulling': pull > 0 }" :style="{ height: `${deckHeight}px` }">
      <a
        v-for="item in items"
        :key="item.card.key"
        class="dk"
        :class="item.classes"
        :style="item.style"
        :href="item.inert || item.card.waiting ? undefined : hrefOf(item.card)"
        :role="!item.inert && (!item.card.route || item.card.waiting) ? 'button' : undefined"
        :tabindex="item.inert ? -1 : 0"
        :aria-hidden="item.inert ? 'true' : undefined"
        :aria-label="item.label"
        draggable="false"
        @pointerdown="onDown($event, item)"
        @pointermove="onMove($event, item)"
        @pointerup="onUp(item)"
        @pointercancel="reset"
        @touchmove="onTouchMove"
        @click="onClick($event, item)"
        @keydown="onKeydown($event, item)"
        @contextmenu="onContextmenu($event, item)"
      >
        <DeckArt
          v-if="item.art && item.card.art"
          :art="item.card.art"
          :small="item.art === 'small'"
        />
        <span class="dk-kick">
          <svg
            v-if="item.card.waiting && item.kicker"
            class="dk-clock"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2" />
            <path
              d="M12 7.5V12l3 2"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          {{ item.kicker }}
        </span>
        <span class="dk-title">{{ item.card.title }}</span>
        <span class="dk-meta">{{ item.card.meta }}</span>
        <!-- Ce que le geste fera, accroché au bord de la carte (voir cueOf). -->
        <span
          v-if="item.cue"
          class="dk-cue"
          :class="[`dk-cue-${item.cue.side}`, { 'dk-cue-armed': item.cue.armed }]"
          :style="{ opacity: item.cue.strength }"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" class="dk-cue-icon">
            <path v-if="item.cue.side === 'done'" d="M5 12.5l4.5 4.5L19 7.5" />
            <template v-else>
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 2" />
            </template>
          </svg>
          {{ item.cue.text }}
        </span>
        <!-- C'est fait : la coche, posée sur la carte avant qu'elle s'envole. -->
        <span v-if="item.stamp" class="dk-stamp">
          <svg viewBox="0 0 24 24" width="30" height="30">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      </a>

      <!-- Plus rien dans la pile : la journée est pleine, ou rien n'était prévu. -->
      <div v-if="!open && pending.length === 0" class="dk dk-plain dk-rest">
        <span class="dk-kick">{{ rest.kicker }}</span>
        <span class="dk-title">{{ rest.title }}</span>
        <span v-if="rest.meta" class="dk-meta">{{ rest.meta }}</span>
      </div>
    </div>

    <p class="sr-only" aria-live="polite">{{ announce }}</p>

    <DayBar
      v-if="!open && count.total > 0"
      :day="day"
      :current="top?.key ?? null"
      :count="count"
      @open="emit('unfold', 'day_bar')"
    />
  </div>
</template>

<style scoped>
.deck {
  position: relative;
  margin-top: 34px;
  transition: height 0.3s ease;
}
.deck-pulling {
  transition: none;
}
.deck-more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 36px;
  padding: 0 4px;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-primary);
}

/* Une carte : en couleur pleine, aux mesures de la carte du moment du Sidour. */
.dk {
  position: absolute;
  inset-inline: 0;
  top: 0;
  height: 124px;
  display: flex;
  flex-direction: column;
  padding: 16px 20px 20px;
  border-radius: var(--radius-card);
  background: var(--color-brand);
  color: var(--color-on-brand);
  box-shadow: var(--shadow-card-hover);
  text-align: start;
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
  /* L'appui long ouvre la fiche : pas l'aperçu du lien que le système proposerait. */
  -webkit-touch-callout: none;
  /* La page défile sous le doigt ; la pile ne retient que ses gestes (onTouchMove). */
  touch-action: pan-y;
  transition:
    top 0.3s ease,
    transform 0.26s ease,
    opacity 0.26s ease,
    background-color 0.2s ease;
}
.dk:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.dk-plain {
  background: var(--color-surface);
  color: var(--color-text-primary);
}
.dk-plain .dk-title {
  color: var(--color-primary);
}
/* Faite : la carte s'éteint, grise et à plat, son dessin aussi. */
.dk-done {
  background: var(--color-surface-soft);
  color: var(--color-text-secondary);
  box-shadow: none;
}
/* Pas encore l'heure : la carte attend, claire et à plat, son dessin pâli. */
.dk-wait {
  background: var(--color-surface);
  color: var(--color-text-secondary);
  box-shadow: inset 0 0 0 1px var(--color-line-strong);
}
.dk.dk-wait .dk-title {
  color: var(--color-text-primary);
}
.dk-wait :deep(.deck-art) {
  filter: grayscale(0.6);
  opacity: 0.5;
}
.dk-clock {
  display: inline-block;
  width: 15px;
  height: 15px;
  margin-inline-end: 4px;
  vertical-align: -2px;
}
.dk-done :deep(.deck-art),
.dk-done :deep(.card-art) {
  filter: grayscale(1);
  opacity: 0.45;
}
.dk-done .dk-kick {
  color: var(--color-text-secondary);
  opacity: 1;
}
/* Les cartes qui se devinent sous la pile : la teinte, de plus en plus pâle. */
.dk-under1 {
  background: color-mix(in srgb, var(--color-surface) 70%, var(--color-brand) 30%);
}
.dk-under2 {
  background: color-mix(in srgb, var(--color-surface) 85%, var(--color-brand) 15%);
}
/* Ce qu'une carte porte paraît quand elle monte en tête, et s'efface sous la pile. */
.dk > * {
  transition: opacity 0.24s ease;
}
.dk.dk-ghost > * {
  opacity: 0;
}
.dk-stowed {
  pointer-events: none;
}
/* Faite ou remise : la carte s'envole, de plus en plus vite. */
.dk-fly {
  transition:
    transform 0.3s cubic-bezier(0.4, 0, 1, 1),
    opacity 0.3s ease-in;
}
/* Ce que le geste fera : une pastille accrochée au bord de la carte glissée,
   à mi-hauteur, dans la place qu'elle découvre. Claire tant que le geste se
   cherche, à la couleur du thème une fois le seuil passé. */
.dk-cue {
  position: absolute;
  top: 50%;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px 7px 10px;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-primary);
  box-shadow: var(--shadow-pop);
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
  pointer-events: none;
  transform: translateY(-50%);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}
.dk.dk-ghost > .dk-cue {
  opacity: 0;
}
.dk-cue-done {
  right: calc(100% + 10px);
}
.dk-cue-later {
  left: calc(100% + 10px);
}
.dk-cue-armed {
  background: var(--color-brand);
  color: var(--color-on-brand);
}
.dk-cue-icon {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
/* La coche, posée sur la carte faite, du côté qu'on voit encore. */
.dk-stamp {
  position: absolute;
  top: 50%;
  left: 24px;
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-primary);
  box-shadow: var(--shadow-pop);
  transform: translateY(-50%);
  animation: dk-stamp 0.26s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes dk-stamp {
  from {
    opacity: 0;
    transform: translateY(-50%) scale(0.3);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) scale(1);
  }
}
/*
 * La suivante monte en tête d'un pas franc, un peu au-delà, puis se pose ;
 * un anneau à l'encre s'en échappe une fois. La montée est une animation,
 * pas une transition : `transform` sort des transitions de la carte.
 */
.dk-arrived {
  transition:
    top 0.3s ease,
    opacity 0.26s ease,
    background-color 0.3s ease;
  animation: dk-rise 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) backwards;
}
@keyframes dk-rise {
  0% {
    transform: translateY(12px) scale(0.95);
  }
  55% {
    transform: translateY(-5px) scale(1.035);
  }
  100% {
    transform: none;
  }
}
.dk-arrived::after {
  content: "";
  position: absolute;
  inset: -2px;
  border: 3px solid var(--color-primary);
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  animation: dk-halo 0.9s ease-out 0.35s;
}
@keyframes dk-halo {
  0% {
    opacity: 0;
    transform: scale(1);
  }
  12% {
    opacity: 0.9;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.08, 1.25);
  }
}
.dk-top {
  cursor: grab;
}
.dk-pick {
  cursor: pointer;
}
.dk-rest {
  touch-action: auto;
}
.dk-kick {
  position: relative;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  opacity: 0.8;
}
.dk-title,
.dk-meta {
  position: relative;
  margin-top: 4px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.dk-title {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 700;
  line-height: 1.25;
}
.dk-meta {
  font-size: 15px;
  font-weight: 500;
  opacity: 0.9;
}
@media (prefers-reduced-motion: reduce) {
  .deck,
  .dk,
  .dk > *,
  .dk-fly,
  .dk-arrived {
    transition: none;
  }
  .dk-stamp,
  .dk-arrived,
  .dk-arrived::after {
    animation: none;
  }
}
</style>
