<script setup lang="ts">
import { ref, computed, defineAsyncComponent, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { localeMessagesReady } from "../i18n";
import { bookName } from "../services/catalogSearch";
import { pageTitle, seoService } from "../services/seoService";
import { appendHebrewNumeral } from "../services/hebrewNumerals";
import {
  hubPath,
  corpusTitle,
  corpusDescription,
  latinName,
  LISTED_CORPORA,
  HALAKHA_WORKS,
  halakhaWorkOfLivre,
  isHalakhaWork,
  type HalakhaWork,
  type ListedCorpus,
} from "../content/etudeTexts";
import { isNativeApp } from "../composables/useNativeApp";
import PageTabs from "../components/PageTabs.vue";
import { STUDY_TABS } from "../config/pageTabs";
import {
  downloadableBooksOfCorpus,
  downloadingPaths,
  formatDownloadSize,
  isBookBundled,
  isBookDownloaded,
  missingBooksOfCorpus,
  offlineBooks,
  offlineCorpora,
  removeBooks,
  totalDownloadedSize,
  type OfflineBook,
} from "../services/offlineLibraryService";
import { ensureManifestLoaded } from "../services/offlineTextStore";
import { readingProgressService, type ReadingPosition } from "../services/readingProgressService";
import { useToast } from "../composables/useToast";
import { useConfirm } from "../composables/useConfirm";
import { useSearchMode } from "../composables/useSearchMode";
import { requestScrollToTop } from "../composables/useScrollToTop";
import { useFoldedBooks } from "../composables/useFoldedBooks";
import { useCatalogSearch } from "../composables/useCatalogSearch";
import { useSearchTracking } from "../composables/useSearchTracking";
import { markReadingEntry } from "../services/readingEntry";
import { useBookDownload, type BookState } from "../composables/useBookDownload";
import { analyticsService } from "../services/analyticsService";
import AppIcon from "../components/icons/AppIcon.vue";
import AccountCta from "../components/AccountCta.vue";
import LibraryOfflineRow from "../components/LibraryOfflineRow.vue";
import LibraryShelf, { type ShelfBook } from "../components/LibraryShelf.vue";
import CollapseTransition from "../components/CollapseTransition.vue";
import CatalogSearchField from "../components/CatalogSearchField.vue";
import { SITE_URL } from "../config/site";

// L'encart du chnei mikra n'existe que sur le Tanakh, et il tire le calendrier
// hébraïque (hebcal) avec lui : chargé à la demande, la bibliothèque et ses
// trois autres corpus n'en portent rien. Même logique pour les psaumes du
// jour, qui coiffent les Tehilim.
const ChneiMikraBanner = defineAsyncComponent(() => import("../components/ChneiMikraBanner.vue"));
const TehilimDayBanner = defineAsyncComponent(() => import("../components/TehilimDayBanner.vue"));
// « Aujourd'hui » (psaumes du jour, chnei mikra, lecture du jour) tire le
// calendrier hébraïque, lui aussi : chargé à la demande.
const StudyToday = defineAsyncComponent(() => import("../components/StudyToday.vue"));
// Ce qu'on dit avant de lire des Tehilim et après : les textes et leur rendu
// liturgique pèsent, et ne servent qu'à ce livre.
const BookEncadrement = defineAsyncComponent(() => import("../components/BookEncadrement.vue"));

const { t, locale } = useI18n();
const toast = useToast();
const { confirm } = useConfirm();
const route = useRoute();

// App native : état de téléchargement affiché sur chaque carte de la
// bibliothèque. Une Map calculée une fois par changement de l'index des
// téléchargements : le patron lisait l'état six fois par carte, sur cent
// cinquante cartes, à chaque rendu.
const { bookStateOf, toggleDownload, downloadAll } = useBookDownload();
const bookStates = computed(() => {
  const states = new Map<string, BookState>();
  if (!isNativeApp) return states;
  for (const text of allTexts) states.set(String(text.id), bookStateOf(text));
  return states;
});
const bookState = (text: TextStudyJsonEntry): BookState =>
  bookStates.value.get(String(text.id)) ?? "none";

// La bibliothèque est un tableau de bord : l'accueil ne montre que les grandes
// sections (corpus) ; la liste détaillée des textes vit sur /bibliotheque/:corpus.
// Six corpus d'étude, sur une étagère (trois volumes par planche, voir
// LibraryShelf). La liturgie (Sidour, Moadim, Brahot) a sa page, le Sidour :
// elle ne vit plus ici (voir SidourPage).
const CORPUS_META: {
  corpus: string;
  typeKey: string;
  labelKey: string;
  descKey: string;
  searchKey: string;
}[] = [
  {
    corpus: "tehilim",
    typeKey: "Tehilim",
    labelKey: "study.types.tehilim",
    descKey: "study.corpus.tehilimDesc",
    searchKey: "study.corpus.tehilimSearch",
  },
  {
    corpus: "michna",
    typeKey: "Mishna",
    labelKey: "study.types.mishna",
    descKey: "study.corpus.michnaDesc",
    searchKey: "study.corpus.michnaSearch",
  },
  {
    corpus: "talmud",
    typeKey: "Talmud Bavli",
    labelKey: "study.types.talmud",
    descKey: "study.corpus.talmudDesc",
    searchKey: "study.corpus.talmudSearch",
  },
  {
    corpus: "tanakh",
    typeKey: "Tanakh",
    labelKey: "study.types.tanakh",
    descKey: "study.corpus.tanakhDesc",
    searchKey: "study.corpus.tanakhSearch",
  },
  // Moussar : un rayon d'étude ('Hovot Halévavot, Pélé Yoets), qu'on ne
  // propose pas au partage de lecture pour autant (voir isShareable).
  {
    corpus: "moussar",
    typeKey: "Moussar",
    labelKey: "study.types.moussar",
    descKey: "study.corpus.moussarDesc",
    searchKey: "study.corpus.moussarSearch",
  },
  // Halakha : le Choulhan Aroukh et ses commentaires, le Kitsour. Un rayon
  // d'étude, sans partage de lecture, comme le moussar.
  {
    corpus: "halakha",
    typeKey: "Halakha",
    labelKey: "study.types.halakha",
    descKey: "study.corpus.halakhaDesc",
    searchKey: "study.corpus.halakhaSearch",
  },
];

/**
 * Les types de la liturgie, que la recherche de l'accueil parcourt aussi :
 * qui tape « Birkat Hamazon » dans l'étude ne doit pas repartir bredouille.
 * Leurs résultats se rangent à part, « Dans le Sidour », et mènent au texte.
 */
const LITURGY_TYPES = [
  { key: "Sidour", labelKey: "study.types.sidour" },
  { key: "Brahot", labelKey: "study.types.brahot" },
  { key: "Moadim", labelKey: "study.types.moadim" },
];
const LITURGY_TYPE_KEYS = new Set(LITURGY_TYPES.map((type) => type.key));

/** Le nom hébreu d'un texte du catalogue : « ברכת המזון (Birkat Hamazon) » → « ברכת המזון ». */
const hebrewOf = (text: TextStudyJsonEntry) => text.name.replace(/\s*\([^)]*\)\s*$/, "").trim();

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;

