<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import { bindingOf } from "../../config/bindings";
import { useMiniPlayerVisible } from "../../composables/useAudioPlayer";
import { useBottomChromeHeight } from "../../composables/useBottomChrome";
import { isNativeApp } from "../../composables/useNativeApp";
import { prefersLessMotion } from "../../composables/useMotion";
import { endFlight, openTableSheet, useReadingTable } from "../../composables/useReadingTable";
import { analyticsService } from "../../services/analyticsService";

/**
 * La barre de la table d'étude : les textes mis de côté, posés côte à côte
 * en bas de l'écran comme le cours qui joue dans la barre du lecteur. Chacun
 * y est un petit volume à la reliure de son rayon ; celui qu'on lit est
 * souligné. Le dernier posé se range au bout, de l'autre côté des autres.
 *
 * Un appui n'importe où sur elle, ou sur un téléphone un glissement vers le
 * haut, ouvre la table (ReadingTableSheet) : un panneau qui monte du bas
 * sans couvrir toute la page, d'où l'on passe d'un texte à l'autre.
 *
 * Mettre un texte de côté le fait s'envoler jusqu'ici : la page se réduit
 * jusqu'à son volume dans la barre (voir `flight` dans useReadingTable).
 *
 * Montée sur toutes les pages : rien ici ne tire le catalogue des textes ;
 * le panneau se charge à la demande.
 */
const loadSheet = () => import("./ReadingTableSheet.vue");
const ReadingTableSheet = defineAsyncComponent(loadSheet);

const { t } = useI18n();
const { texts, sheetOpen, flight, openKey } = useReadingTable();

// Au-dessus de la barre de l'app et du lecteur audio, sous ce qu'elle porte.
const bottom = useBottomChromeHeight("0.5rem", { table: false });
// Sur un écran large, la barre du lecteur est plus haute (ses commandes et
// sa barre de lecture sur deux rangs) : la table s'en écarte d'autant.
const miniPlayerVisible = useMiniPlayerVisible();
const aboveWidePlayer = computed(() => miniPlayerVisible.value && !isNativeApp);

/**
 * Les derniers posés seulement, le reste se compte (« +2 ») : trois sur un
 * téléphone, où un quatrième volume ne laissait plus lire aucun nom
 * (« Bere… », « N… »), cinq sur un écran large.
 */
const wideQuery =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(min-width: 768px)")
    : null;
const wide = ref(wideQuery?.matches ?? false);
wideQuery?.addEventListener?.("change", (event) => {
  wide.value = event.matches;
});
const maxShown = computed(() => (wide.value ? 5 : 3));
const shown = computed(() => texts.value.slice(-maxShown.value));
const hiddenCount = computed(() => Math.max(0, texts.value.length - maxShown.value));

const openLabel = computed(() => t("readingTable.open", texts.value.length));

function openSheet() {
  analyticsService.capture("reading_table_opened", { texts_count: texts.value.length });
  openTableSheet();
}

// Téléphone : un glissement vers le haut sur la barre l'ouvre aussi.
const SWIPE_OPEN = 24;
let swipeStart: { x: number; y: number } | null = null;
function onTouchStart(event: TouchEvent) {
  const touch = event.touches[0];
  swipeStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
}
function onTouchMove(event: TouchEvent) {
  const touch = event.touches[0];
  if (!swipeStart || !touch) return;
  const dy = swipeStart.y - touch.clientY;
  if (dy > SWIPE_OPEN && dy > Math.abs(touch.clientX - swipeStart.x)) {
    swipeStart = null;
    openSheet();
  }
}

// Le panneau reste monté le temps de redescendre, la barre cachée dessous.
const sheetMounted = ref(false);
watch(sheetOpen, (open) => {
  if (open) sheetMounted.value = true;
});
watch(
  () => texts.value.length,
  (count, before) => {
    // Le premier texte posé : le panneau se charge en avance, il s'ouvrira
    // sans attente au premier appui.
    if (count > 0 && !before) void loadSheet().catch(() => undefined);
  },
  { immediate: true },
);

// --- L'envol : la page mise de côté se réduit jusqu'à son volume ---
const ghost = ref<HTMLElement | null>(null);
const bar = ref<HTMLElement | null>(null);
/** Le volume qui attend l'arrivée de sa page pour paraître. */
const landingKey = ref<string | null>(null);

watch(flight, async (current) => {
  if (!current) return;
  if (prefersLessMotion()) {
    endFlight();
    return;
  }
  landingKey.value = current.key;
  await nextTick();
  const el = ghost.value;
  const target =
    bar.value?.querySelector<HTMLElement>(`[data-table-key="${CSS.escape(current.key)}"]`) ??
    bar.value;
  if (!el || !target || typeof el.animate !== "function") {
    land();
    return;
  }
  const to = target.getBoundingClientRect();
  const { from } = current;
  const animation = el.animate(
    [
      {
        top: `${from.top}px`,
        left: `${from.left}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        opacity: 1,
      },
      {
        top: `${to.top}px`,
        left: `${to.left}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        opacity: 0.9,
      },
    ],
    { duration: 480, easing: "cubic-bezier(0.55, 0, 0.25, 1)", fill: "forwards" },
  );
  animation.onfinish = land;
  animation.oncancel = land;
});

