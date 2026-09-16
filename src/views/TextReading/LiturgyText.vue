<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type {
  Rubric,
  TextBlock,
  TextChoice,
  TextParagraph,
  TextRun,
} from "../../services/textService";
import { saidOn } from "../../services/textService";
import { transliterate } from "../../services/hebrewTransliteration";
import type { SupportedLocale } from "../../i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import CollapseTransition from "../../components/CollapseTransition.vue";
import KlafViewer from "../../components/KlafViewer.vue";
import KotelCompass from "../../components/KotelCompass.vue";
import TefilinMirror from "../../components/TefilinMirror.vue";
import { KLAF_ICONS, KLAF_LABELS, openKlaf } from "../../composables/useKlaf";
import {
  addKotelOffer,
  openKotelCompass,
  removeKotelOffer,
} from "../../composables/useKotelCompass";
import {
  addMirrorOffer,
  openTefilinMirror,
  removeMirrorOffer,
} from "../../composables/useTefilinMirror";
import TefilaZman from "./TefilaZman.vue";

/**
 * Rendu des textes de tefila (Sli'hot, Brahot, Sidour) : le fil du texte en
 * paragraphes justifiés, les didascalies dans la langue du lecteur, les
 * reprises de l'assemblée en gras, et ce que le jour ajoute ou change dans
 * le fil à sa place et à la couleur du thème, comme un siddour imprimé le met
 * en rouge : on lit d'un trait, et l'on voit ce qui se dit aujourd'hui.
 *
 * Le lecteur générique (versets numérotés, une ligne = un bloc espacé) ne sait
 * rendre aucune de ces nuances : elles n'ont de sens que pour la liturgie.
 */
const props = withDefaults(
  defineProps<{
    /** Blocs déjà filtrés par occasion (voir TextBlock.when). */
    blocks: TextBlock[];
    showPhonetic: boolean;
    /** Occasions du jour : ce qui se dit, et les encadrés qui s'ouvrent. */
    occasions: Set<string>;
    /**
     * Occasions saisonnières qui viennent de basculer (machiv haroua'h en
     * début d'hiver…). Un texte de saison n'est pas un ajout du jour, il se
     * lit dans le fil à la couleur du texte ; mais les trois premières
     * semaines, le temps que le pli se prenne, il prend la couleur du thème.
     */
    recentChanges: Set<string>;
    /**
     * Le texte que la page fait lire : ses paragraphes portent les ancres par
     * lesquelles on le retrouve (`data-line` pour la position de lecture,
     * `data-block-anchor` pour le menu de lecture). Les passages qui
     * accompagnent une lecture sans en faire partie, ce qu'on dit avant les
     * Tehilim et après, les posent à `false` : sans quoi leur première ligne
     * répondrait à la place du premier verset, ces ancres étant cherchées dans
     * toute la page.
     *
     * Pas de marque-page ici, ni de verset sélectionné : une tefila se lit du
     * début, on n'y revient pas à un paragraphe comme à un verset de Tehilim.
     */
    anchored?: boolean;
  }>(),
  {
    // Par défaut le texte est celui de la page : il porte ses ancres. La
    // valeur compte, elle ne peut pas rester implicite : un booléen optionnel
    // qu'on ne passe pas vaut `false` pour Vue, jamais `undefined`. Sans ce
    // `true`, aucun texte de liturgie ne portait plus d'ancre : le menu de
    // lecture ne menait nulle part, et la reprise de lecture non plus.
    anchored: true,
  },
);

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
 * Répétitions : le passage est réellement réécrit autant de fois qu'il se
 * dit (les reprises en plus clair), comme dans un siddour. Le lecteur lit
 * chaque fois, il ne compte pas : le « Lev tahor » de Birkat halevana
 * s'écrit donc sept fois.
 */
const copiesOf = (paragraph: TextParagraph): number => paragraph.repeat ?? 1;

/**
 * L'espace entre deux fragments d'un même paragraphe est porté par le texte,
 * pas par le gabarit : le compilateur Vue supprime les blancs entre balises,
 * et les mots se retrouveraient collés autour d'une reprise en gras.
 */
