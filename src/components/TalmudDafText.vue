<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { DafBlock } from "../services/textService";
import MarkedText from "./MarkedText.vue";

/**
 * Une guemara : le texte d'un chapitre d'un seul tenant, un repère à chaque
 * changement de daf. Le même rendu dans le lecteur de la bibliothèque et dans
 * la lecture du jour ; seule la taille change (`variant`), la lecture du jour
 * posant plusieurs textes sur une page.
 *
 * `anchored` pose l'ancre du menu de lecture sur chaque daf (l'offset de sa
 * première ligne dans la section) ; `phoneticByDaf` remplace l'hébreu par sa
 * translittération quand le lecteur l'a demandée.
 *
 * `selectable` découpe le texte en passages (ceux de Sefaria, de l'ordre
 * d'une phrase), sans rien changer à sa lecture d'un seul tenant : chacun se
 * touche comme un verset (bulle de commandes, marque-page, reprise de
 * lecture, commentaires) et porte sa ligne (`data-line`, l'index dans la
 * section). `leads` souligne, dans le passage étudié, les mots que citent ses
 * commentaires.
 */
const props = withDefaults(
  defineProps<{
    blocks: DafBlock[];
    variant?: "reader" | "daily";
    anchored?: boolean;
    phoneticByDaf?: Map<string, string> | null;
    selectable?: boolean;
    selectedLine?: number | null;
    highlightedLine?: number | null;
    /** Le passage étudié et les dibbourim de ses commentaires. */
    leads?: { line: number; leads: string[] } | null;
  }>(),
  {
    variant: "reader",
    anchored: false,
    phoneticByDaf: null,
    selectable: false,
    selectedLine: null,
    highlightedLine: null,
    leads: null,
  },
);

const emit = defineEmits<{
  (e: "pick", event: MouseEvent, line: number, text: string): void;
}>();

function pick(event: MouseEvent, line: number, text: string): void {
  emit("pick", event, line, text);
}

const { t } = useI18n();

/** L'index de la première ligne de chaque daf dans la section (ancres, passages). */
const offsets = computed(() => {
  const out: number[] = [];
  let offset = 0;
  for (const block of props.blocks) {
    out.push(offset);
    offset += block.lines.length;
  }
  return out;
});
function offsetOf(index: number): number {
  return offsets.value[index] ?? 0;
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
      v-if="!phoneticByDaf && selectable"
      dir="rtl"
      class="font-hebrew text-text-primary daf-he"
      :class="variant === 'daily' ? 'daf-he-daily' : ''"
    >
      <template v-for="(line, k) in block.lines" :key="k"
        ><span
          :data-line="offsetOf(index) + k"
          class="reading-pick daf-passage"
          :class="{
            'bg-primary/10': highlightedLine === offsetOf(index) + k,
            'reading-selected':
              selectedLine === offsetOf(index) + k && highlightedLine !== offsetOf(index) + k,
          }"
          @click="pick($event, offsetOf(index) + k, line)"
          @contextmenu="pick($event, offsetOf(index) + k, line)"
          ><MarkedText
            :text="line"
            :leads="leads?.line === offsetOf(index) + k ? leads.leads : null" /></span
        >{{ " " }}</template
      >
    </p>
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
/* Un passage se touche sans se voir : le texte se lit d'un seul tenant, seul
   le passage choisi prend un fond. */
.daf-passage {
  border-radius: var(--radius-sm);
  transition: background-color 0.5s;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
.daf-tl {
  font-family: var(--font-reading);
  font-size: calc(1.125rem * var(--reading-scale, 1));
}
</style>
