<script setup lang="ts">
import { SIDOUR_PATH, isSidourPath } from "../../config/navSections";
import {
  ref,
  computed,
  defineAsyncComponent,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from "vue";
import { HDate } from "@hebcal/core";
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";
import type { RouteLocationRaw } from "vue-router";
import { useI18n } from "vue-i18n";
import textStudiesJson from "../../datas/textStudies.json";
import type {
  PrayerName,
  Session,
  TextStudyReservation,
  TextStudiesJson,
  TextStudyJsonEntry,
} from "../../models/models";
import type { User } from "../../services/authService";
import {
  calendarDay,
  loadText,
  loadTranslation,
  translationLangs,
  MissingTextFileError,
  occasionsForDay,
  placeLabel as describePlace,
  rubricText,
  saidOn,
  tractateFromLink,
  tractateSlug,
} from "../../services/textService";
import type {
  TextBlock,
  TextContent,
  TextDay,
  TextSection,
  TextTranslation,
} from "../../services/textService";
import {
  pickTranslationLang,
  setTranslationShown,
  translationLangChoice,
  translationShown,
} from "../../composables/useTranslation";
import TranslationText from "../../components/TranslationText.vue";
import TranslationCredit from "../../components/TranslationCredit.vue";
import TranslationAiNotice from "../../components/TranslationAiNotice.vue";
import {
  activeOccasions,
  getWeekdayTorahParasha,
  recentSeasonalChanges,
} from "../../services/dailyCycles";
import {
  injectWeeklyTorah,
  nextTefilaEntry,
  tefilaHebrewDay,
  tefilaOf,
} from "../../services/sidourService";
import { locationOutcome, useZmanimLocation } from "../../composables/useZmanimLocation";
import { takeReadingEntry } from "../../services/readingEntry";
import { resolveBackNavigation, stripQuery } from "../../composables/readingBack";
import { useNow } from "../../composables/useNow";
import { useScrollFrame } from "../../composables/useScrollFrame";
import { useBookDownload } from "../../composables/useBookDownload";
import { useVerseBookmarks } from "../../composables/useVerseBookmarks";
import { useTextLabels } from "../../composables/useTextLabels";
import { localeMessagesReady } from "../../i18n";
import { transliterate, hasNiqqud } from "../../services/hebrewTransliteration";
import { appendHebrewNumeral } from "../../services/hebrewNumerals";
import { sessionService } from "../../services/sessionService";
import { isPerpetual, isRoundFinished, waitForNextRound } from "../../services/perpetualChain";
import { ReservationGoneError, SlotTakenError } from "../../services/appError";
import { isOffline } from "../../services/userPreferencesService";
import { pageTitle as siteTitle, seoService } from "../../services/seoService";
import {
  hubPath,
  sectionPath,
  entryByCorpusSlug,
  sectionTitle,
  hubTitle,
  sectionDescription,
  hubDescription,
  isLiturgy,
  latinName,
  corpusOf,
  READING_LEAD,
  readingLead as readingLeadOf,
  SITE_URL,
} from "../../content/etudeTexts";
import { APP_SITE_URL } from "../../config/environment";
import { encadrementOf } from "../../services/encadrementService";
import LiturgyText from "./LiturgyText.vue";
import TefilaDays from "./TefilaDays.vue";
import ReadingEncadrement from "../../components/ReadingEncadrement.vue";
import SlihotHours from "./SlihotHours.vue";
import ReadingMenu from "../../components/ReadingMenu.vue";
import FeatureTour, { type TourStep } from "../../components/FeatureTour.vue";
import MockPinch from "../../components/mock/MockPinch.vue";
import MockAutoScroll from "../../components/mock/MockAutoScroll.vue";
import { tipsOffered } from "../../composables/useFeatureTips";
import ReadingSizeControl from "../../components/ReadingSizeControl.vue";
import BookmarkRibbon from "../../components/BookmarkRibbon.vue";
import ReadingProgressBar from "../../components/ReadingProgressBar.vue";
import SessionReservationCard from "./SessionReservationCard.vue";
import PrayerNamesLine from "./PrayerNamesLine.vue";
import ReadingNav from "../../components/ReadingNav.vue";
import TalmudDafText from "../../components/TalmudDafText.vue";
import TalmudDafPages from "../../components/TalmudDafPages.vue";
import TorahScroll from "../../components/TorahScroll.vue";
import { PAGE_FORM_LABELS, usePageForm } from "../../composables/usePageForm";
import { scrollPointed, setScrollPointed } from "../../composables/useScrollPointing";
import {
  usePassageCommentaries,
  type CommentaryLangPicker,
} from "../../composables/usePassageCommentaries";
import { sideBySide } from "../../composables/useSideBySide";
import type { CommentarySummary } from "../../composables/useReadingSelection";
import CommentaryPanel from "../../components/CommentaryPanel.vue";
import MarkedText from "../../components/MarkedText.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
// Les cours audio d'un texte : chargés à la demande, ils lisent Firestore et
// ne servent qu'aux textes d'étude qui en ont.
const TexteChiourim = defineAsyncComponent(
  () => import("../../components/chiourim/TexteChiourim.vue"),
);
// La tâche de Mon parcours qui a mené à cette lecture : chargée à la demande,
// elle tire le calendrier hébraïque, et ne sert qu'à qui vient du parcours.
const ReaderTaskCard = defineAsyncComponent(
  () => import("../../components/parcours/ReaderTaskCard.vue"),
);
// The end of a service's text, opened from anywhere else: the service is
// marked done there. Same reason to load it on demand (the times engine).
const OfficeDoneCard = defineAsyncComponent(
  () => import("../../components/parcours/OfficeDoneCard.vue"),
);
import { useToast } from "../../composables/useToast";
import { usePageFormSize, useReadingSize } from "../../composables/useReadingSize";
import { readingProgressService } from "../../services/readingProgressService";
import type { Bookmark, ReadingPosition } from "../../services/readingProgressService";
import { isNativeApp } from "../../composables/useNativeApp";
import { ensureManifestLoaded } from "../../services/offlineTextStore";
import { scrollToBlockAnchor } from "../../composables/useReadingNav";
import type { ReadingNavSection } from "../../composables/useReadingNav";
import { useReadingPinch } from "../../composables/useReadingPinch";
import { useAutoScroll } from "../../composables/useAutoScroll";
import { isSansTahanoun } from "../../composables/useSansTahanoun";
import { nightWithoutTachanun, withoutTachanun } from "../../services/tachanun";
import { isWalledCityPlace, pastChatzotNight } from "../../services/zmanimService";
import { useKeepAwake } from "../../composables/useKeepAwake";
import { analyticsService } from "../../services/analyticsService";
import { haptic } from "../../services/haptics";
import { useLocalePath } from "../../composables/useLocalePath";
import { useConfirm } from "../../composables/useConfirm";
import {
  hasTableRestore,
  isOnTable,
  refreshOnTable,
  registerTableReader,
  setAside,
  takeTableRestore,
  useReadingTable,
  type TableText,
} from "../../composables/useReadingTable";
import { waitUntilPositionReachable } from "../../router/scrollRestoration";
import {
  clearPassage,
  selectedPassageKey,
  selectPassage,
  usePassageLongPress,
} from "../../composables/useReadingSelection";

/** Les pages traduites suivent l'espace de langue de l'URL ouverte. */
const { localePath } = useLocalePath();

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { confirm } = useConfirm();
const toast = useToast();
const readingSize = useReadingSize();
// The form of the page (daf, Sefer Torah) has a size of its own.
const pageFormSize = usePageFormSize();
const { sectionLabel, blockLabel, dafLabel, headingLabel } = useTextLabels();
// App native : pincer dans la page agrandit le texte lu, pas la page.
useReadingPinch();

/**
 * L'astuce des gestes de lecture (voir FeatureTour), une ouverture après
 * celle du menu : pincer pour la taille du texte, double appui pour le
 * défilement, un appui sur un verset pour le marque-page. Les deux premiers
 * n'ont rien à éclairer, la bulle les montre en capture dessinée ; le
 * troisième éclaire le premier verset, quand le texte en a (pas sur une
 * tefila, qui n'a pas de marque-page).
 */
const readingRoot = ref<HTMLElement | null>(null);

const gesturesTip = computed<TourStep[]>(() => {
  const steps: TourStep[] = [
    {
      key: "pinch",
      title: t("tips.reading.pinch.title"),
      text: t("tips.reading.pinch.text"),
      component: MockPinch,
    },
    {
      key: "autoScroll",
      title: t("tips.reading.autoScroll.title"),
      text: t("tips.reading.autoScroll.text"),
      component: MockAutoScroll,
    },
  ];
  if (!isLiturgyText.value) {
    steps.push({
      key: "bookmark",
      icon: "bookmark",
      title: t("tips.reading.bookmark.title"),
      text: t("tips.reading.bookmark.text"),
      target: () => readingRoot.value?.querySelector<HTMLElement>("[data-line]") ?? null,
      radius: 12,
      padding: 4,
    });
  }
  return steps;
});
// Lieu des horaires : donne le jour hébraïque (sensible à la chkia) qui
// conditionne les ajouts de calendrier des textes de tefila.
const {
  place: zmanimPlace,
  status: locationStatus,
  deniedBefore,
  locateDevice,
} = useZmanimLocation();

// This view serves two URL shapes with the SAME UI: the in-session reader
// (/lire/:textId, numeric id) and the public, indexable reading pages
// (/bibliotheque/:corpus/:slug[/:section], keyword URLs). `isEtudeRoute` switches
// navigation + metadata between the two.
const isEtudeRoute = computed(() => route.params.corpus !== undefined);
/** Corpus ayant leur page de bibliothèque (route `study-corpus`) : le retour
 * y ramène, plutôt qu'à l'accueil de la bibliothèque. Les textes de liturgie
 * (Sidour, Moadim, Brahot) remontent, eux, à la page du Sidour. */
const LIBRARY_CORPORA = new Set(["tehilim", "michna", "talmud", "tanakh", "moussar", "halakha"]);
const etudeEntry = computed<TextStudyJsonEntry | null>(() =>
  isEtudeRoute.value
    ? entryByCorpusSlug(String(route.params.corpus), String(route.params.slug))
    : null,
);

const textId = computed(() =>
  isEtudeRoute.value ? String(etudeEntry.value?.id ?? "") : String(route.params.textId),
);
const sectionParam = computed(() =>
  route.params.section ? Number(route.params.section) : undefined,
);
const sessionSlug = computed(() => (route.query.session ? String(route.query.session) : null));
/** L'objectif de Mon parcours qui a mené ici (`?objectif=`), s'il y en a un. */
const parcoursObjective = computed(() =>
  typeof route.query.objectif === "string" ? route.query.objectif : null,
);

/** Reading lead is shown on the public /bibliotheque pages (not in the session reader).
 * Les corpus liturgiques (non partageables) reçoivent la variante sans partage. */
const readingLead = computed(() =>
  etudeEntry.value ? readingLeadOf(etudeEntry.value) : READING_LEAD,
);
const isTehilimEtude = computed(
  () => isEtudeRoute.value && String(route.params.corpus) === "tehilim",
);

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;
const textEntry = computed(() => allTexts.find((t) => String(t.id) === textId.value) ?? null);

const loading = ref(false);
const missingFile = ref(false);
const error = ref(false);
const content = ref<TextContent | null>(null);
const showPhonetic = ref(false);

// La translittération phonétique est une aide de lecture peu visible : mesurer
// si elle est trouvée et utilisée.
watch(showPhonetic, (enabled) => {
  analyticsService.capture("phonetic_toggled", { enabled });
});

// --- Reading ---
const isSingleSection = computed(() => content.value?.sections.length === 1);

// Single-section texts read as one continuous flow, with a visual marker at
// each chapter / montée (same pattern as the Talmud daf markers). Texts
// without blocks render as one unlabelled group.
const verseBlocks = computed<TextBlock[]>(() => {
  const section = currentSection.value;
  if (!section) return [];
  if (section.blocks?.length) return section.blocks;
  return [{ label: "", lines: section.he, offset: 0 }];
});

// Tefila : les ajouts liés au calendrier (Retsé le Chabbat, Yaalé véyavo à
// Roch Hodech, Al hanissim à Hanouka…) ne s'affichent que le jour où ils se
// disent, fondus dans le fil du texte. Le jour suivi dépend de l'office
// (voir tefilaHebrewDay) : Cha'harit et Min'ha vivent la journée civile,
// Min'ha du jeudi soir reste celle du jeudi ; les brahot basculent à la
// chkia, Retsé se bénit dès le vendredi soir ; Arvit suit la nuit qui vient
// dès le lever du soleil, celle qu'on priera ce soir.
//
// L'heure est donc une donnée du rendu, pas une valeur figée à l'ouverture :
// on bénit après la chkia du vendredi une page ouverte avant elle, et Retsé
// doit apparaître sans qu'on ait à la recharger (horloge partagée, useNow).
//
// L'horloge tique toutes les trente secondes ; le jour hébraïque passe par
// une clé scalaire (son jour absolu) pour que rien ne se recalcule, et
// surtout que l'office ne se re-rende pas, tant que le jour n'a pas changé.
const now = useNow();
const occasionsDayAbs = computed(() =>
  isLiturgyText.value
    ? tefilaHebrewDay(zmanimPlace.value, tefilaOf(textEntry.value), now.value).abs()
    : new HDate(now.value).abs(),
);
const occasionsDay = computed(() => new HDate(occasionsDayAbs.value));
// « Sans tahanoun » (réglage du menu de lecture) : le lecteur retire ce que
// le calendrier ne peut pas savoir, une brit mila ou un marié dans
// l'assemblée. Le réglage ne vaut que le jour où il est posé ; c'est l'heure
// du rendu qui en décide, comme des occasions elles-mêmes.
const calendarOccasions = computed(() => {
  const il = zmanimPlace.value.tzid === "Asia/Jerusalem";
  const today = activeOccasions(occasionsDay.value, il, isWalledCityPlace(zmanimPlace.value));
  const jour = isLiturgyText.value && isSansTahanoun(now.value) ? withoutTachanun(today) : today;
  if (!isLiturgyText.value) return jour;
  // Hatsot halayla ne se lit pas sur le calendrier : c'est une heure, elle
  // change au milieu de la nuit sans que le jour hébraïque bouge. Le Chema du
  // coucher s'en sert pour la bénédiction Hamapil, dont le Nom se pense au
  // lieu de se dire une fois hatsot passé, et pour son vidouy, qui ne se dit
  // pas à la sortie de Chabbat avant hatsot.
  const pastChatzot = pastChatzotNight(zmanimPlace.value, now.value);
  const nuit = new Set(jour);
  if (pastChatzot) nuit.add("apres-hatsot");
  if (nightWithoutTachanun(occasionsDay.value, il, jour, pastChatzot)) {
    nuit.add("sans-tahanoun-nuit");
  }
  return nuit;
});

// Un texte à jours (les Hochanot, une suite par jour de Souccot) s'ouvre sur
// le jour du calendrier, et sur le premier hors de la fête ; le lecteur peut
// en lire un autre (voir TefilaDays). Une adresse peut aussi nommer le jour
// (?jour=hoshana-rabba) : le lien de la page de Hochaana Rabba, les
// anciennes pages d'un jour, un passage partagé. Le choix ne vaut que pour le
// texte ouvert : le rouvrir, c'est retrouver le jour qu'il est.
const textDays = computed<TextDay[]>(() => currentSection.value?.days ?? []);
const pickedDay = ref<string | null>(null);
watch(
  [textId, () => route.query.jour],
  ([, jour]) => (pickedDay.value = typeof jour === "string" ? jour : null),
  { immediate: true },
);
const todayDay = computed(() => calendarDay(textDays.value, calendarOccasions.value));
const shownDay = computed<TextDay | null>(
  () =>
    textDays.value.find((day) => day.when === pickedDay.value) ??
    todayDay.value ??
    textDays.value[0] ??
    null,
);
const occasions = computed(() =>
  shownDay.value
    ? occasionsForDay(calendarOccasions.value, textDays.value, shownDay.value)
    : calendarOccasions.value,
);
const visibleBlocks = computed(() =>
  verseBlocks.value.filter((b) => saidOn(b.when, occasions.value, b.unless)),
);

// Les bascules saisonnières récentes (machiv haroua'h en début d'hiver…) :
// leurs ajouts s'affichent à la couleur du thème les trois premières
// semaines ; le reste du temps ils se fondent dans le fil.
const recentChanges = computed(() =>
  recentSeasonalChanges(occasionsDay.value, zmanimPlace.value.tzid === "Asia/Jerusalem"),
);

/** Tefila (Sli'hot, Brahot, Sidour) : un rendu à part, voir LiturgyText. */
const isLiturgyText = computed(() => !!textEntry.value && isLiturgy(textEntry.value));
/** Un office du sidour : le menu de lecture y propose « sans tahanoun ». */
const textTefila = computed(() => tefilaOf(textEntry.value ?? null));
const isTefila = computed(() => textTefila.value !== null);
/**
 * Le texte porte-t-il, aujourd'hui, une consigne de loi ? Le réglage qui les
 * masque ne se montre que là où il a prise : proposer de masquer ce que la
 * page n'affiche pas laisserait croire qu'on a raté quelque chose.
 */
const hasHalakhot = computed(() =>
  visibleBlocks.value.some((block) =>
    (block.halakhot ?? []).some((halakha) => saidOn(halakha.when, occasions.value, halakha.unless)),
  ),
);

/**
 * Les passages qui encadrent la lecture (le Léchem yihoud du Cantique des
 * cantiques), repliés au-dessus et au-dessous du texte. Ceux qui se disent à
 * l'ouverture d'un livre entier, le Yehi ratson des Tehilim, se posent sur la
 * page du livre et non sur chacun de ses psaumes (voir EncadrementPlace).
 */
const encadrement = computed(() => {
  const passages = encadrementOf(textEntry.value ?? undefined);
  return passages?.place === "text" ? passages : null;
});
// Les Sli'hot, seul texte à afficher sa plage horaire (voir SlihotHours).
// Elles vivent dans les Moadim avec les autres textes de fête ; c'est le
// texte qu'on reconnaît ici, pas son corpus.
const slihotEntry = entryByCorpusSlug("moadim", "slihot");
const isSlihot = computed(
  () => !!textEntry.value && !!slihotEntry && textEntry.value.id === slihotEntry.id,
);

// App native : le texte lu se télécharge sans quitter la page, par l'icône
// du menu de lecture.
const { bookStateOf, toggleDownload: toggleBookDownload } = useBookDownload();
const bookState = computed(() => (textEntry.value ? bookStateOf(textEntry.value) : "none"));

function toggleDownload() {
  if (textEntry.value) void toggleBookDownload(textEntry.value);
}

// Sidour : à la fin de Min'ha, Arvit est à un geste (la sortie des étoiles
// les enchaîne). Pas de lien entre Cha'harit et le reste : la journée les
// sépare.
const sidourNextEntry = computed(() => nextTefilaEntry(textEntry.value));

// Les horaires affichés en tête d'office (TefilaZman) valent ce que vaut le
// lieu : à l'arrivée sur un office du sidour, on redemande la position de
// l'appareil, comme le bouton de la page des horaires, pour que les heures
// suivent l'endroit où l'on est et non celui du dernier passage. Une ville
// choisie explicitement reste respectée, un refus laisse le lieu courant
// (voir locateDevice) et se retient : on ne redemande pas à chaque visite,
// le bouton de la page des horaires reste le moyen de changer d'avis.
watch(
  // Les trois offices, et eux seuls : le sidour porte aussi des textes sans
  // horaires (le Chema du coucher, la havdala, le tikoun hatsot), et demander
  // sa position à quelqu'un qui ouvre le Chema du coucher n'aurait servi à
  // rien de ce qu'il voit.
  () => (tefilaOf(textEntry.value ?? null) ? textId.value : null),
  (id) => {
    if (!id || zmanimPlace.value.source === "city" || deniedBefore.value) return;
    const startedAt = Date.now();
    void locateDevice().then((granted) => {
      analyticsService.capture("zmanim_location_requested", {
        granted,
        source: "sidour",
        ...locationOutcome(granted, locationStatus.value, startedAt),
      });
    });
  },
  { immediate: true },
);

/** Séparation entre deux blocs (chapitre, montée), pas de filet au premier. */
function blockLabelClass(index: number): string {
  const base = "mb-4 text-sm font-semibold text-primary";
  return index === 0 ? base : `${base} mt-10 pt-4 border-t border-black/10 dark:border-white/10`;
}

// Verse numbers for chaptered texts, and within each chapter / montée block.
// Whole short texts without blocks (a single psalm) stay unnumbered, and the
// liturgy (Sli'hot, Brahot) too: on ne cite pas une bénédiction par numéro.
// Un psaume reste sans numéros même découpé : les strophes du psaume 119
// recommenceraient chacune à 1. Un siman de halakha lu seul (Hilkhot
// Melamdim) garde ses numéros : ce sont ceux de ses séifim.
const showVerseNumbers = computed(
  () =>
    !(textEntry.value && isLiturgy(textEntry.value)) &&
    String(textEntry.value?.type) !== "Tehilim" &&
    ((textEntry.value?.totalSections ?? 1) > 1 ||
      String(textEntry.value?.type) === "Halakha" ||
      (currentSection.value?.blocks?.length ?? 0) > 0),
);

const showSectionList = computed(() => !isSingleSection.value && sectionParam.value === undefined);

const currentSection = computed<TextSection | null>(() => {
  if (!content.value) return null;
  if (isSingleSection.value) return content.value.sections[0];
  if (sectionParam.value !== undefined) {
    return content.value.sections.find((s) => s.index === sectionParam.value) ?? null;
  }
  return null;
});

const canTransliterate = computed(
  () => currentSection.value?.he.some((line) => hasNiqqud(line)) ?? false,
);

// --- Traduction ---
// Sous l'hébreu, la traduction du texte quand il en a une (voir
// docs/traductions.md) : dans la langue choisie, à défaut celle de
// l'interface, à défaut celle qui existe. Pas sur une tefila : le sidour se
// prie en hébreu, et ses textes n'ont pas de traduction alignée.
const textTranslationLangs = ref<string[]>([]);
const translation = ref<TextTranslation | null>(null);
/** Le texte dont `translation` est la traduction. */
const translationTextId = ref<string | null>(null);
const translationFailed = ref(false);

const translationLang = computed(() =>
  pickTranslationLang(textTranslationLangs.value, locale.value, translationLangChoice.value),
);
// La forme de la page (la page de Vilna, le tikoun) ne montre pas de
// traduction : la commande n'y est pas proposée.
const canTranslate = computed(
  () => !isLiturgyText.value && translationLang.value !== null && !showPageForm.value,
);
const showTranslation = computed(() => canTranslate.value && translationShown.value);

/** Les lignes traduites de la section lue, alignées sur `he` (vide sans traduction). */
const trLines = computed<string[]>(() => {
  const section = currentSection.value;
  const tr = translation.value;
  if (!showTranslation.value || !section || !tr || translationTextId.value !== textId.value) {
    return [];
  }
  return tr.sections.get(section.index) ?? [];
});

/** Talmud : les lignes traduites de chaque daf, découpées comme ses lignes. */
const translationByDaf = computed<Map<string, string[]> | null>(() => {
  if (!trLines.value.length) return null;
  const byDaf = new Map<string, string[]>();
  let offset = 0;
  for (const block of currentSection.value?.dafBlocks ?? []) {
    byDaf.set(block.daf, trLines.value.slice(offset, offset + block.lines.length));
    offset += block.lines.length;
  }
  return byDaf;
});

/**
 * Le texte n'est pas traduit dans la langue du lecteur : on le dit, avant de
 * montrer celle qui existe (le Talmud, qu'on n'a qu'en anglais).
 */
const translationFallback = computed(() => {
  const lang = translationLang.value;
  const wanted = translationLangChoice.value ?? locale.value;
  if (!showTranslation.value || !lang || lang === wanted) return null;
  if (wanted !== "fr" && wanted !== "en") return null;
  return {
    wanted: t(`textReading.translation.langAdj.${wanted}`),
    shown: t(`textReading.translation.langAdj.${lang}`),
  };
});

watch(
  textId,
  async (id) => {
    textTranslationLangs.value = [];
    const entry = textEntry.value;
    if (!entry) return;
    const langs = await translationLangs(entry);
    if (textId.value === id) textTranslationLangs.value = langs;
  },
  { immediate: true },
);

let translationSequence = 0;
watch(
  [textId, translationLang, showTranslation],
  async () => {
    const entry = textEntry.value;
    const lang = translationLang.value;
    if (!showTranslation.value || !entry || !lang) return;
    if (translationTextId.value === textId.value && translation.value?.lang === lang) return;
    const sequence = ++translationSequence;
    translationFailed.value = false;
    try {
      const loaded = await loadTranslation(entry, lang);
      if (sequence !== translationSequence) return;
      translation.value = loaded;
      translationTextId.value = String(entry.id);
    } catch {
      if (sequence === translationSequence) translationFailed.value = true;
    }
  },
  { immediate: true },
);

/** Les langues du texte pour le menu, celle de l'interface en premier. */
const menuTranslationLangs = computed(() =>
  [...textTranslationLangs.value].sort(
    (a, b) => Number(b === locale.value) - Number(a === locale.value),
  ),
);

function toggleTranslation() {
  setTranslationShown(!translationShown.value, translationLang.value);
}

// La forme de la page (pageForm.ts) : la page de Vilna pour une guemara, le
// Sefer Torah pour une paracha. Le choix est gardé sur l'appareil
// (usePageForm) ; la phonétique, elle, n'a pas de forme de page et passe
// devant le temps qu'on la lise.
const pageForm = usePageForm();
const pageFormKind = computed<"daf" | "scroll" | null>(() => {
  const section = currentSection.value;
  if (!section) return null;
  if (content.value?.type === "Talmud Bavli" && section.dafBlocks?.length) return "daf";
  if (section.scrollMarks?.length) return "scroll";
  return null;
});
const showPageForm = computed(
  () => pageFormKind.value !== null && pageForm.enabled.value && !showPhonetic.value,
);

/** Le mode d'affichage choisi dans la barre d'outils ou le menu. */
type ReadingMode = "hebrew" | "page" | "phonetic";
const readingMode = computed<ReadingMode>(() =>
  showPhonetic.value ? "phonetic" : showPageForm.value ? "page" : "hebrew",
);
function setReadingMode(mode: ReadingMode): void {
  if (mode === readingMode.value) return;
  if (mode === "phonetic") {
    showPhonetic.value = true;
    return;
  }
  showPhonetic.value = false;
  const on = mode === "page";
  if (pageFormKind.value && pageForm.enabled.value !== on) {
    pageForm.set(on);
    // Une forme de lecture nouvelle : savoir si elle est trouvée, et sur
    // quel corpus elle sert.
    analyticsService.capture("page_form_toggled", {
      enabled: on,
      form: pageFormKind.value,
      text_id: textEntry.value?.id ?? null,
    });
  }
}

// Rachi et Tossafot (guemara), Rachi (paracha) du chapitre ouvert : chargés au
// premier passage touché ou à l'ouverture de la page du daf, jamais avant ;
// la lecture seule ne les attend pas (usePassageCommentaries).
// The translation on: the commentaries that have one (Rashi on the Torah)
// come translated too, in the language the text would take.
const commentaryLangPicker = computed<CommentaryLangPicker | null>(() => {
  if (!translationShown.value || isLiturgyText.value) return null;
  const lang = locale.value;
  const choice = translationLangChoice.value;
  return (available) => pickTranslationLang(available, lang, choice);
});
const commentaries = usePassageCommentaries(textEntry, currentSection, commentaryLangPicker);
watch(
  () => (showPageForm.value && pageFormKind.value === "daf" ? currentSection.value : null),
  (section) => {
    if (section) void commentaries.ensure();
  },
  { immediate: true },
);
const dafMeforshimState = computed<"loading" | "ready" | "error">(() =>
  commentaries.state.value === "ready" || commentaries.state.value === "error"
    ? commentaries.state.value
    : "loading",
);

/** Les montées d'une paracha, pour les repères du Sefer Torah. */
const scrollAliyot = computed(() =>
  verseBlocks.value
    .filter((b) => b.label)
    .map((b) => ({ offset: b.offset, anchor: anchorOf(b), label: blockLabel(b) })),
);

// Double appui sur le texte : la page descend toute seule, à l'allure choisie
// dans la pastille du bas (AutoScrollPill). Seulement dans le texte ouvert :
// la liste des chapitres d'un traité se parcourt, elle ne se lit pas.
useAutoScroll(() => currentSection.value !== null);

// L'écran ne s'éteint pas tant qu'un texte est ouvert : un office se dit sans
// toucher au téléphone, et la veille tomberait au milieu de la 'amida.
useKeepAwake(() => currentSection.value !== null);
// Un texte long se cherche par ses divisions : les sections d'un office
// ('Amida, Chéma, ta'hanoun…), les montées d'une paracha, les dafim d'une
// guemara. La page les publie au menu de lecture (ReadingMenu), qui remplace
// le bouton « remonter en haut ». Un texte d'un seul tenant n'en publie
// aucune : son menu se limite alors à la taille et au haut de page.
const dafOffsets = computed<{ daf: string; offset: number }[]>(() => {
  const out: { daf: string; offset: number }[] = [];
  let offset = 0;
  for (const block of currentSection.value?.dafBlocks ?? []) {
    // Un bloc sans daf (traité rangé par chapitre) n'a rien à publier.
    if (block.daf) out.push({ daf: block.daf, offset });
    offset += block.lines.length;
  }
  return out;
});
const navSections = computed<ReadingNavSection[]>(() => {
  if (!currentSection.value) return [];
  if (isLiturgyText.value) {
    return visibleBlocks.value
      .filter((b) => !b.zman && !b.fold && (b.labelText || b.label))
      .map((b) => {
        const label = b.labelText ? rubricText(b.labelText, locale.value) : b.label;
        // Le titre hébreu accompagne le traduit, sauf à le répéter.
        const hebrew = b.labelText?.he;
        return {
          anchor: anchorOf(b),
          offset: b.offset,
          label,
          ...(hebrew && hebrew !== label ? { hebrew } : {}),
        };
      });
  }
  if (content.value?.type === "Talmud Bavli") {
    return dafOffsets.value.map(({ daf, offset }) => ({
      anchor: String(offset),
      offset,
      label: dafLabel(daf),
    }));
  }
  return verseBlocks.value
    .filter((b) => b.label)
    .map((b) => ({ anchor: anchorOf(b), offset: b.offset, label: blockLabel(b) }));
});

/** Le repère d'un bloc pour le menu de lecture (voir TextBlock.anchor). */
const anchorOf = (block: TextBlock): string => block.anchor ?? String(block.offset);

// Translittération mémoïsée : appelée depuis le template, elle était recalculée
// pour toute la section (des dizaines de lignes × plusieurs passes regex) à
// CHAQUE re-rendu de la page, y compris ceux qui n'ont rien à voir (tick du
// lecteur audio, changement de taille de lecture…). Les computed ne refont le
// travail qu'au changement de section, et rien du tout hors mode phonétique.
const phoneticByDaf = computed(() => {
  const byDaf = new Map<string, string>();
  if (!showPhonetic.value) return byDaf;
  for (const block of currentSection.value?.dafBlocks ?? []) {
    byDaf.set(block.daf, block.lines.map(transliterate).join(" "));
  }
  return byDaf;
});

const phoneticLines = computed(() => {
  if (!showPhonetic.value) return [];
  return (currentSection.value?.he ?? []).map(transliterate);
});

const sectionIndexInList = computed(() => {
  if (!content.value || !currentSection.value) return -1;
  return content.value.sections.indexOf(currentSection.value);
});
const hasPrev = computed(() => sectionIndexInList.value > 0);
const hasNext = computed(
  () => content.value !== null && sectionIndexInList.value < content.value.sections.length - 1,
);

// Un texte en chapitres (les huit du Cantique des cantiques) ne répète pas
// ses encadrements à chaque page : le « avant » ouvre le premier chapitre, le
// « après » ferme le dernier, comme la prière encadre la lecture entière.
const showEncadrementBefore = computed(() => encadrement.value !== null && !hasPrev.value);
const showEncadrementAfter = computed(() => encadrement.value !== null && !hasNext.value);

// Numéro du dernier chargement demandé : deux textes enchaînés vite (« texte
// suivant » deux fois, un traité du Talmud pèse jusqu'à 1,8 Mo) font partir
// deux requêtes, et la première revenue écrirait le contenu de l'ancien texte
// sous l'adresse du nouveau. Un résultat périmé est simplement ignoré.
let loadSequence = 0;
/**
 * Le texte dont `content` est le contenu. En passant d'un texte à l'autre
 * sans quitter la page, l'adresse change avant que le nouveau contenu
 * n'arrive : la table d'étude ne doit pas replacer le texte attendu sur
 * l'ancien (voir la reprise depuis la table, plus bas).
 */
let contentTextId: string | null = null;

async function loadContent() {
  if (!textEntry.value) return;
  const sequence = ++loadSequence;
  const stale = () => sequence !== loadSequence;
  const forText = textId.value;
  // Usage de la bibliothèque vs lecture dans le cadre d'une chaîne.
  analyticsService.capture("text_opened", {
    text_id: textEntry.value.id,
    corpus: textEntry.value.type,
    book: textEntry.value.livre,
    source: sessionSlug.value ? "session" : "library",
    // La chaîne d'où vient le lecteur. Le slug, pas l'id : la session n'est
    // résolue qu'après ce chargement (voir onMounted), et c'est le slug que
    // porte l'URL, donc la seule clé disponible ici. C'est aussi celle que
    // `session_text_read_clicked` emporte, pour recoller les deux.
    session_slug: sessionSlug.value,
    // D'où l'on arrive, plus finement que `source` (voir readingEntry) :
    // recherche, accueil, lecture du jour, autre texte, lien de l'extérieur...
    entry: takeReadingEntry(router.options.history.state.back as string | null, {
      session: sessionSlug.value !== null,
    }),
  });
  loading.value = true;
  error.value = false;
  missingFile.value = false;
  content.value = null;
  try {
    const loaded = await loadText(textEntry.value);
    if (stale()) return;
    contentTextId = forText;
    content.value = loaded;
    // Sidour : le lundi et le jeudi, la lecture de la Torah de la semaine
    // (le début de la paracha, en trois montées) prend la place de son
    // marqueur dans Cha'harit. Elle change chaque semaine : c'est le lecteur
    // qui la charge. Avant Souccot, c'est Vezot Haberakha, que le chnei mikra
    // enjambe (voir getWeekdayTorahParasha). Le calendrier est celui du lieu,
    // comme pour les occasions : Israël et la diaspora lisent parfois des
    // parachiot différentes plusieurs semaines de suite.
    if (tefilaOf(textEntry.value) === "chaharit" && occasions.value.has("torah-semaine")) {
      try {
        const parasha = getWeekdayTorahParasha(
          occasionsDay.value.greg(),
          zmanimPlace.value.tzid === "Asia/Jerusalem",
        );
        if (parasha?.entries[0]) {
          const parashaContent = await loadText(parasha.entries[0]);
          if (stale()) return;
          content.value = injectWeeklyTorah(content.value, parasha, parashaContent);
        }
      } catch {
        // Paracha indisponible (hors ligne, fichier manquant) : le marqueur
        // reste vide et la section n'apparaît pas, le reste de l'office si.
      }
    }
  } catch (e) {
    if (stale()) return;
    if (e instanceof MissingTextFileError) missingFile.value = true;
    else error.value = true;
  } finally {
    if (!stale()) loading.value = false;
  }
}

// Entering a chapter from the list pushes a new entry; paging between chapters
// (next/previous) replaces it, since moving along is lateral navigation within
// the same text rather than a new page to step back through.
function goToSection(index: number, replace = false) {
  rememberOnTable();
  userNavigated = true;
  const to =
    isEtudeRoute.value && textEntry.value
      ? sectionPath(textEntry.value, index)
      : {
          name: "text-reading-section",
          params: { textId: textId.value, section: index },
          query: route.query,
        };
  if (replace) router.replace(to);
  else router.push(to);
  scrollTopProgrammatic();
}

/** Chemin (sans query) de l'entrée d'historique précédente, null si on est entré directement. */
function previousHistoryPath(): string | null {
  const back = router.options.history.state.back;
  return typeof back === "string" ? stripQuery(back) : null;
}

/** Une page du texte en cours de lecture : sa liste de chapitres ou l'un d'eux. */
function isCurrentTextPath(path: string): boolean {
  const base =
    isEtudeRoute.value && textEntry.value ? hubPath(textEntry.value) : `/lire/${textId.value}`;
  return path === base || path.startsWith(`${base}/`);
}

/**
 * La bibliothèque du corpus lu (Tehilim, Talmud…), à défaut son accueil ; le
 * Sidour pour un texte de liturgie.
 */
function libraryLocation(): string {
  const corpus = isEtudeRoute.value ? String(route.params.corpus) : "";
  if (isSidourPath(`/bibliotheque/${corpus}`)) return SIDOUR_PATH;
  return LIBRARY_CORPORA.has(corpus) ? `/bibliotheque/${corpus}` : "/bibliotheque";
}

/**
 * « Retour » remonte d'un cran (chapitre → liste des chapitres → bibliothèque).
 * Il ne POUSSE jamais la page parente : soit elle est déjà l'entrée précédente
 * et on y revient, soit on remplace l'entrée courante. Empiler la faisait
 * revenir en arrière sur le chapitre qu'on venait de quitter, chapitre →
 * texte → chapitre, sans fin.
 */
function goUp(target: RouteLocationRaw, preferHistory: boolean) {
  rememberOnTable();
  const action = resolveBackNavigation({
    previousPath: previousHistoryPath(),
    parentPath: router.resolve(target).path,
    isCurrentTextPath,
    preferHistory,
  });
  if (action === "back") {
    // Le routeur restaure la position enregistrée : pas de remise en haut, mais
    // ce défilement n'est pas un geste du lecteur pour autant.
    markProgrammaticScroll();
    router.back();
    return;
  }
  router.replace(target);
  scrollTopProgrammatic();
}

function sectionListLocation(): RouteLocationRaw {
  return isEtudeRoute.value && textEntry.value
    ? hubPath(textEntry.value)
    : { name: "text-reading", params: { textId: textId.value }, query: route.query };
}

function backToSectionList() {
  goUp(sectionListLocation(), false);
}

function exitReading() {
  if (sessionSlug.value) {
    router.push(`/share-reading/session/${sessionSlug.value}`);
    return;
  }
  // While reading a chapter, "back" returns to this text's chapter list rather
  // than the previously read chapter, readers paging through next/previous
  // expect to land back on the list to pick another passage.
  if (!isSingleSection.value && sectionParam.value !== undefined) {
    backToSectionList();
    return;
  }
  // Sur la liste des chapitres, « Retour » quitte le texte : on rend la main à
  // l'écran d'où vient le lecteur, sauf s'il s'agit d'un chapitre de ce même
  // texte (lien direct vers un chapitre), on remonte alors à la bibliothèque.
  goUp(libraryLocation(), true);
}

function prevSection() {
  if (content.value && hasPrev.value)
    goToSection(content.value.sections[sectionIndexInList.value - 1].index, true);
}
function nextSection() {
  if (content.value && hasNext.value)
    goToSection(content.value.sections[sectionIndexInList.value + 1].index, true);
}

// Sibling texts of the same type (all Tehilim, all tractates…), in catalog order.
// Pas pour la liturgie : les brahot ne se suivent pas, on n'y feuillette pas.
const siblings = computed(() =>
  textEntry.value && !isLiturgy(textEntry.value)
    ? allTexts.filter((s) => s.type === textEntry.value!.type)
    : [],
);
const siblingIndex = computed(() => siblings.value.findIndex((s) => String(s.id) === textId.value));
const prevText = computed<TextStudyJsonEntry | null>(() =>
  siblingIndex.value > 0 ? siblings.value[siblingIndex.value - 1] : null,
);
const nextText = computed<TextStudyJsonEntry | null>(() =>
  siblingIndex.value >= 0 && siblingIndex.value < siblings.value.length - 1
    ? siblings.value[siblingIndex.value + 1]
    : null,
);

// Paging to the previous/next sibling text (e.g. Tehilim 5 → Tehilim 6) is
// lateral navigation, so it replaces the history entry rather than pushing.
// That way "Retour" (and the browser back button) returns to the list the
// reader came from instead of stepping back through every text already read.
function goToText(target: TextStudyJsonEntry) {
  rememberOnTable();
  const to = isEtudeRoute.value
    ? hubPath(target)
    : { name: "text-reading", params: { textId: String(target.id) }, query: route.query };
  router.replace(to);
  scrollTopProgrammatic();
}

// --- Reprise de lecture & marque-pages ---
const savedPosition = ref<ReadingPosition | null>(null);
const resumeDismissed = ref(false);
const showBookmarksPanel = ref(false);

/** Section utilisée dans les positions/marque-pages (null pour un texte entier). */
const positionSection = computed(() =>
  isSingleSection.value ? null : (sectionParam.value ?? null),
);

const canonicalReadingPath = computed(() => {
  const e = textEntry.value;
  if (!e) return "";
  return !isSingleSection.value && sectionParam.value !== undefined
    ? sectionPath(e, sectionParam.value)
    : hubPath(e);
});

const positionLabel = computed(() => {
  const e = textEntry.value;
  if (!e) return "";
  const base = appendHebrewNumeral(e.name);
  return currentSection.value && !isSingleSection.value
    ? `${base} · ${currentSection.value.label}`
    : base;
});

/**
 * "Chapitre 2 (ב) · 3e montée · verset 14" pour une position donnée ; dans la
 * Michna, "Chapitre 2 (ב) · michna 3" ; dans la halakha, "Siman 242 · séif 1".
 */
function placeLabel(sectionIndex: number | null, line: number): string {
  const type = String(textEntry.value?.type);
  return describePlace(
    content.value?.sections ?? [],
    sectionIndex,
    line,
    (n) =>
      type === "Mishna"
        ? t("textReading.mishnaN", { n })
        : type === "Halakha"
          ? t("textReading.seifN", { n })
          : t("textReading.verseN", { n }),
    headingLabel,
    (n) => t("textReading.passageN", { n }),
  );
}

// Un verset se repère par sa ligne : une section à l'écran à la fois. Le
// chemin et le libellé enregistrés sont ceux de la section ouverte.
const {
  bookmarks,
  highlighted: highlightedLine,
  refresh: refreshBookmarks,
  isBookmarked,
  toggleBookmark,
  remove: removeBookmarkItem,
  scrollTo,
} = useVerseBookmarks<number>({
  textId: () => textId.value,
  entry: () => textEntry.value,
  keyOf: (_section, line) => line,
  pathFor: () => canonicalReadingPath.value,
  labelFor: () => positionLabel.value,
});

const showResumeBanner = computed(() => {
  // Liturgie : les marque-pages restent, mais pas de « reprendre là où vous
  // étiez », une brakha ou les Sli'hot se lisent du début, pas en cours.
  if (textEntry.value && isLiturgy(textEntry.value)) return false;
  const p = savedPosition.value;
  if (!p || resumeDismissed.value || route.query.verset !== undefined || !content.value)
    return false;
  // Rouvert depuis la table d'étude : il reprend déjà où on l'avait laissé.
  if (hasTableRestore(route.path)) return false;
  if (isSingleSection.value) return p.line > 2;
  if (showSectionList.value) return true;
  return p.section !== sectionParam.value || p.line > 2;
});

const resumePlace = computed(() =>
  savedPosition.value ? placeLabel(savedPosition.value.section, savedPosition.value.line) : "",
);

/** Navigue vers une position (autre chapitre → route, sinon scroll direct). */
function goToPlace(section: number | null, line: number) {
  if (!isSingleSection.value && section !== null && section !== sectionParam.value) {
    const to =
      isEtudeRoute.value && textEntry.value
        ? { path: sectionPath(textEntry.value, section), query: { verset: String(line) } }
        : {
            name: "text-reading-section",
            params: { textId: textId.value, section },
            query: { ...route.query, verset: String(line) },
          };
    router.push(to);
  } else {
    scrollToLine(line);
  }
}

function resumeReading() {
  const p = savedPosition.value;
  if (!p || !textEntry.value) return;
  analyticsService.capture("reading_resumed", { text_id: textEntry.value.id, source: "banner" });
  resumeDismissed.value = true;
  goToPlace(p.section, p.line);
}

function dismissResume() {
  resumeDismissed.value = true;
}

function scrollToLine(line: number) {
  // Un placement, pas une lecture : rien ne s'enregistre avant que le lecteur
  // ne touche à la page (voir awaitingReaderGesture).
  awaitingReaderGesture = true;
  scrollTo(positionSection.value, line, () => {
    const verse = document.querySelector(`[data-line="${line}"]`);
    // Pas de tel verset dans ce chapitre (un traité de Guemara n'a pas de
    // lignes repérées, sa reprise vaut toujours 0) : le chapitre s'ouvre en
    // haut. Le routeur ne remonte plus pour une arrivée sur un verset, et la
    // page restait à la hauteur où l'on avait laissé la liste des chapitres.
    if (!verse) scrollTopProgrammatic();
    return verse;
  });
}

// Arrivée avec ?verset=N (reprise, marque-page, lien partagé) : on scrolle au
// verset dès que le contenu correspondant est rendu.
watch([content, sectionParam, () => route.query.verset], ([loaded, , verset]) => {
  if (!loaded || verset === undefined) return;
  const line = Number(verset);
  if (Number.isInteger(line) && line >= 0) scrollToLine(line);
});

// Arrivée avec ?chapitre=N depuis un cours audio (voir chiourTexte) : sur un
// texte d'une seule page, le N-ième bloc (le chapitre d'un livre des
// Prophètes, la montée d'une paracha). On s'y rend comme à un verset.
watch([content, () => route.query.chapitre], ([loaded, chapitre]) => {
  if (!loaded || chapitre === undefined || route.query.verset !== undefined) return;
  if (loaded.sections.length !== 1) return;
  const block = loaded.sections[0].blocks?.[Number(chapitre) - 1];
  if (block) scrollToLine(block.offset);
});

// Arrivée par un renvoi (#repère, voir TextLink) : la fin des Hochanot ramène
// à Cha'harit là où l'on en était, au Kaddich Titkabal. Le passage n'existe
// qu'une fois le texte chargé et rendu ; son titre vient se poser sous
// l'en-tête, comme depuis le menu de lecture.
watch([content, () => route.hash], async ([loaded, hash]) => {
  if (!loaded || !hash) return;
  await nextTick();
  markProgrammaticScroll();
  scrollToBlockAnchor(hash.slice(1));
});

// --- Suivi de la position (sauvegarde silencieuse au scroll) ---
// La position ne s'enregistre qu'après un geste du lecteur (scroll, choix d'un
// chapitre), jamais à la simple ouverture : sinon on écraserait la position à
// reprendre avant même d'avoir affiché la bannière.
let scrollSaveTimer: number | null = null;
let sessionSaved = false;
// Les remises en haut de page (navigation) déclenchent l'événement scroll
// comme un geste du lecteur : on les marque pour ne pas les compter.
let programmaticScrollAt = 0;

function markProgrammaticScroll() {
  programmaticScrollAt = Date.now();
}

/**
 * Placé sur un verset (reprise, marque-page, lien partagé), le lecteur n'a
 * encore rien lu. Le défilement doux qui l'y amène dure plus que la garde
 * ci-dessus : il était pris pour un geste, et l'on enregistrait la ligne du
 * haut de l'écran, une demi-page avant le verset centré. Rouvrir sans lire
 * faisait reculer la reprise à chaque fois, et un lien partagé écrasait la
 * position du lecteur. Rien ne s'enregistre plus avant un vrai geste.
 */
let awaitingReaderGesture = false;
const READER_GESTURES = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
function onReaderGesture() {
  awaitingReaderGesture = false;
}

function scrollTopProgrammatic() {
  markProgrammaticScroll();
  window.scrollTo({ top: 0 });
}

function clearScrollSaveTimer() {
  if (scrollSaveTimer !== null) {
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = null;
  }
}

function savePositionNow(line: number, sectionIndex = positionSection.value) {
  // Liturgie : pas de position retenue (ni bannière de reprise ici, ni
  // « Reprendre ma lecture » sur l'accueil de la bibliothèque).
  if (!textEntry.value || isLiturgy(textEntry.value)) return;
  sessionSaved = true;
  readingProgressService.savePosition({
    textId: textId.value,
    section: sectionIndex,
    line,
    path: canonicalReadingPath.value,
    label: positionLabel.value,
  });
}

/**
 * Le premier verset encore visible sous l'en-tête : c'est là qu'on reprendra,
 * que ce soit par la reprise de lecture ou par la table d'étude.
 */
function firstVisibleVerse(root: ParentNode = document): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>("[data-line]")) {
    if (el.getBoundingClientRect().bottom >= 96) return el;
  }
  return null;
}

