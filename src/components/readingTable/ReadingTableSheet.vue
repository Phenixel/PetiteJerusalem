<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import AppIcon from "../icons/AppIcon.vue";
import { useConfirm } from "../../composables/useConfirm";
import { useOverlay } from "../../composables/useOverlayStack";
import {
  clearTable,
  closeTableSheet,
  openFromTable,
  placeOnTable,
  removeFromTable,
  useReadingTable,
  type TableText,
} from "../../composables/useReadingTable";
import { analyticsService } from "../../services/analyticsService";

/**
 * La table d'étude ouverte : un panneau qui monte du bas, à la hauteur de ce
 * qu'il porte, sous lequel la page reste visible. Chaque texte posé y montre
 * sa page ouverte, comme un livre sur une table : son rayon et son livre à
 * l'encre du thème (la tête de la page de lecture), son nom, la première
 * ligne de la page où on l'a laissé, dans sa langue, et l'endroit. Une ligne
 * par texte, séparées d'un filet, dans l'ordre de la barre. Un appui en
 * rouvre un, à cet endroit même ; celui qu'on lit est marqué « Ouvert ». Une
 * croix range un texte, « Tout ranger » vide la table.
 *
 * Ouvert depuis un texte qui n'est pas encore sur la table, il propose de
 * l'y poser aussi : passer à un autre ne le fait pas perdre.
 *
 * Il se ferme comme une fenêtre (Échap, retour Android, un appui sur la
 * page autour) et, sur un téléphone, en le tirant vers le bas.
 */
const emit = defineEmits<{ closed: [] }>();

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const { confirm } = useConfirm();
const { texts, sheetOpen, openKey, reader } = useReadingTable();

/** Le texte à l'écran, s'il n'est pas déjà sur la table : on peut l'y poser. */
const unplaced = ref<TableText | null>(null);
function refreshUnplaced() {
  const current = reader.value;
  unplaced.value =
    current && !texts.value.some((text) => text.key === current.key) ? current.snapshot() : null;
}
watch(sheetOpen, (open) => open && refreshUnplaced(), { immediate: true });

/**
 * Au-dessus du nom : le rayon et le livre (« Tanakh · Berechit »), sans
 * répéter le nom quand le livre le porte déjà (la paracha Berechit).
 */
const TYPE_KEYS: Record<string, string> = { michna: "mishna" };
function headOf(text: TableText): string {
  const corpus = text.corpus ? t(`study.types.${TYPE_KEYS[text.corpus] ?? text.corpus}`) : "";
  const book = text.book && text.book !== text.title && text.book !== corpus ? text.book : "";
  return [corpus, book].filter(Boolean).join(" · ");
}

/** Une ligne en hébreu s'écrit dans sa police, de droite à gauche. */
const HEBREW = /[\u0590-\u05ff]/;

function close() {
  closeTableSheet();
}

function openText(text: TableText) {
  analyticsService.capture("reading_table_text_opened", {
    text_id: text.key,
    corpus: text.corpus,
    texts_count: texts.value.length,
    was_open: text.key === openKey.value,
    from: "table",
  });
  openFromTable(text.key, router);
}

function remove(text: TableText) {
  analyticsService.capture("reading_table_text_removed", {
    text_id: text.key,
    texts_count: texts.value.length - 1,
  });
  removeFromTable(text.key);
}

function placeCurrent() {
  const text = unplaced.value;
  if (!text) return;
  placeOnTable(text);
  analyticsService.capture("text_set_aside", {
    text_id: text.key,
    corpus: text.corpus,
    texts_count: texts.value.length,
    from: "table",
  });
  unplaced.value = null;
}

async function clearAll() {
  const accepted = await confirm({
    title: t("readingTable.clearTitle"),
    message: t("readingTable.clearMessage"),
    confirmLabel: t("readingTable.clearConfirm"),
  });
  if (!accepted) return;
  analyticsService.capture("reading_table_cleared", { texts_count: texts.value.length });
  clearTable();
}

// --- Fermeture : Échap, retour Android, navigation ---
useOverlay(sheetOpen, close);
function onKeydown(event: KeyboardEvent) {
  // Une fenêtre posée par-dessus (la confirmation de « Tout ranger ») a déjà
  // pris Échap pour elle : la table reste ouverte.
  if (event.defaultPrevented) return;
  if (event.key === "Escape" && sheetOpen.value) {
    event.preventDefault();
    close();
  }
}
watch(
  () => route.fullPath,
  () => {
    if (sheetOpen.value) close();
  },
);

