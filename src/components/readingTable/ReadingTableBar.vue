<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import AppIcon from "../icons/AppIcon.vue";
import { useMiniPlayerVisible } from "../../composables/useAudioPlayer";
import { useBottomChromeHeight } from "../../composables/useBottomChrome";
import { isNativeApp } from "../../composables/useNativeApp";
import { prefersLessMotion } from "../../composables/useMotion";
import {
  endFlight,
  openFromTable,
  openTableSheet,
  useReadingTable,
  type TableText,
} from "../../composables/useReadingTable";
import { analyticsService } from "../../services/analyticsService";

/**
 * La barre de la table d'étude : les textes mis de côté, en bas de l'écran
 * comme le cours qui joue dans la barre du lecteur, et sous la forme que le
 * site donne déjà à un choix entre voisins, un jeu d'onglets (la bascule
 * hébreu / phonétique, Bibliothèque / Chiourim / Partage). Le texte qu'on lit
 * est l'onglet levé, blanc, à l'encre du thème. Le dernier posé se range au
 * bout ; quand ils ne tiennent plus, la rangée défile de côté.
 *
 * Toucher un onglet ouvre ce texte, à l'endroit où on l'a laissé : passer de
 * l'un à l'autre ne demande qu'un geste. La pile (au début), la flèche (au
 * bout), un appui ailleurs sur la barre ou un glissement vers le haut ouvrent
 * la table (ReadingTableSheet), où chaque texte montre sa page.
 *
 * Mettre un texte de côté le fait s'envoler jusqu'ici : la tête de sa page se
 * réduit jusqu'à son onglet (voir `flight` dans useReadingTable).
 *
 * Montée sur toutes les pages : rien ici ne tire le catalogue des textes ;
 * le panneau se charge à la demande.
 */
const loadSheet = () => import("./ReadingTableSheet.vue");
const ReadingTableSheet = defineAsyncComponent(loadSheet);

const { t } = useI18n();
const router = useRouter();
const { texts, sheetOpen, flight, openKey } = useReadingTable();

// Au-dessus de la barre de l'app et du lecteur audio, sous ce qu'elle porte.
const bottom = useBottomChromeHeight("0.5rem", { table: false });
// Sur un écran large, la barre du lecteur est plus haute (ses commandes et
// sa barre de lecture sur deux rangs) : la table s'en écarte d'autant.
const miniPlayerVisible = useMiniPlayerVisible();
const aboveWidePlayer = computed(() => miniPlayerVisible.value && !isNativeApp);

const openLabel = computed(() => t("readingTable.open", texts.value.length));

function openSheet() {
  analyticsService.capture("reading_table_opened", { texts_count: texts.value.length });
  openTableSheet();
}

/** Un onglet : le texte, là où on l'a laissé ; celui qu'on lit ouvre la table. */
function onTab(text: TableText) {
  if (text.key === openKey.value || !router) {
    openSheet();
    return;
  }
  analyticsService.capture("reading_table_text_opened", {
    text_id: text.key,
    corpus: text.corpus,
    texts_count: texts.value.length,
    was_open: false,
    from: "bar",
  });
  openFromTable(text.key, router);
}

// Téléphone : un glissement vers le haut sur la barre l'ouvre aussi. Un
// glissement de côté, lui, fait défiler les onglets.
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

// L'onglet du texte lu, ou du dernier posé, reste sous les yeux quand la
// rangée défile.
const tabs = ref<HTMLElement | null>(null);
function tabOf(key: string | null | undefined): HTMLElement | null {
  if (!key) return null;
  const all = tabs.value?.querySelectorAll<HTMLElement>("[data-table-key]") ?? [];
  return [...all].find((tab) => tab.dataset.tableKey === key) ?? null;
}
function revealTab(key: string | null | undefined) {
  const row = tabs.value;
  const tab = tabOf(key);
  if (!row || !tab) return;
  const start =
    tab.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft;
  const end = start + tab.offsetWidth;
  if (start < row.scrollLeft) row.scrollLeft = start;
  else if (end > row.scrollLeft + row.clientWidth) row.scrollLeft = end - row.clientWidth;
}
watch(
  [openKey, () => texts.value.length],
  async () => {
    await nextTick();
    revealTab(flight.value?.key ?? openKey.value ?? texts.value[texts.value.length - 1]?.key);
  },
  { immediate: true },
);