// Corpus courant, piloté par la route (/bibliotheque = accueil, sans corpus).
const currentCorpus = computed(
  () => CORPUS_META.find((c) => c.corpus === String(route.params.corpus ?? "")) ?? null,
);

// --- Les livres de la halakha ---
// Le rayon compte plus de cent cinquante groupes de lois : sa page montre
// d'abord ses livres, une carte chacun, et la liste d'un livre s'ouvre à
// part (/bibliotheque/halakha?livre=kitsour), rangée par parties comme les
// autres. Une recherche, elle, parcourt tout le rayon.
const HALAKHA_WORK_META: Record<HalakhaWork, { nameKey: string; descKey: string; hebrew: string }> =
  {
    "choulhan-aroukh": {
      nameKey: "study.halakhaWorks.choulhanAroukh.name",
      descKey: "study.halakhaWorks.choulhanAroukh.desc",
      hebrew: "שולחן ערוך",
    },
    kitsour: {
      nameKey: "study.halakhaWorks.kitsour.name",
      descKey: "study.halakhaWorks.kitsour.desc",
      hebrew: "קיצור שולחן ערוך",
    },
  };

/** Le livre de halakha ouvert, ou null (la page des livres, ou un autre rayon). */
const halakhaWork = computed<HalakhaWork | null>(() =>
  currentCorpus.value?.corpus === "halakha" && isHalakhaWork(route.query.livre)
    ? route.query.livre
    : null,
);

const halakhaWorks = computed(() =>
  HALAKHA_WORKS.map((work) => {
    const texts = allTexts.filter(
      (text) => text.type === "Halakha" && halakhaWorkOfLivre(text.livre) === work,
    );
    const simanim = texts.reduce((sum, text) => sum + (text.totalSections ?? 1), 0);
    return {
      work,
      hebrew: HALAKHA_WORK_META[work].hebrew,
      name: t(HALAKHA_WORK_META[work].nameKey),
      count: t("study.halakhaWorks.simanim", { n: simanim.toLocaleString(locale.value) }),
    };
  }),
);

/**
 * Le titre d'un livre dans la liste d'un livre de halakha : sa partie seule
 * (« Ora'h Hayim »), le livre étant déjà le titre de la page ; rien quand la
 * partie est le livre entier (le Kitsour).
 */
function halakhaGroupHeading(livre: string): string | null {
  const name = formatBookName(livre).replace(/^Choulhan Aroukh,\s*/, "");
  return name === formatBookName(livre) && halakhaWorkOfLivre(livre) === "kitsour" ? null : name;
}

// L'étagère : un livre par grande section, titre sur la couverture. Dans
// l'app, chaque livre dit dans son angle s'il est sur le téléphone : la part
// de ses livres téléchargés (les Tehilim, embarqués, le sont toujours).
function offlineShare(typeKey: string): number {
  const corpus = offlineCorpora.find((c) => c.key === typeKey);
  if (!corpus) return 0;
  const downloadable = downloadableBooksOfCorpus(corpus).length;
  if (downloadable === 0) return 1;
  return 1 - missingBooksOfCorpus(corpus).length / downloadable;
}
const shelfBooks = computed<ShelfBook[]>(() =>
  CORPUS_META.map((c) => {
    const label = t(c.labelKey);
    if (!isNativeApp) return { corpus: c.corpus, to: `/bibliotheque/${c.corpus}`, label };
    const offline = offlineShare(c.typeKey);
    const ariaLabel =
      offline >= 0.999
        ? t("study.offline.bookDone", { book: label })
        : offline > 0.001
          ? t("study.offline.bookPartial", { book: label })
          : label;
    return { corpus: c.corpus, to: `/bibliotheque/${c.corpus}`, label, offline, ariaLabel };
  }),
);

