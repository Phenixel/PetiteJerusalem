<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { TextStudyJsonEntry } from "../../models/models";
import {
  loadParashaRashi,
  loadText,
  MissingTextFileError,
  placeLabel,
} from "../../services/textService";
import type { RashiComment, TextContent, TextSection } from "../../services/textService";
import { isEntryAvailableOffline } from "../../services/offlineLibraryService";
import { ensureManifestLoaded } from "../../services/offlineTextStore";
import { useOnline } from "../../composables/useOnline";
import { anchorToElement } from "../../composables/scrollAnchor";
import { useReadingSize } from "../../composables/useReadingSize";
import { useVerseBookmarks } from "../../composables/useVerseBookmarks";
import { useTextLabels } from "../../composables/useTextLabels";
import type { Bookmark } from "../../services/readingProgressService";
import { hubPath, sectionPath } from "../../content/etudeTexts";
import { appendHebrewNumeral } from "../../services/hebrewNumerals";
import { analyticsService } from "../../services/analyticsService";
import CollapseTransition from "../../components/CollapseTransition.vue";
import TalmudDafText from "../../components/TalmudDafText.vue";
import AppIcon from "../../components/icons/AppIcon.vue";

const props = defineProps<{
  entry: TextStudyJsonEntry;
  readSections?: number[];
  /** Chnei mikra : affiche le Targoum Onkelos sous chaque verset. */
  withTargoum?: boolean;
  /** Chnei mikra : écrit chaque verset deux fois (chnayim mikra). */
  doubleVerses?: boolean;
  /** Chnei mikra : affiche les commentaires de Rachi sous le Targoum. */
  withRashi?: boolean;
  /** D'où le texte est lu, pour la mesure d'audience (le chnei mikra a deux entrées). */
  source?: string;
}>();
const emit = defineEmits<{
  "toggle-section": [index: number];
  "sections-loaded": [indexes: number[]];
}>();
const { t } = useI18n();
const { sectionLabel, headingLabel } = useTextLabels();
// Taille de lecture partagée avec le lecteur de la bibliothèque (A− / A+).
const readingSize = useReadingSize();
const online = useOnline();

const loading = ref(true);
const error = ref(false);
const missing = ref(false);
// Hors connexion et texte absent de l'appareil : ce n'est pas une erreur, mais
// un texte qui n'a pas été téléchargé, on le dit tel quel.
const notDownloaded = ref(false);
const content = ref<TextContent | null>(null);

// Reference texts (more than one section) get verse numbers; texts read as a
// whole (Tehilim, a full parasha) don't need them.
const showVerseNumbers = computed(() => (props.entry.totalSections ?? 1) > 1);
const isMultiSection = computed(() => (content.value?.sections.length ?? 0) > 1);

const readSet = computed(() => new Set(props.readSections ?? []));

// --- Marque-pages : même stockage que le lecteur de la bibliothèque, donc un
// marque-page posé ici se retrouve là-bas (et inversement), dans l'espace
// « daily ». Un verset se repère par "section#ligne" : le livre entier est
// sur la page. ---
// Sections lues (repliées) rouvertes temporairement pour voir un marque-page.
const peekedSections = ref<Set<number>>(new Set());

/** Section telle que stockée dans un marque-page (null pour un texte entier). */
function storeSection(sectionIndex: number): number | null {
  return isMultiSection.value ? sectionIndex : null;
}

/** Le libellé enregistré avec un marque-page : le texte, et son chapitre. */
function sectionOf(section: number | null): TextSection | null {
  return content.value?.sections.find((s) => s.index === section) ?? null;
}

const {
  bookmarks,
  selected: selectedVerse,
  highlighted: highlightedVerse,
  refresh: refreshBookmarks,
  isBookmarked,
  select,
  toggleBookmark,
  scrollTo,
} = useVerseBookmarks<string>({
  scope: "daily",
  textId: () => String(props.entry.id),
  entry: () => props.entry,
  keyOf: (section, line) => `${section ?? 0}#${line}`,
  pathFor: (section) =>
    section !== null ? sectionPath(props.entry, section) : hubPath(props.entry),
  labelFor: (section) => {
    const chapter = section !== null ? sectionOf(section) : null;
    return chapter
      ? `${appendHebrewNumeral(props.entry.name)} · ${chapter.label}`
      : appendHebrewNumeral(props.entry.name);
  },
  source: props.source ?? "daily_reading",
});

function verseKey(sectionIndex: number, line: number): string {
  return `${storeSection(sectionIndex) ?? 0}#${line}`;
}

function isVerseBookmarked(sectionIndex: number, line: number): boolean {
  return isBookmarked(storeSection(sectionIndex), line);
}

