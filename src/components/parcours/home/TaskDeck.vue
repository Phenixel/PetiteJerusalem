<script setup lang="ts">
/**
 * Le paquet de l'accueil, tel que la maquette le dessine (P2-Accueil).
 *
 * Replié, c'est une pile : la carte du dessus, en couleur pleine, aux mesures
 * de la carte du moment du Sidour, et deux cartes qui se devinent dessous.
 * Toucher la carte ouvre sa page, directement ; glisser à droite, c'est
 * fait ; à gauche, plus tard (elle passe sous la pile) : elle s'envole du
 * côté où on l'a poussée, et la suivante arrive du même côté. Tirée vers le
 * bas, la pile s'étale et s'ouvre en portefeuille ; un appui long ouvre sa
 * fiche.
 *
 * Ouvert, c'est le portefeuille : toutes les cartes du jour, du matin au
 * coucher, qui se chevauchent comme dans un porte-cartes. On en touche une
 * pour l'ouvrir ; glissée à droite, elle est faite, même après coup ; à
 * gauche, plus tard, ou pas faite si elle l'était ; vers le haut, le
 * portefeuille se replie.
 *
 * Les mêmes éléments servent aux deux états, dans le même ordre : passer de
 * l'un à l'autre les fait glisser à leur nouvelle place. Le clic droit, la
 * touche du menu contextuel, ouvrent la fiche comme l'appui long : chaque
 * geste y a son bouton, pour qui ne glisse pas.
 */
import { computed, onBeforeUnmount, reactive, ref, type StyleValue } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { prefersLessMotion } from "../../../composables/useMotion";
import type { DeckCard } from "../../../composables/useTodayDeck";
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
/** Le portefeuille poussé vers le haut de plus se replie. */
const FOLD = 60;
/** En deçà, on ne sait pas encore si le doigt glisse de côté ou tire. */
const SLOP = 8;
const LONG_PRESS_MS = 550;
const LEAVE_MS = 260;

type Axis = "x" | "y" | null;
const drag = reactive<{ key: string | null; dx: number; dy: number; axis: Axis }>({
  key: null,
  dx: 0,
  dy: 0,
  axis: null,
});
/** La carte du dessus s'envole : à droite faite, à gauche remise. */
const leaving = ref<"right" | "left" | null>(null);

let x0 = 0;
let y0 = 0;
/** Le clic qui suit un geste (glissé, appui long) ne compte pas. */
let suppress = false;
let pressTimer: ReturnType<typeof setTimeout> | undefined;
let leaveTimer: ReturnType<typeof setTimeout> | undefined;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const top = computed(() => props.pending[0] ?? null);

/** Combien la pile est tirée vers le bas : les cartes du dessous suivent, plus vite. */
const pull = computed(() =>
  !props.open && top.value && drag.key === top.value.key && drag.axis === "y"
    ? clamp(drag.dy, 0, PULL_MAX)
    : 0,
);

type Mode = "top" | "ghost" | "list";
interface Item {
  card: DeckCard;
  mode: Mode;
  classes: string[];
  style: StyleValue;
  kicker: string;
  label: string | undefined;
  art: "big" | "small" | null;
}

function releaseLabel(card: DeckCard): string | null {
  if (drag.key !== card.key || drag.axis !== "x") return null;
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
  const tone = off ? "dk-done" : card.key === top.value?.key && !card.extra ? "" : "dk-plain";
  return {
    card,
    mode: "list",
    classes: [tone, "dk-pick"],
    style: {
      top: `${j * STEP}px`,
      zIndex: j + 1,
      ...(dragging ? { transform: `translateX(${drag.dx}px)`, transition: "none" } : {}),
    },
    kicker: releaseLabel(card) ?? kicker,
    label: t(card.done ? "parcours.hub.cardLabelDone" : "parcours.hub.cardLabel", {
      title: card.title,
    }),
    art: card.art ? "small" : null,
  };
}

