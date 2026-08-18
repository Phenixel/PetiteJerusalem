<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
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
import { activeOccasions } from "../../services/dailyCycles";
import { hebrewDateFor } from "../../services/zmanimService";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { scrollToVerse } from "../../composables/scrollAnchor";
import { resolveBackNavigation, stripQuery } from "../../composables/readingBack";
import { transliterate, hasNiqqud } from "../../services/hebrewTransliteration";
import { appendHebrewNumeral } from "../../services/hebrewNumerals";
import { sessionService } from "../../services/sessionService";
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
  READING_LEAD,
  readingLead as readingLeadOf,
  SITE_URL,
} from "../../content/etudeTexts";
import GuestForm from "../../components/GuestForm.vue";
import ReadingNav from "../../components/ReadingNav.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import { useToast } from "../../composables/useToast";
import { useReadingSize } from "../../composables/useReadingSize";
import { readingProgressService, bookmarkId } from "../../services/readingProgressService";
import type { Bookmark, ReadingPosition } from "../../services/readingProgressService";
import { isNativeApp } from "../../composables/useNativeApp";
import { analyticsService } from "../../services/analyticsService";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const toast = useToast();
const readingSize = useReadingSize();
// Lieu des horaires : donne le jour hébraïque (sensible à la chkia) qui
// conditionne les ajouts de calendrier des textes de tefila.
const { place: zmanimPlace } = useZmanimLocation();

// This view serves two URL shapes with the SAME UI: the in-session reader
// (/lire/:textId, numeric id) and the public, indexable reading pages
// (/bibliotheque/:corpus/:slug[/:section], keyword URLs). `isEtudeRoute` switches
// navigation + metadata between the two.
const isEtudeRoute = computed(() => route.params.corpus !== undefined);
/** Corpus ayant leur page de bibliothèque (route `study-corpus`). Pas les
 * Sli'hot : leur unique texte EST la page du corpus (redirection), le retour
 * ramène donc à l'accueil de la bibliothèque. */
const LIBRARY_CORPORA = new Set(["tehilim", "michna", "talmud", "tanakh", "brahot"]);
const etudeEntry = computed<TextStudyJsonEntry | null>(() =>
  isEtudeRoute.value
    ? entryByCorpusSlug(String(route.params.corpus), String(route.params.slug))
    : null,
);

const textId = computed(() =>
  isEtudeRoute.value ? String(etudeEntry.value?.id ?? "") : String(route.params.textId),
);
const sectionParam = computed(() => (route.params.section ? Number(route.params.section) : undefined));
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
// disent — dans une carte, pour les distinguer du fil du texte. Le jour
// hébraïque suit le lieu des horaires (après la chkia, on est déjà demain).
const occasions = computed(() =>
  activeOccasions(
    hebrewDateFor(zmanimPlace.value, new Date()),
    zmanimPlace.value.tzid === "Asia/Jerusalem",
  ),
);
const visibleBlocks = computed(() =>
  verseBlocks.value.filter((b) => !b.when || occasions.value.has(b.when)),
);

/** Style du titre d'un bloc : carte d'ajout du calendrier, ou séparation du
    fil du texte (sans filet au-dessus du tout premier bloc). */