function capturePosition() {
  if (!currentSection.value || showSectionList.value) return;
  if (!document.querySelector("[data-line]")) {
    // Talmud : pas d'éléments par verset, on retient le chapitre.
    savePositionNow(0);
    return;
  }
  savePositionNow(Number(firstVisibleVerse()?.dataset.line ?? 0));
}

// La position de lecture suit l'image partagée du défilement (useScrollFrame) :
// pas d'écouteur de plus sur la fenêtre.
const scrollFrame = useScrollFrame();
watch(
  () => scrollFrame.value.scrollY,
  () => onScroll(),
);

function onScroll() {
  // Un scroll est un signe de présence : il sert au renouvellement du tirage
  // (voir renewDrawIfNeeded), même quand la capture de position s'abstient.
  noteReadingActivity();
  if (Date.now() - programmaticScrollAt < 300 || awaitingReaderGesture) return;
  if (scrollSaveTimer !== null || !currentSection.value || showSectionList.value) return;
  scrollSaveTimer = window.setTimeout(() => {
    scrollSaveTimer = null;
    capturePosition();
    // Un texte posé sur la table suit la lecture : rouvert, il revient là
    // même si l'app a été fermée entre-temps.
    if (isOnTable(textId.value)) refreshOnTable(tableSnapshot(true));
  }, 600);
}

