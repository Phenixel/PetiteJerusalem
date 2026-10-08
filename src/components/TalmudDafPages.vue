<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useReadingColumn } from "../composables/useReadingColumn";
import { linkedMeforshim, nextLink, type DafLink } from "../services/dafLinks";
import { pageZoomFrame } from "../services/pageZoom";
import type { DafBlock, DafMeforshim } from "../services/textService";
import TalmudPage from "./TalmudPage.vue";

/**
 * Un chapitre de guemara dans la forme de la page : un amoud après l'autre,
 * chacun sous son repère « Daf 2a » (l'ancre du menu de lecture, comme dans
 * TalmudDafText), Rachi et Tossafot autour (TalmudPage).
 *
 * Tant que les commentaires arrivent, la page montre la guemara seule ; s'ils
 * ne viennent pas (hors ligne, sans copie locale), elle le dit, et la guemara
 * reste lisible dans sa forme.
 *
 * La taille de lecture (A− / A+, le pincement dans l'app) n'agrandit pas le
 * texte de la page : cela déplacerait ses lignes, et une page de Vilna se
 * reconnaît à ses lignes. Elle agrandit la page entière, comme une loupe. La
 * page prend `scale` fois la largeur disponible ; ses caractères suivent sa
 * largeur (TalmudPage), ses proportions restent donc celles du livre. Elle
 * déborde d'abord de la colonne de lecture, dans la place libre de chaque
 * côté (un ordinateur en a) ; ce qui dépasse encore se rejoint en faisant
 * glisser la page de côté (pageZoom.ts).
 */
const props = defineProps<{
  blocks: DafBlock[];
  meforshim: Map<number, DafMeforshim> | null;
  state: "loading" | "ready" | "error";
  scale: number;
}>();

const { t } = useI18n();

/**
 * Les commentaires de chaque amoud, bout à bout : la page ne les découpe pas
 * par passage, mais chacun garde le passage qu'il explique (dafLinks.ts).
 * Calculés une fois par chargement, pour que la page ne se recompose pas à
 * chaque rendu de la lecture.
 */
const flat = computed(() => {
  const byAmud = new Map<number, ReturnType<typeof linkedMeforshim>>();
  for (const [amud, m] of props.meforshim ?? []) byAmud.set(amud, linkedMeforshim(m));
  return byAmud;
});
function pageMeforshim(block: DafBlock) {
  return block.amud !== undefined ? (flat.value.get(block.amud) ?? null) : null;
}

/**
 * Le passage ou le commentaire qu'on a touché, et sa page : un seul à la fois
 * dans le chapitre. Le toucher à nouveau le relâche.
 */
const linked = ref<(DafLink & { page: number }) | null>(null);
function onLink(page: number, touched: DafLink | null): void {
  const current = linked.value?.page === page ? linked.value : null;
  const next = nextLink(current && { passage: current.passage, comment: current.comment }, touched);
  linked.value = next && { ...next, page };
}
// Un autre chapitre : plus rien de choisi.
watch(
  () => props.blocks,
  () => (linked.value = null),
);

/** La colonne de lecture et la place libre autour d'elle (useReadingColumn). */
const { ruler, column, free } = useReadingColumn();

const zoom = computed(() =>
  pageZoomFrame(props.scale, column.value, free.value.left, free.value.right),
);
/** Le cadre déborde de la colonne d'autant de chaque côté. */
const frameStyle = computed(() => ({ marginInline: `${-zoom.value.grow}px` }));
/** La page agrandie ; avant la première mesure, en part de la colonne. */
const pageStyle = computed(() => ({
  width: column.value ? `${zoom.value.page}px` : `${Math.round(props.scale * 100)}%`,
}));

/**
 * Les cadres des pages, pour garder sous les yeux ce qu'on regardait quand
 * la loupe change : le milieu de ce qui était visible reste au milieu.
 */
const frames = new Map<number, HTMLElement>();
function setFrame(index: number, el: unknown): void {
  if (!(el instanceof HTMLElement)) {
    frames.delete(index);
    return;
  }
  if (frames.get(index) === el) return;
  frames.set(index, el);
  // Une page ouverte déjà agrandie se présente par son milieu : la guemara.
  void nextTick(() => {
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  });
}

/** Le milieu visible d'un cadre, de 0 (bord gauche) à 1 (bord droit). */
function centreOf(frame: HTMLElement): number {
  const hidden = frame.scrollWidth - frame.clientWidth;
  if (hidden <= 0) return 0.5;
  // En écriture de droite à gauche, `scrollLeft` part de 0 et descend.
  const left = frame.scrollLeft < 0 ? hidden + frame.scrollLeft : frame.scrollLeft;
  return (left + frame.clientWidth / 2) / frame.scrollWidth;
}

watch(
  () => props.scale,
  async () => {
    const centres = new Map([...frames].map(([index, frame]) => [index, centreOf(frame)]));
    await nextTick();
    for (const [index, frame] of frames) {
      const centre = centres.get(index) ?? 0.5;
      frame.scrollLeft = centre * frame.scrollWidth - frame.clientWidth / 2;
    }
  },
);

/** L'index de la première ligne de chaque daf dans la section (ancres). */
function offsetOf(index: number): number {
  let offset = 0;
  for (let i = 0; i < index; i++) offset += props.blocks[i].lines.length;
  return offset;
}
</script>

<template>
  <div ref="ruler" class="daf-ruler" aria-hidden="true"></div>
  <p v-if="state === 'error'" class="mb-4 text-sm text-text-secondary">
    {{ t("textReading.pageForm.meforshimUnavailable") }}
  </p>
  <template v-for="(block, index) in blocks" :key="`${index}-${block.daf}`">
    <p :data-block-anchor="offsetOf(index)" class="mt-8 mb-3 text-sm font-semibold text-primary">
      {{ t("textReading.labels.daf", { daf: block.daf }) }}
    </p>
    <!-- Le cadre de la loupe : la page s'y élargit, il déborde de la colonne
         tant qu'il y a de la place, et la page s'y fait glisser au-delà. Il
         est écrit de gauche à droite pour que `scrollLeft` se lise de la même
         façon partout ; la page, dedans, garde son sens. -->
    <div :ref="(el) => setFrame(index, el)" class="daf-zoom" dir="ltr" :style="frameStyle">
      <div class="daf-zoom-page" :style="pageStyle">
        <TalmudPage
          :daf="block.daf"
          :lines="block.lines"
          :meforshim="pageMeforshim(block)"
          :passages="block.passages"
          :linked="linked?.page === index ? linked : null"
          :scale="1"
          :tractate-start="block.amud === 0"
          @link="onLink(index, $event)"
        />
      </div>
    </div>
  </template>
</template>

<style scoped>
/* Le repère de la colonne de lecture : sa largeur, sans hauteur. */
.daf-ruler {
  height: 0;
}

/* Une page plus large que la place qu'elle a se fait glisser de côté ; plus
   étroite (A−), elle se tient au milieu. */
.daf-zoom {
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
}

.daf-zoom-page {
  margin-inline: auto;
}
</style>