function onVerseClick(sectionIndex: number, line: number) {
  select(storeSection(sectionIndex), line);
}

function toggleBookmarkAt(section: TextSection, line: number) {
  toggleBookmark(storeSection(section.index), line);
}

/** "Chapitre 2 (ב) · 3e montée · verset 14" pour un marque-page. */
function bookmarkPlace(b: Bookmark): string {
  return placeLabel(
    content.value?.sections ?? [],
    b.section,
    b.line,
    (n) => t("textReading.verseN", { n }),
    headingLabel,
  );
}

function goToBookmark(b: Bookmark) {
  // Section repliée (déjà lue) : on la rouvre le temps de la consultation.
  if (b.section !== null && readSet.value.has(b.section)) {
    peekedSections.value = new Set([...peekedSections.value, b.section]);
  }
  const key = `${b.section ?? 0}#${b.line}`;
  scrollTo(b.section, b.line, () => root.value?.querySelector(`[data-verse="${key}"]`));
  analyticsService.capture("reading_resumed", {
    text_id: props.entry.id,
    source: `${props.source ?? "daily_reading"}_bookmark`,
  });
}

function isSectionVisible(sectionIndex: number): boolean {
  return !readSet.value.has(sectionIndex) || peekedSections.value.has(sectionIndex);
}

/** Ligne de Targoum Onkelos alignée sur le verset (chnei mikra). */
function targumLine(section: TextSection, line: number): string {
  if (!props.withTargoum) return "";
  return section.targum?.[line] ?? "";
}

// --- Rachi (option du chnei mikra) : fichier séparé de la paracha, chargé
// seulement quand l'option est active, pour que la paracha seule reste
// légère. Aligné ligne à ligne sur `he` (voir textService.loadParashaRashi). --
const rashiLines = ref<RashiComment[][] | null>(null);
const rashiFailed = ref(false);
let rashiLoading = false;

async function loadRashi() {
  if (rashiLoading || rashiLines.value) return;
  rashiLoading = true;
  rashiFailed.value = false;
  try {
    rashiLines.value = await loadParashaRashi(props.entry);
  } catch {
    // Hors ligne, ou entrée sans fichier Rachi (Na"kh) : la lecture continue
    // sans le commentaire, un mot le dit sur les parachiot.
    rashiFailed.value = true;
  } finally {
    // Un échec ne condamne pas l'option : désactiver puis réactiver réessaie.
    rashiLoading = false;
  }
}

watch(
  () => props.withRashi && content.value !== null,
  (wanted) => {
    if (wanted) void loadRashi();
  },
  { immediate: true },
);

function rashiComments(line: number): RashiComment[] {
  if (!props.withRashi) return [];
  return rashiLines.value?.[line] ?? [];
}

// Marquer un chapitre lu le replie : on garde son titre en vue pour que la
// lecture continue au chapitre suivant, sans saut de scroll.
function onToggleSection(section: TextSection, evt: MouseEvent) {
  const willRead = !readSet.value.has(section.index);
  // Une consultation temporaire (marque-page) ne survit pas au changement d'état.
  peekedSections.value = new Set([...peekedSections.value].filter((i) => i !== section.index));
  emit("toggle-section", section.index);
  if (willRead) {
    anchorToElement((evt.currentTarget as HTMLElement).closest("section"));
  }
}

async function load() {
  loading.value = true;
  error.value = false;
  missing.value = false;
  notDownloaded.value = false;
  content.value = null;
  try {
    // Hors ligne, un texte qui n'est pas sur l'appareil ne viendra pas du
    // réseau : on l'annonce au lieu d'attendre l'échec.
    await ensureManifestLoaded();
    if (!online.value && !isEntryAvailableOffline(props.entry)) {
      notDownloaded.value = true;
      return;
    }
    content.value = await loadText(props.entry);
    // Le parent a besoin des index réels pour savoir quand tout est lu.
    emit(
      "sections-loaded",
      content.value.sections.map((s) => s.index),
    );
  } catch (e) {
    if (!online.value) notDownloaded.value = true;
    else if (e instanceof MissingTextFileError) missing.value = true;
    else error.value = true;
  } finally {
    loading.value = false;
  }
}

// Connexion revenue : un texte resté sur son message « pas téléchargé » (ou en
// erreur réseau) se charge enfin, sans que l'utilisateur ait à quitter la page.
watch(online, (isOnline) => {
  if (isOnline && (notDownloaded.value || error.value)) void load();
});

