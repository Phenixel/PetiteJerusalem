/**
 * Une durée de cours comme on la dit : « 35 min », « 1 h 05 » (« 35 דק׳ » en
 * hébreu). Les secondes n'ont rien à faire dans une liste ; le lecteur, lui,
 * compte à la seconde (formatTime). Les espaces sont insécables : « 1 h » ne
 * se coupe pas en fin de ligne.
 */
export function formatMinutes(seconds: number, locale = "fr"): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.max(1, Math.round(seconds / 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (locale === "he") {
    if (h === 0) return `${minutes} דק׳`;
    return m === 0 ? `${h} שע׳` : `${h} שע׳ ${m} דק׳`;
  }
  if (h === 0) return `${minutes} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** La durée totale d'une liste de cours, celles qu'on connaît. */
export function totalDuration(items: { duration: number | null }[]): number {
  return items.reduce((sum, item) => sum + (item.duration ?? 0), 0);
}
