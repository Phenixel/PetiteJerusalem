<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { DafBlock } from "../services/textService";
import TranslationText from "./TranslationText.vue";
import MarkedText from "./MarkedText.vue";
import { talmudOpenings } from "../services/pageForm";

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
 *
 * `selectable` découpe le texte en passages (ceux de Sefaria, de l'ordre
 * d'une phrase), sans rien changer à sa lecture d'un seul tenant : chacun se
 * touche comme un verset (bulle de commandes, marque-page, reprise de
 * lecture, commentaires) et porte sa ligne (`data-line`, l'index dans la
 * section). `leads` souligne, dans le passage étudié, les mots que citent ses
 * commentaires.
 *
 * Comme sur la page imprimée, le début de chaque Michna et de chaque Guemara
 * est en gras (« מתני׳ », « גמ׳ » et le mot qui suit, le premier mot du
 * traité, la formule qui clôt un chapitre, voir talmudOpenings).
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
    selectable?: boolean;
    selectedLine?: number | null;
    highlightedLine?: number | null;
    /** Les passages marqués d'un marque-page (`.reading-bookmarked`). */
    bookmarkedLines?: number[];
    /** Le passage étudié et les dibbourim de ses commentaires. */
    leads?: { line: number; leads: string[] } | null;
  }>(),
  {
    variant: "reader",
    anchored: false,
    phoneticByDaf: null,
    translationByDaf: null,
    transliterate: null,
    selectable: false,
    selectedLine: null,
    highlightedLine: null,
    bookmarkedLines: () => [],
    leads: null,
  },
);

const emit = defineEmits<{
  (e: "pick", event: MouseEvent, line: number, text: string): void;
}>();

function pick(event: MouseEvent, line: number, text: string): void {
  emit("pick", event, line, text);
}

/** Les mots en gras d'une ligne ; le tout premier passage du traité ouvre sa Michna. */
function openings(block: DafBlock, k: number, line: string): [number, number][] {
  const tractateStart = block.amud === 0 && (block.passages?.[k] ?? k) === 0;
  return talmudOpenings(line, tractateStart);
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

/** Le passage porte un marque-page, et rien d'autre ne le colore déjà. */
function bookmarked(line: number): boolean {
  return (
    props.bookmarkedLines.includes(line) &&
    props.selectedLine !== line &&
    props.highlightedLine !== line
  );
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
          <span
            v-if="selectable"
            :data-line="offsetOf(index) + lineIndex"
            class="reading-pick daf-passage"
            :class="{
              'bg-primary/10': highlightedLine === offsetOf(index) + lineIndex,
              'reading-selected':
                selectedLine === offsetOf(index) + lineIndex &&
                highlightedLine !== offsetOf(index) + lineIndex,
              'reading-bookmarked': bookmarked(offsetOf(index) + lineIndex),
            }"
            @click="pick($event, offsetOf(index) + lineIndex, line)"
            @contextmenu="pick($event, offsetOf(index) + lineIndex, line)"
            ><MarkedText
              :text="line"
              :strong="openings(block, lineIndex, line)"
              :leads="leads?.line === offsetOf(index) + lineIndex ? leads.leads : null"
          /></span>
          <MarkedText v-else :text="line" :strong="openings(block, lineIndex, line)" />
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
      v-else-if="!phoneticByDaf && selectable"
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
            'reading-bookmarked': bookmarked(offsetOf(index) + k),
          }"
          @click="pick($event, offsetOf(index) + k, line)"
          @contextmenu="pick($event, offsetOf(index) + k, line)"
          ><MarkedText
            :text="line"
            :strong="openings(block, k, line)"
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
      <template v-for="(line, k) in block.lines" :key="k"
        ><MarkedText :text="line" :strong="openings(block, k, line)" />{{ " " }}</template
      >
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
.daf-tr {
  font-family: var(--font-reading);
  font-size: calc(1.0625rem * var(--reading-scale, 1));
  line-height: 1.65;
}
</style>