const runText = (text: string, index: number): string => (index === 0 ? text : ` ${text}`);

/**
 * Un bloc qui se lit à la couleur du thème : l'ajout du jour, dans le fil à
 * sa place (« Al hanissim » à 'Hanouka, le psaume qui s'ajoute à celui du
 * jour). Un bloc `when` marqué `plain` (le psaume du jour, le tahanoun, un
 * passage entier comme le Hallel) est conditionnel sans être un ajout à
 * signaler : il garde la couleur du texte, sauf les premières semaines d'une
 * bascule saisonnière, quand c'est là qu'on se trompe.
 */
const isHighlighted = (block: TextBlock): boolean =>
  !!block.when && (!block.plain || props.recentChanges.has(block.when));

/**
 * Classe de l'encadré d'un bloc. Un encadré repliable ne se colore que
 * pendant sa saison ; hors saison il reste là, en gris, dépliable, présent
 * sans réclamer la lecture.
 */
function sectionClass(block: TextBlock): string {
  if (block.fold) {
    const base = "my-7 rounded-xl overflow-hidden";
    return inSeason(block)
      ? `${base} bg-primary/5`
      : `${base} bg-black/[0.04] dark:bg-white/[0.05]`;
  }
  if (isHighlighted(block)) return "text-primary";
  // Variantes : à part du fil, sur un fond neutre, pour qu'on voie qu'on
  // choisit au lieu de tout lire.
  if (block.variants) return "my-6 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] p-4";
  return "";
}

/** Titre du fil du texte : filet de séparation, sauf au tout premier bloc. */
function titleClass(block: TextBlock, index: number): string {
  if (block.variants) return "mb-3 text-sm font-semibold text-text-secondary";
  const base = "mb-3 text-sm font-semibold text-primary";
  if (index === 0) return base;
  return `${base} mt-10 pt-4 border-t border-black/10 dark:border-white/10`;
}

/**
 * Classe du texte d'un paragraphe. Ce qui ne se dit pas toujours passe au
 * second plan : le fil qu'on lit d'un bout à l'autre doit rester le plus net.
 */
const paragraphTone = (block: TextBlock, paragraph: TextParagraph): string =>
  // Un ajout du jour garde la couleur du thème : elle dit « ceci se dit
  // aujourd'hui », l'atténuer reviendrait à la contredire.
  !isHighlighted(block) && (paragraph.muted || block.variants) ? "text-text-secondary" : "";

// Fichier sans mise en forme détaillée : un paragraphe par ligne, sans didascalie.
const plainParagraphs = (block: TextBlock): TextParagraph[] =>
  block.lines.map((text) => ({ runs: [{ kind: "he", text }] }));

/**
 * Un paragraphe prêt à rendre, avec sa ligne absolue dans la section : les
 * lignes conditionnelles (`when`) masquées un jour donné ne décalent pas les
 * index des marque-pages et de la translittération.
 */
interface ParagraphEntry {
  paragraph: TextParagraph;
  line: number;
}

/** Ce qui porte une condition : un bloc, un paragraphe, un fragment, une halakha. */
const saidToday = (item: { when?: string; unless?: string }): boolean =>
  saidOn(item.when, props.occasions, item.unless);

/** Les fragments d'un paragraphe qui se disent aujourd'hui. */
const visibleRuns = (paragraph: TextParagraph): TextRun[] =>
  paragraph.runs.filter((run) => saidToday(run));

/** Le texte hébreu d'un paragraphe tel qu'il se dit aujourd'hui. */
const visibleText = (paragraph: TextParagraph): string =>
  visibleRuns(paragraph)
    .filter((run): run is TextRun & { kind: "he" } => run.kind === "he")
    .map((run) => run.text)
    .join(" ");