// Le défilement de la page s'arrête derrière le panneau, et le clavier y
// entre ; il revient à ce qui l'avait à la fermeture.
const panel = ref<HTMLElement | null>(null);
let overflowBefore: string | null = null;
let focusedBefore: HTMLElement | null = null;
watch(
  sheetOpen,
  async (open) => {
    if (open && overflowBefore === null) {
      overflowBefore = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
      focusedBefore = document.activeElement as HTMLElement | null;
      await nextTick();
      panel.value?.focus();
    } else if (!open && overflowBefore !== null) {
      document.documentElement.style.overflow = overflowBefore;
      overflowBefore = null;
      focusedBefore?.focus?.();
      focusedBefore = null;
    }
  },
  { immediate: true },
);
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  if (overflowBefore !== null) document.documentElement.style.overflow = overflowBefore;
});

// --- Téléphone : tirer le panneau vers le bas le referme ---
const CLOSE_DRAG = 90;
const dragY = ref(0);
let dragStart: number | null = null;
function onDragStart(event: TouchEvent) {
  dragStart = event.touches[0]?.clientY ?? null;
}
function onDragMove(event: TouchEvent) {
  const y = event.touches[0]?.clientY;
  if (dragStart === null || y === undefined) return;
  dragY.value = Math.max(0, y - dragStart);
}
function onDragEnd() {
  if (dragStart === null) return;
  dragStart = null;
  if (dragY.value > CLOSE_DRAG) close();
  dragY.value = 0;
}
const panelStyle = computed(() =>
  dragY.value ? { transform: `translateY(${dragY.value}px)`, transition: "none" } : undefined,
);
</script>

<template>
  <Teleport to="body">
    <Transition name="table-veil" appear>
      <div v-if="sheetOpen" class="table-veil" aria-hidden="true" @click="close"></div>
    </Transition>
    <Transition name="table-sheet" appear @after-leave="emit('closed')">
      <section
        v-if="sheetOpen"
        ref="panel"
        class="table-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reading-table-title"
        tabindex="-1"
        :style="panelStyle"
      >
        <!-- La poignée et l'en-tête : on y tire le panneau vers le bas. -->
        <div
          class="flex-shrink-0 touch-none"
          @touchstart.passive="onDragStart"
          @touchmove.passive="onDragMove"
          @touchend="onDragEnd"
          @touchcancel="onDragEnd"
        >
          <div class="flex justify-center pt-2.5 pb-1">
            <span class="h-1 w-10 rounded-full bg-text-secondary/30"></span>
          </div>
          <header class="flex items-start justify-between gap-3 px-5 pt-1 pb-3">
            <div class="min-w-0">
              <h2
                id="reading-table-title"
                class="font-display text-2xl font-bold text-text-primary"
              >
                {{ t("readingTable.title") }}
              </h2>
              <p class="mt-0.5 text-sm text-text-secondary">
                {{ t("readingTable.count", texts.length) }}
              </p>
            </div>
            <button
              type="button"
              class="icon-btn flex-shrink-0"
              :aria-label="t('common.close')"
              :title="t('common.close')"
              @click="close"
            >
              <AppIcon name="x" :size="18" />
            </button>
          </header>
        </div>

        <!-- Le texte à l'écran, pas encore sur la table -->
        <div v-if="unplaced" class="flex-shrink-0 px-5 pb-2">
          <button type="button" class="table-place" @click="placeCurrent">
            <AppIcon name="plus" :size="16" class="flex-shrink-0" />
            <span class="truncate">{{
              t("readingTable.placeCurrent", { title: unplaced.title })
            }}</span>
          </button>
        </div>

        <!-- Les pages ouvertes, dans l'ordre de la barre -->
        <ul class="table-list min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
          <li v-for="text in texts" :key="text.key" class="flex items-start gap-1">
            <button
              type="button"
              class="table-page group min-w-0 flex-1 text-start"
              :aria-current="text.key === openKey ? 'true' : undefined"
              @click="openText(text)"
            >
              <span v-if="headOf(text)" class="block truncate text-xs font-semibold text-primary">
                {{ headOf(text) }}
              </span>
              <span class="mt-0.5 flex items-center gap-2">
                <span
                  dir="auto"
                  class="truncate font-semibold text-text-primary transition-colors group-hover:text-primary"
                >
                  {{ text.title }}
                </span>
                <span
                  v-if="text.key === openKey"
                  class="chip flex-shrink-0 bg-primary/10 text-primary"
                >
                  {{ t("readingTable.openNow") }}
                </span>
              </span>
              <!-- La page où on l'a laissé : sa première ligne, dans sa langue -->
              <span
                v-if="text.excerpt"
                :dir="HEBREW.test(text.excerpt) ? 'rtl' : 'auto'"
                class="table-excerpt"
                :class="{ 'font-hebrew': HEBREW.test(text.excerpt) }"
              >
                {{ text.excerpt }}
              </span>
              <span v-if="text.place" class="mt-1 block truncate text-sm text-text-secondary">
                {{ text.place }}
              </span>
            </button>
            <button
              type="button"
              class="icon-btn mt-3 flex-shrink-0"
              :aria-label="t('readingTable.remove', { title: text.title })"
              :title="t('readingTable.remove', { title: text.title })"
              @click="remove(text)"
            >
              <AppIcon name="x" :size="16" />
            </button>
          </li>
        </ul>

        <footer class="flex flex-shrink-0 items-center justify-between gap-3 px-5 pt-1 pb-4">
          <p class="text-xs text-text-secondary">{{ t("readingTable.hint") }}</p>
          <button
            type="button"
            class="flex-shrink-0 text-sm font-semibold text-text-secondary transition-colors hover:text-primary"
            @click="clearAll"
          >
            {{ t("readingTable.clear") }}
          </button>
        </footer>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Le voile laisse voir la page : la table se pose dessus, elle ne la cache pas. */