// Choisir un chapitre est aussi un geste de lecture : on retient le chapitre
// ouvert (ligne 0), le scroll affine ensuite. `userNavigated` évite de compter
// l'ouverture initiale de la page. Exception : une position profonde dans un
// AUTRE chapitre n'est pas écrasée à la simple ouverture, jeter « chapitre 3,
// verset 120 » parce qu'on a jeté un œil au chapitre 5 serait irréversible ;
// le premier scroll dans le nouveau chapitre prendra le relais.
let userNavigated = false;
watch(currentSection, (section) => {
  if (!userNavigated || !section || showSectionList.value) return;
  const saved = readingProgressService.getPosition(textId.value);
  const deepElsewhere = saved !== null && saved.line > 2 && saved.section !== positionSection.value;
  if (!deepElsewhere) savePositionNow(0);
});

// --- La table d'étude (voir useReadingTable) ---
// On met le texte de côté pour en consulter un autre ; il garde l'endroit
// exact où on l'a laissé : le verset en haut de l'écran, à sa hauteur.
const { texts: tableTexts } = useReadingTable();

/**
 * Pas dans une chaîne de lecture : on y lit sa part, on ne l'emporte pas. Ni
 * sur un texte du Sidour (une tefila, une brakha, un texte de fête) : on y
 * vient prier, d'un bout à l'autre, pas étudier en passant d'un livre à
 * l'autre ; le Sidour a sa page à lui.
 */
