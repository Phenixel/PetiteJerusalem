import { dateTimeFormat, numberFormat } from "./intlCache";

/**
 * Mises en forme du backoffice : durées, tailles, dates. Le backoffice est
 * en français, quelle que soit la langue de l'interface (comme ses données).
 */

/** 754 → « 12 min », 3900 → « 1 h 05 ». Vide pour une durée inconnue. */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

/** 12 345 678 → « 11,8 Mo ». */
export function formatSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  const mo = bytes / (1024 * 1024);
  const format = numberFormat("fr", { maximumFractionDigits: mo < 10 ? 1 : 0 });
  return `${format.format(mo)} Mo`;
}

/** « 29 sept. 2026 ». */
export function formatDay(date: Date | null | undefined): string {
  if (!date) return "";
  return dateTimeFormat("fr", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/** « aujourd'hui », « hier », « il y a 3 jours », puis la date. */
export function formatAgo(
  date: Date | null | undefined,
  t: (key: string, values?: Record<string, unknown>) => string,
  now = Date.now(),
): string {
  if (!date) return "";
  const startOfDay = (time: number) => {
    const d = new Date(time);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((startOfDay(now) - startOfDay(date.getTime())) / 86_400_000);
  if (days <= 0) return t("admin.ago.today");
  if (days === 1) return t("admin.ago.yesterday");
  if (days < 7) return t("admin.ago.days", { n: days });
  return formatDay(date);
}

/** 12345 → « 12 345 ». */
export function formatCount(value: number): string {
  return numberFormat("fr").format(value);
}
