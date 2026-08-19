<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { Rubric, TextBlock, TextParagraph } from "../../services/textService";
import type { SupportedLocale } from "../../i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import CollapseTransition from "../../components/CollapseTransition.vue";

/**
 * Rendu des textes de tefila (Sli'hot, Brahot) : le fil du texte en paragraphes
 * justifiés, les didascalies dans la langue du lecteur, les reprises de
 * l'assemblée en gras, les ajouts du calendrier à la couleur du thème et ceux
 * des dix jours de pénitence dans un encadré qui se replie.
 *
 * Le lecteur générique (versets numérotés, une ligne = un bloc espacé) ne sait
 * rendre aucune de ces nuances : elles n'ont de sens que pour la liturgie.
 */
const props = defineProps<{
  /** Blocs déjà filtrés par occasion (voir TextBlock.when). */
  blocks: TextBlock[];
  showPhonetic: boolean;
  phoneticLines: string[];
  /** Occasions du jour : ouvrent d'emblée les encadrés qui les concernent. */
  occasions: Set<string>;
  highlightedLine: number | null;
  selectedLine: number | null;
  isBookmarked: (line: number) => boolean;
}>();

const emit = defineEmits<{
  (e: "select", line: number): void;
  (e: "toggle-bookmark", line: number): void;
}>();

const { t, locale } = useI18n();

/** Une didascalie dans la langue du lecteur (français en dernier recours). */
function say(rubric: Rubric): string {
  return rubric[locale.value as SupportedLocale] || rubric.fr;
}

function blockTitle(block: TextBlock): string {
  return block.labelText ? say(block.labelText) : block.label;
}

/** Titre de l'encadré replié : l'occasion, puis le nom du passage s'il en a un. */
function foldTitle(block: TextBlock): string {
  const occasion = t(`textReading.fold.${block.fold}`);
  return block.label ? `${occasion} · ${block.label}` : occasion;
}

/** Un encadré dont c'est la saison : c'est aujourd'hui qu'il se dit. */
const inSeason = (block: TextBlock): boolean => !!block.fold && props.occasions.has(block.fold);

// Les encadrés (ajouts des dix jours de pénitence) s'ouvrent d'eux-mêmes le
// jour où ils se disent ; le reste de l'année ils restent là, repliés. Le
// lecteur peut toujours en décider autrement, bloc par bloc.
const toggled = ref(new Set<number>());
function isOpen(block: TextBlock): boolean {
  if (!block.fold) return true;
  const openByDefault = inSeason(block);
  return toggled.value.has(block.offset) ? !openByDefault : openByDefault;
}
function toggleFold(block: TextBlock) {
  const next = new Set(toggled.value);
  if (next.has(block.offset)) next.delete(block.offset);
  else next.add(block.offset);
  toggled.value = next;
}

/**
 * Répétitions : jusqu'à trois fois, le passage est réellement réécrit — la
 * reprise en plus clair —, comme dans un siddour. Au-delà (« sept fois »),
 * le réécrire noierait le fil : on annonce le compte.
 */
const MAX_WRITTEN_REPEATS = 3;
const copiesOf = (paragraph: TextParagraph): number =>
  Math.min(paragraph.repeat ?? 1, MAX_WRITTEN_REPEATS);
const repeatBadge = (paragraph: TextParagraph): string =>
  (paragraph.repeat ?? 1) > MAX_WRITTEN_REPEATS
    ? t("textReading.repeatTimes", { n: paragraph.repeat })
    : "";

/**
 * L'espace entre deux fragments d'un même paragraphe est porté par le texte,
 * pas par le gabarit : le compilateur Vue supprime les blancs entre balises,
 * et les mots se retrouveraient collés autour d'une reprise en gras.
 */
const runText = (text: string, index: number): string => (index === 0 ? text : ` ${text}`);

/**
 * Litanies (« Ra'hamana… », « Élohénou chébachamayim… ») : des dizaines de
 * lignes courtes, une par supplication. Les espacer comme des paragraphes les
 * étire sur des écrans entiers — deux lignes courtes qui se suivent se serrent.
 */
const SHORT_LINE = 120;
function tightWith(block: TextBlock, index: number): boolean {
  if (index === 0) return false;
  return block.lines[index].length < SHORT_LINE && block.lines[index - 1].length < SHORT_LINE;
}

/**
 * Classe de l'encadré d'un bloc. La couleur du thème dit « c'est maintenant » :
 * un ajout du calendrier ne s'affiche que le jour où il se dit, et un encadré
 * repliable ne se colore que pendant sa saison. Hors saison il reste là, en
 * gris, dépliable — présent sans réclamer la lecture.
 */
function sectionClass(block: TextBlock): string {
  if (block.fold) {
    const base = "my-7 rounded-xl border overflow-hidden";
    return inSeason(block)
      ? `${base} border-primary/25 bg-primary/5`
      : `${base} border-line bg-black/[0.02] dark:bg-white/[0.03]`;
  }
  // Ajout du calendrier : à la couleur du thème, adossé à un filet.
  if (block.when) return "my-7 border-s-2 border-primary/40 ps-4 text-primary";
  return "";
}

/** Titre du fil du texte : filet de séparation, sauf au tout premier bloc. */
function titleClass(block: TextBlock, index: number): string {
  const base = "mb-3 text-sm font-semibold text-primary";
  if (block.when || index === 0) return base;
  return `${base} mt-10 pt-4 border-t border-black/10 dark:border-white/10`;
}