const canSetAside = computed(
  () => !!textEntry.value && !!content.value && sessionSlug.value === null && !isLiturgyText.value,
);

/** Le haut du texte dans le document : la table y compte son défilement. */
function readingTop(): number {
  return (readingRoot.value?.getBoundingClientRect().top ?? 0) + window.scrollY;
}

/**
 * Ce que la table retient du texte à l'écran. `refresh` : la mise à jour
 * d'un texte déjà posé, qui ne se fait que pendant la lecture. Remonté à la
 * liste des chapitres, on a refermé le livre sans perdre sa page : la table
 * garde le chapitre où l'on lisait.
 */
function tableSnapshot(refresh = false): TableText | null {
  const entry = textEntry.value;
  if (!entry || !content.value || !canSetAside.value) return null;
  if (refresh && showSectionList.value) return null;
  if (contentTextId !== textId.value) return null;
  let line: number | null = null;
  let offset = 0;
  // La page où l'on en est, telle que la table la montre : sa première ligne.
  let excerpt = "";
  let daf = "";
  const root = readingRoot.value;
  if (currentSection.value && !showSectionList.value) {
    // Le premier verset encore visible sous l'en-tête, comme la reprise.
    const verse = root ? firstVisibleVerse(root) : null;
    if (verse) {
      line = Number(verse.dataset.line ?? 0);
      offset = verse.getBoundingClientRect().top;
      excerpt = (verse.querySelector(".reading-he, .reading-tl") ?? verse).textContent ?? "";
    }
    // Une Guemara n'a pas de versets repérés : le daf lu est le dernier dont
    // le titre est passé sous l'en-tête, et sa page commence à son titre.
    if (line === null && content.value.type === "Talmud Bavli") {
      let current: HTMLElement | null = null;
      for (const label of root?.querySelectorAll<HTMLElement>("[data-block-anchor]") ?? []) {
        if (label.getBoundingClientRect().top <= 140 || !current) current = label;
        else break;
      }
      daf = current?.textContent?.trim() ?? "";
      excerpt = current?.nextElementSibling?.textContent ?? "";
    }
  }
  const section =
    currentSection.value && !isSingleSection.value && !showSectionList.value
      ? currentSection.value
      : null;
  // Où l'on reprendra : « Chapitre 4 · verset 12 », « Daf 2b ».
  const place = daf
    ? daf
    : line !== null
      ? placeLabel(positionSection.value, line)
      : section
        ? sectionLabel(section)
        : "";
  // Le livre, en latin (« Berechit », « Zeraim ») : la table le dit au-dessus
  // du nom, comme la tête de la page de lecture.
  const livre = String(entry.livre ?? "");
  return {
    key: textId.value,
    path: canonicalReadingPath.value,
    // Le nom latin, court dans la barre (« Berakhot », et non « ברכות
    // (Berakhot) », que le sens de lecture retourne ; « Tehilim 119 », sans
    // son numéro en lettres) ; une Michna le dit, pour ne pas se confondre
    // avec le traité du Talmud de même nom.
    title: entry.type === "Mishna" ? `Michna ${latinName(entry)}` : latinName(entry),
    place,
    book: (livre.match(/\(([^)]+)\)\s*$/)?.[1] ?? livre).trim(),
    excerpt: excerpt.replace(/\s+/g, " ").trim().slice(0, 160),
    corpus: isEtudeRoute.value ? String(route.params.corpus) : (corpusOf(entry) ?? ""),
    line,
    offset,
    // Compté depuis le haut du texte, et non de la page : ce qui le précède
    // (une page qui s'en va, un bandeau) ne le décale pas.
    scrollY: window.scrollY - readingTop(),
    at: Date.now(),
  };
}

/**
 * Mettre de côté : le texte rejoint la table (ou y retient sa page), la page
 * se réduit jusqu'à la barre du bas, et l'on retrouve la bibliothèque pour
 * en chercher un autre.
 */
function setTextAside(from: "header" | "menu") {
  const alreadyOnTable = isOnTable(textId.value);
  // Depuis la liste des chapitres, un texte déjà posé garde le chapitre où
  // l'on lisait : on le range sans rien en changer.
  const text =
    alreadyOnTable && showSectionList.value
      ? (tableTexts.value.find((t) => t.key === textId.value) ?? null)
      : tableSnapshot();
  if (!text) return;
  const rect = readingRoot.value?.getBoundingClientRect();
  const top = rect ? Math.max(rect.top, 0) : 0;
  const bottom = rect ? Math.min(rect.bottom, window.innerHeight) : 0;
  setAside(
    text,
    rect && bottom > top ? { top, left: rect.left, width: rect.width, height: bottom - top } : null,
  );
  analyticsService.capture("text_set_aside", {
    text_id: text.key,
    corpus: text.corpus,
    texts_count: tableTexts.value.length,
    from,
    already_on_table: alreadyOnTable,
  });
  void router.push("/bibliotheque");
}

// Le texte à l'écran se fait connaître de la table : elle le marque
// « Ouvert », et peut l'y poser depuis son panneau. Pas en chaîne de lecture.
let unregisterTableReader: (() => void) | null = null;
onMounted(() => {
  if (sessionSlug.value !== null) return;
  unregisterTableReader = registerTableReader({
    get key() {
      return textId.value;
    },
    snapshot: tableSnapshot,
  });
});
/** La page est démontée : une reprise encore en attente n'a plus d'objet. */
let readerGone = false;
onBeforeUnmount(() => {
  readerGone = true;
  unregisterTableReader?.();
});

// En quittant un texte posé sur la table (un autre texte, un autre chapitre,
// la bibliothèque), il retient sa page : la page à l'écran est encore la sienne.
// Les boutons de la page (chapitre suivant, « Retour », texte voisin) la
// remettent en haut avant que la navigation ne parte : ils la font retenir
// d'abord, et la garde de route, qui ne verrait plus que le haut de page,
// s'abstient alors.
function rememberOnTable() {
  if (Date.now() - programmaticScrollAt < 300) return;
  if (isOnTable(textId.value)) refreshOnTable(tableSnapshot(true));
}
onBeforeRouteLeave(rememberOnTable);
onBeforeRouteUpdate(rememberOnTable);

// Rouvert depuis la table : une fois le chapitre rendu, le verset retrouvé
// revient à la hauteur où on l'avait laissé ; sans verset repéré (Guemara),
// le défilement de la page. Le routeur n'a pas remis la page en haut
// (hasTableRestore). Comme une reprise, ce n'est pas encore une lecture.
watch(
  [content, currentSection, () => route.path],
  async ([loaded]) => {
    if (!loaded || contentTextId !== textId.value) return;
    const text = takeTableRestore(route.path);
    if (!text) return;
    resumeDismissed.value = true;
    awaitingReaderGesture = true;
    await nextTick();
    await waitUntilPositionReachable(readingTop() + text.scrollY);
    // L'attente peut durer : le lecteur a pu défiler, changer de texte ou
    // quitter la page entre-temps. La table ne reprend alors pas la main.
    const stillHere = () =>
      !readerGone &&
      awaitingReaderGesture &&
      route.path === text.path &&
      contentTextId === textId.value;
    if (!stillHere()) return;
    const place = () => {
      const verse =
        text.line !== null
          ? readingRoot.value?.querySelector<HTMLElement>(`[data-line="${text.line}"]`)
          : null;
      const top = verse
        ? verse.getBoundingClientRect().top + window.scrollY - text.offset
        : readingTop() + text.scrollY;
      markProgrammaticScroll();
      window.scrollTo({ top: Math.max(0, top) });
    };
    place();
    // App native : la page qu'on quitte reste dans le document le temps de
    // sa transition, au-dessus du texte (App.vue) ; à son départ, le texte
    // remontait de toute sa hauteur. Il se repose tant que le texte bouge
    // encore dans la page, et que le lecteur n'y a pas touché.
    let lastTop = readingTop();
    for (let i = 0; i < 12 && stillHere(); i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const top = readingTop();
      if (top !== lastTop && stillHere()) place();
      lastTop = top;
    }
  },
  { flush: "post" },
);

// --- Marque-pages (voir useVerseBookmarks) ---
function isLineBookmarked(line: number): boolean {
  return isBookmarked(positionSection.value, line);
}

/** Les versets marqués de la section lue (la guemara, le tikoun). */
const bookmarkedLines = computed(() =>
  isLiturgyText.value
    ? []
    : bookmarks.value
        .filter((b) => (b.section ?? 0) === (positionSection.value ?? 0))
        .map((b) => b.line),
);

function toggleBookmarkAt(line: number) {
  if (!textEntry.value) return;
  toggleBookmark(positionSection.value, line);
}

// --- Le passage choisi (voir useReadingSelection) ---
//
// Un appui sur un verset ou sur un paragraphe d'office le choisit, et la bulle
// de commandes vient se poser dessus : partager ce passage, en lire la
// phonétique, signaler une erreur, et le marque-page là où le texte en prend.
// C'est la page qui sait nommer un passage et lui donner une adresse ; le
// rendu, lui, ne connaît que sa ligne.

// L'appui long sur un passage vaut l'appui bref : couper la sélection du
// système a coupé le geste qui l'ouvrait, il est rendu à la bulle.
usePassageLongPress();

/** Le passage choisi dans le texte ouvert, par sa ligne : le fil le surligne. */
const pickedLine = ref<number | null>(null);

// --- Le panneau d'étude (commentaires d'un passage) ---
// Ouvert depuis la bulle d'un passage, il suit ensuite la lecture : tant
// qu'il est ouvert, toucher un autre passage y montre ses commentaires, sans
// rouvrir de bulle (voir CommentaryPanel.vue et docs/design.md).
/** La ligne dont le panneau montre les commentaires ; null : fermé. */
const studyLine = ref<number | null>(null);
let studyViewed = 0;
/** Le passage surligné : celui qu'on étudie, sinon celui de la bulle. */
const selectedLine = computed(() => studyLine.value ?? pickedLine.value);
const studyGroups = computed(() =>
  studyLine.value === null ? [] : commentaries.groupsAt(studyLine.value),
);
/** Les dibbourim du passage étudié, pour en souligner les mots dans le texte. */
const studyLeads = computed(() =>
  studyLine.value === null
    ? null
    : {
        line: studyLine.value,
        leads: studyGroups.value.flatMap((g) => g.comments.map((c) => c.lead).filter(Boolean)),
      },
);

function commentarySummary(line: number): CommentarySummary {
  const state = commentaries.state.value;
  if (state === "error") return { state: "none" };
  if (state !== "ready") return { state: "loading" };
  const counts = commentaries
    .groupsAt(line)
    .map((g) => ({ source: g.source, count: g.comments.length }));
  return counts.length ? { state: "ready", counts } : { state: "none" };
}

/**
 * Le passage étudié reste sous les yeux à l'ouverture du panneau. Sur un
 * téléphone, le volet monte à mi-hauteur : un passage de la moitié basse
 * passerait dessous. Sur un écran large, la colonne de texte se rétrécit pour
 * faire place aux commentaires, et le passage, qui s'allonge, peut glisser
 * sous le bas de l'écran. Dans les deux cas, on le remonte sous le bandeau.
 */
function keepPassageInView(line: number): void {
  const el = document.querySelector<HTMLElement>(`[data-line="${line}"]`);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  // Le haut du volet, là où il est vraiment (dans l'app, il se pose sur la
  // barre d'onglets) ; à défaut, la mi-hauteur.
  const sheetTop =
    document.querySelector(".commentary-panel")?.getBoundingClientRect().top ??
    window.innerHeight * 0.45;
  const visibleBottom = sideBySide.value ? window.innerHeight * 0.9 : sheetTop - 16;
  if (rect.top >= 0 && rect.bottom <= visibleBottom) return;
  markProgrammaticScroll();
  window.scrollBy({ top: rect.top - window.innerHeight * 0.15, behavior: "smooth" });
}

