import { HDate, months } from "@hebcal/core";

/**
 * Les hiloulot du jour : les rabbanim dont c'est le jour de disparition.
 *
 * La liste vient du calendrier `Rabbi Ovadiah Yosef Calendar` d'Elyahu Jacobi,
 * sous licence MIT (voir src/datas/hiloulot.LICENSE.txt et le script
 * scripts/generate-hiloulot.mjs qui la reprend). Elle compte environ 2 600
 * noms, répartis sur les 384 jours des deux formes de l'année hébraïque.
 *
 * Elle n'est PAS embarquée dans le lot de départ : deux fichiers de 75 et
 * 110 Ko, chargés à la demande par la page qui les affiche, et gardés ensuite
 * pour la session. Dans l'app native, dont les fichiers sont sur l'appareil,
 * ils s'ouvrent aussi connexion coupée.
 *
 * Deux particularités du calendrier, les mêmes que pour les dates personnelles
 * (voir hebrewOccasions) et tranchées de la même façon :
 *
 *  - **Adar.** La liste inscrit séparément Adar et Adar II. Les années à
 *    treize mois, chacun garde donc les siens ; les années ordinaires, l'Adar
 *    unique porte les deux, sans quoi cent vingt noms disparaîtraient deux
 *    années sur trois. C'est la règle du calendrier d'origine, et elle diffère
 *    de celle des dates personnelles (voir hebrewOccasions), qui suit l'usage
 *    séfarade parce qu'il s'agit là d'une date qu'on observe, pas d'une
 *    colonne qu'on lit.
 *  - **Le 30 du mois.** 'Hechvan et Kislev n'ont que 29 jours certaines
 *    années : ce qui y est inscrit au 30 se lit alors le 29, dernier jour du
 *    mois.
 */

/** Un nom, tel que la liste le porte. */
export type Hiloula = string;

/** La liste entière : clé `MMJJ` (mois hebcal, Nissan = 1) vers les noms. */
export type HiloulotIndex = Record<string, Hiloula[]>;

function indexKey(month: number, day: number): string {
  return `${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

/**
 * Les clés de la liste à lire pour ce jour hébraïque-là. Plusieurs, car l'Adar
 * d'une année ordinaire porte les deux listes d'Adar, et car le 30 d'un mois
 * qui n'en compte que 29 se lit le dernier jour.
 */
export function hiloulotKeys(hd: HDate): string[] {
  const month = hd.getMonth();
  const year = hd.getFullYear();
  const day = hd.getDate();

  const days = [day];
  if (day === 29 && HDate.daysInMonth(month, year) === 29) days.push(30);

  const recorded = [month];
  if (month === months.ADAR_I && !HDate.isLeapYear(year)) recorded.push(months.ADAR_II);

  return recorded.flatMap((each) => days.map((one) => indexKey(each, one)));
}

/** Les noms du jour, sans doublon, dans l'ordre de la liste. */
export function hiloulotOn(index: HiloulotIndex, hd: HDate): Hiloula[] {
  const names: Hiloula[] = [];
  for (const key of hiloulotKeys(hd)) {
    for (const name of index[key] ?? []) {
      if (!names.includes(name)) names.push(name);
    }
  }
  return names;
}

/** Les listes déjà chargées, par écriture : une par session, pas une par jour. */
const loaded = new Map<"latin" | "he", HiloulotIndex>();

/**
 * La liste dans l'écriture de la langue : l'hébreu a ses noms, le français et
 * l'anglais partagent la translittération latine. Null si le fichier ne se
 * charge pas (site ouvert hors ligne, lot non encore téléchargé) : la page
 * n'affiche alors pas la section, elle ne montre pas d'erreur.
 */
export async function loadHiloulot(locale: string): Promise<HiloulotIndex | null> {
  const script = locale === "he" ? "he" : "latin";
  const cached = loaded.get(script);
  if (cached) return cached;
  try {
    const { default: index } = await (script === "he"
      ? import("../datas/hiloulot.he.json")
      : import("../datas/hiloulot.json"));
    loaded.set(script, index as HiloulotIndex);
    return index as HiloulotIndex;
  } catch {
    return null;
  }
}
