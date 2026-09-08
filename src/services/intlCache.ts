/**
 * Formateurs Intl partagés.
 *
 * `new Intl.DateTimeFormat(...)` coûte quelques centaines de microsecondes
 * (résolution de la locale, données du fuseau) : la page des horaires en
 * construisait une vingtaine par rendu, et se re-rend toutes les trente
 * secondes ; le calendrier, deux par ligne ; la boussole, un formateur de
 * nombres à chaque recalcul. Un formateur ne dépend que de la locale et de ses
 * options, il se garde donc, indexé par les deux.
 */

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
const numberFormats = new Map<string, Intl.NumberFormat>();
const displayNamesFormats = new Map<string, Intl.DisplayNames>();

function keyOf(locale: string, options: object | undefined): string {
  return `${locale}|${JSON.stringify(options ?? {})}`;
}

export function dateTimeFormat(
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = keyOf(locale, options);
  let format = dateTimeFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    dateTimeFormats.set(key, format);
  }
  return format;
}

export function numberFormat(
  locale: string,
  options?: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = keyOf(locale, options);
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, options);
    numberFormats.set(key, format);
  }
  return format;
}

export function displayNames(locale: string, options: Intl.DisplayNamesOptions): Intl.DisplayNames {
  const key = keyOf(locale, options);
  let format = displayNamesFormats.get(key);
  if (!format) {
    format = new Intl.DisplayNames([locale], options);
    displayNamesFormats.set(key, format);
  }
  return format;
}

/** Pour les tests : repart sans aucun formateur en mémoire. */
export function resetIntlCache(): void {
  dateTimeFormats.clear();
  numberFormats.clear();
  displayNamesFormats.clear();
}
