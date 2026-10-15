<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { DafBlock } from "../services/textService";
import TranslationText from "./TranslationText.vue";

/**
 * Une guemara : le texte d'un chapitre d'un seul tenant, un repère à chaque
 * changement de daf. Le même rendu dans le lecteur de la bibliothèque et dans
 * la lecture du jour ; seule la taille change (`variant`), la lecture du jour
 * posant plusieurs textes sur une page.
 *
 * `anchored` pose l'ancre du menu de lecture sur chaque daf (l'offset de sa
 * première ligne dans la section) ; `phoneticByDaf` remplace l'hébreu par sa
 * translittération quand le lecteur l'a demandée. Un bloc sans daf (traité
 * rangé par chapitre) n'a pas de repère.
 *
 * `translationByDaf` (les lignes traduites de chaque daf, alignées sur ses
 * lignes hébraïques) fait passer le daf d'un bloc à une suite de passages :
 * chaque phrase de la guemara suivie de sa traduction, pour qu'on sache ce
 * qui traduit quoi. Une traduction posée sous un daf entier ne se suivrait
 * pas.
 */
const props = withDefaults(
  defineProps<{
    blocks: DafBlock[];
    variant?: "reader" | "daily";
    anchored?: boolean;
    phoneticByDaf?: Map<string, string> | null;
    translationByDaf?: Map<string, string[]> | null;
    /** Une ligne hébraïque en lettres latines, quand la phonétique est demandée. */
    transliterate?: ((line: string) => string) | null;
  }>(),
  {
    variant: "reader",
    anchored: false,
    phoneticByDaf: null,
    translationByDaf: null,
    transliterate: null,
  },
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
      v-if="block.daf"
      :data-block-anchor="anchored ? offsetOf(index) : undefined"
      :class="
        variant === 'daily'
          ? 'my-4 text-xs font-semibold text-primary/70 dark:text-primary text-center'
          : 'mt-6 mb-2 text-sm font-semibold text-primary'
      "
    >
      {{ t("textReading.labels.daf", { daf: block.daf }) }}
    </p>
    <!-- Avec la traduction : passage par passage, l'hébreu puis sa traduction. -->
    <div v-if="translationByDaf" class="space-y-5">
      <div v-for="(line, lineIndex) in block.lines" :key="lineIndex">
        <p
          v-if="!transliterate"
          dir="rtl"
          class="font-hebrew text-text-primary daf-he"
          :class="variant === 'daily' ? 'daf-he-daily' : ''"
        >
          {{ line }}
        </p>
        <p v-else dir="ltr" class="leading-relaxed italic text-text-secondary daf-tl">
          {{ transliterate(line) }}
        </p>
        <p
          v-if="translationByDaf.get(block.daf)?.[lineIndex]"
          dir="ltr"
          class="mt-2 text-text-secondary daf-tr"
        >
          <TranslationText :text="translationByDaf.get(block.daf)![lineIndex]" />
        </p>
      </div>
    </div>
    <p
      v-else-if="!phoneticByDaf"
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
  font-family: var(--font-reading);
  font-size: calc(1.125rem * var(--reading-scale, 1));
}
.daf-tr {
  font-family: var(--font-reading);
  font-size: calc(1.0625rem * var(--reading-scale, 1));
  line-height: 1.65;
}
</style>
