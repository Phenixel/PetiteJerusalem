<script setup lang="ts">
/**
 * L'accueil, en modification (P2-AccueilModifier) : le paquet du jour en
 * tête, toujours, sans pastille ; dessous, les blocs, qu'on glisse pour les
 * déplacer et qu'on masque d'une pastille ; ceux qu'on a masqués attendent
 * en bas, à remettre d'un toucher. « Terminé » ramène à l'accueil.
 *
 * Le bloc qu'on tient suit le doigt ; les autres s'écartent à mesure, et la
 * place où il sera posé se dessine en pointillé. Lâché, il y glisse.
 *
 * Au clavier, une flèche vers le haut ou le bas déplace le bloc qui a le
 * focus.
 */
import { computed, ref, watch, type StyleValue } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { SITE_URL } from "../config/site";
import {
  dropIndex,
  HOME_BLOCKS,
  makeRoom,
  useHomeLayout,
  type HomeBlock,
} from "../composables/useHomeLayout";
import { localeMessagesReady } from "../i18n";
import { analyticsService } from "../services/analyticsService";
import { haptic } from "../services/haptics";
import { pageTitle, seoService } from "../services/seoService";

const { t, locale } = useI18n();

watch(
  [locale, localeMessagesReady],
  () =>
    seoService.setMeta({
      title: pageTitle(t("home.edit.title"), null),
      canonical: `${SITE_URL}/accueil/modifier`,
      robots: "noindex",
    }),
  { immediate: true },
);
const router = useRouter();
const home = useHomeLayout();

/** La hauteur d'un bloc et son écart : un pas de glissé. */
const STEP = 96;

const drag = ref<{ block: HomeBlock; y0: number; dy: number } | null>(null);
/** Le bloc qu'on vient de lâcher : il glisse de là où on l'a lâché jusqu'à sa place. */
const dropped = ref<{ block: HomeBlock; offset: number } | null>(null);
/** L'image où l'ordre change : rien ne glisse, chacun est déjà où il doit être. */
const settling = ref(false);

const order = computed(() => home.layout.value.order);

/** La place où le bloc tenu serait posé, si on le lâchait maintenant. */
const target = computed(() => {
  const d = drag.value;
  if (!d) return null;
  return dropIndex(order.value.indexOf(d.block), d.dy, STEP, order.value.length);
});

// La place du bloc tenu change : un battement, à chaque cran.
watch(target, (to, before) => {
  if (to !== null && before !== null && to !== before) haptic("tick");
});

function tileStyle(block: HomeBlock, index: number): StyleValue | undefined {
  const d = drag.value;
  if (d?.block === block) {
    // Un peu transparent : la place en pointillé se devine à travers.
    return { transform: `translateY(${d.dy}px) scale(1.02)`, opacity: 0.88, transition: "none" };
  }
  if (dropped.value?.block === block) {
    return { transform: `translateY(${dropped.value.offset}px)`, transition: "none" };
  }
  if (d && target.value !== null) {
    const shift = makeRoom(index, order.value.indexOf(d.block), target.value);
    if (shift) return { transform: `translateY(${shift * STEP}px)` };
  }
  return undefined;
}

function onDown(event: PointerEvent, block: HomeBlock): void {
  if (event.button !== 0) return;
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // Le pointeur est déjà relâché : rien à capturer.
  }
  drag.value = { block, y0: event.clientY, dy: 0 };
}
function onMove(event: PointerEvent): void {
  if (drag.value) drag.value = { ...drag.value, dy: event.clientY - drag.value.y0 };
}
function onUp(): void {
  const current = drag.value;
  if (!current) return;
  const from = order.value.indexOf(current.block);
  const to = target.value ?? from;
  settling.value = true;
  dropped.value = { block: current.block, offset: current.dy - (to - from) * STEP };
  drag.value = null;
  if (to !== from) {
    home.move(current.block, to);
    analyticsService.capture("home_block_moved", { block: current.block, to });
  }
  // Une image plus tard, le bloc lâché glisse jusqu'à sa place.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      settling.value = false;
      dropped.value = null;
    }),
  );
}

function onKey(event: KeyboardEvent, block: HomeBlock): void {
  const index = home.layout.value.order.indexOf(block);
  if (event.key === "ArrowUp" && index > 0) {
    event.preventDefault();
    home.move(block, index - 1);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    home.move(block, index + 1);
  }
}

function hide(block: HomeBlock): void {
  haptic("tick");
  home.hide(block);
  analyticsService.capture("home_block_hidden", { block });
}
function show(block: HomeBlock): void {
  haptic("tick");
  home.show(block);
  analyticsService.capture("home_block_shown", { block });
}

const hidden = computed(() => HOME_BLOCKS.filter((b) => home.layout.value.hidden.includes(b)));
</script>