function blockLabelClass(block: TextBlock, index: number): string {
  if (block.when) return "mb-4 flex items-center gap-2 text-sm font-semibold text-primary";
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

const canTransliterate = computed(() => currentSection.value?.he.some((line) => hasNiqqud(line)) ?? false);

// Translittération mémoïsée : appelée depuis le template, elle était recalculée
// pour toute la section (des dizaines de lignes × plusieurs passes regex) à
// CHAQUE re-rendu de la page — y compris ceux qui n'ont rien à voir (tick du
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

async function loadContent() {
  if (!textEntry.value) return;
  // Usage de la bibliothèque vs lecture dans le cadre d'une chaîne.
  analyticsService.capture("text_opened", {
    text_id: textEntry.value.id,
    corpus: textEntry.value.type,
    book: textEntry.value.livre,
    source: sessionSlug.value ? "session" : "library",
  });
  loading.value = true;
  error.value = false;
  missingFile.value = false;
  content.value = null;
  try {
    content.value = await loadText(textEntry.value);
  } catch (e) {
    if (e instanceof MissingTextFileError) missingFile.value = true;
    else error.value = true;
  } finally {
    loading.value = false;
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
      : { name: "text-reading-section", params: { textId: textId.value, section: index }, query: route.query };
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
 * revenir en arrière sur le chapitre qu'on venait de quitter — chapitre →
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
  // than the previously read chapter — readers paging through next/previous
  // expect to land back on the list to pick another passage.
  if (!isSingleSection.value && sectionParam.value !== undefined) {
    backToSectionList();
    return;
  }
  // Sur la liste des chapitres, « Retour » quitte le texte : on rend la main à
  // l'écran d'où vient le lecteur, sauf s'il s'agit d'un chapitre de ce même
  // texte (lien direct vers un chapitre) — on remonte alors à la bibliothèque.
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
  // étiez » — une brakha ou les Sli'hot se lisent du début, pas en cours.
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
watch(
  [content, sectionParam, () => route.query.verset],
  ([loaded, , verset]) => {
    if (!loaded || verset === undefined) return;
    const line = Number(verset);
    if (Number.isInteger(line) && line >= 0) scrollToLine(line);
  },
);

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
// AUTRE chapitre n'est pas écrasée à la simple ouverture — jeter « chapitre 3,
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

const isSessionMode = computed(() => sessionSlug.value !== null && session.value !== null);

// Reservation unit: the current chapter, or 1 for a single-section text.
const reservationUnit = computed(() => (isSingleSection.value ? 1 : sectionParam.value));

const showReservationBar = computed(() => isSessionMode.value && reservationUnit.value !== undefined);

function findReservation(unit: number | undefined): TextStudyReservation | null {
  if (!session.value || unit === undefined) return null;
  return (
    session.value.reservations.find((r) => r.textStudyId === textId.value && r.section === unit) ?? null
  );
}

const currentReservation = computed(() => findReservation(reservationUnit.value));

const reservedStatus = computed(() => {
  if (!session.value || reservationUnit.value === undefined) return { isReserved: false } as const;
  return sessionService.isTextOrSectionReserved(textId.value, reservationUnit.value, session.value);
});

const isMine = computed(() => {
  const r = currentReservation.value;
  return !!r && sessionService.canUserDeleteReservation(r, currentUser.value, reservationForm.value.email);
});

// Entrée du funnel de réservation : le lecteur atteint une section libre et la
// barre de réservation s'affiche. C'était le pas manquant entre session_viewed
// et reservation_confirm_clicked — le trou de conversion à mesurer est là,
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
  if (!confirm(t("textReading.cancelConfirm"))) return;
  isReserving.value = true;
  try {
    await sessionService.deleteReservation(session.value.id, r.id);
    session.value.reservations = session.value.reservations.filter((x) => x.id !== r.id);
    analyticsService.capture("reservation_cancelled", {
      session_id: session.value.id,
      is_guest: currentUser.value == null,
      source: "reading_page",
    });
  } catch (e) {
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
    session.value.reservations = [...session.value.reservations];
    analyticsService.capture("section_marked_read", {
      session_id: session.value.id,
      marked: next,
      is_guest: currentUser.value == null,
      source: "reading_page",
    });
  } catch (e) {
    toast.errorFromException(e, t("textReading.updateError"));
  } finally {
    isReserving.value = false;
  }
}

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
  const sec = currentSection.value && !isSingleSection.value ? ` · ${currentSection.value.label}` : "";
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

  await loadContent();
  if (sessionSlug.value) {
    currentUser.value = await sessionService.getCurrentUser();
    session.value = await sessionService.resolveSession(sessionSlug.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll);
  if (scrollSaveTimer !== null) {
    clearScrollSaveTimer();
    // Une capture était en attente : on fige la position avant de partir.
    capturePosition();
  }
});

watch(textId, () => {
  // Une capture armée par un scroll dans l'ANCIEN texte ne doit pas
  // s'exécuter sur le nouveau (elle écraserait sa position par la ligne 0).
  clearScrollSaveTimer();
  sessionSaved = false;
  userNavigated = false;
  refreshProgressState();
  void loadContent();
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
      <header class="mb-8">
        <p class="text-sm font-semibold text-primary uppercase tracking-wide mb-1">
          {{ textEntry.livre }}
        </p>
        <h1 class="text-3xl md:text-4xl font-bold text-text-primary">
          {{ appendHebrewNumeral(textEntry.name) }}
        </h1>
        <p
          v-if="currentSection && !isSingleSection"
          class="mt-2 text-text-secondary"
        >
          {{ currentSection.label }}
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
              <span class="font-medium text-text-primary truncate group-hover:text-primary transition-colors">
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
        <!-- Reservation bar (session mode) -->
        <div v-if="showReservationBar" class="mb-8 p-4 card">
          <!-- Current session -->
          <router-link
            :to="`/share-reading/session/${sessionSlug}`"
            class="flex items-center gap-2 mb-3 text-sm font-semibold text-text-primary hover:text-primary transition-colors"
          >
            <AppIcon name="users" :size="16" class="text-primary flex-shrink-0" />
            <span class="truncate">{{ session?.name }}</span>
          </router-link>

          <!-- Reserved by me -->
          <div v-if="isMine" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span
              class="chip !text-sm w-fit"
              :class="
                currentReservation?.isCompleted
                  ? 'bg-green-600/10 text-green-700 dark:text-green-300'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-200'
              "
            >
              <AppIcon
                :name="currentReservation?.isCompleted ? 'circle-check' : 'user-clock'"
                :size="14"
              />
              {{
                currentReservation?.isCompleted
                  ? t("textReading.readByYou")
                  : t("textReading.reservedByYou")
              }}
            </span>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                @click="toggleRead"
                :disabled="isReserving"
                class="btn !px-3 !py-1.5 text-sm"
                :class="
                  currentReservation?.isCompleted
                    ? 'btn-soft'
                    : 'bg-green-600/10 text-green-700 hover:bg-green-600/20 dark:text-green-300'
                "
              >
                <AppIcon name="check" :size="13" />
                {{ currentReservation?.isCompleted ? t("textReading.unmarkRead") : t("textReading.markRead") }}
              </button>
              <button
                @click="cancelReservation"
                :disabled="isReserving"
                class="icon-btn hover:!text-red-600 disabled:opacity-50"
                :title="t('textReading.cancel')"
              >
                <AppIcon name="x" :size="16" />
              </button>
            </div>
          </div>

          <!-- Reserved by someone else -->
          <div v-else-if="reservedStatus.isReserved" class="flex items-center gap-2">
            <span
              class="chip !text-sm w-fit"
              :class="
                currentReservation?.isCompleted
                  ? 'bg-green-600/10 text-green-700 dark:text-green-300'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-200'
              "
            >
              <AppIcon
                :name="currentReservation?.isCompleted ? 'circle-check' : 'user'"
                :size="14"
              />
              {{
                currentReservation?.isCompleted
                  ? t("textReading.readBy", { name: reservedStatus.reservedBy || t("textReading.someone") })
                  : t("textReading.reservedBy", { name: reservedStatus.reservedBy || t("textReading.someone") })
              }}
            </span>
          </div>

          <!-- Available -->
          <div v-else>
            <div v-if="!currentUser" class="mb-4">
              <p class="text-sm text-text-secondary mb-3">
                {{ guestIntroText }}
              </p>
              <GuestForm
                v-model:reservation-form="reservationForm"
                :email-required="guestEmailRequired"
                @first-input="trackGuestFormFilled"
              />
            </div>
            <button @click="reserve" :disabled="isReserving" class="btn btn-primary text-sm">
              <AppIcon name="bookmark" :size="13" />
              {{ t("textReading.reserve") }}
            </button>
          </div>
        </div>

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
            :class="showBookmarksPanel ? 'text-primary' : 'text-text-secondary hover:text-text-primary'"
            :title="t('textReading.bookmarks')"
          >
            <AppIcon name="bookmark" :size="14" />
            {{ bookmarks.length }}
          </button>
          <div
            class="inline-flex items-center rounded-lg bg-black/5 dark:bg-white/10"
            role="group"
            :aria-label="t('textReading.textSize')"
          >
            <button
              @click="readingSize.decrease()"
              :disabled="!readingSize.canDecrease.value"
              class="px-3 py-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-35"
              :aria-label="t('textReading.textSizeDecrease')"
              :title="t('textReading.textSizeDecrease')"
            >
              A−
            </button>
            <button
              @click="readingSize.increase()"
              :disabled="!readingSize.canIncrease.value"
              class="px-3 py-1.5 text-base font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-35"
              :aria-label="t('textReading.textSizeIncrease')"
              :title="t('textReading.textSizeIncrease')"
            >
              A+
            </button>
          </div>

          <div v-if="canTransliterate" class="inline-flex p-0.5 rounded-lg bg-black/5 dark:bg-white/10">
            <button
              @click="showPhonetic = false"
              class="px-3 py-1 rounded-md text-sm font-medium transition-colors"
              :class="
                !showPhonetic
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-text-secondary'
              "
            >
              {{ t("textReading.hebrew") }}
            </button>
            <button
              @click="showPhonetic = true"
              class="px-3 py-1 rounded-md text-sm font-medium transition-colors"
              :class="
                showPhonetic
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-text-secondary'
              "
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

        <!-- Talmud: continuous text with a marker at each daf change -->
        <div
          v-if="content.type === 'Talmud Bavli'"
          :style="{ '--reading-scale': readingSize.scale.value }"
        >
          <template v-for="block in currentSection.dafBlocks ?? []" :key="block.daf">
            <p class="mt-6 mb-2 text-sm font-semibold text-primary">Daf {{ block.daf }}</p>
            <p
              v-if="!showPhonetic"
              dir="rtl"
              class="font-hebrew leading-loose text-text-primary reading-he"
            >
              {{ block.lines.join(" ") }}
            </p>
            <p v-else dir="ltr" class="leading-relaxed italic text-text-secondary reading-tl">
              {{ phoneticByDaf.get(block.daf) }}
            </p>
          </template>
        </div>

        <!-- Verses / mishnayot (numbered for reference texts), grouped by
             chapter / montée with a marker at each block start -->
        <div v-else :style="{ '--reading-scale': readingSize.scale.value }">
          <template v-for="(block, blockIndex) in visibleBlocks" :key="block.offset">
            <!-- Ajout du calendrier (`when`) : une carte, affichée seulement le
                 jour où il se dit (voir visibleBlocks). -->
            <div :class="block.when ? 'card p-5 mb-6 border-s-4 border-primary/50' : undefined">
              <p v-if="block.label" :class="blockLabelClass(block, blockIndex)">
                <AppIcon v-if="block.when" name="calendar" :size="14" />
                {{ block.label }}
              </p>
              <div class="space-y-6" :class="block.when ? undefined : 'mb-6'">
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
                    class="flex-1 min-w-0 font-hebrew leading-loose text-text-primary reading-he"
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
                <div
                  v-if="selectedLine === block.offset + index"
                  class="flex justify-end !mt-2"
                >
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
            </div>
          </template>
        </div>

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

      <!-- Internal links (public /bibliotheque reading pages only) -->
      <section
        v-if="isEtudeRoute"
        class="mt-14 text-sm text-text-secondary"
      >
        <nav class="flex flex-wrap gap-x-5 gap-y-2">
          <RouterLink to="/bibliotheque" class="hover:text-primary transition-colors">Bibliothèque</RouterLink>
          <RouterLink
            v-if="isTehilimEtude"
            to="/tehilim"
            class="hover:text-primary transition-colors"
            >Tehilim par intention</RouterLink
          >
          <RouterLink to="/partage-tehilim" class="hover:text-primary transition-colors"
            >Partage de Tehilim</RouterLink
          >
        </nav>
      </section>
    </template>
  </main>
</template>

<style scoped>
/* Reader text sizes follow the A− / A+ control (useReadingSize). */
.reading-he {
  font-size: calc(1.5rem * var(--reading-scale, 1));
}
.reading-tl {
  font-size: calc(1.125rem * var(--reading-scale, 1));
}
</style>
