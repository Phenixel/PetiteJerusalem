<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import AppIcon from "../icons/AppIcon.vue";
import { bindingOf } from "../../config/bindings";
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
 * comme le cours qui joue dans la barre du lecteur. Chacun y est un petit
 * livre debout, dessiné comme les volumes de l'étagère de la bibliothèque
 * (la reliure de son rayon, un double filet crème, le titre en serif) : posé
 * sur la barre comme sur une planche, il ne dépasse pas en bas, et sa tête
 * dépasse un peu en haut. Le texte qu'on lit est sorti du rang, plus haut que
 * ses voisins, comme un livre qu'on vient de prendre. Le dernier posé se
 * range au bout ; quand ils ne tiennent plus, la rangée défile de côté.
 *
 * Toucher un livre ouvre ce texte, à l'endroit où on l'a laissé : passer de
 * l'un à l'autre ne demande qu'un geste. La flèche (au bout), un appui
 * ailleurs sur la barre, un glissement vers le haut, ou le livre qu'on lit
 * ouvrent la table (ReadingTableSheet), où chaque texte montre sa page. Pas
 * de pile ni de compte devant les livres : on les voit, on les compte.
 *
 * Mettre un texte de côté le fait s'envoler jusqu'ici : la tête de sa page se
 * réduit jusqu'à son livre (voir `flight` dans useReadingTable).
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

/**
 * La taille du titre sur la couverture : un mot ne s'y coupe jamais
 * (« Berakho / t »). Le plus long mot du titre décide, entre 6,5 et 10 px.
 */
function titleSize(title: string): string {
  const longest = Math.max(...title.split(/\s+/).map((word) => word.length), 1);
  return `${Math.min(10, Math.max(6.5, 74 / longest)).toFixed(1)}px`;
}

const openLabel = computed(() => t("readingTable.open", texts.value.length));

function openSheet() {
  analyticsService.capture("reading_table_opened", { texts_count: texts.value.length });
  openTableSheet();
}

/** Un livre : le texte, là où on l'a laissé ; celui qu'on lit ouvre la table. */
function onBook(text: TableText) {
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
// glissement de côté, lui, fait défiler les livres.
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

// Le livre du texte lu, ou du dernier posé, reste sous les yeux quand la
// rangée défile.
const shelf = ref<HTMLElement | null>(null);
function bookOf(key: string | null | undefined): HTMLElement | null {
  if (!key) return null;
  const all = shelf.value?.querySelectorAll<HTMLElement>("[data-table-key]") ?? [];
  return [...all].find((tab) => tab.dataset.tableKey === key) ?? null;
}
function revealBook(key: string | null | undefined) {
  const row = shelf.value;
  const tab = bookOf(key);
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
    revealBook(flight.value?.key ?? openKey.value ?? texts.value[texts.value.length - 1]?.key);
  },
  { immediate: true },
);

// --- L'envol : la tête de la page mise de côté se réduit jusqu'à son livre ---
const ghost = ref<HTMLElement | null>(null);
/** Le livre qui attend l'arrivée de sa page pour paraître. */
const landingKey = ref<string | null>(null);

watch(flight, async (current) => {
  if (!current) return;
  if (prefersLessMotion()) {
    endFlight();
    return;
  }
  landingKey.value = current.key;
  await nextTick();
  revealBook(current.key);
  const el = ghost.value;
  const target = bookOf(current.key);
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
        borderRadius: "3px",
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
        class="pointer-events-auto mx-auto flex h-12 max-w-md cursor-pointer items-center gap-1.5 rounded-control bg-surface ps-2 pe-1 shadow-pop md:max-w-xl"
        @click="openSheet"
        @touchstart.passive="onTouchStart"
        @touchmove.passive="onTouchMove"
      >
        <!-- Les textes posés : un livre debout chacun, posé sur la barre -->
        <div ref="shelf" class="table-shelf min-w-0 flex-1">
          <div class="table-shelf-row">
            <button
              v-for="text in texts"
              :key="text.key"
              type="button"
              :data-table-key="text.key"
              class="table-book"
              :class="{
                'table-book-open': text.key === openKey,
                'opacity-0': text.key === landingKey,
              }"
              :style="{
                '--binding': bindingOf(text.corpus),
                '--title-size': titleSize(text.title),
              }"
              :aria-current="text.key === openKey ? 'page' : undefined"
              :aria-label="text.place ? `${text.title}, ${text.place}` : text.title"
              :title="text.place ? `${text.title} · ${text.place}` : text.title"
              @click.stop="onBook(text)"
            >
              <span class="table-book-lift">
                <span class="table-book-pages" aria-hidden="true"></span>
                <span class="table-book-cover">
                  <span dir="auto" class="table-book-title">{{ text.title }}</span>
                </span>
              </span>
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

  <!-- La tête de la page qui s'envole vers son livre -->
  <div v-if="flight" ref="ghost" class="table-ghost" :style="ghostStyle" aria-hidden="true">
    <span v-if="flight.book" dir="auto" class="table-ghost-book">{{ flight.book }}</span>
    <span dir="auto" class="table-ghost-title">{{ flight.title }}</span>
  </div>

  <ReadingTableSheet v-if="sheetMounted" @closed="sheetMounted = false" />
