<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { DafBlock } from "../services/textService";

/**
 * Une guemara : le texte d'un chapitre d'un seul tenant, un repère à chaque
 * changement de daf. Le même rendu dans le lecteur de la bibliothèque et dans
 * la lecture du jour ; seule la taille change (`variant`), la lecture du jour
 * posant plusieurs textes sur une page.
 *
 * `anchored` pose l'ancre du menu de lecture sur chaque daf (l'offset de sa
 * première ligne dans la section) ; `phoneticByDaf` remplace l'hébreu par sa
 * translittération quand le lecteur l'a demandée.
 */
const props = withDefaults(
  defineProps<{
    blocks: DafBlock[];
    variant?: "reader" | "daily";
    anchored?: boolean;
    phoneticByDaf?: Map<string, string> | null;
  }>(),
  { variant: "reader", anchored: false, phoneticByDaf: null },
);

const { t } = useI18n();

/** L'index de la première ligne de chaque daf dans la section (ancres). */
function offsetOf(index: number): number {
  let offset = 0;
  for (let i = 0; i < index; i++) offset += props.blocks[i].lines.length;
  return offset;
}
</script>

<template>
  <!-- Le daf est unique dans une section, l'index protège un fichier abîmé
       qui répéterait un daf : sans lui, deux clés égales feraient sauter le
       rendu au mauvais bloc. -->
  <template v-for="(block, index) in blocks" :key="`${index}-${block.daf}`">
    <p
      :data-block-anchor="anchored ? offsetOf(index) : undefined"
      :class="
        variant === 'daily'
          ? 'my-4 text-xs font-semibold text-primary/70 dark:text-primary text-center'
          : 'mt-6 mb-2 text-sm font-semibold text-primary'
      "
    >
      {{ t("textReading.labels.daf", { daf: block.daf }) }}
    </p>
    <p
      v-if="!phoneticByDaf"
      dir="rtl"
      class="font-hebrew text-text-primary daf-he"
      :class="variant === 'daily' ? 'daf-he-daily' : ''"
    >
      {{ block.lines.join(" ") }}
    </p>
    <p v-else dir="ltr" class="leading-relaxed italic text-text-secondary daf-tl">
      {{ phoneticByDaf.get(block.daf) }}
    </p>
  </template>
</template>

<style scoped>
/* Tailles pilotées par le réglage A− / A+ (useReadingSize), héritées de la
   page par `--reading-scale`. L'interligne de l'hébreu est volontairement
   plus serré que leading-loose : assez d'air pour les voyelles et les teamim,
   sans étirer la lecture. */
.daf-he {
  font-size: calc(1.5rem * var(--reading-scale, 1));
  line-height: 1.7;
}
.daf-he-daily {
  font-size: calc(1.25rem * var(--reading-scale, 1));
}
.daf-tl {
  font-size: calc(1.125rem * var(--reading-scale, 1));
}
</style>