function openStudy(line: number): void {
  studyLine.value = line;
  studyViewed = 1;
  clearPassage();
  // Après la mise en page : la colonne de texte vient peut-être de se rétrécir.
  void nextTick(() => requestAnimationFrame(() => keepPassageInView(line)));
  // Les commentaires : trouvés, et sur quel corpus.
  analyticsService.capture("commentaries_opened", {
    corpus: commentaries.corpus.value,
    text_id: textEntry.value?.id ?? null,
    count: commentaries.groupsAt(line).reduce((n, g) => n + g.comments.length, 0),
  });
}

function closeStudy(): void {
  if (studyLine.value === null) return;
  // Le panneau qui suit la lecture : sert-il à un passage, ou à un daf entier ?
  analyticsService.capture("commentaries_closed", { passages_viewed: studyViewed });
  studyLine.value = null;
}
watch([textId, sectionParam], closeStudy);
onBeforeUnmount(closeStudy);
// Relâché d'ailleurs (un appui hors du texte, Échap, le bouton retour) : le
// surlignage suit.
watch(selectedPassageKey, (key) => {
  if (key === null) pickedLine.value = null;
});
// On ne garde pas un passage d'un texte en ouvrant le suivant.
watch([textId, sectionParam], clearPassage);
onBeforeUnmount(clearPassage);

/** L'adresse publique qui ramène à ce passage, et à lui seul. */
function passageUrl(line: number): string {
  // Dans un texte à jours, le passage n'existe que sous son jour : l'adresse
  // le nomme, pour que celui qui la reçoit ne tombe pas sur un autre.
  const jour = shownDay.value ? `&jour=${encodeURIComponent(shownDay.value.when)}` : "";
  return `${APP_SITE_URL}${canonicalReadingPath.value}?verset=${line}${jour}`;
}

/**
 * Où se trouve un passage, en clair. Un livre se repère par son verset
 * (« Michna Berakhot · Chapitre 2 · verset 14 ») ; un office par le nom de son
 * passage, un numéro de verset ne voulant rien dire devant une brakha.
 */
function passagePlace(line: number, label?: string): string {
  const name = textEntry.value ? appendHebrewNumeral(textEntry.value.name) : "";
  const where = isLiturgyText.value ? (label ?? "") : placeLabel(positionSection.value, line);
  return [name, where].filter(Boolean).join(" · ");
}

function pickPassage(passage: { el: HTMLElement; line: number; hebrew: string; label?: string }) {
  // Le panneau d'étude ouvert suit la lecture : le passage touché y passe.
  if (studyLine.value !== null) {
    if (studyLine.value !== passage.line) studyViewed++;
    studyLine.value = passage.line;
    return;
  }
  const key = `${textId.value}#${positionSection.value ?? 0}#${passage.line}`;
  const withCommentary = commentaries.corpus.value !== null;
  if (withCommentary) void commentaries.ensure();
  selectPassage({
    key,
    el: passage.el,
    hebrew: passage.hebrew,
    place: passagePlace(passage.line, passage.label),
    url: passageUrl(passage.line),
    // Une tefila ne prend pas de marque-page : elle se lit du début.
    bookmarked: isLiturgyText.value ? null : isLineBookmarked(passage.line),
    toggleBookmark: () => toggleBookmarkAt(passage.line),
    commentary: withCommentary
      ? { summary: () => commentarySummary(passage.line), open: () => openStudy(passage.line) }
      : undefined,
  });
  // Un second appui sur le même passage le relâche (voir selectPassage).
  pickedLine.value = selectedPassageKey.value === key ? passage.line : null;
}

/** Un verset : son texte hébreu est la ligne elle-même. */
function pickVerse(event: MouseEvent, line: number, hebrew: string) {
  // Clic droit : le menu du navigateur propose de copier, c'est la bulle qui
  // répond à sa place.
  if (event.type === "contextmenu") event.preventDefault();
  pickPassage({ el: event.currentTarget as HTMLElement, line, hebrew });
}

function bookmarkPlace(b: Bookmark): string {
  return placeLabel(b.section, b.line);
}

function goToBookmark(b: Bookmark) {
  if (!textEntry.value) return;
  showBookmarksPanel.value = false;
  analyticsService.capture("reading_resumed", { text_id: textEntry.value.id, source: "bookmark" });
  goToPlace(b.section, b.line);
}

function refreshProgressState() {
  savedPosition.value = readingProgressService.getPosition(textId.value);
  refreshBookmarks();
  resumeDismissed.value = false;
  clearPassage();
  showBookmarksPanel.value = false;
}

// --- Reservation (session mode) ---
const session = ref<Session | null>(null);
/** Chaîne perpétuelle : les noms pour lesquels on lit (voir PrayerNamesLine). */
const prayerNames = ref<PrayerName[]>([]);
const currentUser = ref<User | null>(null);
const reservationForm = ref({ name: "", email: "" });

// Absent sur les sessions créées avant l'introduction du réglage : l'email
// des invités y est optionnel.
const guestEmailRequired = computed(() => session.value?.guestEmailRequired === true);

const guestIntroText = computed(() =>
  guestEmailRequired.value ? t("textReading.guestIntro") : t("textReading.guestIntroNameOnly"),
);
const isReserving = ref(false);

/**
 * La réservation du tirage est en route, le texte est déjà à l'écran. On
 * masque l'encadré le temps qu'elle atterrisse : montrer « Réserver » pendant
 * une demi-seconde, puis basculer sur « Vous avez réservé ce passage »,
 * donnerait à croire qu'il faut agir alors que tout est déjà en cours.
 */
const isClaimingDraw = ref(false);

const isSessionMode = computed(() => sessionSlug.value !== null && session.value !== null);

// Reservation unit: the current chapter, or 1 for a single-section text.
const reservationUnit = computed(() => (isSingleSection.value ? 1 : sectionParam.value));

const showReservationBar = computed(
  () => isSessionMode.value && reservationUnit.value !== undefined && !isClaimingDraw.value,
);

function findReservation(unit: number | undefined): TextStudyReservation | null {
  if (!session.value || unit === undefined) return null;
  return (
    session.value.reservations.find(
      (r) =>
        r.textStudyId === textId.value &&
        r.section === unit &&
        // Un tirage expiré sans lecture ne tient plus l'emplacement.
        !sessionService.isReservationExpired(r),
    ) ?? null
  );
}

const currentReservation = computed(() => findReservation(reservationUnit.value));

const reservedStatus = computed(() => {
  if (!session.value || reservationUnit.value === undefined) return { isReserved: false } as const;
  return sessionService.isTextOrSectionReserved(textId.value, reservationUnit.value, session.value);
});

/** Le nom du réservataire, quand la section est prise par quelqu'un d'autre. */
const reservedByName = computed(() =>
  "reservedBy" in reservedStatus.value ? (reservedStatus.value.reservedBy ?? null) : null,
);

const isMine = computed(() => {
  const r = currentReservation.value;
  return (
    !!r &&
    sessionService.canUserDeleteReservation(r, currentUser.value, reservationForm.value.email)
  );
});

// Entrée du funnel de réservation : le lecteur atteint une section libre et la
// barre de réservation s'affiche. C'était le pas manquant entre session_viewed
// et reservation_confirm_clicked, le trou de conversion à mesurer est là,
// entre voir le formulaire et cliquer sur « Confirmer ».
const canReserveNow = computed(() => showReservationBar.value && !reservedStatus.value.isReserved);

// Une seule fois par unité réservable : la navigation latérale entre textes
// (goToText) ne recrée pas le composant, et le formulaire invité fait changer
// les computeds à chaque frappe.
let lastReservationStartKey: string | null = null;

watch([canReserveNow, reservationUnit], ([canReserve, unit]) => {
  if (!canReserve || !session.value) return;
  const key = `${session.value.id}#${textId.value}#${unit}`;
  if (lastReservationStartKey === key) return;
  lastReservationStartKey = key;
  analyticsService.capture("reservation_started", {
    session_id: session.value.id,
    text_type: session.value.type,
    sections_count: 1,
    is_guest: currentUser.value == null,
    source: "reading_page",
  });
});

// Même signal que sur la page de chaîne : la première frappe dans le
// formulaire invité, une seule fois par visite (voir trackGuestFormFilled dans
// DetailSession.vue).
let hasTrackedGuestForm = false;

function trackGuestFormFilled(field: "name" | "email") {
  if (hasTrackedGuestForm || !session.value) return;
  hasTrackedGuestForm = true;
  analyticsService.capture("guest_form_filled", {
    session_id: session.value.id,
    field,
    // Toujours vrai ici : le formulaire ne s'affiche que sur une section libre
    // déjà ouverte, il n'y a rien à cocher au préalable.
    has_selection: true,
    source: "reading_page",
  });
}

async function reserve() {
  if (!session.value || reservationUnit.value === undefined) return;
  analyticsService.capture("reservation_confirm_clicked", {
    session_id: session.value.id,
    sections_count: 1,
    is_guest: currentUser.value == null,
    source: "reading_page",
  });
  if (
    !currentUser.value &&
    (!reservationForm.value.name || (guestEmailRequired.value && !reservationForm.value.email))
  ) {
    analyticsService.capture("reservation_failed", {
      session_id: session.value.id,
      reason: !reservationForm.value.name ? "missing_name" : "missing_email",
      source: "reading_page",
    });
    toast.info(guestIntroText.value);
    return;
  }
  isReserving.value = true;
  try {
    const id = await sessionService.createReservationForUser(
      session.value.id,
      textId.value,
      reservationUnit.value,
      currentUser.value,
      reservationForm.value,
      guestEmailRequired.value,
    );
    const local = sessionService.createLocalReservation(
      id,
      textId.value,
      reservationUnit.value,
      currentUser.value,
      reservationForm.value,
    );
    session.value.reservations = [...session.value.reservations, local];
    analyticsService.capture("reservation_completed", {
      session_id: session.value.id,
      text_type: session.value.type,
      sections_count: 1,
      is_guest: currentUser.value == null,
      guest_has_email: currentUser.value == null && reservationForm.value.email.trim() !== "",
      source: "reading_page",
    });
    toast.success(t("textReading.reserveSuccess"));
  } catch (e) {
    analyticsService.capture("reservation_failed", {
      session_id: session.value.id,
      reason: e instanceof SlotTakenError ? "conflict" : "error",
      error_message: e instanceof Error ? e.message : String(e),
      source: "reading_page",
    });
    // Le message affiché vient du code de l'erreur (errors.*), jamais du
    // message brut du service.
    toast.errorFromException(e, t("textReading.reserveError"));
  } finally {
    isReserving.value = false;
  }
}

async function cancelReservation() {
  const r = currentReservation.value;
  if (!session.value || !r || !isMine.value) return;
  if (!(await confirm({ title: t("textReading.cancelConfirm"), danger: true }))) return;
  isReserving.value = true;
  try {
    await sessionService.deleteReservation(session.value.id, r.id);
    session.value.reservations = session.value.reservations.filter((x) => x.id !== r.id);
    analyticsService.capture("reservation_cancelled", {
      session_id: session.value.id,
      is_guest: currentUser.value == null,
      source: "reading_page",
    });
    // En mode tirage, annuler signifie renoncer à ce texte : on ramène le
    // lecteur à la chaîne, où il peut en retirer un autre.
    if (isRandomDraw.value) exitReading();
  } catch (e) {
    // Contrepartie manquante de `reservation_cancelled` : une annulation qui
    // échoue laisse la section affichée comme réservée, et le lecteur croit
    // l'avoir rendue.
    analyticsService.capture("reservation_cancel_failed", {
      session_id: session.value.id,
      is_guest: currentUser.value == null,
      error_message: e instanceof Error ? e.message : String(e),
      source: "reading_page",
    });
    toast.errorFromException(e, t("textReading.cancelError"));
  } finally {
    isReserving.value = false;
  }
}

async function toggleRead() {
  const r = currentReservation.value;
  if (!session.value || !r) return;
  const next = !r.isCompleted;
  isReserving.value = true;
  try {
    await sessionService.markReservationAsCompleted(session.value.id, r.id, next);
    haptic(next ? "done" : "undo");
    r.isCompleted = next;
    // La transaction a effacé l'échéance du tirage : l'état local doit suivre,
    // sinon « remettre en non lu » ferait réapparaître une réservation périmée
    // ici alors qu'elle est devenue définitive en base.
    if (next) delete r.expiresAt;
    session.value.reservations = [...session.value.reservations];
    analyticsService.capture("section_marked_read", {
      session_id: session.value.id,
      marked: next,
      is_guest: currentUser.value == null,
      source: "reading_page",
    });
  } catch (e) {
    analyticsService.capture("section_mark_read_failed", {
      session_id: session.value.id,
      marked: next,
      is_guest: currentUser.value == null,
      error_message: e instanceof Error ? e.message : String(e),
      source: "reading_page",
    });
    // Le tirage avait expiré et quelqu'un a repris l'emplacement : ce n'est
    // pas une panne, c'est une place perdue, et ça se dit autrement.
    if (e instanceof ReservationGoneError) {
      forgetLostReservation(r.id);
    } else {
      toast.errorFromException(e, t("textReading.updateError"));
    }
  } finally {
    isReserving.value = false;
  }
}

// --- Tirage aléatoire ---
// Arrivée via le bouton « Tirer un Téhilim » (?tirage=1) : la page porte tout
// le flux. Le texte est déjà à l'écran, sa réservation se pose ici ; s'il ne
// convient pas, on en repioche un autre, et si le lecteur repart sans avoir
// marqué sa lecture, la réservation est libérée pour ne pas bloquer un texte
// que personne ne lira.

const isRandomDraw = computed(() => isSessionMode.value && route.query.tirage !== undefined);
const isDrawingAnother = ref(false);

/**
 * La réservation posée à l'arrivée, tant qu'elle est en vol. La page de la
 * chaîne navigue sans attendre la transaction Firestore : le texte s'affiche
 * pendant que la réservation part. Tout ce qui décide du sort de cette
 * réservation (repartir, repiocher) doit donc l'attendre d'abord, sinon il
 * statuerait sur une réservation qui n'existe pas encore.
 */
let pendingClaim: Promise<void> | null = null;

/**
 * Les réservations posées par un tirage depuis cette page. Seules elles se
 * libèrent quand on repart sans lire : sur la chaîne perpétuelle, une place
 * réservée à la main porte aussi une échéance (24 heures, posée par la Cloud
 * Function), et la seule échéance ne distingue plus un tirage d'un choix.
 */
const drawnReservationIds = new Set<string>();

/**
 * Un tirage de ce lecteur, à rendre s'il repart sans lire. Hors chaîne
 * perpétuelle, seule une réservation tirée porte une échéance : c'est ce qui
 * laisse libérer aussi un tirage d'une visite précédente, rouvert ici.
 *
 * L'échéance est exigée dans tous les cas : marquée lue, la réservation
 * devient définitive et la perd (voir toggleRead). Remise en non lu, elle
 * reste au lecteur, même tirée d'ici ; il ne la rend pas en repartant.
 */
function isOwnUnreadDraw(s: Session, r: TextStudyReservation): boolean {
  if (r.isCompleted || sessionService.isReservationExpired(r)) return false;
  if (r.expiresAt === undefined) return false;
  if (!sessionService.canUserDeleteReservation(r, currentUser.value, reservationForm.value.email)) {
    return false;
  }
  return drawnReservationIds.has(r.id) || !isPerpetual(s);
}

/**
 * Le lecteur est-il toujours devant le texte d'où l'action est partie ? Une
 * réservation part sans retenir la navigation : quand elle revient, la page a
 * pu être quittée, et remplacer la route ramènerait le lecteur de force.
 */
function stillReading(startedOnTextId: string): boolean {
  return isRandomDraw.value && textId.value === startedOnTextId;
}

/**
 * Pose la réservation du texte tiré, à l'arrivée sur la page. Le texte a déjà
 * été annoncé au lecteur : il passe en tête, et on ne le déplace que si
 * quelqu'un l'a pris entre-temps.
 */