/*
 * Chargement à la visibilité, pas au montage : chaque entrée charge le fichier
 * COMPLET de son livre (jusqu'à ~1,8 Mo pour un traité du Talmud). Une liste de
 * lecture de 3 traités tirait ~5 Mo en parallèle à l'ouverture du profil, y
 * compris pour les textes repliés (v-show) ou sous la ligne de flottaison. On
 * n'hydrate qu'à l'approche du viewport (marge de 200 px pour précharger juste
 * avant l'arrivée du lecteur).
 */
const root = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

onMounted(() => {
  refreshBookmarks();
  if (typeof IntersectionObserver === "undefined" || !root.value) {
    void load();
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer?.disconnect();
        observer = null;
        void load();
      }
    },
    { rootMargin: "200px" },
  );
  observer.observe(root.value);
});

onUnmounted(() => observer?.disconnect());
</script>

<template>
  <div ref="root" :style="{ '--reading-scale': readingSize.scale.value }">
    <div v-if="loading" class="animate-pulse space-y-3 py-2">
      <div class="h-5 bg-black/10 rounded w-full dark:bg-white/10"></div>
      <div class="h-5 bg-black/10 rounded w-5/6 dark:bg-white/10"></div>
      <div class="h-5 bg-black/10 rounded w-2/3 dark:bg-white/10"></div>
    </div>

    <p v-else-if="notDownloaded" class="py-2 text-sm text-text-secondary flex items-center gap-1.5">
      <AppIcon name="download" :size="14" class="text-text-secondary/60" />
      {{ t("dailyReading.offline.notDownloaded") }}
    </p>

    <p
      v-else-if="missing || error"
      class="py-2 text-sm text-text-secondary flex items-center gap-1.5"
    >
      <AppIcon name="alert-triangle" :size="14" class="text-amber-500" />
      {{ t("dailyReading.loadError") }}
      <button @click="load" class="ml-2 text-primary hover:underline">
        {{ t("textReading.retry") }}
      </button>
    </p>

    <div v-else-if="content" class="space-y-6">
      <!-- Marque-pages posés dans cette lecture : retour direct au verset -->
      <div v-if="bookmarks.length" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span class="inline-flex items-center gap-1.5 text-text-secondary">
          <AppIcon name="bookmark" :size="13" class="text-primary" />
          {{ t("textReading.bookmarks") }}
        </span>
        <button
          v-for="b in bookmarks"
          :key="b.id"
          @click="goToBookmark(b)"
          class="text-primary hover:underline"
        >
          {{ bookmarkPlace(b) }}
        </button>
      </div>

      <!-- Option Rachi active mais fichier introuvable (hors ligne, par exemple) -->
      <p
        v-if="withRashi && rashiFailed"
        class="text-sm text-text-secondary flex items-center gap-1.5"
      >
        <AppIcon name="alert-triangle" :size="14" class="text-amber-500" />
        {{ t("chneiMikra.rashiUnavailable") }}
      </p>

      <section v-for="section in content.sections" :key="section.index">
        <!-- Chaptered texts: per-chapter header with its own "mark read". -->
        <div v-if="isMultiSection" class="mb-3 flex items-center justify-between gap-3">
          <p
            class="text-sm font-semibold"
            :class="
              readSet.has(section.index)
                ? 'text-text-secondary/60'
                : 'text-primary/80 dark:text-primary'
            "
          >
            {{ sectionLabel(section) }}
          </p>
          <button
            @click="onToggleSection(section, $event)"
            :class="[
              'inline-flex items-center gap-1.5 text-xs font-medium transition-colors shrink-0',
              readSet.has(section.index)
                ? 'text-green-600 dark:text-green-400'
                : 'text-text-secondary hover:text-primary',
            ]"
          >
            <AppIcon v-if="readSet.has(section.index)" name="circle-check" :size="14" />
            <span v-else class="w-3 h-3 rounded-full border-2 border-current shrink-0"></span>
            {{
              readSet.has(section.index)
                ? t("dailyReading.sectionRead")
                : t("dailyReading.sectionMarkRead")
            }}
          </button>
        </div>

        <!-- Une section lue se retire du rendu (`v-if`) : un livre entier est
             sur la page, ses chapitres déjà lus n'ont pas à peser dans le DOM.
             Celles qui restent se rendent à l'approche de l'écran
             (content-visibility, voir le style). -->
        <CollapseTransition>
          <div v-if="isSectionVisible(section.index)" class="daily-section">
            <!-- Talmud: continuous text with a marker at each daf change -->
            <TalmudDafText
              v-if="content.type === 'Talmud Bavli'"
              :blocks="section.dafBlocks ?? []"
              variant="daily"
            />

            <!-- Verses / mishnayot / psalm lines: each on its own line, flowing on
                 the background, with a marker at each chapter / montée block -->
            <template v-else>
              <template
                v-for="block in section.blocks ?? [{ label: '', lines: section.he, offset: 0 }]"
                :key="block.offset"
              >
                <p
                  v-if="block.label"
                  class="my-4 text-xs font-semibold text-primary/70 dark:text-primary text-center"
                >
                  {{ headingLabel(block.heading, block.label) }}
                </p>
                <p dir="rtl" class="font-hebrew text-text-primary daily-he">
                  <template v-for="(line, index) in block.lines" :key="block.offset + index">
                    <span
                      :data-verse="verseKey(section.index, block.offset + index)"
                      @click="onVerseClick(section.index, block.offset + index)"
                      class="cursor-pointer rounded transition-colors duration-500 box-decoration-clone px-0.5 -mx-0.5"
                      :class="{
                        'bg-primary/10':
                          highlightedVerse === verseKey(section.index, block.offset + index),
                        'bg-black/5 dark:bg-white/10':
                          selectedVerse === verseKey(section.index, block.offset + index) &&
                          highlightedVerse !== verseKey(section.index, block.offset + index),
                      }"
                    >
                      <AppIcon
                        v-if="isVerseBookmarked(section.index, block.offset + index)"
                        name="bookmark"
                        :size="11"
                        class="inline-block align-super text-primary"
                      />
                      <span
                        v-if="showVerseNumbers || block.label"
                        class="text-xs align-super text-primary/60 select-none"
                      >
                        {{ index + 1 }}&#8201;</span
                      >{{ line }}</span
                    >
                    <!-- Chnayim mikra : le verset se lit deux fois, on l'écrit deux fois -->
                    <span v-if="doubleVerses && withTargoum" dir="rtl" class="block">{{
                      line
                    }}</span>
                    <!-- Chnei mikra : le Targoum Onkelos du verset, en dessous -->
                    <span
                      v-if="targumLine(section, block.offset + index)"
                      dir="rtl"
                      class="block mb-2 font-hebrew leading-relaxed text-text-secondary daily-tl"
                    >
                      {{ targumLine(section, block.offset + index) }}
                    </span>
                    <!-- Option Rachi : les commentaires du verset, dibbour hamat'hil en avant -->
                    <span
                      v-if="rashiComments(block.offset + index).length"
                      dir="rtl"
                      class="block mb-3 daily-rashi"
                    >
                      <span
                        v-for="(comment, commentIndex) in rashiComments(block.offset + index)"
                        :key="commentIndex"
                        class="block font-hebrew text-text-secondary"
                      >
                        <span v-if="comment.lead" class="font-semibold text-text-primary/85">{{
                          comment.lead
                        }}</span>
                        {{ comment.text }}
                      </span>
                    </span>
                    <!-- Verset sélectionné : proposer le marque-page -->
                    <span
                      v-if="selectedVerse === verseKey(section.index, block.offset + index)"
                      class="block my-2"
                    >
                      <button
                        @click.stop="toggleBookmarkAt(section, block.offset + index)"
                        class="btn btn-soft !px-3 !py-1.5 text-sm"
                      >
                        <AppIcon name="bookmark" :size="13" />
                        {{
                          isVerseBookmarked(section.index, block.offset + index)
                            ? t("textReading.bookmarkRemove")
                            : t("textReading.bookmarkAdd")
                        }}
                      </button>
                    </span>
                    <br
                      v-else-if="
                        !targumLine(section, block.offset + index) &&
                        !rashiComments(block.offset + index).length
                      "
                    />
                  </template>
                </p>
              </template>
            </template>
          </div>
        </CollapseTransition>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* Un chapitre hors écran n'est ni mis en page ni peint tant qu'on n'en
   approche pas ; la taille estimée garde une barre de défilement stable. */
.daily-section {
  content-visibility: auto;
  contain-intrinsic-size: auto 40rem;
}
/* Tailles pilotées par le réglage A− / A+ (useReadingSize), comme le lecteur.
   L'interligne de l'hébreu est volontairement plus serré que leading-loose :
   assez d'air pour les voyelles et les teamim, sans étirer la lecture. */
.daily-he {
  font-size: calc(1.25rem * var(--reading-scale, 1));
  line-height: 1.7;
}
.daily-tl {
  font-family: var(--font-reading);
  font-size: calc(1rem * var(--reading-scale, 1));
}
/* Rachi : sous le Targoum, plus petit et en retrait derrière un filet
   (côté droit : le texte est en hébreu). */
.daily-rashi {
  font-size: calc(0.95rem * var(--reading-scale, 1));
  line-height: 1.65;
  padding-inline-start: 0.75rem;
  border-inline-start: 2px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
}
</style>
