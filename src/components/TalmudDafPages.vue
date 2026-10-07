<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { flatMeforshim, type DafBlock, type DafMeforshim } from "../services/textService";
import TalmudPage from "./TalmudPage.vue";

/**
 * Un chapitre de guemara dans la forme de la page : un amoud après l'autre,
 * chacun sous son repère « Daf 2a » (l'ancre du menu de lecture, comme dans
 * TalmudDafText), Rachi et Tossafot autour (TalmudPage).
 *
 * Tant que les commentaires arrivent, la page montre la guemara seule ; s'ils
 * ne viennent pas (hors ligne, sans copie locale), elle le dit, et la guemara
 * reste lisible dans sa forme.
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
 * par passage. Calculés une fois par chargement, pour que la page ne se
 * recompose pas à chaque rendu de la lecture.
 */
const flat = computed(() => {
  const byAmud = new Map<number, ReturnType<typeof flatMeforshim>>();
  for (const [amud, m] of props.meforshim ?? []) byAmud.set(amud, flatMeforshim(m));
  return byAmud;
});
function pageMeforshim(block: DafBlock) {
  return block.amud !== undefined ? (flat.value.get(block.amud) ?? null) : null;
}

/** L'index de la première ligne de chaque daf dans la section (ancres). */
function offsetOf(index: number): number {
  let offset = 0;
  for (let i = 0; i < index; i++) offset += props.blocks[i].lines.length;
  return offset;
}
</script>

<template>
  <p v-if="state === 'error'" class="mb-4 text-sm text-text-secondary">
    {{ t("textReading.pageForm.meforshimUnavailable") }}
  </p>
  <template v-for="(block, index) in blocks" :key="`${index}-${block.daf}`">
    <p :data-block-anchor="offsetOf(index)" class="mt-8 mb-3 text-sm font-semibold text-primary">
      {{ t("textReading.labels.daf", { daf: block.daf }) }}
    </p>
    <TalmudPage
      :daf="block.daf"
      :lines="block.lines"
      :meforshim="pageMeforshim(block)"
      :scale="scale"
    />
  </template>
</template>