/**
 * Classe d'un fragment hébreu. Ce que le jour ajoute ou change (`accent`,
 * avec son `when`) se lit à la couleur du thème, à sa place dans le fil :
 * Hamélekh hakadoch aux dix jours de techouva, Zokhrénou dans Avot. Un
 * fragment de saison sans accent (morid hatal, machiv haroua'h) reste à la
 * couleur du texte, sauf les premières semaines d'une bascule. Quand
 * l'application ne peut pas trancher (en Terre d'Israël, à dix convives), le
 * gris signale une possibilité sans la faire passer pour une lecture obligée.
 */
const runClass = (run: TextRun & { kind: "he" }) => ({
  "font-bold": run.strong,
  "reading-accent": (run.accent && !!run.when) || (!!run.when && props.recentChanges.has(run.when)),
  "reading-alt": run.accent && !run.when,
});

/** Les halakhot d'un bloc qui servent aujourd'hui. */
const halakhotOf = (block: TextBlock): Rubric[] =>
  (block.halakhot ?? []).filter((halakha) => saidToday(halakha));

/**
 * La boussole du Kotel, ouverte depuis le titre d'un passage qui se dit face
 * à Jérusalem (la 'Amida, Moussaf). Une seule fenêtre pour toute la page : le
 * cap ne dépend pas du passage d'où on l'ouvre.
 *
 * Le texte qui en porte un le signale au menu de lecture, qui offre alors la
 * même boussole sous le pouce, sans remonter au titre.
 */
const offersKotel = computed(() => props.blocks.some((block) => block.kotel));
let offering = false;
function syncKotelOffer(offered: boolean): void {
  if (offered === offering) return;
  offering = offered;
  if (offered) addKotelOffer();
  else removeKotelOffer();
}
watch(offersKotel, syncKotelOffer, { immediate: true });
onUnmounted(() => syncKotelOffer(false));

/**
 * Le miroir des téfilines, sur le même modèle que la boussole : le passage qui
 * les pose le porte à son titre, et le signale au menu de lecture, qui l'offre
 * alors sous le pouce. Cha'harit est le seul office à le porter.
 */
const offersMirror = computed(() => props.blocks.some((block) => block.mirror));
let offeringMirror = false;
function syncMirrorOffer(offered: boolean): void {
  if (offered === offeringMirror) return;
  offeringMirror = offered;
  if (offered) addMirrorOffer();
  else removeMirrorOffer();
}
watch(offersMirror, syncMirrorOffer, { immediate: true });
onUnmounted(() => syncMirrorOffer(false));

/**
 * Les parchemins : le paragraphe d'où l'on dit le pitoum haketoret ou le
 * Lamnatséa'h porte la commande qui ouvre le sien, et c'est la seule porte
 * (le menu de lecture ne les propose pas). Une seule fenêtre pour la page,
 * qui montre le parchemin demandé, montée seulement si la page en porte un.
 */
const offersKlaf = computed(() =>
  props.blocks.some((block) => (block.paragraphs ?? []).some((paragraph) => paragraph.klaf)),
);

/**
 * Les choix laissés au lecteur (la haftara de Min'ha d'un jeûne, que chaque
 * communauté lit à sa façon) : l'option prise pour chaque clé, retenue sur
 * l'appareil comme un réglage de lecture (la taille, la phonétique). Un
 * choix qui n'a pas encore été fait suit ce que le jour propose (`preferred`),
 * sinon la première option.
 */
const CHOICES_STORAGE_KEY = "pj-tefila-choices";
function readChoices(): Map<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(CHOICES_STORAGE_KEY) ?? "{}") as Record<
      string,
      string
    >;
    return new Map(Object.entries(raw));
  } catch {
    return new Map();
  }
}
const chosen = ref(readChoices());
function choose(option: TextBlock): void {
  const { key, id } = choiceOf(option);
  const next = new Map(chosen.value);
  next.set(key, id);
  chosen.value = next;
  try {
    localStorage.setItem(CHOICES_STORAGE_KEY, JSON.stringify(Object.fromEntries(next)));
  } catch {
    // Sans stockage (navigation privée, quota), le choix vaut pour la page ouverte.
  }
}
/** Le choix d'un bloc option : le gabarit ne sait pas qu'il est toujours là. */
const choiceOf = (option: TextBlock): TextChoice => option.choice as TextChoice;
function chosenAmong(options: TextBlock[]): TextBlock {
  const stored = chosen.value.get(choiceOf(options[0]).key);
  return (
    options.find((option) => choiceOf(option).id === stored) ??
    options.find((option) => {
      const preferred = choiceOf(option).preferred;
      return !!preferred && saidToday({ when: preferred });
    }) ??
    options[0]
  );
}

