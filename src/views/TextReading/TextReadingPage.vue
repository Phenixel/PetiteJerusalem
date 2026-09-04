<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import type { RouteLocationRaw } from "vue-router";
import { useI18n } from "vue-i18n";
import textStudiesJson from "../../datas/textStudies.json";
import type {
  Session,
  TextStudyReservation,
  TextStudiesJson,
  TextStudyJsonEntry,
} from "../../models/models";
import type { User } from "../../services/authService";
import {
  loadText,
  MissingTextFileError,
  placeLabel as describePlace,
} from "../../services/textService";
import type { TextBlock, TextContent, TextSection } from "../../services/textService";
import {
  activeOccasions,
  getWeeklyParasha,
  recentSeasonalChanges,
} from "../../services/dailyCycles";
import {
  injectWeeklyTorah,
  nextTefilaEntry,
  tefilaHebrewDay,
  tefilaOf,
} from "../../services/sidourService";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { scrollToVerse } from "../../composables/scrollAnchor";
import { resolveBackNavigation, stripQuery } from "../../composables/readingBack";
import { transliterate, hasNiqqud } from "../../services/hebrewTransliteration";
import { appendHebrewNumeral } from "../../services/hebrewNumerals";
import { sessionService } from "../../services/sessionService";
import { ReservationGoneError } from "../../services/reservationService";
import { isOffline } from "../../services/userPreferencesService";
import { seoService } from "../../services/seoService";
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
  READING_LEAD,
  readingLead as readingLeadOf,
  SITE_URL,
} from "../../content/etudeTexts";
import { encadrementOf } from "../../services/encadrementService";
import LiturgyText from "./LiturgyText.vue";
import ReadingEncadrement from "../../components/ReadingEncadrement.vue";
import SlihotHours from "./SlihotHours.vue";
import ReadingMenu from "../../components/ReadingMenu.vue";
import ReadingSizeControl from "../../components/ReadingSizeControl.vue";
import ReadingProgressBar from "../../components/ReadingProgressBar.vue";
import SessionReservationCard from "./SessionReservationCard.vue";
import ReadingNav from "../../components/ReadingNav.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import { useToast } from "../../composables/useToast";
import { useReadingSize } from "../../composables/useReadingSize";
import { readingProgressService, bookmarkId } from "../../services/readingProgressService";
import type { Bookmark, ReadingPosition } from "../../services/readingProgressService";
import { isNativeApp } from "../../composables/useNativeApp";
import {
  bookForEntry,
  downloadBook,
  downloadingPaths,
  isBookDownloaded,
  removeBook,
} from "../../services/offlineLibraryService";
import { ensureManifestLoaded } from "../../services/offlineTextStore";
import type { ReadingNavSection } from "../../composables/useReadingNav";
import type { SupportedLocale } from "../../i18n";
import { useReadingPinch } from "../../composables/useReadingPinch";
import { useAutoScroll } from "../../composables/useAutoScroll";
import { analyticsService } from "../../services/analyticsService";
import { useLocalePath } from "../../composables/useLocalePath";
import { useConfirm } from "../../composables/useConfirm";

/** Les pages traduites suivent l'espace de langue de l'URL ouverte. */
const { localePath } = useLocalePath();

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { confirm } = useConfirm();
const toast = useToast();
const readingSize = useReadingSize();
// App native : pincer dans la page agrandit le texte lu, pas la page.
useReadingPinch();
// Lieu des horaires : donne le jour hébraïque (sensible à la chkia) qui
// conditionne les ajouts de calendrier des textes de tefila.
const { place: zmanimPlace, deniedBefore, locateDevice } = useZmanimLocation();

// This view serves two URL shapes with the SAME UI: the in-session reader
// (/lire/:textId, numeric id) and the public, indexable reading pages
// (/bibliotheque/:corpus/:slug[/:section], keyword URLs). `isEtudeRoute` switches
// navigation + metadata between the two.
const isEtudeRoute = computed(() => route.params.corpus !== undefined);
/** Corpus ayant leur page de bibliothèque (route `study-corpus`). Pas les
 * Sli'hot : leur unique texte EST la page du corpus (redirection), le retour
 * ramène donc à l'accueil de la bibliothèque. */
