import { holidayThemeOn, type HolidayThemeId } from "../services/holidayThemes";

/**
 * La fête en cours et son livre dans Moadim : la liste de Moadim s'ouvre sur
 * lui, et le sidour y renvoie tant qu'elle dure (MoadimNowBanner).
 *
 * La fenêtre est celle des thèmes des fêtes (holidayThemeOn), qui ne dépend
 * que du calendrier, pas du réglage du thème : les Sli'hot et l'Atarat
 * nedarim depuis Eloul jusqu'à Kippour, Souccot du lendemain de Kippour au
 * lendemain de Sim'hat Torah, 'Hanouka ses huit jours. Les autres fêtes n'ont
 * pas encore de livre dans Moadim.
 *
 * La clé est le `livre` du catalogue (src/datas/textStudies.json) : un livre
 * renommé là doit l'être ici, ce que tient moadimNow.test.ts.
 */
export const MOADIM_BOOK_BY_THEME: Partial<Record<HolidayThemeId, string>> = {
  tichri: "ימים נוראים (Yamim Noraim)",
  souccot: "סוכות (Souccot)",
  hanouka: "חנוכה (Hanouka)",
};

/** Le livre de Moadim de la fête en cours ce jour-là, ou null. */
export function currentMoadimBook(date: Date): string | null {
  const theme = holidayThemeOn(date);
  return theme ? (MOADIM_BOOK_BY_THEME[theme.id] ?? null) : null;
}

/** Les livres d'un corpus, celui de la fête en cours en tête, l'ordre gardé sinon. */
export function withCurrentFirst<T>(
  groups: Record<string, T>,
  current: string | null,
): Record<string, T> {
  if (!current || !(current in groups)) return groups;
  return { [current]: groups[current], ...groups };
}
