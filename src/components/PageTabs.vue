<script lang="ts">
/**
 * D'où part la pastille au prochain montage d'un jeu d'onglets : chaque
 * onglet est une page à part, la barre du nouvel onglet est donc une autre
 * instance que celle qu'on vient de toucher. Le toucher note la position
 * quittée, la barre qui se monte la reprend et glisse jusqu'à son onglet. Une
 * arrivée par un autre chemin (barre du bas, lien) ne trouve rien à reprendre
 * et pose la pastille sans mouvement.
 */
let pendingSlide: { group: string; from: number } | null = null;

/** Le toucher d'un onglet note d'où part la pastille. */
function notePendingSlide(group: string, from: number): void {
  pendingSlide = { group, from };
}

/** D'où part la pastille pour ce jeu d'onglets, null si l'on n'arrive pas d'un onglet. */
function pendingSlideFrom(group: string): number | null {
  return pendingSlide?.group === group ? pendingSlide.from : null;
}

/** La barre montée a repris la position : elle ne vaut plus. */
function clearPendingSlide(): void {
  pendingSlide = null;
}
</script>

<script setup lang="ts">
/**
 * Des pages voisines, un jeu d'onglets en tête, dans l'app native.
 *
 * La barre du bas ne tient que quatre onglets : des pages qui vont ensemble
 * n'y ont pas toutes leur place, et elles finissaient introuvables (le partage
 * de lectures n'était atteignable que par l'accueil, le calendrier des fêtes
 * par un petit lien perdu sous le titre des horaires). Elles se rangent donc
 * ensemble, là où l'on est déjà : la bibliothèque, les chiourim et le partage
 * dans l'Étude ; les horaires du jour et le calendrier de l'année.
 *
 * Sur le site, ce composant ne sert pas : le bandeau et le menu mènent partout
 * d'un clic.
 *
 * Ce sont de vraies pages, pas des panneaux : chacune garde son adresse (lien
 * partagé, retour Android, reprise de défilement), l'onglet ne fait que les
 * relier. L'onglet actif est celui dont l'adresse ouvre celle qu'on lit, la
 * plus précise l'emportant : /share-reading/session/x est bien au partage.
 *
 * Changer d'onglet fait glisser la pastille blanche de l'un à l'autre : un
 * mouvement qui répond au geste, et qui dit qu'on reste dans la même section.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { analyticsService } from "../services/analyticsService";
import { prefersLessMotion } from "../composables/useMotion";

export interface PageTab {
  /** Sert aussi de valeur dans la mesure d'audience. */
  id: string;
  to: string;
  labelKey: string;
}

const props = defineProps<{
  tabs: PageTab[];
  /** Nom de l'événement d'audience posé au changement d'onglet. */
  event: string;
  /** Ce que le groupe annonce aux lecteurs d'écran. */
  label: string;
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const activeId = computed(() => {
  const matching = props.tabs.filter((tab) => route.path.startsWith(tab.to));
  const best = matching.sort((a, b) => b.to.length - a.to.length)[0];
  return best?.id ?? props.tabs[0]?.id;
});
const activeIndex = computed(() =>
  Math.max(
    0,
    props.tabs.findIndex((tab) => tab.id === activeId.value),
  ),
);

function go(tab: PageTab): void {
  if (tab.id === activeId.value) return;
  analyticsService.capture(props.event, { tab: tab.id });
  notePendingSlide(props.event, activeIndex.value);
  void router.push(tab.to);
}

// Arrivé par un onglet de ce jeu : la barre est déjà là, seule la pastille
// bouge. Le fondu d'arrivée ne se joue qu'en arrivant d'ailleurs.
const arrivingByTab = pendingSlideFrom(props.event) !== null;

// --- La pastille, posée sous l'onglet actif ---
// Tant qu'elle n'est pas mesurée, l'onglet actif porte lui-même le fond blanc :
// rien ne clignote au premier rendu.
const shell = ref<HTMLElement | null>(null);
// Rangés par index : le tableau d'un `ref` dans un v-for ne garantit pas
// l'ordre des onglets.
const buttons: (HTMLButtonElement | null)[] = [];
function setButton(el: unknown, index: number): void {
  buttons[index] = el instanceof HTMLButtonElement ? el : null;
}
const pill = ref<{ x: number; w: number } | null>(null);
const sliding = ref(false);

function measure(index: number): { x: number; w: number } | null {
  const button = buttons[index];
  return button ? { x: button.offsetLeft, w: button.offsetWidth } : null;
}

function place(): void {
  sliding.value = false;
  pill.value = measure(activeIndex.value);
}

function slideFrom(from: number): void {
  const start = measure(from);
  if (!start || prefersLessMotion()) return place();
  sliding.value = false;
  pill.value = start;
  // Deux images : la première pose la pastille au départ, la seconde lance
  // la transition vers l'onglet actif.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      sliding.value = true;
      pill.value = measure(activeIndex.value);
    }),
  );
}

const pillStyle = computed(() =>
  pill.value ? { width: `${pill.value.w}px`, transform: `translateX(${pill.value.x}px)` } : {},
);

let resizeObserver: ResizeObserver | null = null;
onMounted(async () => {
  await nextTick();
  const from = pendingSlideFrom(props.event);
  clearPendingSlide();
  if (from !== null && from !== activeIndex.value) slideFrom(from);
  else place();
  // Les polices arrivent après le premier rendu, la langue peut changer : la
  // pastille suit la largeur des onglets, sans mouvement.
  if (typeof ResizeObserver !== "undefined" && shell.value) {
    resizeObserver = new ResizeObserver(() => place());
    resizeObserver.observe(shell.value);
  }
});
onUnmounted(() => resizeObserver?.disconnect());

// Même page, autre onglet (une vue qui en porte deux) : la pastille glisse.
watch(activeIndex, (index, previous) => {
  if (previous !== undefined && previous !== index) slideFrom(previous);
});
</script>

<template>
  <div class="mb-6 flex justify-center" :class="{ 'animate-[fadeIn_0.4s_ease]': !arrivingByTab }">
    <div
      ref="shell"
      class="relative inline-flex p-0.5 rounded-btn bg-black/5 dark:bg-white/10"
      role="group"
      :aria-label="label"
    >
      <span
        v-if="pill"
        class="tabs-pill absolute top-0.5 bottom-0.5 left-0 rounded-control bg-surface shadow-sm"
        :class="{ 'tabs-pill-sliding': sliding }"
        :style="pillStyle"
        aria-hidden="true"
      ></span>
      <button
        v-for="(tab, index) in tabs"
        :key="tab.id"
        :ref="(el) => setButton(el, index)"
        type="button"
        class="relative rounded-control px-4 py-2 text-sm font-semibold transition-colors"
        :class="[
          activeId === tab.id ? 'text-primary' : 'text-text-secondary',
          activeId === tab.id && !pill ? 'bg-surface shadow-sm' : '',
        ]"
        :aria-pressed="activeId === tab.id"
        @click="go(tab)"
      >
        {{ t(tab.labelKey) }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* La pastille glisse d'un onglet à l'autre, en s'étirant à la largeur du
   suivant ; elle ne bouge que lorsqu'on a touché un onglet. */
.tabs-pill-sliding {
  transition:
    transform 0.32s cubic-bezier(0.3, 0.7, 0.3, 1),
    width 0.32s cubic-bezier(0.3, 0.7, 0.3, 1);
}
</style>