async function claimDrawnText() {
  const s = session.value;
  if (!s || reservationUnit.value === undefined) return;
  // Déjà à moi (retour sur une lecture en cours, lien rouvert) : rien à poser.
  if (isMine.value) return;

  const from = textId.value;

  const textStudies = sessionService.getSessionTextStudies(s);
  // Le texte annoncé passe en tête, sauf s'il a été pris pendant le trajet :
  // inutile de dépenser une transaction pour se le faire refuser, on en
  // retient un autre et on y bascule.
  const announced = reservedStatus.value.isReserved
    ? null
    : (textStudies.find((text) => text.id === textId.value) ?? null);

  isClaimingDraw.value = true;
  try {
    const result = await sessionService.reserveRandomAvailableText(
      s,
      textStudies,
      currentUser.value,
      reservationForm.value,
      t("detailSession.randomDraw.anonymous"),
      announced,
    );
    if (!result) {
      toast.info(t("detailSession.randomDraw.noneAvailable"));
      return;
    }

    drawnReservationIds.add(result.reservation.id);
    s.reservations = [...s.reservations, result.reservation];
    analyticsService.capture("reservation_completed", {
      session_id: s.id,
      text_type: s.type,
      sections_count: 1,
      is_guest: currentUser.value == null,
      guest_has_email: currentUser.value == null && reservationForm.value.email.trim() !== "",
      source: "random_button",
    });

    // Le texte annoncé a été pris pendant le trajet : on bascule sur celui qui
    // a effectivement été retenu, sauf si le lecteur est déjà reparti.
    if (result.text.id !== from && stillReading(from)) {
      router.replace({
        name: "text-reading",
        params: { textId: result.text.id },
        query: route.query,
      });
      scrollTopProgrammatic();
    }
  } catch (e) {
    analyticsService.capture("reservation_failed", {
      session_id: s.id,
      reason: "error",
      error_message: e instanceof Error ? e.message : String(e),
      source: "random_button",
    });
    toast.errorFromException(e, t("textReading.reserveError"));
  } finally {
    isClaimingDraw.value = false;
  }
}

/** Vérification du délai restant, assez espacée pour ne rien coûter. */
const RENEW_CHECK_MS = 5 * 60 * 1000;
/** En dessous de ce reste, on repousse l'échéance. */
const RENEW_WHEN_REMAINING_MS = 20 * 60 * 1000;
/**
 * Au-delà de ce silence (aucun scroll, aucune touche, onglet jamais revenu au
 * premier plan), la page est réputée abandonnée : plus de renouvellement, et
 * le texte redevient prenable à l'échéance. C'est ce qui distingue « je lis
 * depuis deux heures » de « j'ai laissé l'onglet ouvert avant de partir ».
 */
const PRESENCE_WINDOW_MS = 30 * 60 * 1000;

let lastActivityAt = Date.now();
let renewTimer: ReturnType<typeof setInterval> | null = null;

function noteReadingActivity() {
  lastActivityAt = Date.now();
}

function onVisibilityChange() {
  if (document.visibilityState === "visible") noteReadingActivity();
}

/**
 * L'emplacement a été repris par quelqu'un d'autre : on retire la réservation
 * de l'état local (la barre repasse à « Réserver ») et on le dit au lecteur
 * plutôt que d'afficher une erreur technique.
 */
function forgetLostReservation(reservationId: string) {
  const s = session.value;
  if (!s) return;
  s.reservations = s.reservations.filter((x) => x.id !== reservationId);
  toast.info(t("textReading.drawLost"));
}

/**
 * Repousse l'échéance du tirage tant que le lecteur est là. Sans ce filet, une
 * lecture qui dure plus d'une heure verrait son texte repris sous ses yeux ;
 * avec lui, seule une page vraiment abandonnée laisse l'échéance tomber.
 */
async function renewDrawIfNeeded() {
  const s = session.value;
  const r = currentReservation.value;
  if (!s || !r || r.expiresAt === undefined || r.isCompleted || !isMine.value) return;
  if (Date.now() - lastActivityAt > PRESENCE_WINDOW_MS) return;
  if (new Date(r.expiresAt).getTime() - Date.now() > RENEW_WHEN_REMAINING_MS) return;

  try {
    const expiresAt = await sessionService.renewRandomReservation(s.id, r.id);
    r.expiresAt = expiresAt;
    s.reservations = [...s.reservations];
  } catch (e) {
    if (e instanceof ReservationGoneError) {
      forgetLostReservation(r.id);
      return;
    }
    // Réseau coupé, écriture refusée : sans bruit. Au pire l'échéance tombe et
    // le texte est rendu, ce qui est exactement ce qu'elle sert à faire.
    console.error("Renouvellement du tirage impossible :", e);
  }
}

/** Coupe l'attente du tour suivant quand le lecteur quitte la page. */
const nextRoundWait = new AbortController();

onMounted(() => {
  window.addEventListener("pointerdown", noteReadingActivity, { passive: true });
  window.addEventListener("keydown", noteReadingActivity, { passive: true });
  for (const gesture of READER_GESTURES) {
    window.addEventListener(gesture, onReaderGesture, { passive: true });
  }
  document.addEventListener("visibilitychange", onVisibilityChange);
  renewTimer = setInterval(() => void renewDrawIfNeeded(), RENEW_CHECK_MS);
});

onBeforeUnmount(() => {
  nextRoundWait.abort();
  window.removeEventListener("pointerdown", noteReadingActivity);
  window.removeEventListener("keydown", noteReadingActivity);
  for (const gesture of READER_GESTURES) window.removeEventListener(gesture, onReaderGesture);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  if (renewTimer !== null) {
    clearInterval(renewTimer);
    renewTimer = null;
  }
});

/**
 * Chaîne perpétuelle : la copie locale de la chaîne date du montage. Quand
 * elle n'a plus de place libre, la chaîne a pu repartir entre-temps, et c'est
 * le cas quand le lecteur vient de lire le dernier Téhilim du tour. On la
 * relit donc ; si le tour y est entièrement lu, la Cloud Function ne l'a pas
 * encore remise à zéro (démarrage à froid) : on le dit, et on attend le tour
 * suivant par quelques essais bornés (waitForNextRound). Renvoie la chaîne
 * relue, ou null si le tour suivant n'est pas venu.
 */
async function refreshPerpetualChain(s: Session): Promise<Session | null> {
  const load = () => sessionService.getSessionById(s.id);
  let latest = await load();
  if (latest && isRoundFinished(latest)) {
    toast.info(t("perpetual.roundDone"));
    latest = await waitForNextRound(latest, load, { signal: nextRoundWait.signal });
  }
  if (!latest || nextRoundWait.signal.aborted) return null;
  if (!Array.isArray(latest.reservations)) latest.reservations = [];
  return latest;
}

async function drawAnother() {
  let s = session.value;
  if (!s || isDrawingAnother.value) return;
  const from = textId.value;
  // La réservation d'arrivée peut être encore en vol : sans cette attente, on
  // libérerait un texte qui n'est pas encore réservé, et il resterait pris.
  await pendingClaim;
  analyticsService.capture("random_tehilim_clicked", {
    session_id: s.id,
    is_guest: currentUser.value == null,
    source: "reading_page",
  });
  if (isOffline()) {
    toast.error(t("detailSession.randomDraw.offline"));
    return;
  }
  isDrawingAnother.value = true;
  try {
    const reserve = (chain: Session) =>
      sessionService.reserveRandomAvailableText(
        chain,
        sessionService.getSessionTextStudies(chain),
        currentUser.value,
        reservationForm.value,
        t("detailSession.randomDraw.anonymous"),
      );
    let result = await reserve(s);
    if (!result && isPerpetual(s)) {
      const latest = await refreshPerpetualChain(s);
      // Page quittée pendant l'attente : rien à dire, ni à tirer.
      if (nextRoundWait.signal.aborted) return;
      if (latest) {
        session.value = latest;
        s = session.value;
        result = await reserve(s);
      }
    }
    if (!result) {
      toast.info(t("detailSession.randomDraw.noneAvailable"));
      return;
    }

    // Le nouveau tirage d'abord, la libération ensuite : si plus rien n'était
    // disponible, le lecteur garde au moins son texte actuel. Il entre dans
    // l'état local avant la libération : si celle-ci échoue (réseau coupé),
    // il n'en reste pas moins à lui, et suivi. Seul un tirage se libère ; une
    // place choisie à la main ne se rend pas pour en tirer une autre.
    drawnReservationIds.add(result.reservation.id);
    const previous = currentReservation.value;
    s.reservations = [...s.reservations, result.reservation];
    if (previous && isMine.value && isOwnUnreadDraw(s, previous)) {
      try {
        await sessionService.deleteReservation(s.id, previous.id);
        s.reservations = s.reservations.filter((x) => x.id !== previous.id);
        drawnReservationIds.delete(previous.id);
        analyticsService.capture("reservation_cancelled", {
          session_id: s.id,
          is_guest: currentUser.value == null,
          source: "random_redraw",
        });
      } catch (e) {
        // Le précédent expirera de lui-même dans l'heure.
        console.error("Libération du tirage précédent impossible :", e);
      }
    }

    analyticsService.capture("reservation_completed", {
      session_id: s.id,
      text_type: s.type,
      sections_count: 1,
      is_guest: currentUser.value == null,
      guest_has_email: currentUser.value == null && reservationForm.value.email.trim() !== "",
      source: "random_button",
    });

    noteReadingActivity();
    if (stillReading(from)) {
      router.replace({
        name: "text-reading",
        params: { textId: result.text.id },
        query: route.query,
      });
      scrollTopProgrammatic();
    }
  } catch (e) {
    analyticsService.capture("reservation_failed", {
      session_id: s.id,
      reason: "error",
      error_message: e instanceof Error ? e.message : String(e),
      source: "random_button",
    });
    toast.errorFromException(e, t("textReading.reserveError"));
  } finally {
    isDrawingAnother.value = false;
  }
}

/**
 * Libère le tirage resté sans lecture sur `forTextId`. Seules les réservations
 * issues du tirage (elles seules portent expiresAt) sont concernées : une
 * réservation choisie à la main n'est jamais touchée.
 */
async function releaseUnreadRandomDraw(forTextId: string = textId.value) {
  // Ces deux lectures doivent rester AVANT le moindre `await` : la fonction est
  // appelée depuis un garde de navigation, et elle reprendrait après le
  // changement de route, quand `?tirage=1` a déjà disparu de l'URL. Attendre
  // d'abord, c'est ne plus jamais rien libérer en quittant la page.
  const isDraw = isRandomDraw.value;
  const s = session.value;
  if (!isDraw || !s) return;

  // La réservation d'arrivée peut être encore en vol : on ne peut pas rendre
  // ce qui n'est pas encore posé.
  await pendingClaim;

  // Le tirage de ce texte, et lui seul : ni une place choisie à la main, ni
  // un ancien tirage expiré du même texte, que le serveur a déjà retiré
  // (libérer celui-là laisserait le nouveau pris une heure).
  const r = s.reservations.find((x) => x.textStudyId === forTextId && isOwnUnreadDraw(s, x));
  if (!r) return;
  s.reservations = s.reservations.filter((x) => x.id !== r.id);
  drawnReservationIds.delete(r.id);
  try {
    await sessionService.deleteReservation(s.id, r.id);
    analyticsService.capture("reservation_cancelled", {
      session_id: s.id,
      is_guest: currentUser.value == null,
      source: "random_leave",
    });
  } catch (e) {
    // On ne bloque jamais le départ du lecteur pour ça : au pire,
    // l'expiration libérera le texte d'elle-même au bout d'une heure.
    console.error("Erreur lors de la libération du tirage :", e);
  }
}

/** Ce que le retour à la chaîne attend, au plus, la libération du tirage. */
const RELEASE_BEFORE_CHAIN_MS = 1500;

// Quitter la page (retour à la chaîne, navigation ailleurs) sans avoir lu : le
// texte tiré est libéré pour que quelqu'un d'autre puisse le prendre.
//
// Vers la page de la chaîne, la navigation attend la libération, une seconde
// et demie au plus : la page relit la chaîne en arrivant, et la lisait entre
// la pose du tirage et son retrait. Elle montrait alors le texte comme réservé
// par le lecteur, avec son interrupteur « Lu », qui répondait « Réservation
// introuvable » (section_mark_read_failed, septembre 2026). Ailleurs, la
// libération ne retarde rien.
onBeforeRouteLeave((to) => {
  const releasing = releaseUnreadRandomDraw();
  if (to.name !== "detail-session") return;
  return Promise.race([
    releasing,
    new Promise((resolve) => setTimeout(resolve, RELEASE_BEFORE_CHAIN_MS)),
  ]).then(() => undefined);
});

// --- SEO ---
// On /bibliotheque (the public, indexable pages) use the keyword title/description and
// index the page. On /lire (the in-session reader) keep the reader title and
// noindex, pointing the canonical at the /bibliotheque equivalent.
const pageTitle = computed(() => {
  const e = textEntry.value;
  if (!e) return siteTitle(t("textReading.pageTitle"));
  if (isEtudeRoute.value) {
    return currentSection.value ? sectionTitle(e, currentSection.value) : hubTitle(e);
  }
  const sec =
    currentSection.value && !isSingleSection.value
      ? ` · ${sectionLabel(currentSection.value)}`
      : "";
  return siteTitle(`${appendHebrewNumeral(e.name)}${sec}`);
});
const pageDescription = computed(() => {
  const e = textEntry.value;
  if (!e || !isEtudeRoute.value) return undefined;
  return currentSection.value ? sectionDescription(e, currentSection.value) : hubDescription(e);
});
/**
 * Le nom sous lequel le texte se partage : celui du texte, et sa section quand
 * il en a plusieurs. Le titre de la page ne convient pas, il porte le nom du
 * site, que le message d'invitation dit déjà.
 */
const shareTitle = computed(() => {
  const e = textEntry.value;
  if (!e) return "";
  const sec =
    currentSection.value && !isSingleSection.value
      ? ` · ${sectionLabel(currentSection.value)}`
      : "";
  return `${e.name}${sec}`;
});
const canonicalPath = computed(() => {
  const e = textEntry.value;
  if (!e) return undefined;
  if (currentSection.value) return sectionPath(e, currentSection.value.index);
  return hubPath(e);
});
/** L'adresse canonique, celle de la production (référencement). */
const canonicalUrl = computed(() =>
  canonicalPath.value === undefined ? undefined : `${SITE_URL}${canonicalPath.value}`,
);
/** L'adresse qu'on partage : celle du site de l'environnement (config/environment). */
const shareReadingUrl = computed(() =>
  canonicalPath.value === undefined ? undefined : `${APP_SITE_URL}${canonicalPath.value}`,
);
// Rejoué au changement de langue : les messages en et he arrivent par import
// dynamique, parfois après le montage.
watch(
  [pageTitle, pageDescription, canonicalUrl, locale, localeMessagesReady],
  ([title, description, canonical]) =>
    seoService.setMeta({
      title,
      description,
      canonical,
      og: canonical ? { url: canonical, type: "article" } : undefined,
      robots: isEtudeRoute.value ? "index, follow" : "noindex, follow",
    }),
  { immediate: true },
);