// Les livres de l'étude qui se téléchargent, pour la ligne « Hors ligne ».
const STUDY_TYPE_KEYS = new Set(CORPUS_META.map((c) => c.typeKey));
const studyOfflineBooks = computed(() =>
  isNativeApp
    ? offlineBooks.filter((book) => STUDY_TYPE_KEYS.has(book.corpus) && !isBookBundled(book))
    : [],
);
// Les textes du Sidour n'ont plus de page de livre où se supprimer : la
// corbeille de l'étude libère aussi ceux qui sont sur le téléphone.
const liturgyOfflineBooks = computed(() =>
  isNativeApp ? offlineBooks.filter((book) => !STUDY_TYPE_KEYS.has(book.corpus)) : [],
);

// La recherche de l'accueil couvre toute la bibliothèque, celle d'une page
// corpus reste dans le corpus : le placeholder le dit explicitement.
const searchPlaceholder = computed(() =>
  currentCorpus.value ? t(currentCorpus.value.searchKey) : t("study.searchAllPlaceholder"),
);

// La recherche du catalogue, la même que dans la lecture du jour (nom hébreu,
// nom latin, livre ; filtre différé de 150 ms) : voir useCatalogSearch. La
// recherche de l'accueil couvre toute la bibliothèque, celle d'un corpus reste
// dans le corpus.
const {
  term: searchTerm,
  debouncedTerm,
  hasSearch,
  filtered: searchResults,
  groupedByType,
  hasResults,
  reset: resetSearch,
} = useCatalogSearch(
  allTexts,
  [...CORPUS_META.map((c) => ({ key: c.typeKey, labelKey: c.labelKey })), ...LITURGY_TYPES],
  () => currentCorpus.value?.typeKey ?? null,
);

// Les résultats de l'étude, par corpus puis par livre ; ceux de la liturgie
// en une liste, sous « Dans le Sidour ».
const studyResultGroups = computed(() =>
  groupedByType.value
    .filter((group) => !LITURGY_TYPE_KEYS.has(group.key))
    .map((group) => {
      // Un livre de halakha ouvert : ses parties seules.
      const work = halakhaWork.value;
      if (!work) return group;
      const groups = Object.fromEntries(
        Object.entries(group.groups).filter(([livre]) => halakhaWorkOfLivre(livre) === work),
      ) as typeof group.groups;
      return { ...group, groups };
    }),
);
const sidourResults = computed(() =>
  groupedByType.value
    .filter((group) => LITURGY_TYPE_KEYS.has(group.key))
    .flatMap((group) => Object.values(group.groups).flat()),
);

// Recherche en cours : l'écran se replie autour de la barre et des résultats.
const { searching } = useSearchMode(searchTerm);

watch(searchTerm, (value) => {
  if (value.trim()) trackLibrarySearchUsed();
});

// The library home page lists its results only while searching: the
// back-to-top button comes with them (a section's page has it anyway).
requestScrollToTop(() => searchTerm.value.trim() !== "");

// Changer de page remet la recherche à zéro.
watch(currentCorpus, () => {
  resetSearch();
  hasTrackedSearch = false;
  trackLibraryViewed();
});

// --- Les sefarim des Tehilim, repliables ---
// Les cent cinquante psaumes font une longue page : le titre d'un sefer la
// replie d'un appui, avec la plage de psaumes qu'il couvre pour savoir ce qu'on
// vient de ranger. Tout reste déplié au départ : on vient chercher un psaume,
// il doit être là sans un geste de plus.
// Les autres corpus n'ont pas de titre à replier : leurs livres sont courts, ou
// déjà une page à eux (un traité, une paracha). Une recherche, elle, montre ce
// qu'elle a trouvé : rien ne s'y replie.
const { isBookOpen, toggleBook } = useFoldedBooks();

const foldableBooks = computed(() => currentCorpus.value?.corpus === "tehilim" && !hasSearch.value);

function isGroupOpen(livre: string): boolean {
  if (!foldableBooks.value) return true;
  return isBookOpen(currentCorpus.value?.corpus ?? "", livre);
}

function toggleGroup(livre: string) {
  const corpus = currentCorpus.value?.corpus;
  if (!corpus) return;
  toggleBook(corpus, livre);
  analyticsService.capture("library_book_toggled", {
    corpus,
    open: isBookOpen(corpus, livre),
  });
}

/** Le numéro écrit à la fin d'un nom (« Tehilim 41 » : 41), s'il y en a un. */
function trailingNumber(name: string): number | null {
  const match = /(\d+)\s*$/.exec(name);
  return match ? Number(match[1]) : null;
}

