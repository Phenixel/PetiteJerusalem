<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { Rubric, TextBlock, TextParagraph } from "../../services/textService";
import type { SupportedLocale } from "../../i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import CollapseTransition from "../../components/CollapseTransition.vue";
import TefilaZman from "./TefilaZman.vue";

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

/**
 * Titre de l'encadré replié : le titre propre du bloc s'il en a un, sinon
 * l'occasion qui l'ouvre, suivie du nom du passage.
 */
function foldTitle(block: TextBlock): string {
  if (block.labelText) return say(block.labelText);
  const occasion = t(`textReading.fold.${block.fold}`);
  return block.label ? `${occasion} · ${block.label}` : occasion;
}

/** Un encadré dont c'est la saison : c'est aujourd'hui qu'il se dit. */
const inSeason = (block: TextBlock): boolean => !!block.fold && props.occasions.has(block.fold);

// Les encadrés (ajouts des dix jours de pénitence) s'ouvrent d'eux-mêmes le
// jour où ils se disent ; le reste de l'année ils restent là, repliés. Le
// lecteur peut toujours en décider autrement, bloc par bloc.
//
// Ce qu'on retient est l'état voulu, pas « il a touché à celui-là » : la
// saison peut changer sous la page ouverte (la chkia du 1er Tichri), et un
// simple drapeau de bascule verrait alors son sens s'inverser, refermant
// l'ajout le jour même où il se dit.
const decided = ref(new Map<number, boolean>());
function isOpen(block: TextBlock): boolean {
  if (!block.fold) return true;
  return decided.value.get(block.offset) ?? inSeason(block);
}
function toggleFold(block: TextBlock) {
  const next = new Map(decided.value);
  next.set(block.offset, !isOpen(block));
  decided.value = next;
}

/**
 * Répétitions : jusqu'à trois fois, le passage est réellement réécrit (la
 * reprise en plus clair), comme dans un siddour. Au-delà (« sept fois »),
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
 * Un ajout du calendrier au sens fort : conditionnel ET mis en avant. Les
 * blocs `when` marqués `plain` (le psaume du jour, le tahanoun) sont
 * conditionnels sans être des ajouts : ils gardent le rendu du fil ordinaire.
 */
const isCalendarAdd = (block: TextBlock): boolean => !!block.when && !block.plain;

/**
 * Classe de l'encadré d'un bloc. La couleur du thème dit « c'est maintenant » :
 * un ajout du calendrier ne s'affiche que le jour où il se dit, et un encadré
 * repliable ne se colore que pendant sa saison. Hors saison il reste là, en
 * gris, dépliable, présent sans réclamer la lecture.
 */
function sectionClass(block: TextBlock): string {
  if (block.fold) {
    const base = "my-7 rounded-xl overflow-hidden";
    return inSeason(block)
      ? `${base} bg-primary/5`
      : `${base} bg-black/[0.04] dark:bg-white/[0.05]`;
  }
  // Ajout du calendrier : à la couleur du thème, adossé à un filet.
  if (isCalendarAdd(block)) return "my-7 border-s-2 border-primary/40 ps-4 text-primary";
  // Variantes : à part du fil, sur un fond neutre, pour qu'on voie qu'on
  // choisit au lieu de tout lire.
  if (block.variants) return "my-6 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] p-4";
  return "";
}

/** Titre du fil du texte : filet de séparation, sauf au tout premier bloc. */
function titleClass(block: TextBlock, index: number): string {
  if (block.variants) return "mb-3 text-sm font-semibold text-text-secondary";
  const base = "mb-3 text-sm font-semibold text-primary";
  if (isCalendarAdd(block) || index === 0) return base;
  return `${base} mt-10 pt-4 border-t border-black/10 dark:border-white/10`;
}

/**
 * Classe du texte d'un paragraphe. Ce qui ne se dit pas toujours passe au
 * second plan : le fil qu'on lit d'un bout à l'autre doit rester le plus net.
 */
const paragraphTone = (block: TextBlock, paragraph: TextParagraph): string =>
  // Un ajout du calendrier garde la couleur du thème : elle dit déjà « c'est
  // aujourd'hui », l'atténuer reviendrait à le contredire.
  !isCalendarAdd(block) && (paragraph.muted || block.variants) ? "text-text-secondary" : "";

// Fichier sans mise en forme détaillée : un paragraphe par ligne, sans didascalie.
const plainParagraphs = (block: TextBlock): TextParagraph[] =>
  block.lines.map((text) => ({ runs: [{ kind: "he", text }] }));