function land() {
  landingKey.value = null;
  endFlight();
}

const ghostStyle = computed(() => {
  const current = flight.value;
  if (!current) return undefined;
  return {
    top: `${current.from.top}px`,
    left: `${current.from.left}px`,
    width: `${current.from.width}px`,
    height: `${current.from.height}px`,
    "--binding": bindingOf(current.corpus),
  };
});
</script>

<template>
  <Transition :name="flight ? '' : 'table-bar'">
    <div
      v-if="texts.length"
      class="pointer-events-none fixed inset-x-0 z-40 px-2"
      :class="{ invisible: sheetMounted, 'md:mb-3': aboveWidePlayer }"
      :style="{ bottom }"
    >
      <div
        ref="bar"
        role="region"
        :aria-label="t('readingTable.title')"
        class="pointer-events-auto mx-auto flex h-12 max-w-md cursor-pointer items-center gap-2 rounded-control bg-surface ps-1.5 pe-1 shadow-pop md:max-w-xl"
        @click="openSheet"
        @touchstart.passive="onTouchStart"
        @touchmove.passive="onTouchMove"
      >
        <button
          type="button"
          class="flex h-full min-w-0 flex-1 items-center gap-2 text-start"
          :aria-label="openLabel"
          :title="openLabel"
        >
          <!-- La pile et son compte -->
          <span
            class="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <AppIcon name="books" :size="18" />
            <span class="table-count">{{ texts.length }}</span>
          </span>
          <!-- Les volumes posés, côte à côte -->
          <span class="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden" aria-hidden="true">
            <span
              v-if="hiddenCount"
              class="flex-shrink-0 text-xs font-semibold text-text-secondary"
            >
              +{{ hiddenCount }}
            </span>
            <span
              v-for="text in shown"
              :key="text.key"
              :data-table-key="text.key"
              class="tome"
              :class="{ 'tome-open': text.key === openKey, 'opacity-0': text.key === landingKey }"
              :style="{ '--binding': bindingOf(text.corpus) }"
            >
              <span class="tome-spine"></span>
              <span dir="auto" class="truncate">{{ text.title }}</span>
            </span>
          </span>
        </button>
        <span
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-text-secondary"
          aria-hidden="true"
        >
          <AppIcon name="chevron-up" :size="18" />
        </span>
      </div>
    </div>
  </Transition>

  <!-- La page qui s'envole vers la barre -->
  <div v-if="flight" ref="ghost" class="table-ghost" :style="ghostStyle" aria-hidden="true">
    <span class="table-ghost-spine"></span>
    <span dir="auto" class="table-ghost-title">{{ flight.title }}</span>
  </div>

  <ReadingTableSheet v-if="sheetMounted" @closed="sheetMounted = false" />
</template>

<style scoped>
.table-count {
  position: absolute;
  top: -0.2rem;
  inset-inline-end: -0.2rem;
  min-width: 1.05rem;
  height: 1.05rem;
  padding: 0 0.25rem;
  border-radius: var(--radius-pill);
  background-color: var(--color-brand);
  color: var(--color-on-brand);
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1.05rem;
  text-align: center;
}

/* Un volume : sa reliure en dos, son titre à côté. Taillé franc, comme les
   livres de l'étagère ; il se partage la place avec ses voisins. */
.tome {
  display: inline-flex;
  min-width: 0;
  max-width: 9.5rem;
  flex: 0 1 auto;
  align-items: center;
  gap: 0.4rem;
  height: 1.9rem;
  padding-inline-end: 0.5rem;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-soft);
  color: var(--color-text-primary);
  font-size: 0.75rem;
  font-weight: 600;
  transition: opacity 0.2s ease;
}
.tome-spine {
  width: 0.4rem;
  align-self: stretch;
  flex-shrink: 0;
  background-color: var(--binding);
}
/* Le texte à l'écran : souligné de l'encre du thème. */
.tome-open {
  box-shadow: inset 0 -2px 0 var(--color-primary);
  color: var(--color-primary);
}

.table-ghost {
  position: fixed;
  z-index: 45;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  overflow: hidden;
  border-radius: var(--radius-card);
  background-color: var(--color-surface);
  box-shadow: var(--shadow-pop);
  pointer-events: none;
}
.table-ghost-spine {
  width: 0.5rem;
  align-self: stretch;
  flex-shrink: 0;
  background-color: var(--binding);
}
.table-ghost-title {
  padding-top: 1.25rem;
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  white-space: nowrap;
  color: var(--color-text-primary);
}

.table-bar-enter-active,
.table-bar-leave-active {
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
}
.table-bar-enter-from,
.table-bar-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .table-bar-enter-active,
  .table-bar-leave-active {
    transition: none;
  }
}
</style>
