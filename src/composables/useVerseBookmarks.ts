import {
  computed,
  nextTick,
  onScopeDispose,
  ref,
  toValue,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import type { TextStudyJsonEntry } from "../models/models";
import { readingProgressService, bookmarkId } from "../services/readingProgressService";
import type { Bookmark, BookmarkScope } from "../services/readingProgressService";
import { analyticsService } from "../services/analyticsService";
import { scrollToVerse } from "./scrollAnchor";

/**
 * Les marque-pages et la sélection d'un verset, tels que le lecteur de la
 * bibliothèque et la lecture du jour les font tous deux : un appui sélectionne
 * un verset et propose le marque-page, la liste des marque-pages ramène au
 * verset en le surlignant le temps que l'œil le retrouve.
 *
 * Les deux pages ne repèrent pas un verset de la même façon : le lecteur par
 * sa ligne (une section à l'écran à la fois), la lecture du jour par
 * « section#ligne » (un livre entier sur la page). `keyOf` fait ce choix ; le
 * reste, stockage, événements de mesure, surbrillance, est le même.
 */
export interface VerseBookmarksOptions<K> {
  /** Espace des marque-pages : la bibliothèque, ou la lecture quotidienne. */
  scope?: BookmarkScope;
  textId: MaybeRefOrGetter<string>;
  /** L'entrée lue, pour la mesure d'audience (id et corpus). */
  entry: MaybeRefOrGetter<TextStudyJsonEntry | null>;
  /** Comment la page nomme un verset (voir ci-dessus). */
  keyOf: (section: number | null, line: number) => K;
  /** Chemin et libellé enregistrés avec un marque-page posé dans `section`. */
  pathFor: (section: number | null) => string;
  labelFor: (section: number | null) => string;
  /** D'où le marque-page est posé, pour la mesure d'audience ; absent dans la bibliothèque. */
  source?: string;
}

export function useVerseBookmarks<K>(options: VerseBookmarksOptions<K>) {
  const scope = options.scope ?? "library";
  const bookmarks = ref<Bookmark[]>([]) as Ref<Bookmark[]>;
  const selected = ref(null) as Ref<K | null>;
  const highlighted = ref(null) as Ref<K | null>;

  function refresh() {
    bookmarks.value = readingProgressService.getBookmarks(toValue(options.textId), scope);
  }

  const bookmarkIds = computed(() => new Set(bookmarks.value.map((b) => b.id)));

  function isBookmarked(section: number | null, line: number): boolean {
    return bookmarkIds.value.has(bookmarkId(toValue(options.textId), section, line, scope));
  }

  function isSelected(section: number | null, line: number): boolean {
    return selected.value === options.keyOf(section, line);
  }

  /** Un appui sélectionne le verset, un second le désélectionne. */
  function select(section: number | null, line: number) {
    const key = options.keyOf(section, line);
    selected.value = selected.value === key ? null : key;
  }

  function trackToggle(added: boolean) {
    const entry = toValue(options.entry);
    analyticsService.capture(added ? "bookmark_added" : "bookmark_removed", {
      text_id: entry?.id,
      corpus: entry?.type,
      ...(options.source ? { source: options.source } : {}),
    });
  }

  /** Pose ou retire le marque-page du verset ; vrai s'il vient d'être posé. */
  function toggleBookmark(section: number | null, line: number): boolean {
    const added = readingProgressService.toggleBookmark({
      textId: toValue(options.textId),
      section,
      line,
      path: options.pathFor(section),
      label: options.labelFor(section),
      scope,
    });
    refresh();
    selected.value = null;
    trackToggle(added);
    return added;
  }

  /** Retire un marque-page depuis la liste, tel qu'il a été enregistré. */
  function remove(bookmark: Bookmark) {
    readingProgressService.toggleBookmark({
      textId: bookmark.textId,
      section: bookmark.section,
      line: bookmark.line,
      path: bookmark.path,
      label: bookmark.label,
      scope,
    });
    refresh();
    trackToggle(false);
  }

  // La surbrillance s'éteint d'elle-même ; pas après le démontage.
  let cancelHighlight: (() => void) | null = null;
  onScopeDispose(() => cancelHighlight?.());

  /**
   * Amène le verset à l'écran, une fois rendu, et le surligne. `find` dit où
   * le chercher dans le DOM.
   */
  function scrollTo(section: number | null, line: number, find: () => Element | null | undefined) {
    void nextTick(() => {
      cancelHighlight?.();
      cancelHighlight = scrollToVerse(find, options.keyOf(section, line), highlighted);
    });
  }

  /** Nouveau texte à l'écran : tout repart de la liste enregistrée. */
  function reset() {
    refresh();
    selected.value = null;
  }

  return {
    bookmarks,
    selected,
    highlighted,
    refresh,
    reset,
    isBookmarked,
    isSelected,
    select,
    toggleBookmark,
    remove,
    scrollTo,
  };
}