.table-veil {
  position: fixed;
  inset: 0;
  z-index: 55;
  background-color: rgb(20 16 8 / 0.3);
}

/* Le panneau : une surface, taillée franc comme une fenêtre, qui monte du bas ; à la hauteur
   de ce qu'il porte, sans jamais dépasser les trois quarts de l'écran. */
.table-sheet {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 56;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 36rem;
  max-height: min(75vh, 40rem);
  margin-inline: auto;
  padding-bottom: max(var(--safe-bottom, 0px), env(safe-area-inset-bottom, 0px));
  border-start-start-radius: var(--radius-xl);
  border-start-end-radius: var(--radius-xl);
  background-color: var(--color-surface);
  box-shadow: var(--shadow-pop);
  outline: none;
  transition: transform 0.2s ease;
}
@media (min-width: 768px) {
  .table-sheet {
    bottom: 1rem;
    border-radius: var(--radius-xl);
  }
}

/* Une ligne par texte, séparées d'un filet, comme la file du lecteur. */
.table-list > li + li {
  border-top: 1px solid var(--color-line);
}
.table-page {
  display: block;
  padding-block: 0.875rem;
}
/* La première ligne de la page : le texte même, dans sa police de lecture,
   sur une ligne, coupée du côté où elle finit. */
.table-excerpt {
  display: block;
  margin-top: 0.375rem;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 1.05rem;
  line-height: 1.6;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* « Poser aussi » : une commande à la couleur du thème, qui dit ce qu'elle fait. */
.table-place {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  border-radius: var(--radius-btn);
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
  font-size: 0.875rem;
  font-weight: 600;
  transition: background-color 0.2s ease;
}
.table-place:hover {
  background-color: color-mix(in srgb, var(--color-primary) 16%, transparent);
}

.table-veil-enter-active,
.table-veil-leave-active {
  transition: opacity 0.25s ease;
}
.table-veil-enter-from,
.table-veil-leave-to {
  opacity: 0;
}
.table-sheet-enter-active,
.table-sheet-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.table-sheet-enter-from,
.table-sheet-leave-to {
  transform: translateY(105%);
}
@media (prefers-reduced-motion: reduce) {
  .table-veil-enter-active,
  .table-veil-leave-active,
  .table-sheet-enter-active,
  .table-sheet-leave-active {
    transition: none;
  }
}
</style>