// --- Lifecycle ---
onMounted(async () => {
  // Un lien public /lire (sans chaîne) est renvoyé vers la bibliothèque par
  // le routeur, avant que la vue n'existe (voir router/lireRedirect).
  // Position et marque-pages : lecture locale immédiate (avant tout
  // enregistrement), puis rafraîchie quand la synchro du compte aboutit,
  // sauf si le lecteur a déjà commencé à lire.
  refreshProgressState();
  void readingProgressService.ensureSynced().then(() => {
    if (!sessionSaved) savedPosition.value = readingProgressService.getPosition(textId.value);
    refreshBookmarks();
  });
  // App native : l'état des téléchargements sert au bouton de la tête de page
  // (Sli'hot), qui s'ouvre sans passer par la bibliothèque.
  if (isNativeApp) void ensureManifestLoaded();

  await loadContent();
  if (sessionSlug.value) {
    // La chaîne peut manquer (supprimée, hors ligne) sans que le texte, lui,
    // manque : le lecteur reste utilisable, seule la barre de réservation
    // n'apparaît pas. Sans ce garde-fou, le montage rejetait en silence.
    try {
      currentUser.value = await sessionService.getCurrentUser();
      session.value = await sessionService.resolveSession(sessionSlug.value);
    } catch (e) {
      console.error("Chaîne de lecture indisponible:", e);
    }
    // Chaîne perpétuelle : pour qui l'on lit. Le service ne se charge que là ;
    // sans les noms, la lecture se fait quand même.
    const chain = session.value;
    if (chain?.perpetual) {
      void import("../../services/prayerNameService")
        .then(({ prayerNameService }) =>
          prayerNameService.board(chain.id, currentUser.value?.id ?? null),
        )
        .then((board) => {
          prayerNames.value = board.listed;
        })
        .catch((e) => console.error("Noms de la chaîne indisponibles:", e));
    }
    // Arrivée par le tirage : la réservation se pose ici, maintenant que le
    // texte est à l'écran. Uniquement au montage : la navigation latérale
    // (texte suivant, précédent) ne réserve rien, et « Un autre Téhilim » pose
    // la sienne lui-même.
    if (isRandomDraw.value) pendingClaim = claimDrawnText();
  }
});

onBeforeUnmount(() => {
  if (scrollSaveTimer !== null) {
    clearScrollSaveTimer();
    // Une capture était en attente : on fige la position avant de partir.
    capturePosition();
  }
});

// Les quatre barres de navigation et les deux encadrés de réservation du
// patron partagent les mêmes propriétés : calculées une fois ici.
const sectionNavProps = computed(() => ({
  prevLabel: hasPrev.value ? t("textReading.previous") : null,
  nextLabel: hasNext.value ? t("textReading.next") : null,
  middleLabel: t("textReading.allSections"),
  onPrev: prevSection,
  onNext: nextSection,
  onMiddle: backToSectionList,
}));
const siblingNavProps = computed(() => ({
  prevLabel: prevText.value ? appendHebrewNumeral(prevText.value.name) : null,
  nextLabel: nextText.value ? appendHebrewNumeral(nextText.value.name) : null,
  onPrev: () => prevText.value && goToText(prevText.value),
  onNext: () => nextText.value && goToText(nextText.value),
}));
const reservationCardProps = computed(() => ({
  sessionSlug: sessionSlug.value ?? "",
  sessionName: session.value?.name ?? "",
  isMine: isMine.value,
  isCompleted: currentReservation.value?.isCompleted ?? false,
  isReserved: reservedStatus.value.isReserved,
  reservedBy: reservedByName.value,
  isReserving: isReserving.value,
  isGuest: !currentUser.value,
  guestIntroText: guestIntroText.value,
  guestEmailRequired: guestEmailRequired.value,
  canDrawAnother: isRandomDraw.value,
  isDrawing: isDrawingAnother.value,
  onToggleRead: toggleRead,
  onCancel: cancelReservation,
  onReserve: reserve,
  onDrawAnother: drawAnother,
  onGuestFirstInput: trackGuestFormFilled,
}));

watch(textId, (_, previousTextId) => {
  // Une capture armée par un scroll dans l'ANCIEN texte ne doit pas
  // s'exécuter sur le nouveau (elle écraserait sa position par la ligne 0).
  clearScrollSaveTimer();
  sessionSaved = false;
  userNavigated = false;
  refreshProgressState();
  void loadContent();
  // Navigation latérale (texte suivant/précédent) : même règle qu'en quittant
  // la page, le tirage laissé sans lecture est libéré. Après « Un autre
  // Téhilim », l'ancien tirage a déjà été retiré : sans objet.
  if (previousTextId) void releaseUnreadRandomDraw(previousTextId);
});
</script>