const LIBRARY_CORPORA = new Set(["tehilim", "michna", "talmud", "tanakh", "brahot", "sidour"]);
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
// Min'ha du jeudi soir reste celle du jeudi ; Arvit et les brahot basculent
// à la chkia, Retsé se bénit dès le vendredi soir.
//
// L'heure est donc une donnée du rendu, pas une valeur figée à l'ouverture :
// on bénit après la chkia du vendredi une page ouverte avant elle, et Retsé
// doit apparaître sans qu'on ait à la recharger (minuteur plus bas).
const now = ref(new Date());
const occasionsDay = computed(() =>
  tefilaHebrewDay(zmanimPlace.value, tefilaOf(textEntry.value), now.value),
);
const occasions = computed(() =>
  activeOccasions(occasionsDay.value, zmanimPlace.value.tzid === "Asia/Jerusalem"),
);
const visibleBlocks = computed(() =>
  verseBlocks.value.filter((b) => !b.when || occasions.value.has(b.when)),
);

// Les bascules saisonnières récentes (machiv haroua'h en début d'hiver…) :
// leurs ajouts s'affichent à la couleur du thème les trois premières
// semaines ; le reste du temps ils se fondent dans le fil.
const recentChanges = computed(() =>
  recentSeasonalChanges(occasionsDay.value, zmanimPlace.value.tzid === "Asia/Jerusalem"),
);

/** Tefila (Sli'hot, Brahot, Sidour) : un rendu à part, voir LiturgyText. */
const isLiturgyText = computed(() => !!textEntry.value && isLiturgy(textEntry.value));

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
const isSlihot = computed(() => String(textEntry.value?.type) === "Slihot");

// App native : le texte lu se télécharge sans quitter la page, par l'icône
// du menu de lecture. Les Sli'hot gardent en plus leur bouton en tête du
// texte : leur livre s'ouvre directement (voir le router), sans carte dans
// la bibliothèque d'où le télécharger, le menu seul serait trop discret.
type BookState = "none" | "downloading" | "downloaded" | "idle";
const bookState = computed<BookState>(() => {
  if (!isNativeApp || !textEntry.value) return "none";
  const book = bookForEntry(textEntry.value);
  if (!book) return "none";
  if (downloadingPaths.has(book.path)) return "downloading";
  return isBookDownloaded(book) ? "downloaded" : "idle";
});

async function toggleDownload() {
  const entry = textEntry.value;
  if (!entry) return;
  const book = bookForEntry(entry);
  if (!book) return;
  try {
    if (isBookDownloaded(book)) {
      await removeBook(book);
      analyticsService.capture("offline_download_deleted", { scope: "book", book: book.path });
    } else {
      await downloadBook(book);
      analyticsService.capture("offline_download_completed", { scope: "book", book: book.path });
    }
  } catch {
    toast.error(t("downloads.error"));
  }
}

// Sidour : à la fin de Min'ha, Arvit est à un geste (la sortie des étoiles
// les enchaîne). Pas de lien entre Cha'harit et le reste : la journée les
// sépare.
const sidourNextEntry = computed(() => nextTefilaEntry(textEntry.value));

// Le minuteur des occasions : seuls les textes de tefila regardent l'heure,
// il ne tourne donc que pour eux, et s'arrête dès qu'on ouvre autre chose.
let occasionsTicker: ReturnType<typeof setInterval> | null = null;
function stopOccasionsTicker() {
  if (occasionsTicker !== null) clearInterval(occasionsTicker);
  occasionsTicker = null;
}
watch(
  isLiturgyText,
  (liturgy) => {
    stopOccasionsTicker();
    if (!liturgy) return;
    now.value = new Date();
    occasionsTicker = setInterval(() => (now.value = new Date()), 60_000);
  },
  { immediate: true },
);