// --- L'envol : la tête de la page mise de côté se réduit jusqu'à son onglet ---
const ghost = ref<HTMLElement | null>(null);
/** L'onglet qui attend l'arrivée de sa page pour paraître. */
const landingKey = ref<string | null>(null);

watch(flight, async (current) => {
  if (!current) return;
  if (prefersLessMotion()) {
    endFlight();
    return;
  }
  landingKey.value = current.key;
  await nextTick();
  revealTab(current.key);
  const el = ghost.value;
  const target = tabOf(current.key);
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
        borderRadius: "6px",
        opacity: 1,
      },
      {
        top: `${to.top}px`,
        left: `${to.left}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        borderRadius: "10px",
        opacity: 0.85,
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
        role="region"
        :aria-label="t('readingTable.title')"
        class="pointer-events-auto mx-auto flex h-12 max-w-md cursor-pointer items-center gap-1.5 rounded-control bg-surface ps-1.5 pe-1 shadow-pop md:max-w-xl"
        @click="openSheet"
        @touchstart.passive="onTouchStart"
        @touchmove.passive="onTouchMove"
      >
        <!-- La pile et son compte : la table -->
        <button
          type="button"
          class="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          :aria-label="openLabel"
          :title="openLabel"
          @click.stop="openSheet"
        >
          <AppIcon name="books" :size="18" />
          <span class="table-count" aria-hidden="true">{{ texts.length }}</span>
        </button>

        <!-- Les textes posés : un onglet chacun -->
        <div ref="tabs" class="table-tabs min-w-0 flex-1">
          <div class="inline-flex rounded-btn bg-black/5 p-0.5 dark:bg-white/10">
            <button
              v-for="text in texts"
              :key="text.key"
              type="button"
              :data-table-key="text.key"
              class="table-tab"
              :class="{
                'table-tab-open': text.key === openKey,
                'opacity-0': text.key === landingKey,
              }"
              :aria-current="text.key === openKey ? 'page' : undefined"
              :title="text.place ? `${text.title} · ${text.place}` : text.title"
              @click.stop="onTab(text)"
            >
              <span dir="auto" class="truncate">{{ text.title }}</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          class="flex h-10 w-9 flex-shrink-0 items-center justify-center rounded-full text-text-secondary"
          :aria-label="openLabel"
          @click.stop="openSheet"
        >
          <AppIcon name="chevron-up" :size="18" />
        </button>
      </div>
    </div>
  </Transition>

  <!-- La tête de la page qui s'envole vers son onglet -->
  <div v-if="flight" ref="ghost" class="table-ghost" :style="ghostStyle" aria-hidden="true">
    <span v-if="flight.book" dir="auto" class="table-ghost-book">{{ flight.book }}</span>
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

/* La rangée d'onglets défile de côté quand elle déborde, sans barre de
   défilement : le bord coupé dit qu'il y en a d'autres. */
.table-tabs {
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}
.table-tabs::-webkit-scrollbar {
  display: none;
}

/* Un onglet : le dessin de la bascule hébreu / phonétique. */
.table-tab {
  display: inline-flex;
  max-width: 9rem;
  flex-shrink: 0;
  align-items: center;
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-control);
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    opacity 0.2s ease;
}
.table-tab:hover {
  color: var(--color-text-primary);
}
.table-tab-open,
.table-tab-open:hover {
  background-color: var(--color-surface);
  color: var(--color-primary);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
}

/* La tête de la page lue, comme en haut de la lecture : le livre à l'encre
   du thème, le nom en Playfair. */
.table-ghost {
  position: fixed;
  z-index: 45;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1.5rem;
  overflow: hidden;
  border-radius: var(--radius-card);
  background-color: var(--color-surface);
  box-shadow: var(--shadow-pop);
  pointer-events: none;
}
.table-ghost-book {
  color: var(--color-primary);
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
}
.table-ghost-title {
  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.15;
  white-space: nowrap;
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
