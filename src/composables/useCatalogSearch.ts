import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import type { TextStudyJsonEntry } from "../models/models";
import { filterBySearch, groupByBook } from "../services/catalogSearch";

/**
 * La recherche dans le catalogue, telle que la bibliothèque et la composition
 * de la lecture du jour la font toutes deux : un terme qui suit la frappe, sa
 * copie différée qui filtre, et les résultats regroupés par corpus puis par
 * livre.
 *
 * Chaque frappe re-filtrait et regroupait les 350 entrées du catalogue : sur
 * un appareil lent, taper devenait poussif. Le filtre n'est refait que
 * 150 ms après la dernière frappe ; le champ, lui, reste réactif (`term`
 * suit la frappe). Le minuteur meurt avec le composant.
 */

/** Un corpus, dans l'ordre où ses groupes s'affichent. */
export interface CatalogType {
  /** Le `type` des entrées du catalogue ("Tehilim", "Talmud Bavli"…). */
  key: string;
  /** Clé i18n de son titre. */
  labelKey: string;
}

export interface CatalogTypeGroup<T extends TextStudyJsonEntry> {
  key: string;
  labelKey: string;
  /** Les textes du corpus par livre (ou seder), dans l'ordre du catalogue. */
  groups: Record<string, T[]>;
  count: number;
}

const DEBOUNCE_MS = 150;

export function useCatalogSearch<T extends TextStudyJsonEntry>(
  texts: T[],
  types: CatalogType[],
  /** Le corpus dans lequel chercher ; null pour tout le catalogue. */
  selectedType: MaybeRefOrGetter<string | null> = null,
) {
  const term = ref("");
  const debouncedTerm = ref("");
  let timer: ReturnType<typeof setTimeout> | undefined;

  watch(term, (value) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      debouncedTerm.value = value;
    }, DEBOUNCE_MS);
  });
  onScopeDispose(() => clearTimeout(timer));

  /** Remet la recherche à zéro tout de suite, sans attendre le délai. */
  function reset() {
    clearTimeout(timer);
    term.value = "";
    debouncedTerm.value = "";
  }

  const hasSearch = computed(() => debouncedTerm.value.trim() !== "");

  const filtered = computed(() => {
    const type = toValue(selectedType);
    const inType = type === null ? texts : texts.filter((txt) => String(txt.type) === type);
    return filterBySearch(inType, debouncedTerm.value);
  });

  // Un titre de corpus n'a de sens que quand plusieurs se mélangent (une
  // recherche depuis l'accueil) ; c'est la vue qui décide de l'afficher.
  const groupedByType = computed<CatalogTypeGroup<T>[]>(() =>
    types
      .map((type) => {
        const inType = filtered.value.filter((txt) => String(txt.type) === type.key);
        return {
          key: type.key,
          labelKey: type.labelKey,
          groups: groupByBook(inType),
          count: inType.length,
        };
      })
      .filter((group) => group.count > 0),
  );

  const hasResults = computed(() => groupedByType.value.length > 0);

  return { term, debouncedTerm, hasSearch, filtered, groupedByType, hasResults, reset };
}