// Les horaires affichés en tête d'office (TefilaZman) valent ce que vaut le
// lieu : à l'arrivée sur un office du sidour, on redemande la position de
// l'appareil, comme le bouton de la page des horaires, pour que les heures
// suivent l'endroit où l'on est et non celui du dernier passage. Une ville
// choisie explicitement reste respectée, un refus laisse le lieu courant
// (voir locateDevice) et se retient : on ne redemande pas à chaque visite,
// le bouton de la page des horaires reste le moyen de changer d'avis.
watch(
  () => (String(textEntry.value?.type) === "Sidour" ? textId.value : null),
  (id) => {
    if (!id || zmanimPlace.value.source === "city" || deniedBefore.value) return;
    void locateDevice().then((granted) => {
      analyticsService.capture("zmanim_location_requested", { granted, source: "sidour" });
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
const showVerseNumbers = computed(
  () =>
    !(textEntry.value && isLiturgy(textEntry.value)) &&
    ((textEntry.value?.totalSections ?? 1) > 1 || (currentSection.value?.blocks?.length ?? 0) > 0),
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

// Double appui sur le texte : la page descend toute seule, à l'allure choisie
// dans la pastille du bas (AutoScrollPill). Seulement dans le texte ouvert :
// la liste des chapitres d'un traité se parcourt, elle ne se lit pas.
useAutoScroll(() => currentSection.value !== null);
// Un texte long se cherche par ses divisions : les sections d'un office
// ('Amida, Chéma, ta'hanoun…), les montées d'une paracha, les dafim d'une
// guemara. La page les publie au menu de lecture (ReadingMenu), qui remplace
// le bouton « remonter en haut ». Un texte d'un seul tenant n'en publie
// aucune : son menu se limite alors à la taille et au haut de page.
const dafOffsets = computed<{ daf: string; offset: number }[]>(() => {
  const out: { daf: string; offset: number }[] = [];
  let offset = 0;
  for (const block of currentSection.value?.dafBlocks ?? []) {
    out.push({ daf: block.daf, offset });
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
        const label = b.labelText
          ? b.labelText[locale.value as SupportedLocale] || b.labelText.fr
          : b.label;
        // Le titre hébreu accompagne le traduit, sauf à le répéter.
        const hebrew = b.labelText?.he;
        return { offset: b.offset, label, ...(hebrew && hebrew !== label ? { hebrew } : {}) };
      });
  }
  if (content.value?.type === "Talmud Bavli") {
    return dafOffsets.value.map(({ daf, offset }) => ({ offset, label: `Daf ${daf}` }));
  }
  return verseBlocks.value
    .filter((b) => b.label)
    .map((b) => ({ offset: b.offset, label: b.label }));
});

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

async function loadContent() {
  if (!textEntry.value) return;
  const sequence = ++loadSequence;
  const stale = () => sequence !== loadSequence;
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
  });
  loading.value = true;
  error.value = false;
  missingFile.value = false;
  content.value = null;
  try {
    const loaded = await loadText(textEntry.value);
    if (stale()) return;
    content.value = loaded;
    // Sidour : le lundi et le jeudi, la lecture de la Torah de la semaine
    // (le début de la paracha, en trois montées) prend la place de son
    // marqueur dans Cha'harit. Elle change chaque semaine : c'est le lecteur
    // qui la charge.
    if (tefilaOf(textEntry.value) === "chaharit" && occasions.value.has("torah-semaine")) {
      try {
        const parasha = getWeeklyParasha(now.value);
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

/** La bibliothèque du corpus lu (Tehilim, Talmud…), à défaut son accueil. */
function libraryLocation(): string {
  const corpus = isEtudeRoute.value ? String(route.params.corpus) : "";
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
  const to = isEtudeRoute.value
    ? hubPath(target)
    : { name: "text-reading", params: { textId: String(target.id) }, query: route.query };
  router.replace(to);
  scrollTopProgrammatic();
}

// --- Reprise de lecture & marque-pages ---
const savedPosition = ref<ReadingPosition | null>(null);
const resumeDismissed = ref(false);
const highlightedLine = ref<number | null>(null);
const selectedLine = ref<number | null>(null);
const bookmarks = ref<Bookmark[]>([]);
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

/** "Chapitre 2 (ב) · 3e montée · verset 14" pour une position donnée. */
function placeLabel(sectionIndex: number | null, line: number): string {
  return describePlace(content.value?.sections ?? [], sectionIndex, line, (n) =>
    t("textReading.verseN", { n }),
  );
}

const showResumeBanner = computed(() => {
  // Liturgie : les marque-pages restent, mais pas de « reprendre là où vous
  // étiez », une brakha ou les Sli'hot se lisent du début, pas en cours.
  if (textEntry.value && isLiturgy(textEntry.value)) return false;
  const p = savedPosition.value;
  if (!p || resumeDismissed.value || route.query.verset !== undefined || !content.value)
    return false;
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
  void nextTick(() =>
    scrollToVerse(() => document.querySelector(`[data-line="${line}"]`), line, highlightedLine),
  );
}

// Arrivée avec ?verset=N (reprise, marque-page, lien partagé) : on scrolle au
// verset dès que le contenu correspondant est rendu.
watch([content, sectionParam, () => route.query.verset], ([loaded, , verset]) => {
  if (!loaded || verset === undefined) return;
  const line = Number(verset);
  if (Number.isInteger(line) && line >= 0) scrollToLine(line);
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

function capturePosition() {
  if (!currentSection.value || showSectionList.value) return;
  const els = document.querySelectorAll<HTMLElement>("[data-line]");
  if (els.length === 0) {
    // Talmud : pas d'éléments par verset, on retient le chapitre.
    savePositionNow(0);
    return;
  }
  // Premier verset encore visible sous l'en-tête : c'est là qu'on reprendra.
  let line = 0;
  for (const el of els) {
    if (el.getBoundingClientRect().bottom >= 96) {
      line = Number(el.dataset.line ?? 0);
      break;
    }
  }
  savePositionNow(line);
}

function onScroll() {
  // Un scroll est un signe de présence : il sert au renouvellement du tirage
  // (voir renewDrawIfNeeded), même quand la capture de position s'abstient.
  noteReadingActivity();
  if (Date.now() - programmaticScrollAt < 300) return;
  if (scrollSaveTimer !== null || !currentSection.value || showSectionList.value) return;
  scrollSaveTimer = window.setTimeout(() => {
    scrollSaveTimer = null;
    capturePosition();
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

// --- Marque-pages ---
const bookmarkIds = computed(() => new Set(bookmarks.value.map((b) => b.id)));

function isLineBookmarked(line: number): boolean {
  return bookmarkIds.value.has(bookmarkId(textId.value, positionSection.value, line));
}

function onVerseClick(line: number) {
  selectedLine.value = selectedLine.value === line ? null : line;
}

function toggleBookmarkAt(line: number) {
  if (!textEntry.value) return;
  const added = readingProgressService.toggleBookmark({
    textId: textId.value,
    section: positionSection.value,
    line,
    path: canonicalReadingPath.value,
    label: positionLabel.value,
  });
  bookmarks.value = readingProgressService.getBookmarks(textId.value);
  analyticsService.capture(added ? "bookmark_added" : "bookmark_removed", {
    text_id: textEntry.value.id,
    corpus: textEntry.value.type,
  });
  selectedLine.value = null;
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

function removeBookmarkItem(b: Bookmark) {
  readingProgressService.toggleBookmark({
    textId: b.textId,
    section: b.section,
    line: b.line,
    path: b.path,
    label: b.label,
  });
  bookmarks.value = readingProgressService.getBookmarks(textId.value);
  analyticsService.capture("bookmark_removed", {
    text_id: textEntry.value?.id,
    corpus: textEntry.value?.type,
  });
}

function refreshProgressState() {
  savedPosition.value = readingProgressService.getPosition(textId.value);
  bookmarks.value = readingProgressService.getBookmarks(textId.value);
  resumeDismissed.value = false;
  selectedLine.value = null;
  showBookmarksPanel.value = false;
}

// --- Reservation (session mode) ---
const session = ref<Session | null>(null);
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
    const errorMessage = e instanceof Error ? e.message : String(e);
    analyticsService.capture("reservation_failed", {
      session_id: session.value.id,
      reason: errorMessage.includes("déjà réservée") ? "conflict" : "error",
      error_message: errorMessage,
      source: "reading_page",
    });
    toast.errorFromException(
      e,
      e instanceof Error && e.message ? e.message : t("textReading.reserveError"),
    );
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

onMounted(() => {
  window.addEventListener("pointerdown", noteReadingActivity, { passive: true });
  window.addEventListener("keydown", noteReadingActivity, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  renewTimer = setInterval(() => void renewDrawIfNeeded(), RENEW_CHECK_MS);
});

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", noteReadingActivity);
  window.removeEventListener("keydown", noteReadingActivity);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  if (renewTimer !== null) {
    clearInterval(renewTimer);
    renewTimer = null;
  }
});

async function drawAnother() {
  const s = session.value;
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
    const result = await sessionService.reserveRandomAvailableText(
      s,
      sessionService.getSessionTextStudies(s),
      currentUser.value,
      reservationForm.value,
      t("detailSession.randomDraw.anonymous"),
    );
    if (!result) {
      toast.info(t("detailSession.randomDraw.noneAvailable"));
      return;
    }

    // Le nouveau tirage d'abord, la libération ensuite : si plus rien n'était
    // disponible, le lecteur garde au moins son texte actuel.
    const previous = currentReservation.value;
    if (previous && !previous.isCompleted && isMine.value) {
      await sessionService.deleteReservation(s.id, previous.id);
      s.reservations = s.reservations.filter((x) => x.id !== previous.id);
      analyticsService.capture("reservation_cancelled", {
        session_id: s.id,
        is_guest: currentUser.value == null,
        source: "random_redraw",
      });
    }

    s.reservations = [...s.reservations, result.reservation];
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

  const r = s.reservations.find(
    (x) =>
      x.textStudyId === forTextId &&
      x.expiresAt !== undefined &&
      !x.isCompleted &&
      sessionService.canUserDeleteReservation(x, currentUser.value, reservationForm.value.email),
  );
  if (!r) return;
  // L'état local d'abord : la libération part sans retenir la navigation, et
  // la chaîne qu'on rejoint ne doit pas réafficher le texte comme pris.
  s.reservations = s.reservations.filter((x) => x.id !== r.id);
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

// Quitter la page (retour à la chaîne, navigation ailleurs) sans avoir lu : le
// texte tiré est libéré pour que quelqu'un d'autre puisse le prendre. La
// suppression n'est pas attendue, elle ne doit pas retarder la navigation.
onBeforeRouteLeave(() => {
  void releaseUnreadRandomDraw();
});

// --- SEO ---
// On /bibliotheque (the public, indexable pages) use the keyword title/description and
// index the page. On /lire (the in-session reader) keep the reader title and
// noindex, pointing the canonical at the /bibliotheque equivalent.
const pageTitle = computed(() => {
  const e = textEntry.value;
  if (!e) return "Lecture | Petite Jérusalem";
  if (isEtudeRoute.value) {
    return currentSection.value ? sectionTitle(e, currentSection.value) : hubTitle(e);
  }
  const sec =
    currentSection.value && !isSingleSection.value ? ` · ${currentSection.value.label}` : "";
  return `${appendHebrewNumeral(e.name)}${sec} | Petite Jérusalem`;
});
const pageDescription = computed(() => {
  const e = textEntry.value;
  if (!e || !isEtudeRoute.value) return undefined;
  return currentSection.value ? sectionDescription(e, currentSection.value) : hubDescription(e);
});
const canonicalUrl = computed(() => {
  const e = textEntry.value;
  if (!e) return undefined;
  if (currentSection.value) return `${SITE_URL}${sectionPath(e, currentSection.value.index)}`;
  return `${SITE_URL}${hubPath(e)}`;
});
watch(
  [pageTitle, pageDescription, canonicalUrl],
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
  // A public /lire link (no session) is redirected to the canonical /bibliotheque page,
  // so there is a single indexable URL. /bibliotheque pages render here directly.
  if (!isEtudeRoute.value && !sessionSlug.value && textEntry.value) {
    const target =
      sectionParam.value !== undefined
        ? sectionPath(textEntry.value, sectionParam.value)
        : hubPath(textEntry.value);
    router.replace(target);
    return;
  }
  // Position et marque-pages : lecture locale immédiate (avant tout
  // enregistrement), puis rafraîchie quand la synchro du compte aboutit,
  // sauf si le lecteur a déjà commencé à lire.
  refreshProgressState();
  void readingProgressService.ensureSynced().then(() => {
    if (!sessionSaved) savedPosition.value = readingProgressService.getPosition(textId.value);
    bookmarks.value = readingProgressService.getBookmarks(textId.value);
  });
  window.addEventListener("scroll", onScroll, { passive: true });
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
    // Arrivée par le tirage : la réservation se pose ici, maintenant que le
    // texte est à l'écran. Uniquement au montage : la navigation latérale
    // (texte suivant, précédent) ne réserve rien, et « Un autre Téhilim » pose
    // la sienne lui-même.
    if (isRandomDraw.value) pendingClaim = claimDrawnText();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll);
  stopOccasionsTicker();
  if (scrollSaveTimer !== null) {
    clearScrollSaveTimer();
    // Une capture était en attente : on fige la position avant de partir.
    capturePosition();
  }
});

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
  <main class="mx-auto px-6 py-12 max-w-3xl w-full">
    <button @click="exitReading" class="back-link mb-8">
      <AppIcon name="chevron-left" :size="14" />
      {{ sessionSlug ? t("textReading.backToSession") : t("textReading.back") }}
    </button>

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
      <header class="mb-8 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-primary uppercase tracking-wide mb-1">
            {{ textEntry.livre }}
          </p>
          <h1 class="text-3xl md:text-4xl font-bold text-text-primary">
            {{ appendHebrewNumeral(textEntry.name) }}
          </h1>
          <p v-if="currentSection && !isSingleSection" class="mt-2 text-text-secondary">
            {{ currentSection.label }}
          </p>
        </div>
        <!-- App native : télécharger le texte pour le lire sans connexion,
             faute de carte dans la bibliothèque d'où le faire (Sli'hot). -->
        <button
          v-if="isSlihot && bookState !== 'none'"
          @click="toggleDownload()"
          class="icon-btn flex-shrink-0"
          :class="bookState === 'downloaded' ? 'text-primary' : 'text-text-secondary'"
          :aria-label="bookState === 'downloaded' ? t('downloads.delete') : t('downloads.download')"
          :title="bookState === 'downloaded' ? t('downloads.delete') : t('downloads.download')"
        >
          <AppIcon
            v-if="bookState === 'downloading'"
            name="spinner"
            :size="20"
            class="animate-spin text-primary"
          />
          <AppIcon v-else-if="bookState === 'downloaded'" name="circle-check" :size="20" />
          <AppIcon v-else name="download" :size="20" />
        </button>
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
          <p class="text-sm text-text-secondary mt-0.5 truncate">{{ resumePlace }}</p>
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
        <ReadingNav
          v-if="prevText || nextText"
          :prev-label="prevText ? appendHebrewNumeral(prevText.name) : null"
          :next-label="nextText ? appendHebrewNumeral(nextText.name) : null"
          @prev="prevText && goToText(prevText)"
          @next="nextText && goToText(nextText)"
          class="mb-8"
        />
        <p class="text-sm text-text-secondary mb-4">
          {{ t("textReading.sectionsCount", { count: content.sections.length }) }}
        </p>
        <div class="space-y-2">
          <button
            v-for="section in content.sections"
            :key="section.index"
            @click="goToSection(section.index)"
            class="card card-hover w-full flex items-center justify-between gap-3 p-4 transition-all text-left group"
          >
            <span class="flex items-center gap-3 min-w-0">
              <span
                class="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm"
              >
                {{ section.index }}
              </span>
              <span
                class="font-medium text-text-primary truncate group-hover:text-primary transition-colors"
              >
                {{ section.label }}
              </span>
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
                :size="15"
                class="text-text-secondary/40 group-hover:text-primary transition-colors"
              />
            </span>
          </button>
        </div>
        <ReadingNav
          v-if="prevText || nextText"
          :prev-label="prevText ? appendHebrewNumeral(prevText.name) : null"
          :next-label="nextText ? appendHebrewNumeral(nextText.name) : null"
          @prev="prevText && goToText(prevText)"
          @next="nextText && goToText(nextText)"
          class="mt-10"
        />
      </div>

      <!-- Reading a passage -->
      <div v-else-if="currentSection">
        <!-- Sli'hot : la plage horaire où elles se disent, avant le texte. -->
        <SlihotHours v-if="isSlihot" />
        <!-- Reservation bar (session mode) -->
        <SessionReservationCard
          v-if="showReservationBar"
          class="mb-8"
          :session-slug="sessionSlug ?? ''"
          :session-name="session?.name ?? ''"
          :is-mine="isMine"
          :is-completed="currentReservation?.isCompleted ?? false"
          :is-reserved="reservedStatus.isReserved"
          :reserved-by="reservedByName"
          :is-reserving="isReserving"
          :is-guest="!currentUser"
          :guest-intro-text="guestIntroText"
          :guest-email-required="guestEmailRequired"
          :can-draw-another="isRandomDraw"
          :is-drawing="isDrawingAnother"
          v-model:reservation-form="reservationForm"
          @toggle-read="toggleRead"
          @cancel="cancelReservation"
          @reserve="reserve"
          @draw-another="drawAnother"
          @guest-first-input="trackGuestFormFilled"
        />

        <!-- Top navigation -->
        <ReadingNav
          v-if="!isSingleSection"
          :prev-label="hasPrev ? t('textReading.previous') : null"
          :next-label="hasNext ? t('textReading.next') : null"
          :middle-label="t('textReading.allSections')"
          @prev="prevSection"
          @next="nextSection"
          @middle="backToSectionList"
          class="mb-8"
        />
        <ReadingNav
          v-else-if="prevText || nextText"
          :prev-label="prevText ? appendHebrewNumeral(prevText.name) : null"
          :next-label="nextText ? appendHebrewNumeral(nextText.name) : null"
          @prev="prevText && goToText(prevText)"
          @next="nextText && goToText(nextText)"
          class="mb-8"
        />

        <!-- Reading toolbar: text size + Hebrew / phonetic toggle -->
        <div class="flex items-center justify-end gap-3 mb-5">
          <button
            v-if="bookmarks.length"
            @click="showBookmarksPanel = !showBookmarksPanel"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-sm font-medium transition-colors"
            :class="
              showBookmarksPanel ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
            "
            :title="t('textReading.bookmarks')"
          >
            <AppIcon name="bookmark" :size="14" />
            {{ bookmarks.length }}
          </button>
          <ReadingSizeControl />

          <div
            v-if="canTransliterate"
            class="inline-flex p-0.5 rounded-lg bg-black/5 dark:bg-white/10"
          >
            <button
              @click="showPhonetic = false"
              class="px-3 py-1 rounded-md text-sm font-medium transition-colors"
              :class="!showPhonetic ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary'"
            >
              {{ t("textReading.hebrew") }}
            </button>
            <button
              @click="showPhonetic = true"
              class="px-3 py-1 rounded-md text-sm font-medium transition-colors"
              :class="showPhonetic ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary'"
            >
              {{ t("textReading.phonetic") }}
            </button>
          </div>
        </div>

        <!-- Marque-pages du texte (ouvert depuis l'icône de la barre d'outils) -->
        <div v-if="showBookmarksPanel && bookmarks.length" class="mb-5 card p-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary px-1 mb-1.5">
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

        <!-- Talmud: continuous text with a marker at each daf change -->
        <div
          v-if="content.type === 'Talmud Bavli'"
          :style="{ '--reading-scale': readingSize.scale.value }"
        >
          <template v-for="(block, dafIndex) in currentSection.dafBlocks ?? []" :key="block.daf">
            <p
              :data-block-anchor="dafOffsets[dafIndex]?.offset"
              class="mt-6 mb-2 text-sm font-semibold text-primary"
            >
              Daf {{ block.daf }}
            </p>
            <p v-if="!showPhonetic" dir="rtl" class="font-hebrew text-text-primary reading-he">
              {{ block.lines.join(" ") }}
            </p>
            <p v-else dir="ltr" class="leading-relaxed italic text-text-secondary reading-tl">
              {{ phoneticByDaf.get(block.daf) }}
            </p>
          </template>
        </div>

        <!-- Tefila : paragraphes justifiés, didascalies traduites, ajouts du
             calendrier et encadrés des dix jours de pénitence. -->
        <LiturgyText
          v-else-if="isLiturgyText"
          :style="{ '--reading-scale': readingSize.scale.value }"
          :blocks="visibleBlocks"
          :show-phonetic="showPhonetic"
          :phonetic-lines="phoneticLines"
          :occasions="occasions"
          :recent-changes="recentChanges"
          :highlighted-line="highlightedLine"
          :selected-line="selectedLine"
          :is-bookmarked="isLineBookmarked"
          @select="onVerseClick"
          @toggle-bookmark="toggleBookmarkAt"
        />

        <!-- Verses / mishnayot (numbered for reference texts), grouped by
             chapter / montée with a marker at each block start -->
        <div v-else :style="{ '--reading-scale': readingSize.scale.value }">
          <template v-for="(block, blockIndex) in verseBlocks" :key="block.offset">
            <p
              v-if="block.label"
              :data-block-anchor="block.offset"
              :class="blockLabelClass(blockIndex)"
            >
              {{ block.label }}
            </p>
            <div class="space-y-6 mb-6">
              <template v-for="(line, index) in block.lines" :key="block.offset + index">
                <div
                  :data-line="block.offset + index"
                  @click="onVerseClick(block.offset + index)"
                  class="flex items-start gap-3 rounded-lg transition-colors duration-500 -mx-2 px-2"
                  :class="{
                    'bg-primary/10': highlightedLine === block.offset + index,
                    'bg-black/5 dark:bg-white/10':
                      selectedLine === block.offset + index &&
                      highlightedLine !== block.offset + index,
                  }"
                >
                  <span
                    v-if="showVerseNumbers || isLineBookmarked(block.offset + index)"
                    class="mt-2 flex-shrink-0 w-6 flex flex-col items-end gap-1 text-right text-xs text-primary font-semibold select-none"
                  >
                    <span v-if="showVerseNumbers">{{ index + 1 }}</span>
                    <AppIcon
                      v-if="isLineBookmarked(block.offset + index)"
                      name="bookmark"
                      :size="11"
                    />
                  </span>
                  <p
                    v-if="!showPhonetic"
                    dir="rtl"
                    class="flex-1 min-w-0 font-hebrew text-text-primary reading-he"
                  >
                    {{ line }}
                  </p>
                  <p
                    v-else
                    dir="ltr"
                    class="flex-1 min-w-0 leading-relaxed italic text-text-secondary reading-tl"
                  >
                    {{ phoneticLines[block.offset + index] }}
                  </p>
                </div>
                <!-- Verset sélectionné : proposer le marque-page -->
                <div v-if="selectedLine === block.offset + index" class="flex justify-end !mt-2">
                  <button
                    @click.stop="toggleBookmarkAt(block.offset + index)"
                    class="btn btn-soft !px-3 !py-1.5 text-sm"
                  >
                    <AppIcon name="bookmark" :size="13" />
                    {{
                      isLineBookmarked(block.offset + index)
                        ? t("textReading.bookmarkRemove")
                        : t("textReading.bookmarkAdd")
                    }}
                  </button>
                </div>
              </template>
            </div>
          </template>
        </div>

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
          :session-slug="sessionSlug ?? ''"
          :session-name="session?.name ?? ''"
          :is-mine="isMine"
          :is-completed="currentReservation?.isCompleted ?? false"
          :is-reserved="reservedStatus.isReserved"
          :reserved-by="reservedByName"
          :is-reserving="isReserving"
          :is-guest="!currentUser"
          :guest-intro-text="guestIntroText"
          :guest-email-required="guestEmailRequired"
          guest-form-id-prefix="guest-bottom"
          :can-draw-another="isRandomDraw"
          :is-drawing="isDrawingAnother"
          v-model:reservation-form="reservationForm"
          @toggle-read="toggleRead"
          @cancel="cancelReservation"
          @reserve="reserve"
          @draw-another="drawAnother"
          @guest-first-input="trackGuestFormFilled"
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
          <AppIcon
            name="chevron-right"
            :size="16"
            class="flex-shrink-0 text-text-secondary/50 group-hover:text-primary transition-colors rtl:rotate-180"
          />
        </RouterLink>

        <!-- Bottom navigation -->
        <ReadingNav
          v-if="!isSingleSection"
          :prev-label="hasPrev ? t('textReading.previous') : null"
          :next-label="hasNext ? t('textReading.next') : null"
          :middle-label="t('textReading.allSections')"
          @prev="prevSection"
          @next="nextSection"
          @middle="backToSectionList"
          class="mt-12"
        />
        <ReadingNav
          v-else-if="prevText || nextText"
          :prev-label="prevText ? appendHebrewNumeral(prevText.name) : null"
          :next-label="nextText ? appendHebrewNumeral(nextText.name) : null"
          @prev="prevText && goToText(prevText)"
          @next="nextText && goToText(nextText)"
          class="mt-12"
        />
      </div>

      <!-- Internal links (public /bibliotheque reading pages only). Pas sous un
           texte de tefila : on y vient prier, pas naviguer. -->
      <section v-if="isEtudeRoute && !isLiturgyText" class="mt-14 text-sm text-text-secondary">
        <nav class="flex flex-wrap gap-x-5 gap-y-2">
          <RouterLink to="/bibliotheque" class="hover:text-primary transition-colors"
            >Bibliothèque</RouterLink
          >
          <RouterLink
            v-if="isTehilimEtude"
            to="/tehilim"
            class="hover:text-primary transition-colors"
            >Tehilim par intention</RouterLink
          >
          <RouterLink
            :to="localePath('partageTehilim')"
            class="hover:text-primary transition-colors"
            >Partage de Tehilim</RouterLink
          >
        </nav>
      </section>
    </template>

    <!-- Tous les textes de la bibliothèque : le menu de lecture remplace le
         bouton de remontée, et la progression court au bas de l'écran. Le
         menu reprend la bascule hébreu / phonétique de la barre d'outils et,
         dans l'app native, le téléchargement du texte. -->
    <template v-if="content && currentSection">
      <ReadingMenu
        :sections="navSections"
        :phonetic="canTransliterate ? showPhonetic : null"
        :download-state="bookState"
        @update:phonetic="showPhonetic = $event"
        @download="toggleDownload()"
      />
      <ReadingProgressBar />
    </template>
  </main>
</template>

<style scoped>
/* Reader text sizes follow the A− / A+ control (useReadingSize).
   L'interligne de l'hébreu est volontairement plus serré que leading-loose :
   assez d'air pour les voyelles et les teamim, sans étirer la lecture. */
.reading-he {
  font-size: calc(1.5rem * var(--reading-scale, 1));
  line-height: 1.7;
}
.reading-tl {
  font-size: calc(1.125rem * var(--reading-scale, 1));
}
</style>