/**
 * Ce qu'un sefer annonce de son contenu : la plage de psaumes qu'il couvre
 * (« 1 à 41 »), qui dit ce qu'on replie, et ce qu'on retrouve en le rouvrant.
 * Les textes qui ne portent pas de numéro se contentent de leur nombre.
 */
function groupHint(texts: TextStudyJsonEntry[]): string {
  const from = trailingNumber(texts[0]?.name ?? "");
  const to = trailingNumber(texts[texts.length - 1]?.name ?? "");
  if (from !== null && to !== null && from !== to) return t("study.range", { from, to });
  return t("study.textsCount", { count: texts.length }, texts.length);
}

// Un livre consulté en entier : c'est là que se posent ses encarts. Ils
// s'effacent pendant une recherche, qui vise un texte, pas le livre.
const browsingBook = (corpus: string) =>
  currentCorpus.value?.corpus === corpus && !hasSearch.value && !searching.value;

// Le chnei mikra coiffe le Tanakh : c'est là qu'on vient chercher la paracha
// de la semaine.
const showChneiMikra = computed(() => browsingBook("tanakh"));

// Les psaumes du jour (cycle mensuel) coiffent les Tehilim, de la même façon.
const showTehilimDay = computed(() => browsingBook("tehilim"));

// Le Yehi ratson des Tehilim se dit à l'ouverture du livre, une fois pour les
// psaumes qu'on va y lire : sa place est ici, pas sur chacun des cent
// cinquante (voir EncadrementPlace).
const showBookEncadrement = computed(() => browsingBook("tehilim"));

// La liste détaillée s'affiche sur une page corpus, ou dès qu'on cherche
// depuis l'accueil (la recherche reste la porte d'entrée la plus rapide).
const showList = computed(() => currentCorpus.value !== null || hasSearch.value);

// La page de la halakha, sans livre ouvert ni recherche : les cartes des livres.
const showHalakhaWorks = computed(
  () => currentCorpus.value?.corpus === "halakha" && !halakhaWork.value && !hasSearch.value,
);

// --- La reprise de lecture, en tête de la bibliothèque. ---
// Dernière position de lecture : le vrai « Reprendre ma lecture ».
const lastReading = ref<ReadingPosition | null>(null);
const resumeLink = computed(() =>
  lastReading.value
    ? { path: lastReading.value.path, query: { verset: String(lastReading.value.line) } }
    : null,
);

function trackResume() {
  if (!lastReading.value) return;
  markReadingEntry("resume");
  analyticsService.capture("reading_resumed", {
    text_id: lastReading.value.textId,
    source: "library",
  });
}

// Lecture terminée (ou abandonnée) : la croix retire la position pour ne plus
// la proposer, et la ligne s'en va. Une lecture plus ancienne ne prend pas le
// relais : la bibliothèque ne propose que la dernière.
function dismissResume() {
  const current = lastReading.value;
  if (!current) return;
  readingProgressService.dismissResume(current.textId);
  lastReading.value = null;
  analyticsService.capture("reading_resume_dismissed", {
    text_id: current.textId,
    source: "library",
  });
}

function trackCorpusOpened(corpus: string) {
  analyticsService.capture("library_corpus_opened", { corpus });
}

/**
 * Arrivée sur la bibliothèque, accueil comme page de corpus. Attendu par le
 * dashboard « Bibliothèque (tableau de bord) » depuis le 11 août, jamais posé :
 * la tuile d'arrivées y est vide, et l'entrée par un corpus
 * (`library_corpus_opened`) n'a donc aucun dénominateur.
 */
function trackLibraryViewed() {
  const corpus = currentCorpus.value?.corpus ?? null;
  analyticsService.capture("library_viewed", {
    // `variant` est la propriété que les tuiles ventilent déjà : dashboard
    // pour l'étagère (/bibliotheque), corpus pour la liste détaillée d'une
    // grande section. Elle sépare « j'arrive » de « je descends dans un
    // corpus », que le seul $pageview mélangeait.
    variant: corpus ? "corpus" : "dashboard",
    corpus,
  });
}

// Une seule fois par page de bibliothèque, comme session_search_used : chaque
// frappe noierait les stats. Remis à zéro en changeant de corpus, la recherche
// de l'accueil et celle d'un corpus n'ayant pas la même portée.
let hasTrackedSearch = false;

function trackLibrarySearchUsed() {
  if (hasTrackedSearch) return;
  hasTrackedSearch = true;
  analyticsService.capture("library_search_used", {
    // `scope` porte directement la portée de la recherche, telle que la tuile
    // l'attend : « all » depuis l'étagère (toute la bibliothèque), le corpus
    // courant sur sa page (la recherche y reste dans le corpus).
    scope: currentCorpus.value?.corpus ?? "all",
  });
}

/** La portée de la recherche, comme `library_search_used` la nomme. */
const searchScope = () => currentCorpus.value?.corpus ?? "all";

// La recherche posée, avec son terme et ce qu'elle trouve (useSearchTracking) ;
// `library_search_used`, lui, continue de partir à la première frappe.
const searchTracking = useSearchTracking({
  term: debouncedTerm,
  resultsCount: () => searchResults.value.length,
  track: (search) =>
    analyticsService.capture("library_search_performed", { scope: searchScope(), ...search }),
});