/** Les paragraphes d'un bloc qui se disent aujourd'hui, avec leur ligne. */
const paragraphsOf = (block: TextBlock): ParagraphEntry[] =>
  (block.paragraphs ?? plainParagraphs(block))
    .map((paragraph, i): ParagraphEntry => ({ paragraph, line: block.offset + i }))
    // Un paragraphe se lit s'il se dit aujourd'hui, et s'il lui reste de
    // l'hébreu à dire : un paragraphe fait d'un seul fragment `when`
    // (le compte du 'Omer de ce soir) disparaît avec lui.
    .filter(
      ({ paragraph }) =>
        saidToday(paragraph) && visibleRuns(paragraph).some((run) => run.kind === "he"),
    );

/**
 * Une section du fil : le bloc qui donne le titre et l'ancre, le texte qui se
 * lit (le même bloc, ou l'option choisie d'un choix), les options du choix
 * s'il y en a un, et les paragraphes du texte.
 */
interface SectionEntry {
  block: TextBlock;
  text: TextBlock;
  options: TextBlock[];
  paragraphs: ParagraphEntry[];
  index: number;
}

const sections = computed<SectionEntry[]>(() => {
  const out: SectionEntry[] = [];
  const choicesSeen = new Set<string>();
  for (const block of props.blocks) {
    let text = block;
    let options: TextBlock[] = [];
    if (block.choice) {
      // Les options d'un même choix forment une seule section, à la place de
      // la première : son titre, son ancre, et le texte de l'option prise.
      if (choicesSeen.has(block.choice.key)) continue;
      choicesSeen.add(block.choice.key);
      const key = block.choice.key;
      options = props.blocks.filter((candidate) => candidate.choice?.key === key);
      text = chosenAmong(options);
    }
    const paragraphs = paragraphsOf(text);
    // Un marqueur resté vide (la Torah de la semaine qui n'a pas pu se
    // charger) ou un bloc dont aucune ligne ne se dit aujourd'hui (les fêtes
    // du Mé'ein chaloch) ne laisse pas un titre orphelin dans le fil. Un
    // choix reste, même vide : « pas de haftara » se choisit aussi.
    if (!block.zman && options.length === 0 && paragraphs.length === 0) continue;
    out.push({ block, text, options, paragraphs, index: out.length });
  }
  return out;
});

/**
 * La translittération, ligne par ligne, de ce qui se dit aujourd'hui : les
 * fragments que le jour écarte (l'autre conclusion, l'autre saison) n'y
 * entrent pas, le lecteur phonétique lit le même texte que le lecteur hébreu.
 * Calculée seulement quand on la demande : elle parcourt chaque lettre.
 */
const phoneticOf = computed(() => {
  const byLine = new Map<number, string>();
  if (!props.showPhonetic) return byLine;
  for (const { paragraphs } of sections.value) {
    for (const { paragraph, line } of paragraphs) {
      byLine.set(line, transliterate(visibleText(paragraph)));
    }
  }
  return byLine;
});
</script>

