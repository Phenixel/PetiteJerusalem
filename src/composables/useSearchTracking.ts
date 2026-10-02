import { onScopeDispose, watch, type WatchSource } from "vue";

/**
 * Une recherche « posée », pour les événements `*_search_performed`.
 *
 * Les événements `*_search_used` partent à la première frappe, une fois par
 * page, sans le terme ni le nombre de résultats : on savait qu'on cherchait,
 * jamais quoi, ni si l'on trouvait (voir docs/audit-usage-posthog-2026-10.md,
 * 5.2). Les replays n'y suppléent pas, les saisies y étant masquées.
 *
 * Une frappe n'est pas une recherche : on attend que le terme n'ait plus
 * bougé depuis `SEARCH_SETTLE_MS`. On l'envoie aussi tout de suite quand un
 * résultat est ouvert (`flush`), et en quittant la page : la recherche qui a
 * mené quelque part, ou nulle part, est justement celle qu'on veut. Le même
 * terme ne part pas deux fois de suite.
 *
 * Le terme est normalisé (minuscules, espaces resserrées) et tronqué : ce
 * sont des noms de livres et de cours, pas des données personnelles, mais
 * rien ne justifie d'en garder davantage.
 */

export const SEARCH_SETTLE_MS = 1200;
export const SEARCH_QUERY_MAX = 40;

/** Le terme tel qu'il part : minuscules, espaces resserrées, 40 caractères. */
export function normalizeSearchQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, SEARCH_QUERY_MAX);
}

export interface SearchTrackingOptions {
  /** Le terme de la recherche (le terme différé de la page, s'il y en a un). */
  term: WatchSource<string>;
  /** Combien de résultats la page affiche pour ce terme, au moment de l'envoi. */
  resultsCount: () => number;
  /** L'envoi lui-même : l'événement et ses propriétés propres à la page. */
  track: (search: { query: string; query_length: number; results_count: number }) => void;
}

export function useSearchTracking(options: SearchTrackingOptions): { flush: () => void } {
  let pending = "";
  let lastSent = "";
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clear(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  /** Envoie la recherche en attente, s'il y en a une et qu'elle est nouvelle. */
  function flush(): void {
    clear();
    const query = normalizeSearchQuery(pending);
    if (!query || query === lastSent) return;
    lastSent = query;
    options.track({ query, query_length: query.length, results_count: options.resultsCount() });
  }

  watch(options.term, (value) => {
    clear();
    pending = value;
    if (!value.trim()) return;
    timer = setTimeout(flush, SEARCH_SETTLE_MS);
  });

  onScopeDispose(flush);

  return { flush };
}