/**
 * Un résultat ouvert : la recherche part d'abord (celle qui a mené quelque
 * part), puis le résultat et son rang ; la lecture qui s'ouvre saura qu'elle
 * vient de la recherche (`text_opened.entry`).
 */
function trackSearchResultOpened(text: TextStudyJsonEntry): void {
  if (!hasSearch.value) return;
  searchTracking.flush();
  markReadingEntry("search");
  // Le rang à l'écran : les résultats de l'étude s'y rangent par rayon puis
  // par livre, ceux du Sidour à la suite, pas dans l'ordre du catalogue.
  const shown = [
    ...studyResultGroups.value.flatMap((group) => Object.values(group.groups).flat()),
    ...sidourResults.value,
  ];
  analyticsService.capture("library_search_result_opened", {
    scope: searchScope(),
    rank: shown.indexOf(text) + 1,
    corpus: text.type,
    text_id: String(text.id),
  });
}

// App native, page d'un corpus : « Tout télécharger » le corpus, et l'espace
// utilisé. L'accueil de la bibliothèque, lui, a sa ligne « Hors ligne » en bas
// de page (LibraryOfflineRow) et ses livres disent leur état dans leur angle.
const tabCorpusBooks = computed<OfflineBook[]>(() => {
  if (!isNativeApp || currentCorpus.value === null) return [];
  return offlineBooks.filter((b) => b.corpus === currentCorpus.value?.typeKey);
});

// Ce qui se télécharge : les livres embarqués dans l'app (les Tehilim) y sont
// déjà, leur page n'a donc rien à proposer.
const tabBooks = computed(() => tabCorpusBooks.value.filter((b) => !isBookBundled(b)));

const tabAllDownloaded = computed(
  () => tabBooks.value.length > 0 && tabBooks.value.every((b) => isBookDownloaded(b)),
);

// Le lot et son suivi vivent dans useBookDownload, avec le téléchargement
// d'un seul livre : un échec en chemin n'y abandonne pas la suite.
function downloadAllInTab() {
  return downloadAll(tabBooks.value, currentCorpus.value?.typeKey ?? "Tout");
}

// Libérer de la place : symétrique de « Tout télécharger », donc au même
// endroit et avec la même portée, le corpus courant.
// Un livre embarqué a pu être téléchargé par une version d'avant : sa copie
// se libère avec les autres.
const tabDownloadedBooks = computed(() => tabCorpusBooks.value.filter((b) => isBookDownloaded(b)));

const removingAll = ref(false);

/** Libellé du bouton : il n'est plus écrit à l'écran (infobulle et modale). */
const deleteAllLabel = computed(() =>
  currentCorpus.value ? t("downloads.deleteAllCorpus") : t("downloads.deleteAll"),
);

async function removeAllInTab() {
  if (removingAll.value) return;
  const books = tabDownloadedBooks.value;
  if (books.length === 0) return;
  const corpus = currentCorpus.value;
  // Le bouton est discret : c'est la modale qui explique ce qui va disparaître,
  // et ce qui reste accessible ensuite.
  const confirmed = await confirm({
    title: corpus
      ? t("downloads.deleteAllCorpusTitle", { corpus: t(corpus.labelKey) })
      : t("downloads.deleteAllTitle"),
    message: t("downloads.deleteAllExplain", books.length),
    confirmLabel: t("common.delete"),
    danger: true,
  });
  if (!confirmed) return;
  removingAll.value = true;
  try {
    await removeBooks(books);
    analyticsService.capture("offline_download_deleted", {
      scope: "all",
      tab: corpus?.typeKey ?? "Tout",
      books_count: books.length,
    });
    toast.success(t("downloads.deleteAllDone"));
  } catch (e) {
    analyticsService.capture("offline_download_delete_failed", {
      scope: "all",
      tab: corpus?.typeKey ?? "Tout",
      books_count: books.length,
      error_message: e instanceof Error ? e.message : String(e),
    });
    toast.error(t("downloads.deleteError"));
  } finally {
    removingAll.value = false;
  }
}

const formatBookName = bookName;

// Badge marque-pages sur les cartes : lecture locale immédiate, affinée quand
// la synchro du compte aboutit.
const bookmarkCounts = ref<Record<string, number>>({});

function applySeoMeta() {
  const corpus = currentCorpus.value;
  if (corpus) {
    const url = SITE_URL + `/bibliotheque/${corpus.corpus}`;
    // En français, le même titre et la même description que la page
    // prérendue (etudeTexts) : Googlebot rend le JavaScript, et un titre
    // différent de celui du HTML servi lui laisserait choisir. Les autres
    // langues gardent leurs libellés traduits.
    const fr = locale.value === "fr" && (LISTED_CORPORA as string[]).includes(corpus.corpus);
    seoService.setMeta({
      title: fr
        ? corpusTitle(corpus.corpus as ListedCorpus)
        : pageTitle(t(corpus.labelKey), t("study.title")),
      description: fr ? corpusDescription(corpus.corpus as ListedCorpus) : t(corpus.descKey),
      canonical: url,
    });
  } else {
    const url = SITE_URL + "/bibliotheque";
    seoService.setMeta({
      title: pageTitle(t("study.title")),
      description: t("study.subtitle"),
      canonical: url,
    });
  }
}