<template>
  <main
    ref="readingRoot"
    class="mx-auto px-6 py-12 max-w-3xl w-full"
    :class="{ 'study-open': studyLine !== null }"
  >
    <div class="mb-8 flex items-center justify-between gap-3">
      <button @click="exitReading" class="back-link">
        <AppIcon name="chevron-left" :size="14" />
        {{ sessionSlug ? t("textReading.backToSession") : t("textReading.back") }}
      </button>
      <!-- La table d'étude : on pose ce texte pour en ouvrir un autre. -->
      <button
        v-if="canSetAside"
        type="button"
        class="btn btn-soft !px-3 !py-1.5 text-sm"
        @click="setTextAside('header')"
      >
        <AppIcon name="books" :size="15" class="text-primary" />
        {{ t("readingTable.setAside") }}
      </button>
    </div>

    <!-- Text not in catalog -->
    <div v-if="!textEntry" class="flex flex-col items-center justify-center py-16 text-center">
      <AppIcon name="help" :size="32" class="text-text-secondary/40 mb-4" />
      <p class="text-text-secondary">{{ t("textReading.notFound") }}</p>
    </div>

    <div v-else-if="loading" class="animate-pulse">
      <div class="h-4 w-24 bg-primary/10 rounded-full mb-3"></div>
      <div class="h-9 bg-black/10 rounded-lg w-2/3 mb-8 dark:bg-white/10"></div>
      <div class="space-y-4">
        <div v-for="n in 6" :key="n" class="h-5 bg-black/10 rounded w-full dark:bg-white/10"></div>
      </div>
    </div>

    <!-- Text file unavailable -->
    <div
      v-else-if="missingFile"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <AppIcon name="book-open" :size="32" class="text-primary/60 mb-4" />
      <h2 class="text-xl font-semibold text-text-primary mb-2">
        {{ t("textReading.missingTitle") }}
      </h2>
      <p class="text-text-secondary mb-1 max-w-sm">
        {{ t("textReading.missingDescription") }}
      </p>
      <p class="text-xs text-text-secondary/60">{{ appendHebrewNumeral(textEntry.name) }}</p>
    </div>

    <div v-else-if="error" class="flex flex-col items-center justify-center py-16 text-center">
      <AppIcon name="alert-triangle" :size="32" class="text-red-500 mb-4" />
      <p class="text-text-primary font-medium mb-6">{{ t("textReading.loadError") }}</p>
      <button @click="loadContent" class="btn btn-soft">
        {{ t("textReading.retry") }}
      </button>
    </div>

    <template v-else-if="content">
      <header class="mb-8 min-w-0">
        <p class="text-sm font-semibold text-primary mb-1">
          {{ textEntry.livre }}
        </p>
        <h1 class="text-3xl md:text-4xl font-bold text-text-primary">
          {{ appendHebrewNumeral(textEntry.name) }}
        </h1>
        <p v-if="currentSection && !isSingleSection" class="mt-2 text-text-secondary">
          {{ sectionLabel(currentSection) }}
        </p>
      </header>

      <!-- SEO intro (public /bibliotheque reading pages only ; masquée dans
           l'app native où elle n'apporte rien au lecteur) -->
      <p v-if="isEtudeRoute && !isNativeApp" class="-mt-4 mb-8 text-text-secondary leading-relaxed">
        {{ readingLead }}
      </p>

      <!-- Reprise de lecture : là où le lecteur s'était arrêté -->
      <div v-if="showResumeBanner" class="mb-6 p-4 card flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-text-primary flex items-center gap-2">
            <AppIcon name="book-open" :size="15" class="text-primary flex-shrink-0" />
            {{ t("textReading.resumeTitle") }}
          </p>
          <p class="text-sm text-text-secondary mt-0.5">{{ resumePlace }}</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <button @click="resumeReading" class="btn btn-primary !px-3 !py-1.5 text-sm">
            {{ t("textReading.resumeCta") }}
          </button>
          <button @click="dismissResume" class="icon-btn" :title="t('textReading.resumeDismiss')">
            <AppIcon name="x" :size="15" />
          </button>
        </div>
      </div>

      <!-- Passage list (multi-section texts) -->
      <div v-if="showSectionList">
        <ReadingNav v-if="prevText || nextText" v-bind="siblingNavProps" class="mb-8" />
        <!-- Les cours audio sur ce livre, avant ses chapitres -->
        <TexteChiourim
          v-if="textEntry && !isLiturgyText && !isSessionMode"
          :entry="textEntry"
          :chapitre="null"
          class="mb-10"
        />
        <p class="text-sm text-text-secondary mb-4">
          {{ t("textReading.sectionsCount", { count: content.sections.length }) }}
        </p>
        <!-- Les chapitres : une liste nue, sur le fond de la page, une ligne
             chacun et un filet entre eux. Le nom du chapitre dit déjà son
             numéro (« Chapitre 3 (ג) », « Siman 8 : ... ») : pas de pastille
             numérotée en plus. -->
        <div>
          <button
            v-for="section in content.sections"
            :key="section.index"
            @click="goToSection(section.index)"
            class="section-row w-full flex items-center justify-between gap-3 text-start group"
          >
            <span
              class="min-w-0 font-medium text-text-primary group-hover:text-primary transition-colors"
            >
              {{ sectionLabel(section) }}
            </span>
            <span class="flex items-center gap-2 flex-shrink-0">
              <AppIcon
                v-if="isSessionMode && findReservation(section.index)?.isCompleted"
                name="circle-check"
                :size="16"
                class="text-green-500"
                :title="t('textReading.read')"
              />
              <AppIcon
                v-else-if="isSessionMode && findReservation(section.index)"
                name="user-clock"
                :size="16"
                class="text-amber-500"
              />
              <AppIcon
                name="chevron-right"
                :size="16"
                class="text-text-secondary/60 rtl:rotate-180"
              />
            </span>
          </button>
        </div>
        <ReadingNav v-if="prevText || nextText" v-bind="siblingNavProps" class="mt-10" />
      </div>

      <!-- Reading a passage -->
      <div v-else-if="currentSection">
        <!-- Sli'hot : la plage horaire où elles se disent, avant le texte. -->
        <SlihotHours v-if="isSlihot" />
        <!-- Reservation bar (session mode) -->
        <SessionReservationCard
          v-if="showReservationBar"
          class="mb-8"
          v-bind="reservationCardProps"
          v-model:reservation-form="reservationForm"
        >
          <PrayerNamesLine v-if="prayerNames.length" :names="prayerNames" />
        </SessionReservationCard>

        <!-- Top navigation -->
        <ReadingNav v-if="!isSingleSection" v-bind="sectionNavProps" class="mb-8" />
        <ReadingNav v-else-if="prevText || nextText" v-bind="siblingNavProps" class="mb-8" />

        <!-- Reading toolbar: marque-pages, taille, voyelles du tikoun,
             traduction, puis la bascule hébreu / forme / phonétique, toujours
             au bout de la ligne (à droite, à gauche en hébreu) : les
             commandes qui vont et viennent selon le texte se rangent devant
             elle, sans la déplacer. Une seule ligne, même sur un téléphone :
             la taille du texte n'y paraît qu'à partir d'un écran moyen (le
             menu de lecture la porte partout), et la bascule y garde le nom
             du mode choisi, les deux autres en abrégé (א, le dessin de la
             forme, Aa), comme dans le menu. -->
        <div class="flex flex-wrap items-center justify-end gap-2 sm:gap-3 mb-5">
          <button
            v-if="bookmarks.length && !isLiturgyText"
            @click="showBookmarksPanel = !showBookmarksPanel"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-black/5 dark:bg-white/10 text-sm font-medium transition-colors"
            :class="
              showBookmarksPanel ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
            "
            :title="t('textReading.bookmarks')"
          >
            <AppIcon name="bookmark" :size="14" />
            {{ bookmarks.length }}
          </button>
          <span class="hidden sm:inline-flex">
            <ReadingSizeControl />
          </span>

          <!-- Tikoun : les voyelles et les teamim, sur les mêmes lignes
               (TorahScroll.vue). Le même réglage que dans le menu de lecture. -->
          <button
            v-if="showPageForm && pageFormKind === 'scroll'"
            type="button"
            class="inline-flex items-center px-3 py-1.5 rounded-btn bg-black/5 dark:bg-white/10 text-sm font-medium transition-colors"
            :class="scrollPointed ? 'text-primary' : 'text-text-secondary hover:text-text-primary'"
            :aria-pressed="scrollPointed"
            :title="t('textReading.settings.scrollPointedHint')"
            @click="setScrollPointed(!scrollPointed)"
          >
            {{ t("textReading.pageForm.pointed") }}
          </button>

          <!-- La traduction, quand le texte en a une : une commande qui porte
               son nom, et la couleur du thème quand elle est allumée. Pas dans
               la forme de la page (daf de Vilna, tikoun) : ni l'une ni l'autre
               ne montre de traduction. -->
          <button
            v-if="canTranslate"
            @click="toggleTranslation"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-black/5 dark:bg-white/10 text-sm font-medium transition-colors"
            :class="
              showTranslation ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
            "
            :aria-pressed="showTranslation"
          >
            <AppIcon name="languages" :size="14" />
            {{ t("textReading.translation.toggle") }}
          </button>

          <!-- Hébreu, forme de la page (guemara, Torah), phonétique : trois
               façons de montrer le même texte, une seule à la fois. -->
          <div
            v-if="canTransliterate || pageFormKind"
            class="inline-flex p-0.5 rounded-btn bg-black/5 dark:bg-white/10"
            role="group"
          >
            <button
              @click="setReadingMode('hebrew')"
              class="px-2.5 sm:px-3 py-1 rounded-control text-sm font-medium transition-colors"
              :class="
                readingMode === 'hebrew'
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-text-secondary'
              "
              :aria-pressed="readingMode === 'hebrew'"
              :aria-label="t('textReading.hebrew')"
              :title="t('textReading.hebrew')"
            >
              <span v-if="readingMode !== 'hebrew'" class="sm:hidden" aria-hidden="true">א</span>
              <span :class="readingMode === 'hebrew' ? '' : 'hidden sm:inline'">{{
                t("textReading.hebrew")
              }}</span>
            </button>
            <button
              v-if="pageFormKind"
              @click="setReadingMode('page')"
              class="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-control text-sm font-medium transition-colors"
              :class="
                readingMode === 'page' ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary'
              "
              :aria-pressed="readingMode === 'page'"
              :aria-label="t(PAGE_FORM_LABELS[pageFormKind].label)"
              :title="t(PAGE_FORM_LABELS[pageFormKind].hint)"
            >
              <AppIcon :name="PAGE_FORM_LABELS[pageFormKind].icon" :size="14" />
              <span :class="readingMode === 'page' ? '' : 'hidden sm:inline'">{{
                t(PAGE_FORM_LABELS[pageFormKind].label)
              }}</span>
            </button>
            <button
              v-if="canTransliterate"
              @click="setReadingMode('phonetic')"
              class="px-2.5 sm:px-3 py-1 rounded-control text-sm font-medium transition-colors"
              :class="
                readingMode === 'phonetic'
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-text-secondary'
              "
              :aria-pressed="readingMode === 'phonetic'"
              :aria-label="t('textReading.phonetic')"
              :title="t('textReading.phonetic')"
            >
              <span v-if="readingMode !== 'phonetic'" class="sm:hidden" aria-hidden="true">Aa</span>
              <span :class="readingMode === 'phonetic' ? '' : 'hidden sm:inline'">{{
                t("textReading.phonetic")
              }}</span>
            </button>
          </div>
        </div>

        <p v-if="translationFallback" class="mb-5 text-sm text-text-secondary">
          {{ t("textReading.translation.fallback", translationFallback) }}
        </p>
        <p v-if="showTranslation && translationFailed" class="mb-5 text-sm text-text-secondary">
          {{ t("textReading.translation.unavailable") }}
        </p>
        <TranslationAiNotice
          v-if="showTranslation && trLines.length"
          class="mb-5"
          :sources="translation?.sources"
        />

        <!-- Marque-pages du texte (ouvert depuis l'icône de la barre d'outils).
             Pas sur une tefila : une brakha ou un office se lisent du début,
             on n'y revient pas à un verset. -->
        <div v-if="showBookmarksPanel && bookmarks.length && !isLiturgyText" class="mb-5 card p-3">
          <p class="text-sm font-semibold text-text-secondary px-1 mb-1.5">
            {{ t("textReading.bookmarks") }}
          </p>
          <div v-for="b in bookmarks" :key="b.id" class="flex items-center gap-1">
            <button
              @click="goToBookmark(b)"
              class="flex-1 min-w-0 text-left px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-sm text-text-primary flex items-center gap-2 transition-colors"
            >
              <AppIcon name="bookmark" :size="13" class="text-primary flex-shrink-0" />
              <span class="truncate">{{ bookmarkPlace(b) }}</span>
            </button>
            <button
              @click="removeBookmarkItem(b)"
              class="icon-btn hover:!text-red-600"
              :title="t('textReading.bookmarkRemove')"
            >
              <AppIcon name="x" :size="14" />
            </button>
          </div>
        </div>

        <!-- Ce qui se dit avant la lecture (Tehilim, Cantique des cantiques) :
             replié, au-dessus du texte, là où on le dirait. -->
        <ReadingEncadrement
          v-if="encadrement && showEncadrementBefore"
          :blocks="encadrement.before"
          :title="t('encadrement.before')"
          :show-phonetic="showPhonetic"
        />

        <!-- Un texte à jours (les Hochanot) : celui qu'on lit, les autres à
             un appui. -->
        <TefilaDays
          v-if="isLiturgyText && shownDay"
          :days="textDays"
          :shown="shownDay.when"
          :today="todayDay?.when ?? null"
          @pick="pickedDay = $event"
        />

        <!-- Talmud: continuous text with a marker at each daf change.
             `ph-no-deadclick` sur les trois corps de texte : un appui sur le
             texte (double appui du défilement, lecture du doigt) ne change
             rien à l'écran sans être une commande en panne, et noierait les
             clics morts de PostHog. -->
        <!-- La forme de la page : la page de Vilna, le Sefer Torah. -->
        <div
          v-if="showPageForm && pageFormKind === 'daf'"
          class="ph-no-deadclick"
          :style="{ '--reading-scale': pageFormSize.scale.value }"
        >
          <TalmudDafPages
            :tractate="textEntry ? tractateSlug(tractateFromLink(textEntry.link)) : null"
            :blocks="currentSection.dafBlocks ?? []"
            :meforshim="commentaries.talmud.value"
            :state="dafMeforshimState"
            :scale="pageFormSize.scale.value"
          />
        </div>
        <div
          v-else-if="showPageForm && pageFormKind === 'scroll'"
          class="ph-no-deadclick"
          :style="{ '--reading-scale': pageFormSize.scale.value }"
        >
          <TorahScroll
            :text-id="textEntry?.id ?? null"
            :lines="currentSection.he"
            :marks="currentSection.scrollMarks ?? []"
            :aliyot="scrollAliyot"
            :picked-line="selectedLine"
            :bookmarked-lines="bookmarkedLines"
            :highlighted-line="highlightedLine"
            :leads="studyLeads"
            @pick="pickVerse"
          />
        </div>
        <div
          v-else-if="content.type === 'Talmud Bavli'"
          class="ph-no-deadclick"
          :style="{ '--reading-scale': readingSize.scale.value }"
        >
          <TalmudDafText
            :blocks="currentSection.dafBlocks ?? []"
            anchored
            selectable
            :selected-line="selectedLine"
            :bookmarked-lines="bookmarkedLines"
            :highlighted-line="highlightedLine"
            :leads="studyLeads"
            :phonetic-by-daf="showPhonetic ? phoneticByDaf : null"
            :translation-by-daf="translationByDaf"
            :transliterate="showPhonetic ? transliterate : null"
            @pick="pickVerse"
          />
        </div>

        <!-- Tefila : paragraphes justifiés, didascalies traduites, ajouts du
             calendrier et encadrés des dix jours de pénitence. -->
        <LiturgyText
          v-else-if="isLiturgyText"
          class="ph-no-deadclick"
          :style="{ '--reading-scale': readingSize.scale.value }"
          :blocks="visibleBlocks"
          :show-phonetic="showPhonetic"
          :occasions="occasions"
          :recent-changes="recentChanges"
          selectable
          :selected-line="pickedLine"
          @pick="pickPassage"
        />

        <!-- Verses / mishnayot (numbered for reference texts), grouped by
             chapter / montée with a marker at each block start -->
        <div v-else class="ph-no-deadclick" :style="{ '--reading-scale': readingSize.scale.value }">
          <template v-for="(block, blockIndex) in verseBlocks" :key="anchorOf(block)">
            <!-- Une strophe du psaume 119 : sa lettre en grand et en gras,
                 qu'on repère d'un coup d'œil en cherchant celles d'un nom.
                 Elle se pose du côté où les versets commencent : à droite
                 au-dessus de l'hébreu, à gauche au-dessus de la phonétique. -->
            <p
              v-if="block.heading?.kind === 'letter'"
              :data-block-anchor="anchorOf(block)"
              :dir="showPhonetic ? 'ltr' : 'rtl'"
              :class="blockLabelClass(blockIndex)"
              class="flex items-baseline gap-3"
            >
              <span dir="rtl" class="font-hebrew text-3xl font-bold leading-none">
                {{ block.heading.letter }}
              </span>
              <span v-if="locale !== 'he'" dir="ltr">{{ block.heading.name }}</span>
            </p>
            <p
              v-else-if="block.label"
              :data-block-anchor="anchorOf(block)"
              :class="blockLabelClass(blockIndex)"
            >
              {{ blockLabel(block) }}
            </p>
            <div class="space-y-6 mb-6">
              <template v-for="(line, index) in block.lines" :key="block.offset + index">
                <!-- Le signet, posé en travers avant le verset marqué. -->
                <BookmarkRibbon v-if="isLineBookmarked(block.offset + index)" />
                <div
                  :data-line="block.offset + index"
                  @click="pickVerse($event, block.offset + index, line)"
                  @contextmenu="pickVerse($event, block.offset + index, line)"
                  class="reading-pick flex items-start gap-3 rounded-lg transition-colors duration-500 -mx-2 px-2"
                  :class="{
                    'bg-primary/10': highlightedLine === block.offset + index,
                    'reading-selected':
                      selectedLine === block.offset + index &&
                      highlightedLine !== block.offset + index,
                  }"
                >
                  <span
                    v-if="showVerseNumbers"
                    class="mt-2 flex-shrink-0 w-6 text-right text-xs text-primary font-semibold select-none"
                  >
                    {{ index + 1 }}
                  </span>
                  <div class="flex-1 min-w-0">
                    <p
                      v-if="!showPhonetic"
                      dir="rtl"
                      class="font-hebrew text-text-primary reading-he"
                    >
                      <MarkedText
                        :text="line"
                        :leads="studyLeads?.line === block.offset + index ? studyLeads.leads : null"
                      />
                    </p>
                    <p
                      v-else
                      dir="ltr"
                      class="leading-relaxed italic text-text-secondary reading-tl"
                    >
                      {{ phoneticLines[block.offset + index] }}
                    </p>
                    <!-- La traduction du verset, sous lui, dans la police de
                         lecture latine. -->
                    <p
                      v-if="trLines[block.offset + index]"
                      dir="ltr"
                      class="mt-2 text-text-secondary reading-tr"
                    >
                      <TranslationText :text="trLines[block.offset + index]" />
                    </p>
                  </div>
                </div>
              </template>
            </div>
          </template>
        </div>

        <!-- D'où vient la traduction lue : son auteur, sa licence. -->
        <TranslationCredit
          v-if="trLines.length && translation?.sources.length"
          :sources="translation.sources"
        />

        <!-- Ce qui se dit après la lecture, au bas du texte. -->
        <ReadingEncadrement
          v-if="encadrement && showEncadrementAfter"
          :blocks="encadrement.after"
          :title="t('encadrement.after')"
          :show-phonetic="showPhonetic"
        />

        <!-- Le même encadré qu'en tête, au bas de la lecture : on marque
             « lu » là où on finit, sans remonter toute la page. -->
        <SessionReservationCard
          v-if="showReservationBar"
          class="mt-12"
          v-bind="reservationCardProps"
          guest-form-id-prefix="guest-bottom"
          v-model:reservation-form="reservationForm"
        />

        <!-- Venu de Mon parcours : la tâche du jour se coche là où l'on finit. -->
        <ReaderTaskCard
          v-if="parcoursObjective && !isSessionMode"
          :objective-id="parcoursObjective"
          class="mt-12"
        />
        <!-- A service, opened from the Sidour or elsewhere: it is marked
             done where it ends, and the Sidour moves on. -->
        <OfficeDoneCard
          v-else-if="textTefila && !isSessionMode"
          :tefila="textTefila"
          class="mt-12"
        />

        <!-- Sidour : à la fin de Min'ha, un geste suffit pour enchaîner
             avec Arvit. -->
        <RouterLink
          v-if="sidourNextEntry"
          :to="hubPath(sidourNextEntry)"
          class="mt-12 card card-hover p-4 flex items-center justify-between gap-3 group"
        >
          <span class="flex items-center gap-3 min-w-0">
            <AppIcon name="moon" :size="18" class="text-primary flex-shrink-0" />
            <span class="min-w-0">
              <span
                class="block font-semibold text-text-primary group-hover:text-primary transition-colors"
              >
                {{ t("textReading.sidourNext", { name: latinName(sidourNextEntry) }) }}
              </span>
              <span class="block text-sm text-text-secondary">
                {{ t("textReading.sidourNextHint") }}
              </span>
            </span>
          </span>
        </RouterLink>

        <!-- Les cours audio sur ce chapitre (ou ce texte), une fois lu -->
        <TexteChiourim
          v-if="textEntry && !isLiturgyText && !isSessionMode"
          :entry="textEntry"
          :chapitre="isSingleSection ? null : currentSection.index"
          class="mt-12"
        />

        <!-- Bottom navigation -->
        <ReadingNav v-if="!isSingleSection" v-bind="sectionNavProps" class="mt-12" />
        <ReadingNav v-else-if="prevText || nextText" v-bind="siblingNavProps" class="mt-12" />
      </div>

      <!-- Internal links (public /bibliotheque reading pages only). Pas sous un
           texte de tefila : on y vient prier, pas naviguer. -->
      <section v-if="isEtudeRoute && !isLiturgyText" class="mt-14 text-sm text-text-secondary">
        <nav class="flex flex-wrap gap-x-5 gap-y-2">
          <RouterLink to="/bibliotheque" class="hover:text-primary transition-colors">
            {{ t("textReading.links.library") }}
          </RouterLink>
          <RouterLink
            v-if="isTehilimEtude"
            to="/tehilim"
            class="hover:text-primary transition-colors"
          >
            {{ t("textReading.links.tehilimIntentions") }}
          </RouterLink>
          <RouterLink
            :to="localePath('partageTehilim')"
            class="hover:text-primary transition-colors"
          >
            {{ t("textReading.links.shareTehilim") }}
          </RouterLink>
        </nav>
      </section>
    </template>

    <!-- Tous les textes de la bibliothèque : le menu de lecture remplace le
         bouton de remontée, et la progression court au bas de l'écran. Le
         menu reprend la bascule hébreu / phonétique de la barre d'outils et,
         dans l'app native, le téléchargement du texte ; sur un office, il
         porte aussi le réglage « sans tahanoun ». Le partage mène à la page
         publique du texte (la canonique), et non à la lecture en session, qui
         n'est pas indexée et ne s'ouvre pas de l'extérieur. -->
    <template v-if="content && currentSection">
      <ReadingMenu
        :sections="navSections"
        :phonetic="canTransliterate ? showPhonetic : null"
        :page-form="pageFormKind"
        :page-form-active="showPageForm"
        :download-state="bookState"
        :tefila="isTefila"
        :halakhot="hasHalakhot"
        :translation-langs="canTranslate ? menuTranslationLangs : []"
        :translation-lang="translationLang"
        :share-title="shareTitle"
        :share-url="shareReadingUrl"
        :concealed="studyLine !== null || (!sideBySide && selectedPassageKey !== null)"
        :set-aside="canSetAside"
        @update:phonetic="setReadingMode($event ? 'phonetic' : 'hebrew')"
        @update:page-form-active="setReadingMode($event ? 'page' : 'hebrew')"
        @download="toggleDownload()"
        @set-aside="setTextAside('menu')"
      />
      <ReadingProgressBar />
      <!-- Les gestes de lecture, une ouverture après le menu (gesturesTip). -->
      <FeatureTour
        v-if="tipsOffered"
        tip="reading-gestures"
        :steps="gesturesTip"
        :after="['reading-menu']"
      />
      <!-- The study panel: the passage's commentaries, which follow the
           reading while it is open. On a phone it rises from the bottom and
           goes back down (BottomSheet.vue). -->
      <Transition name="bottom-sheet">
        <CommentaryPanel
          v-if="studyLine !== null"
          :place="placeLabel(positionSection, studyLine)"
          :groups="studyGroups"
          :state="commentaries.state.value"
          :sources="commentaries.sources.value"
          :style="{ '--reading-scale': readingSize.scale.value }"
          @close="closeStudy"
        />
      </Transition>
    </template>
  </main>
</template>

<style scoped>
/* La liste des chapitres : des lignes sur le fond de la page, sans carte
   autour, un filet entre elles. Au survol, le nom prend la couleur du thème. */
.section-row {
  min-height: 3.25rem;
  padding: 0.75rem 0.25rem;
}
.section-row + .section-row {
  border-top: 1px solid var(--color-line);
}
/* Le panneau d'étude ouvert (CommentaryPanel.vue). Sur un téléphone, la page
   réserve sous le texte la hauteur de son volet à mi-hauteur, pour qu'on lise
   jusqu'au dernier passage. Dès que le texte et ses commentaires tiennent
   côte à côte (640 px, voir useSideBySide), la colonne de lecture se range à
   gauche de celle des commentaires (`--study-width`, main.css). */
.study-open {
  padding-bottom: calc(55vh + 2rem);
}
@media (min-width: 640px) {
  /* La colonne de lecture garde sa largeur ordinaire (48 rem) tant que la
     place à gauche du panneau la contient, et ne rétrécit qu'en dessous.
     Elle reste centrée sur l'écran tant qu'elle n'y touche pas le panneau
     (un grand écran ne bouge pas) ; sinon elle glisse vers la gauche, juste
     assez pour laisser l'écart (`--study-gap`) entre le texte et lui. */
  .study-open {
    --study-gap: 2rem;
    --study-room: calc(100% - var(--study-width) - var(--study-gap));
    --study-text: min(48rem, var(--study-room));
    width: var(--study-text);
    max-width: none;
    padding-bottom: 3rem;
    margin-left: min(
      calc((100% - var(--study-text)) / 2),
      calc(var(--study-room) - var(--study-text))
    );
    margin-right: 0;
  }
}

/* Le texte glisse en place quand le panneau s'ouvre ou se ferme, au lieu de
   sauter d'un côté à l'autre. */
main {
  transition:
    margin-left 0.25s ease,
    width 0.25s ease;
}
@media (prefers-reduced-motion: reduce) {
  main {
    transition: none;
  }
}
/* Pendant qu'on tire le bord de la colonne des commentaires, le texte suit
   le doigt sans retard (CommentaryPanel.vue). */
:global(.study-resizing main) {
  transition: none;
}

/* Reader text sizes follow the A− / A+ control (useReadingSize).
   L'interligne de l'hébreu est volontairement plus serré que leading-loose :
   assez d'air pour les voyelles et les teamim, sans étirer la lecture. */
.reading-he {
  font-size: calc(1.5rem * var(--reading-scale, 1));
  line-height: 1.7;
}
.reading-tl {
  /* La police latine choisie dans les réglages (useFonts) ne vaut que pour le
     texte des lectures : le reste de l'app garde Manrope. */
  font-family: var(--font-reading);
  font-size: calc(1.125rem * var(--reading-scale, 1));
}
/* La traduction sous un verset : la police de lecture latine, un cran sous
   l'hébreu, qui reste le texte qu'on lit. */
.reading-tr {
  font-family: var(--font-reading);
  font-size: calc(1.0625rem * var(--reading-scale, 1));
  line-height: 1.65;
}
</style>