function topItem(card: DeckCard): Item {
  let style: StyleValue = { zIndex: 30 };
  if (leaving.value) {
    const sign = leaving.value === "right" ? 1 : -1;
    style = {
      ...style,
      transform: `translateX(${sign * 460}px) rotate(${sign * 10}deg)`,
      opacity: 0,
    };
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
    classes: [card.extra ? "dk-plain" : "", "dk-top"],
    style,
    kicker: card.kicker,
    label: t("parcours.hub.topLabel", { title: card.title, meta: card.meta }),
    art: card.art ? "big" : null,
  };
}

function ghostItem(card: DeckCard, i: number): Item {
  const y = i === 1 ? 12 + pull.value * 0.55 : 24 + pull.value * 1.05;
  const scale = i === 1 ? 0.95 : 0.9;
  return {
    card,
    mode: "ghost",
    classes: [i === 1 ? "dk-under1" : i === 2 ? "dk-under2" : "dk-plain", "dk-ghost"],
    style: {
      zIndex: i === 1 ? 20 : i === 2 ? 10 : 0,
      transform: `translateY(${y}px) scale(${scale})`,
      ...(i > 2 ? { opacity: 0 } : {}),
      ...(pull.value ? { transition: "none" } : {}),
    },
    kicker: "",
    label: undefined,
    art: null,
  };
}

/** Les cartes, dans le même ordre d'éléments quel que soit l'état. */
const items = computed<Item[]>(() =>
  props.open
    ? props.day.map(listItem)
    : props.pending.map((card, i) => (i === 0 ? topItem(card) : ghostItem(card, i))),
);

const deckHeight = computed(() => {
  if (props.open) return Math.max(0, props.day.length - 1) * STEP + CARD_HEIGHT;
  const n = props.pending.length;
  const collapsed = n >= 3 ? 148 : n === 2 ? 136 : CARD_HEIGHT;
  return collapsed + pull.value * 1.1;
});

const revealDone = computed(() =>
  !props.open && drag.key === top.value?.key && drag.axis === "x"
    ? clamp(drag.dx / TOP_THRESHOLD, 0, 1)
    : 0,
);
const revealLater = computed(() =>
  !props.open && drag.key === top.value?.key && drag.axis === "x"
    ? clamp(-drag.dx / TOP_THRESHOLD, 0, 1)
    : 0,
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
  if (item.mode === "ghost" || event.button !== 0 || leaving.value) return;
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
    if (drag.key === card.key && !drag.axis) openSheet(card);
  }, LONG_PRESS_MS);
  drag.key = card.key;
  drag.dx = 0;
  drag.dy = 0;
  drag.axis = null;
}

function onMove(event: PointerEvent, item: Item): void {
  if (drag.key !== item.card.key) return;
  const dx = event.clientX - x0;
  const dy = event.clientY - y0;
  if (!drag.axis && (Math.abs(dx) > SLOP || Math.abs(dy) > SLOP)) {
    drag.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    suppress = true;
    clearTimeout(pressTimer);
  }
  drag.dx = dx;
  drag.dy = dy;
}

/** La carte du dessus s'envole, puis le geste agit : la suivante arrive du même côté. */
function fly(card: DeckCard, side: "right" | "left"): void {
  reset();
  leaving.value = side;
  leaveTimer = setTimeout(
    () => {
      leaving.value = null;
      if (side === "right") emit("done", card, "home_deck_swipe");
      else emit("later", card, "swipe");
    },
    prefersLessMotion() ? 0 : LEAVE_MS,
  );
}

function onUp(item: Item): void {
  clearTimeout(pressTimer);
  if (drag.key !== item.card.key) return;
  const card = item.card;
  const { dx, dy, axis } = drag;
  reset();
  if (item.mode === "top") {
    if (axis === "x" && dx > TOP_THRESHOLD) fly(card, "right");
    else if (axis === "x" && dx < -TOP_THRESHOLD) fly(card, "left");
    else if (axis === "y" && dy > PULL_OPEN) emit("unfold", "swipe");
    return;
  }
  if (axis === "x" && dx > LIST_THRESHOLD) {
    if (!card.done) emit("done", card, "home_wallet_swipe");
  } else if (axis === "x" && dx < -LIST_THRESHOLD) {
    if (card.done || card.skipped) emit("undo", card, "home_wallet_swipe");
    else emit("later", card, "wallet_swipe");
  } else if (axis === "y" && dy < -FOLD) {
    emit("fold", "swipe");
  }
}