const sections = computed(() =>
  props.blocks
    // Un marqueur resté vide (la Torah de la semaine qui n'a pas pu se
    // charger) ne laisse pas un titre orphelin dans le fil.
    .filter((block) => block.zman || block.lines.length > 0)
    .map((block, index) => ({
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
      :key="`${index}-${block.offset}`"
      :data-when="block.when"
      :data-fold="block.fold"
      :data-zman="block.zman"
      :class="block.zman ? '' : sectionClass(block)"
    >
      <!-- Horaire du moment (fin du Chéma, plage de Min'ha…), avant ce qui se lit. -->
      <TefilaZman v-if="block.zman" :zman="block.zman" />
      <!-- Ajout des dix jours de pénitence : replié hors saison, mais jamais absent. -->
      <button
        v-else-if="block.fold"
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

      <CollapseTransition v-if="!block.zman">
        <div
          v-show="isOpen(block)"
          :class="[
            block.fold ? 'px-4 pb-4' : '',
            block.numbered ? 'reading-numbered divide-y divide-line' : '',
          ]"
        >
          <!-- La halakha du passage (« en cas d'erreur, on reprend… »), dans la
               langue du lecteur, avant le texte qu'elle encadre : une simple
               ligne en petit, dans le registre des didascalies. -->
          <p v-if="block.halakha" class="reading-halakha">{{ say(block.halakha) }}</p>
          <template v-for="(paragraph, i) in paragraphs" :key="block.offset + i">
            <div :class="block.numbered ? 'flex items-start gap-3 py-2' : ''">
              <span
                v-if="block.numbered"
                class="mt-2 w-6 shrink-0 text-sm font-semibold tabular-nums text-primary"
              >
                {{ i + 1 }}
              </span>
              <div class="min-w-0 flex-1">
                <!-- Dans un bloc de variantes, le cas se lit en regard du texte,
                     pas au-dessus : c'est ainsi qu'on voit qu'on en choisit une. -->
                <p v-if="paragraph.rubric && !block.variants" class="reading-rubric">
                  {{ say(paragraph.rubric) }}
                </p>
                <div
                  v-for="copy in copiesOf(paragraph)"
                  :key="copy"
                  :data-line="copy === 1 ? block.offset + i : undefined"
                  class="reading-para"
                  :class="{
                    'reading-lead': paragraph.lead,
                    'reading-tight': paragraph.tight,
                    'reading-echo': copy > 1,
                    'bg-primary/10': highlightedLine === block.offset + i,
                    'bg-black/5 dark:bg-white/10':
                      selectedLine === block.offset + i && highlightedLine !== block.offset + i,
                  }"
                  @click="emit('select', block.offset + i)"
                >
                  <div :class="block.variants ? 'flex items-baseline gap-3' : ''">
                    <span v-if="block.variants && paragraph.rubric" class="reading-variant-label">{{
                      say(paragraph.rubric)
                    }}</span>
                    <p
                      v-if="!showPhonetic"
                      dir="rtl"
                      class="reading-he min-w-0 flex-1"
                      :class="paragraphTone(block, paragraph)"
                    >
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
                    <p v-else dir="ltr" class="reading-tl min-w-0 flex-1">
                      {{ phoneticLines[block.offset + i] }}
                    </p>
                  </div>
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
              </div>
            </div>
          </template>
        </div>
      </CollapseTransition>
    </section>
  </div>
</template>

<style scoped>
/* Les tailles suivent le réglage A− / A+ (--reading-scale, useReadingSize).
   Interligne aligné sur celui des autres lecteurs (1.7) : assez d'air pour
   les voyelles, sans étirer la lecture. */
.reading-he {
  font-family: var(--font-hebrew);
  font-size: calc(1.45rem * var(--reading-scale, 1));
  line-height: 1.7;
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

/* La halakha d'un passage : une consigne qui se lit, pas un texte qui se dit.
   Même registre discret que les didascalies, en ligne au-dessus du texte. */
.reading-halakha {
  margin-bottom: 0.75rem;
  font-size: calc(0.85rem * var(--reading-scale, 1));
  font-style: italic;
  line-height: 1.55;
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

/* Reprise d'un passage qui se dit deux ou trois fois. */
.reading-echo {
  margin-top: 0.2rem;
  opacity: 0.5;
}

/* Le cas d'une variante, en regard du texte : « après des mezonot », etc. */
.reading-variant-label {
  flex: 0 0 auto;
  max-width: 45%;
  font-size: calc(0.8rem * var(--reading-scale, 1));
  font-style: italic;
  line-height: 1.4;
  color: var(--color-text-secondary);
}

/* Bénédictions numérotées : le numéro tient la marge, pas de blanc en plus. */
.reading-numbered .reading-para {
  margin-top: 0;
}

/* Passage d'un seul tenant : on va à la ligne comme le siddour, sans le blanc
   qui sépare deux paragraphes. */
.reading-tight {
  margin-top: 0;
}

/* Strophes : le blanc au-dessus de l'invocation groupe les demandes de sa
   lettre, celles-ci se lisant serrées dessous. */
.reading-lead {
  margin-top: 1.75rem;
}
</style>