// Rejoué au changement de corpus et de langue : les messages en et he
// arrivent par import dynamique, parfois après le montage (voir ParashaPage).
watch([currentCorpus, locale, localeMessagesReady], applySeoMeta);

onMounted(() => {
  trackLibraryViewed();
  bookmarkCounts.value = readingProgressService.getBookmarkCounts();
  // Position locale tout de suite, affinée quand la synchro du compte aboutit.
  lastReading.value = readingProgressService.getResumePosition();
  void readingProgressService.ensureSynced().then(() => {
    bookmarkCounts.value = readingProgressService.getBookmarkCounts();
    lastReading.value = readingProgressService.getResumePosition();
  });
  if (isNativeApp) {
    ensureManifestLoaded();
  }
  applySeoMeta();
});
</script>

<template>
  <main class="mx-auto px-6 py-12">
    <!-- Pendant une recherche, tout ce qui précède la barre se replie : elle
         glisse jusqu'en haut de l'écran et les résultats prennent la place
         laissée par le clavier (voir useSearchMode). -->
    <CollapseTransition>
      <div v-show="!searching">
        <!-- ===== Page corpus : liste détaillée d'une grande section ===== -->
        <div
          v-if="currentCorpus"
          class="max-w-5xl mx-auto animate-[fadeIn_0.4s_ease]"
          :class="isNativeApp ? 'mb-4' : 'mb-8'"
        >
          <!-- Un livre de halakha ouvert remonte à la page des livres. -->
          <RouterLink v-if="halakhaWork" to="/bibliotheque/halakha" class="back-link mb-4">
            <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
            {{ t(currentCorpus.labelKey) }}
          </RouterLink>
          <RouterLink v-else to="/bibliotheque" class="back-link mb-4">
            <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
            {{ t("study.title") }}
          </RouterLink>
          <h1 class="text-3xl md:text-4xl font-bold text-text-primary tracking-tight pb-1">
            {{
              halakhaWork ? t(HALAKHA_WORK_META[halakhaWork].nameKey) : t(currentCorpus.labelKey)
            }}
          </h1>
          <p v-if="!isNativeApp" class="mt-2 text-lg text-text-secondary max-w-2xl leading-relaxed">
            {{ halakhaWork ? t(HALAKHA_WORK_META[halakhaWork].descKey) : t(currentCorpus.descKey) }}
          </p>
        </div>

        <!-- ===== Accueil de la bibliothèque : hero ===== -->
        <!-- Hero resserré sur téléphone : chaque ligne gagnée remonte les livres
             au-dessus de la pliure. Dans l'app, les onglets prennent la place du
             titre : ils disent où l'on est aussi bien que lui, et deux lignes
             qui se répètent ne valent pas la hauteur qu'elles coûtent. Le titre
             reste là pour les lecteurs d'écran. -->
        <div
          v-else
          class="text-center animate-[fadeIn_0.5s_ease]"
          :class="isNativeApp ? 'mb-6' : 'mb-6 md:mb-10'"
        >
          <PageTabs
            v-if="isNativeApp"
            :tabs="STUDY_TABS"
            event="library_tab_switched"
            :label="t('common.study')"
          />
          <h1
            class="text-3xl md:text-5xl font-bold text-text-primary tracking-tight pb-1"
            :class="isNativeApp ? 'sr-only' : ''"
          >
            {{ t("study.title") }}
          </h1>
          <p
            v-if="!isNativeApp"
            class="mt-2 md:mt-4 text-sm md:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed"
          >
            {{ t("study.subtitle") }}
          </p>
        </div>
      </div>
    </CollapseTransition>

    <!-- Recherche : depuis l'accueil elle cherche dans toute la bibliothèque. -->
    <CatalogSearchField
      v-model:term="searchTerm"
      :placeholder="searchPlaceholder"
      class="mb-6 animate-[fadeIn_0.5s_ease]"
    />

    <!-- App native : tout télécharger (bibliothèque entière ou corpus courant)
         + espace utilisé. Retiré pendant une recherche : cette ligne n'a rien à
         voir avec ce qu'on cherche, et elle repousserait les résultats sous le
         clavier. -->
    <div
      v-if="isNativeApp && !searching && (tabBooks.length > 0 || tabDownloadedBooks.length > 0)"
      class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-8 animate-[fadeIn_0.5s_ease]"
    >
      <!-- Télécharger et supprimer vont ensemble : le second est une petite
           icône posée contre le premier. Supprimer reste l'exception, il n'a
           pas à peser autant à l'écran, la modale, elle, explique tout. -->
      <span class="flex items-center gap-1">
        <!-- Rien à télécharger (Tehilim) : seule reste la corbeille, pour
             une copie téléchargée par une version d'avant. -->
        <template v-if="tabBooks.length > 0">
          <button v-if="!tabAllDownloaded" class="btn btn-soft" @click="downloadAllInTab()">
            <AppIcon
              v-if="downloadingPaths.size > 0"
              name="spinner"
              :size="14"
              class="animate-spin"
            />
            <AppIcon v-else name="download" :size="14" />
            {{ t("downloads.downloadAll") }}
          </button>
          <p v-else class="flex items-center gap-1.5 text-sm text-primary">
            <AppIcon name="circle-check" :size="14" />
            {{ t("downloads.allDownloaded") }}
          </p>
        </template>
        <button
          v-if="tabDownloadedBooks.length > 0"
          class="icon-btn hover:text-red-600 dark:hover:text-red-400"
          :disabled="removingAll"
          :title="deleteAllLabel"
          :aria-label="deleteAllLabel"
          @click="removeAllInTab()"
        >
          <AppIcon v-if="removingAll" name="spinner" :size="15" class="animate-spin" />
          <AppIcon v-else name="trash" :size="15" />
        </button>
      </span>
      <p v-if="totalDownloadedSize > 0" class="text-sm text-text-secondary">
        {{ t("downloads.total", { size: formatDownloadSize(totalDownloadedSize) }) }}
      </p>
    </div>

    <!-- Tanakh : l'entrée du chnei mikra, qui se lit sur sa propre page. -->
    <ChneiMikraBanner v-if="showChneiMikra" class="max-w-5xl mx-auto mb-10" />

    <!-- Tehilim : les psaumes du jour du mois hébraïque, qui se lisent d'une
         traite sur leur page. -->
    <TehilimDayBanner v-if="showTehilimDay" class="max-w-5xl mx-auto mb-10" />

    <!-- Tehilim : ce qu'on dit avant d'en lire, et ce qu'on dit après. -->
    <BookEncadrement v-if="showBookEncadrement" corpus="tehilim" class="max-w-5xl mx-auto mb-10" />

    <!-- ===== Halakha : ses livres, dans les cartes de la liste des textes ===== -->
    <div
      v-if="showHalakhaWorks"
      class="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 animate-[fadeIn_0.5s_ease]"
    >
      <RouterLink
        v-for="book in halakhaWorks"
        :key="book.work"
        :to="{ path: '/bibliotheque/halakha', query: { livre: book.work } }"
        class="card card-hover p-4 flex items-center justify-between gap-2 group"
      >
        <span class="min-w-0">
          <span class="block font-medium text-text-primary">
            {{ locale === "he" ? book.name : `${book.hebrew} (${book.name})` }}
          </span>
          <span class="text-xs text-text-secondary">{{ book.count }}</span>
        </span>
      </RouterLink>
    </div>

    <!-- ===== Accueil sans recherche : le tableau de bord ===== -->
    <template v-else-if="!showList">
      <!-- Reprendre la dernière lecture, au verset près : une simple ligne
           discrète juste sous la recherche. -->
      <div
        v-if="lastReading && resumeLink"
        class="flex items-center justify-center gap-1 -mt-2 mb-6 animate-[fadeIn_0.5s_ease]"
      >
        <RouterLink
          :to="resumeLink"
          class="group inline-flex items-center gap-1.5 min-w-0 text-sm text-text-secondary hover:text-primary transition-colors"
          @click="trackResume()"
        >
          <AppIcon name="bookmark" :size="13" class="shrink-0 text-primary/70" />
          <span class="truncate">
            {{ t("home.dashboard.resumeCta", { label: lastReading.label }) }}
          </span>
        </RouterLink>
        <button
          @click="dismissResume"
          class="shrink-0 p-1 rounded-full text-text-secondary/50 hover:text-red-600 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          :title="t('home.dashboard.resumeDismiss')"
          :aria-label="t('home.dashboard.resumeDismiss')"
        >
          <AppIcon name="x" :size="12" />
        </button>
      </div>

      <!-- Les grandes sections : on est dans la bibliothèque, les livres sont
           la porte d'entrée principale, visibles sans scroller, même sur
           téléphone. Dans l'app, chacun dit dans son angle s'il est sur le
           téléphone. -->
      <div class="mt-2 md:mt-6">
        <LibraryShelf :books="shelfBooks" @open="trackCorpusOpened" />
      </div>

      <!-- Ce qui se lit aujourd'hui : les psaumes du jour, le chnei mikra, et
           Ma journée (elle mène à la pile de l'accueil). -->
      <StudyToday class="max-w-3xl mx-auto mt-12 animate-[fadeIn_0.5s_ease]" />

      <!-- App native : tout télécharger, en bas de page, une ligne parmi les
           autres. -->
      <LibraryOfflineRow
        v-if="isNativeApp"
        class="max-w-3xl mx-auto mt-6"
        :books="studyOfflineBooks"
        :also-removable="liturgyOfflineBooks"
      />
    </template>

    <!-- ===== Liste détaillée : page corpus, ou recherche depuis l'accueil ===== -->
    <template v-else>
      <div v-if="hasResults" class="max-w-5xl mx-auto space-y-12 animate-[fadeIn_0.5s_ease]">
        <div v-for="typeGroup in studyResultGroups" :key="typeGroup.key" class="space-y-10">
          <!-- Type heading: shown only when searching across the whole library. -->
          <h2 v-if="!currentCorpus" class="text-2xl font-bold text-text-primary">
            {{ t(typeGroup.labelKey) }}
          </h2>
          <section v-for="(texts, livre) in typeGroup.groups" :key="livre">
            <!-- Les Tehilim : le titre du sefer replie et rouvre sa liste. -->
            <button
              v-if="foldableBooks"
              type="button"
              class="w-full flex items-center justify-between gap-3 mb-4 text-left"
              :aria-expanded="isGroupOpen(String(livre))"
              @click="toggleGroup(String(livre))"
            >
              <span class="min-w-0">
                <span class="block text-xl font-bold text-text-primary">
                  {{ formatBookName(String(livre)) }}
                </span>
                <span class="block text-sm text-text-secondary">{{ groupHint(texts) }}</span>
              </span>
              <AppIcon
                :name="isGroupOpen(String(livre)) ? 'chevron-up' : 'chevron-down'"
                :size="18"
                class="shrink-0 text-text-secondary"
              />
            </button>
            <template v-else-if="halakhaWork">
              <h3
                v-if="halakhaGroupHeading(String(livre))"
                class="text-xl font-bold text-text-primary mb-4"
              >
                {{ halakhaGroupHeading(String(livre)) }}
              </h3>
            </template>
            <h3 v-else class="text-xl font-bold text-text-primary mb-4">
              {{ formatBookName(String(livre)) }}
            </h3>
            <!-- Une seule colonne sur téléphone : les noms restent lisibles en entier.
                 Un sefer replié ne pose pas ses cartes du tout (`v-if`) : c'est
                 autant de liens en moins à tenir sur la page des Tehilim. -->
            <CollapseTransition>
              <div
                v-if="isGroupOpen(String(livre))"
                class="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3"
              >
                <router-link
                  v-for="text in texts"
                  :key="text.id"
                  :to="hubPath(text)"
                  class="card card-hover p-4 flex items-center justify-between gap-2 group"
                  @click="trackSearchResultOpened(text)"
                >
                  <span class="min-w-0">
                    <span class="block font-medium text-text-primary">
                      {{ appendHebrewNumeral(text.name) }}
                    </span>
                    <span v-if="text.totalSections > 1" class="text-xs text-text-secondary">
                      {{ t("study.sections", { count: text.totalSections }) }}
                    </span>
                  </span>
                  <!-- Un marque-page attend dans ce texte -->
                  <span
                    v-if="bookmarkCounts[String(text.id)]"
                    class="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary"
                    :title="t('textReading.bookmarks')"
                  >
                    <AppIcon name="bookmark" :size="13" />
                    {{ bookmarkCounts[String(text.id)] }}
                  </span>
                  <!-- App native : télécharger/supprimer le livre sans quitter la bibliothèque. -->
                  <button
                    v-if="bookState(text) !== 'none'"
                    @click.prevent.stop="toggleDownload(text)"
                    class="shrink-0 p-1.5 -m-1.5 transition-colors"
                    :class="
                      bookState(text) === 'downloaded'
                        ? 'text-primary'
                        : 'text-text-secondary/50 hover:text-primary'
                    "
                    :aria-label="
                      bookState(text) === 'downloaded'
                        ? t('downloads.delete')
                        : t('downloads.download')
                    "
                    :title="
                      bookState(text) === 'downloaded'
                        ? t('downloads.delete')
                        : t('downloads.download')
                    "
                  >
                    <AppIcon
                      v-if="bookState(text) === 'downloading'"
                      name="spinner"
                      :size="19"
                      class="animate-spin text-primary"
                    />
                    <AppIcon
                      v-else-if="bookState(text) === 'downloaded'"
                      name="circle-check"
                      :size="19"
                    />
                    <AppIcon v-else name="download" :size="19" />
                  </button>
                </router-link>
              </div>
            </CollapseTransition>
          </section>
        </div>

        <!-- La liturgie a sa page, le Sidour : une recherche qui la touche y
             renvoie, plutôt que de répondre qu'il n'y a rien. -->
        <section v-if="!currentCorpus && sidourResults.length" class="space-y-4">
          <h2 class="flex items-center gap-2.5 text-2xl font-bold text-text-primary">
            <AppIcon name="book-open" :size="20" class="text-primary" />
            {{ t("study.inSidour") }}
          </h2>
          <div class="card overflow-hidden">
            <router-link
              v-for="text in sidourResults"
              :key="text.id"
              :to="hubPath(text)"
              class="sidour-result group flex min-h-12 items-center justify-between gap-3 px-4 py-2.5"
              @click="trackSearchResultOpened(text)"
            >
              <span
                class="font-medium text-text-primary group-hover:text-primary transition-colors"
              >
                {{ latinName(text) }}
              </span>
              <span class="font-hebrew text-lg text-text-secondary" lang="he" dir="rtl">
                {{ hebrewOf(text) }}
              </span>
            </router-link>
          </div>
        </section>
      </div>

      <!-- Empty -->
      <div v-else class="flex flex-col items-center justify-center py-16 text-center">
        <AppIcon name="search" :size="32" class="text-text-secondary/40 mb-4" />
        <p class="text-text-secondary">{{ t("study.noResults") }}</p>
      </div>
    </template>

    <AccountCta class="max-w-3xl mx-auto mt-12" />
  </main>
</template>

<style scoped>
/* Les résultats du Sidour, en lignes d'une liste posée dans une carte : un
   filet entre elles, comme sur la page du Sidour. */
.sidour-result + .sidour-result {
  border-top: 1px solid var(--color-line);
}
</style>