function onClick(event: MouseEvent, item: Item): void {
  if (item.mode === "ghost") {
    event.preventDefault();
    return;
  }
  if (suppress) {
    event.preventDefault();
    suppress = false;
    return;
  }
  const card = item.card;
  if (!card.route) {
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

/** Une carte sans page est un bouton : Entrée et Espace l'ouvrent. */
function onKeydown(event: KeyboardEvent, item: Item): void {
  if (item.card.route || item.mode === "ghost") return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    emit("sheet", item.card);
  }
}

function onContextmenu(event: Event, item: Item): void {
  event.preventDefault();
  if (item.mode === "ghost" || suppress) return;
  openSheet(item.card);
}

const hrefOf = (card: DeckCard): string | undefined =>
  card.route ? router.resolve(card.route).href : undefined;

onBeforeUnmount(() => {
  clearTimeout(pressTimer);
  clearTimeout(leaveTimer);
});
</script>

<template>
  <div>
    <div v-if="open" class="mt-[22px] flex items-center justify-between gap-2">
      <span class="text-[15px] font-bold">
        {{ t("parcours.hub.today", { done: count.done, total: count.total }) }}
      </span>
      <span class="flex gap-2.5">
        <RouterLink to="/parcours/journee" class="deck-more">{{
          t("parcours.hub.day")
        }}</RouterLink>
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
      <span class="deck-reveal left-1.5" :style="{ opacity: revealDone }" aria-hidden="true">
        {{ t("parcours.hub.done") }}
      </span>
      <span class="deck-reveal right-1.5" :style="{ opacity: revealLater }" aria-hidden="true">
        {{ t("parcours.hub.later") }}
      </span>

      <a
        v-for="(item, i) in items"
        :key="i"
        class="dk"
        :class="item.classes"
        :style="item.style"
        :href="item.mode === 'ghost' ? undefined : hrefOf(item.card)"
        :role="item.mode !== 'ghost' && !item.card.route ? 'button' : undefined"
        :tabindex="item.mode === 'ghost' ? -1 : 0"
        :aria-hidden="item.mode === 'ghost' ? 'true' : undefined"
        :aria-label="item.label"
        draggable="false"
        @pointerdown="onDown($event, item)"
        @pointermove="onMove($event, item)"
        @pointerup="onUp(item)"
        @pointercancel="reset"
        @click="onClick($event, item)"
        @keydown="onKeydown($event, item)"
        @contextmenu="onContextmenu($event, item)"
      >
        <DeckArt
          v-if="item.art && item.card.art"
          :art="item.card.art"
          :small="item.art === 'small'"
        />
        <span class="dk-kick">{{ item.kicker }}</span>
        <span class="dk-title">{{ item.card.title }}</span>
        <span class="dk-meta">{{ item.card.meta }}</span>
      </a>

      <!-- Plus rien dans la pile : la journée est pleine, ou rien n'était prévu. -->
      <div v-if="!open && pending.length === 0" class="dk dk-plain dk-rest">
        <span class="dk-kick">{{ rest.kicker }}</span>
        <span class="dk-title">{{ rest.title }}</span>
        <span v-if="rest.meta" class="dk-meta">{{ rest.meta }}</span>
      </div>
    </div>

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
/* Ce que le geste fera, découvert sous la carte qu'on pousse. */
.deck-reveal {
  position: absolute;
  top: 44px;
  z-index: 25;
  font-size: 15px;
  font-weight: 800;
  color: var(--color-primary);
  pointer-events: none;
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
  touch-action: none;
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
.dk-ghost > * {
  visibility: hidden;
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
  .dk {
    transition: none;
  }
}
</style>