<template>
  <div class="reading-liturgy">
    <section
      v-for="{ block, text, options, index, paragraphs } in sections"
      :key="`${index}-${block.offset}`"
      :data-when="block.when"
      :data-fold="block.fold"
      :data-zman="block.zman"
      :data-block-anchor="block.zman || !anchored ? undefined : (block.anchor ?? block.offset)"
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
        <!-- Face à Jérusalem : la boussole donne la direction du Kotel depuis
             le lieu où l'on se trouve, là où la question se pose, au titre du
             passage qui se dit tourné vers elle. -->
        <button
          v-if="block.kotel"
          type="button"
          class="ms-1.5 inline-flex items-center align-middle rounded-full p-1 text-primary hover:bg-primary/10"
          :aria-label="t('textReading.kotel.open')"
          :title="t('textReading.kotel.open')"
          @click="openKotelCompass('title')"
        >
          <AppIcon name="compass" :size="15" />
        </button>
        <!-- Le miroir, au titre du passage où l'on pose les téfilines : le
             bayit de la tête se place là où l'on ne se voit pas. -->
        <button
          v-if="block.mirror"
          type="button"
          class="ms-1.5 inline-flex items-center align-middle rounded-full p-1 text-primary hover:bg-primary/10"
          :aria-label="t('textReading.mirror.open')"
          :title="t('textReading.mirror.open')"
          @click="openTefilinMirror('title')"
        >
          <AppIcon name="mirror" :size="15" />
        </button>
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
          <p v-for="(halakha, h) in halakhotOf(text)" :key="h" class="reading-halakha">
            {{ say(halakha) }}
          </p>
          <!-- Un choix laissé au lecteur : les options, l'une prise, sous la
               note qui dit qui lit quoi. Le texte de l'option prise suit. -->
          <div
            v-if="options.length > 0"
            class="reading-choice"
            role="group"
            :aria-label="t('textReading.choice')"
          >
            <p class="reading-choice-label">{{ t("textReading.choice") }}</p>
            <button
              v-for="option in options"
              :key="choiceOf(option).id"
              type="button"
              class="reading-choice-option"
              :class="option === text ? 'text-primary' : 'text-text-secondary'"
              :aria-pressed="option === text"
              @click="choose(option)"
            >
              <AppIcon
                name="check"
                :size="15"
                class="mt-0.5 shrink-0"
                :class="option === text ? '' : 'opacity-0'"
              />
              <span>{{ say(choiceOf(option).label) }}</span>
            </button>
          </div>
          <template v-for="({ paragraph, line }, i) in paragraphs" :key="line">
            <div :class="block.numbered ? 'flex items-start gap-3 py-2' : ''">
              <span
                v-if="block.numbered"
                class="mt-2 w-6 shrink-0 text-sm font-semibold tabular-nums text-primary"
              >
                {{ i + 1 }}
              </span>
              <div class="min-w-0 flex-1">
                <!-- La didascalie du paragraphe, y compris le cas d'une variante
                     (« après des mezonot », « l'invité ajoute ») : toujours
                     au-dessus du texte, jamais en regard, qui rétrécirait la
                     colonne d'hébreu. L'encadré du bloc dit déjà qu'on choisit
                     l'une de ses variantes. -->
                <p v-if="paragraph.rubric" class="reading-rubric">
                  {{ say(paragraph.rubric) }}
                </p>
                <!-- Le parchemin, au paragraphe où il se lit : la ketoret
                     telle qu'un sofer l'écrit, le psaume en forme de menora. -->
                <button
                  v-if="paragraph.klaf"
                  type="button"
                  class="reading-klaf"
                  @click.stop="openKlaf(paragraph.klaf)"
                >
                  <AppIcon :name="KLAF_ICONS[paragraph.klaf]" :size="14" />
                  {{ t(KLAF_LABELS[paragraph.klaf].open) }}
                </button>
                <div
                  v-for="copy in copiesOf(paragraph)"
                  :key="copy"
                  :data-line="copy === 1 && anchored ? line : undefined"
                  class="reading-para"
                  :class="{
                    'reading-lead': paragraph.lead,
                    'reading-tight': paragraph.tight,
                    'reading-echo': copy > 1,
                  }"
                >
                  <p
                    v-if="!showPhonetic"
                    dir="rtl"
                    class="reading-he"
                    :class="paragraphTone(text, paragraph)"
                  >
                    <template v-for="(run, r) in visibleRuns(paragraph)" :key="r">
                      <span v-if="run.kind === 'rubric'" class="reading-rubric-inline">{{
                        say(run.rubric)
                      }}</span>
                      <span v-else :class="runClass(run)">{{ runText(run.text, r) }}</span>
                    </template>
                  </p>
                  <p v-else dir="ltr" class="reading-tl">
                    {{ phoneticOf.get(line) }}
                  </p>
                </div>
              </div>
            </div>
          </template>
        </div>
      </CollapseTransition>
    </section>

    <KotelCompass v-if="offersKotel" />
    <TefilinMirror v-if="offersMirror" />
    <KlafViewer v-if="offersKlaf" />
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
  font-family: var(--font-reading);
  font-size: calc(1.05rem * var(--reading-scale, 1));
  line-height: 1.75;
  font-style: italic;
  text-align: justify;
  color: var(--color-text-secondary);
}

