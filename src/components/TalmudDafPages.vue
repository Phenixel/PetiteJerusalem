<script setup lang="ts">
import { useI18n } from "vue-i18n";
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
 */
const props = defineProps<{
  blocks: DafBlock[];
  meforshim: Map<number, DafMeforshim> | null;
  state: "loading" | "ready" | "error";
  scale: number;
}>();

const { t } = useI18n();

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
      :meforshim="block.amud !== undefined ? (meforshim?.get(block.amud) ?? null) : null"
      :scale="scale"
    />
  </template>
</template>