</template>

<style scoped>
/* La rangée de livres défile de côté quand elle déborde, sans barre de
   défilement : le bord coupé dit qu'il y en a d'autres. Un conteneur qui
   défile coupe aussi ce qui dépasse en haut : il monte donc au-dessus de la
   barre de quoi loger la tête des livres, et laisse passer les appuis à
   travers ce qui n'est pas un livre. */
.table-shelf {
  align-self: stretch;
  margin-top: -1.5rem;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  pointer-events: none;
}
.table-shelf::-webkit-scrollbar {
  display: none;
}
.table-shelf-row {
  display: flex;
  height: 100%;
  width: max-content;
  align-items: flex-end;
  gap: 0.4rem;
  padding: 0 0.25rem 0.3rem;
}

/* Un livre debout : la couverture à la reliure de son rayon, la tranche des
   pages qui dépasse au bout, comme sur l'étagère (LibraryShelf). Posé à
   quelques pixels du bas de la barre, il dépasse d'un quart en haut. */
.table-book {
  position: relative;
  width: 3.5rem;
  height: 3.6rem;
  flex-shrink: 0;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.2s ease;
}
/* Son ombre, sur la barre ; elle reste posée quand le livre se soulève. */
.table-book::after {
  content: "";
  position: absolute;
  inset-inline: 12%;
  bottom: -2px;
  height: 4px;
  border-radius: 9999px;
  background: rgb(58 46 30 / 0.3);
  filter: blur(2px);
}
:root.dark .table-book::after {
  background: rgb(0 0 0 / 0.5);
}
.table-book-lift {
  position: absolute;
  inset: 0;
  z-index: 1;
  transform-origin: bottom center;
  transition: transform 0.3s ease-out;
}
.table-book-pages {
  position: absolute;
  inset-block: 2px;
  inset-inline-end: 0;
  width: 5px;
  border-radius: 2px;
  background: #efe5d0;
  box-shadow: inset -1.5px 0 0 #d6c8ab;
}
/* La couverture et son double filet crème, estampé comme sur l'étagère. */
.table-book-cover {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  inset-inline-end: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.3rem;
  border-radius: 3px;
  background-color: var(--binding);
  box-shadow:
    inset 0 0 0 3px var(--binding),
    inset 0 0 0 4px rgb(236 223 196 / 0.5),
    inset 0 0 0 5.5px var(--binding),
    inset 0 0 0 6px rgb(236 223 196 / 0.28),
    0 1px 2px rgb(30 26 18 / 0.25);
}
/* Le titre, comme doré à chaud : en serif, centré, sur deux ou trois lignes. */
.table-book-title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  color: #f3ead6;
  font-family: var(--font-serif);
  font-size: var(--title-size, 10px);
  font-weight: 600;
  line-height: 1.15;
  text-align: center;
  /* La règle de [dir="auto"] (assets/main.css) passe un mot trop long à la
     ligne : sur une couverture, le titre rapetisse plutôt (titleSize). */
  overflow-wrap: normal;
}
/* Le livre qu'on lit, sorti du rang ; les autres se soulèvent au survol. */
@media (hover: hover) {
  .table-book:hover .table-book-lift {
    transform: translateY(-3px);
  }
}
.table-book-open .table-book-lift,
.table-book-open:hover .table-book-lift {
  transform: translateY(-7px);
}
.table-book:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 4px;
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