/* La halakha d'un passage : une consigne qui se lit, pas un texte qui se dit.
   Même registre discret que les didascalies, en ligne au-dessus du texte. */
.reading-halakha {
  font-family: var(--font-reading);
  margin-bottom: 0.75rem;
  font-size: calc(0.85rem * var(--reading-scale, 1));
  font-style: italic;
  line-height: 1.55;
  color: var(--color-text-secondary);
}

/* Le sélecteur d'un choix : une surface neutre à part du fil, une option par
   ligne, cochée quand elle est prise. Des boutons, pas du texte à dire. */
.reading-choice {
  margin: 0.75rem 0 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-btn);
  background-color: color-mix(in srgb, var(--color-text-primary) 4%, transparent);
  font-family: var(--font-sans);
}

.reading-choice-label {
  margin: 0.25rem 0 0.375rem;
  font-size: calc(0.8rem * var(--reading-scale, 1));
  font-weight: 600;
  color: var(--color-text-secondary);
}

.reading-choice-option {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.375rem;
  border-radius: var(--radius-control);
  text-align: start;
  font-size: calc(0.9rem * var(--reading-scale, 1));
  font-weight: 600;
  line-height: 1.4;
  transition: background-color 0.2s ease;
}

.reading-choice-option:hover {
  background-color: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
}

.reading-choice-option:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Didascalies : plus petites, en italique, distinctes du texte qui se dit. */
.reading-rubric {
  font-family: var(--font-reading);
  margin-top: 1.25rem;
  margin-bottom: 0.25rem;
  font-size: calc(0.85rem * var(--reading-scale, 1));
  font-style: italic;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.reading-rubric-inline {
  font-family: var(--font-reading);
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

/* Ce que le jour ajoute ou change dans le fil (Hamélekh hakadoch aux dix
   jours, Zokhrénou, machiv haroua'h en début d'hiver…) : la couleur du thème,
   comme le rouge d'un siddour imprimé. */
.reading-accent {
  color: var(--color-primary);
}

/* Le texte que la didascalie affecte sans que l'application puisse trancher
   (en Terre d'Israël, à dix convives) : en gris, une possibilité signalée,
   pas une lecture imposée. */
.reading-alt {
  color: var(--color-text-secondary);
}

/* Reprise d'un passage qui se dit deux ou trois fois. */
.reading-echo {
  margin-top: 0.2rem;
  opacity: 0.5;
}

/* Une didascalie annonce le texte qui la suit : il se lit juste dessous, le
   blanc se tient au-dessus d'elle. */
.reading-rubric + .reading-para {
  margin-top: 0.25rem;
}

/* La commande qui ouvre le parchemin : une pastille ronde à la couleur du
   thème, posée au-dessus du paragraphe, dans le registre des didascalies.
   Elle se lit comme un bouton, pas comme du texte à dire. */
.reading-klaf {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 1rem;
  padding: 0.3rem 0.8rem;
  border-radius: var(--radius-pill);
  font-family: var(--font-sans);
  font-size: calc(0.8rem * var(--reading-scale, 1));
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-primary);
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  transition: background-color 0.2s ease;
}

.reading-klaf:hover {
  background-color: color-mix(in srgb, var(--color-primary) 16%, transparent);
}

.reading-klaf:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Sous une didascalie, la pastille la suit de près, et le texte la suit. */
.reading-rubric + .reading-klaf {
  margin-top: 0.35rem;
}

.reading-klaf + .reading-para {
  margin-top: 0.35rem;
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