<template>
  <main class="mx-auto w-full max-w-2xl px-4 pb-10 pt-[18px] md:px-6 md:py-12">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm leading-snug">
        <span class="font-extrabold">{{ t("home.edit.title") }}</span>
        <br />
        <span class="text-text-secondary">{{ t("home.edit.hint") }}</span>
      </p>
      <button type="button" class="btn btn-primary edit-done" @click="router.push('/')">
        {{ t("home.edit.done") }}
      </button>
    </div>

    <!-- Toujours en tête, sans pastille : on ne le masque pas. -->
    <div class="deck-tile mt-[22px]">
      <p class="text-xs font-bold opacity-80">{{ t("home.edit.alwaysFirst") }}</p>
      <p class="mt-0.5 text-lg font-extrabold">{{ t("home.edit.deck") }}</p>
    </div>

    <div class="relative mt-3 flex flex-col gap-3" :class="{ 'is-settling': settling }">
      <!-- Où le bloc tenu sera posé : sa place, en pointillé. -->
      <div
        v-if="drag && target !== null"
        class="tile-slot"
        :style="{ top: `${target * STEP}px` }"
        aria-hidden="true"
      />
      <div
        v-for="(block, index) in order"
        :key="block"
        class="tile"
        :class="drag?.block === block ? 'is-dragging' : 'is-waiting'"
        :style="tileStyle(block, index)"
        tabindex="0"
        :aria-label="t('home.edit.tileLabel', { name: t(`home.edit.blocks.${block}.title`) })"
        @pointerdown="onDown($event, block)"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @keydown="onKey($event, block)"
      >
        <button
          type="button"
          class="tile-hide"
          :aria-label="t('home.edit.hideLabel', { name: t(`home.edit.blocks.${block}.title`) })"
          @pointerdown.stop
          @click="hide(block)"
        >
          {{ t("home.edit.hide") }}
        </button>
        <p class="text-[17px] font-bold" :class="{ 'font-display': block === 'portes' }">
          {{ t(`home.edit.blocks.${block}.title`) }}
        </p>
        <p class="mt-[3px] text-[13px] text-text-secondary">
          {{ t(`home.edit.blocks.${block}.sub`) }}
        </p>
      </div>
    </div>

    <template v-if="hidden.length">
      <p class="mb-3 mt-[30px] text-sm font-bold text-text-secondary">{{ t("home.edit.back") }}</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="block in hidden"
          :key="block"
          type="button"
          class="add-pill"
          @click="show(block)"
        >
          <span class="font-display text-lg leading-none" aria-hidden="true">+</span>
          {{ t(`home.edit.blocks.${block}.title`) }}
        </button>
      </div>
    </template>
    <p class="mt-[26px] text-[13px] leading-normal text-text-secondary">
      {{ t("home.edit.note") }}
    </p>
  </main>
</template>

<style scoped>
.edit-done {
  min-height: 40px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 700;
}
.deck-tile {
  display: flex;
  height: 84px;
  flex-direction: column;
  justify-content: center;
  padding: 14px 16px;
  border-radius: var(--radius-card);
  background: var(--color-brand);
  color: var(--color-on-brand);
}
.tile {
  position: relative;
  display: flex;
  height: 84px;
  flex-direction: column;
  justify-content: center;
  padding: 14px 16px;
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
  transition: transform 0.2s ease;
}
.tile:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.tile.is-dragging {
  z-index: 5;
  box-shadow: var(--shadow-pop);
  cursor: grabbing;
}
/* Les blocs tremblent un peu : on peut les prendre. */
.tile.is-waiting {
  animation: wobble 0.5s ease-in-out infinite;
}
/* `rotate`, pas `transform` : le tremblement n'empêche pas un bloc de s'écarter. */
@keyframes wobble {
  0%,
  100% {
    rotate: -0.4deg;
  }
  50% {
    rotate: 0.4deg;
  }
}
/* La place où le bloc tenu sera posé. */
.tile-slot {
  position: absolute;
  inset-inline: 0;
  height: 84px;
  border: 2px dashed color-mix(in srgb, var(--color-primary) 60%, transparent);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
  pointer-events: none;
  transition: top 0.2s ease;
}
.is-settling .tile {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .tile.is-waiting {
    animation: none;
  }
  .tile,
  .tile-slot {
    transition: none;
  }
}
.tile-hide {
  position: absolute;
  top: -10px;
  inset-inline-end: -6px;
  z-index: 2;
  height: 28px;
  padding: 0 11px;
  border-radius: var(--radius-pill);
  background: var(--color-text-primary);
  color: var(--color-page);
  font-size: 12px;
  font-weight: 700;
}
.add-pill {
  display: inline-flex;
  height: 38px;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  font-size: 14px;
  font-weight: 700;
  color: var(--color-primary);
}
</style>
