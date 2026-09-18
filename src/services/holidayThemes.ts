import { HDate, months } from "@hebcal/hdate";

/**
 * Les thèmes des fêtes : le temps d'une fête, l'application change de
 * couleurs, se pare d'ornements (un chofar et un pot de miel à Tichri, un
 * loulav et un étrog à Souccot, et ainsi de suite) et le bouton rond des
 * horaires de l'app native prend la forme d'un objet de la fête. Puis tout
 * revient au thème choisi.
 *
 * Ce fichier ne connaît que le calendrier : quel thème appelle quel jour.
 * L'activation (le réglage, l'heure qu'il est) est dans useHolidayTheme, les
 * dessins (ornements, forme du bouton) dans src/components/holiday, rangés
 * par l'identifiant du thème.
 *
 * `@hebcal/hdate` et non `@hebcal/core` : la conversion de date suffit ici,
 * et elle pèse le dixième du moteur d'horaires, que rien ne doit tirer avant
 * le premier rendu (voir HomeView). Une fenêtre se compte en jours civils,
 * pas à la chkia : un thème qui bascule dans la nuit ne trompe personne,
 * alors qu'un thème qui changerait à 19 h 42 le ferait sous les yeux.
 */

export type HolidayThemeId =
  | "tichri"
  | "souccot"
  | "hanouka"
  | "toubichvat"
  | "pourim"
  | "pessah"
  | "chavouot";

export interface HolidayTheme {
  id: HolidayThemeId;
  /** Même rôle que dans un thème choisi (voir useTheme) : fond et encre. */
  primary: string;
  secondary: string;
}

/**
 * Les couleurs sont prises avec la même contrainte que les thèmes choisis
 * (docs/design.md) : assez soutenues pour tenir en encre sur le beige comme
 * en fond sous du blanc.
 *
 * - Tichri : le rouge de la pomme qu'on trempe dans le miel, et le miel.
 * - Souccot : le vert des feuilles du loulav (plus franc et plus jaune que
 *   l'émeraude des thèmes choisis, qui tire sur le bleu), et l'étrog.
 * - 'Hanouka : le jaune des lumières, pris en moutarde pour rester lisible en
 *   encre (un jaune vif ne passe pas sur le blanc), et la flamme, vive, en
 *   seconde couleur, là où le jaune se voit.
 * - Tou Bichvat : le violet de la figue et du raisin, et la feuille.
 * - Pourim : la framboise du masque, et son or.
 * - Pessah : le bleu de la mer qui s'ouvre, et la matsa.
 * - Chavouot : le bleuet des champs, et l'or du blé de la moisson.
 */
export const HOLIDAY_THEMES: HolidayTheme[] = [
  { id: "tichri", primary: "#D8322F", secondary: "#D9A21B" },
  { id: "souccot", primary: "#4E8A2E", secondary: "#D9B324" },
  { id: "hanouka", primary: "#9F7A00", secondary: "#FFD23F" },
  { id: "toubichvat", primary: "#9A4FC0", secondary: "#79B043" },
  { id: "pourim", primary: "#CC2E70", secondary: "#F2B705" },
  { id: "pessah", primary: "#2A86A3", secondary: "#D8B570" },
  { id: "chavouot", primary: "#3F72B8", secondary: "#D4A017" },
];

export function holidayThemeById(id: string): HolidayTheme | null {
  return HOLIDAY_THEMES.find((theme) => theme.id === id) ?? null;
}

/** Une fenêtre d'un thème : du premier au dernier jour, tous deux compris. */
export interface HolidayThemeWindow {
  id: HolidayThemeId;
  first: HDate;
  last: HDate;
}

/** Le thème de Tichri s'installe deux semaines avant Roch Hachana. */
const TICHRI_LEAD_DAYS = 14;
/** Pessah et Chavouot s'annoncent une semaine avant. */
const WEEK_LEAD_DAYS = 7;

/**
 * Les fenêtres des thèmes pour l'année hébraïque `year`, celle qui s'ouvre à
 * Roch Hachana : la fenêtre de Tichri commence donc en Eloul de l'année
 * d'avant, les autres tombent dans l'année.
 *
 * - Tichri tient jusqu'à Kippour ; Souccot prend le lendemain, le jour où
 *   l'on commence la soucca, et tient jusqu'au lendemain de Sim'hat Torah,
 *   compté comme en diaspora (le 23 Tichri) : le thème ne sait pas où l'on
 *   est, et un jour de plus ne gêne personne.
 * - 'Hanouka : les huit jours, pas un de plus.
 * - Tou Bichvat : le jour même.
 * - Pourim : la veille (le jeûne d'Esther) et le lendemain (Chouchan
 *   Pourim) ; en année embolismique, c'est le Pourim d'Adar II.
 * - Pessah et Chavouot : une semaine avant, jusqu'au lendemain de la fête,
 *   comptée comme en diaspora (huit jours, deux jours).
 */
export function holidayThemeWindows(year: number): HolidayThemeWindow[] {
  const rochHachana = new HDate(1, months.TISHREI, year);
  const hanouka = new HDate(25, months.KISLEV, year);
  const pourim = new HDate(14, HDate.isLeapYear(year) ? months.ADAR_II : months.ADAR_I, year);
  const pessah = new HDate(15, months.NISAN, year);
  const chavouot = new HDate(6, months.SIVAN, year);
  return [
    {
      id: "tichri",
      first: new HDate(rochHachana.abs() - TICHRI_LEAD_DAYS),
      last: new HDate(10, months.TISHREI, year),
    },
    {
      id: "souccot",
      first: new HDate(11, months.TISHREI, year),
      last: new HDate(24, months.TISHREI, year),
    },
    { id: "hanouka", first: hanouka, last: new HDate(hanouka.abs() + 7) },
    {
      id: "toubichvat",
      first: new HDate(15, months.SHVAT, year),
      last: new HDate(15, months.SHVAT, year),
    },
    { id: "pourim", first: new HDate(pourim.abs() - 1), last: new HDate(pourim.abs() + 1) },
    {
      id: "pessah",
      first: new HDate(pessah.abs() - WEEK_LEAD_DAYS),
      last: new HDate(23, months.NISAN, year),
    },
    {
      id: "chavouot",
      first: new HDate(chavouot.abs() - WEEK_LEAD_DAYS),
      last: new HDate(8, months.SIVAN, year),
    },
  ];
}

/** Le thème que ce jour civil appelle, ou null hors des fêtes. */
export function holidayThemeOn(date: Date): HolidayTheme | null {
  const day = new HDate(date);
  const abs = day.abs();
  // Fin Eloul appartient encore à l'année qui s'achève, et la fenêtre de
  // Tichri de l'année suivante y commence : on regarde les deux années.
  for (const year of [day.getFullYear(), day.getFullYear() + 1]) {
    for (const window of holidayThemeWindows(year)) {
      if (abs >= window.first.abs() && abs <= window.last.abs()) {
        return holidayThemeById(window.id);
      }
    }
  }
  return null;
}