// Fichier sans mise en forme détaillée : un paragraphe par ligne, sans didascalie.
const plainParagraphs = (block: TextBlock): TextParagraph[] =>
  block.lines.map((text) => ({ runs: [{ kind: "he", text }] }));

const sections = computed(() =>
  props.blocks.map((block, index) => ({
    block,
    index,
    paragraphs: block.paragraphs ?? plainParagraphs(block),
  })),
);
</script>

<template>
  <div class="reading-liturgy">
    <section
      v-for="{ block, index, paragraphs } in sections"
      :key="block.offset"
      :data-when="block.when"
      :data-fold="block.fold"
      :class="sectionClass(block)"
    >
      <!-- Ajout des dix jours de pénitence : replié hors saison, mais jamais absent. -->
      <button
        v-if="block.fold"
        type="button"
        class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        :aria-expanded="isOpen(block)"
        @click="toggleFold(block)"
      >
        <span
          class="text-sm font-semibold"
          :class="inSeason(block) ? 'text-primary' : 'text-text-secondary'"
        >
          {{ foldTitle(block) }}
        </span>
        <AppIcon
          :name="isOpen(block) ? 'chevron-up' : 'chevron-down'"
          :size="16"
          class="flex-shrink-0"
          :class="inSeason(block) ? 'text-primary' : 'text-text-secondary'"
        />
      </button>
      <p v-else-if="blockTitle(block)" :class="titleClass(block, index)">
        {{ blockTitle(block) }}
      </p>

      <CollapseTransition>
        <div v-show="isOpen(block)" :class="block.fold ? 'px-4 pb-4' : ''">
          <template v-for="(paragraph, i) in paragraphs" :key="block.offset + i">
            <p v-if="paragraph.rubric" class="reading-rubric">{{ say(paragraph.rubric) }}</p>
            <div
              v-for="copy in copiesOf(paragraph)"
              :key="copy"
              :data-line="copy === 1 ? block.offset + i : undefined"
              class="reading-para"
              :class="{
                'reading-para-tight': copy === 1 && tightWith(block, i),
                'reading-echo': copy > 1,
                'bg-primary/10': highlightedLine === block.offset + i,
                'bg-black/5 dark:bg-white/10':
                  selectedLine === block.offset + i && highlightedLine !== block.offset + i,
              }"
              @click="emit('select', block.offset + i)"
            >
              <p v-if="!showPhonetic" dir="rtl" class="reading-he">
                <AppIcon
                  v-if="copy === 1 && isBookmarked(block.offset + i)"
                  name="bookmark"
                  :size="13"
                  class="text-primary me-1"
                />
                <template v-for="(run, r) in paragraph.runs" :key="r">
                  <span v-if="run.kind === 'rubric'" class="reading-rubric-inline">{{
                    say(run.rubric)
                  }}</span>
                  <span v-else :class="{ 'font-bold': run.strong }">{{
                    runText(run.text, r)
                  }}</span>
                </template>
                <span v-if="repeatBadge(paragraph)" class="reading-rubric-inline">{{
                  repeatBadge(paragraph)
                }}</span>
              </p>
              <p v-else dir="ltr" class="reading-tl">{{ phoneticLines[block.offset + i] }}</p>
            </div>
            <div v-if="selectedLine === block.offset + i" class="flex justify-end mt-2">
              <button
                class="btn btn-soft !px-3 !py-1.5 text-sm"
                @click.stop="emit('toggle-bookmark', block.offset + i)"
              >
                <AppIcon name="bookmark" :size="13" />
                {{
                  isBookmarked(block.offset + i)
                    ? t("textReading.bookmarkRemove")
                    : t("textReading.bookmarkAdd")
                }}
              </button>
            </div>
          </template>
        </div>
      </CollapseTransition>
    </section>
  </div>
</template>

<style scoped>
/* Les tailles suivent le réglage A− / A+ (--reading-scale, useReadingSize). */
.reading-he {
  font-family: var(--font-hebrew);
  font-size: calc(1.45rem * var(--reading-scale, 1));
  line-height: 1.9;
  text-align: justify;
  color: inherit;
}

.reading-tl {
  font-size: calc(1.05rem * var(--reading-scale, 1));
  line-height: 1.75;
  font-style: italic;
  text-align: justify;
  color: var(--color-text-secondary);
}

/* Didascalies : plus petites, en italique, distinctes du texte qui se dit. */
.reading-rubric {
  margin-top: 1.25rem;
  margin-bottom: 0.25rem;
  font-size: calc(0.85rem * var(--reading-scale, 1));
  font-style: italic;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.reading-rubric-inline {
  font-family: var(--font-sans);
  font-size: calc(0.8rem * var(--reading-scale, 1));
  font-style: italic;
  color: var(--color-text-secondary);
  unicode-bidi: isolate;
  margin: 0 0.35em;
}

.reading-para {
  margin-top: 1rem;
  padding: 0.125rem 0.5rem;
  margin-inline: -0.5rem;
  border-radius: var(--radius-sm);
  transition: background-color 0.5s ease;
}

/* Litanies : les lignes courtes qui se suivent restent groupées. */
.reading-para-tight {
  margin-top: 0.2rem;
}

/* Reprise d'un passage qui se dit deux ou trois fois. */
.reading-echo {
  margin-top: 0.2rem;
  opacity: 0.5;
}
</style>
