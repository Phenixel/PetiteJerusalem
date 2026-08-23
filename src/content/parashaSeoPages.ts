/**
 * Le hub « Paracha de la semaine » (/paracha) et les dates de lecture
 * injectées dans les pages de parachiot de la bibliothèque, générés au build.
 *
 * Les 54 pages de textes existaient déjà et étaient indexées, mais rien n'y
 * disait quand la paracha se lit : « parachat Vayéra 2026 » ou « quelle est la
 * paracha de cette semaine » ne trouvaient donc rien. Ce module apporte les
 * deux : une phrase datée sur chaque page de texte, et un hub qui répond pour
 * la semaine en cours, puis déroule le cycle.
 *
 * Comme zmanimSeoPages, il vit hors de seoPages.ts (il tire hebcal par
 * dailyCycles) et n'est chargé que par le prérendu, indexnow et les tests. La
 * vue ParashaPage, elle, recalcule tout en direct depuis parashaCalendar.
 */

import { HDate, Locale, months } from "@hebcal/core";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { TORAH_LIVRES, hubPath } from "./etudeTexts";
import { PARASHA_PATH, parashaLabel, parashaWeeks, readingDatesByEntry } from "./parashaCalendar";
import { PARASHA_STRINGS } from "./parashaStrings";
import { SEO_LOCALES, alternatesOf, fileForPath, sectionPath, type SeoLocale } from "./seoLocales";
import type { WeeklyParasha } from "../services/dailyCycles";
import { breadcrumb, faqHtml, faqJsonLd, type SeoPage, type SitemapEntry } from "./seoPages";

/** Un cycle complet et des poussières : chaque paracha y passe au moins une fois. */
const CYCLE_WEEKS = 56;

/** Deux cycles : de quoi dater chaque paracha cette année et l'année suivante. */
const DATING_WEEKS = 110;

/**
 * « 7 novembre 2026 », sans le jour de la semaine : ces dates sont toujours
 * précédées du mot « Chabbat », et « le Chabbat samedi 7 novembre » bégaie.
 */
const dayYear = (date: Date): string =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(date);

/**
 * La phrase datée posée sur la page d'une paracha, par identifiant d'entrée.
 *
 * Elle dit quand la paracha se lit, cette année et la suivante : c'est la
 * réponse à « quand lit-on Ki Tétsé », et elle reste vraie même si le
 * déploiement date, puisqu'elle nomme ses Chabbats.
 */
export function parashaNotes(now: Date = new Date()): Map<string, string> {
  const dates = readingDatesByEntry(parashaWeeks(now, DATING_WEEKS));
  const notes = new Map<string, string>();
  const links = `Voir le <a href="${PARASHA_PATH}">calendrier des parachiot</a> et les
      <a href="/horaires">horaires de Chabbat</a> de votre ville.`;
  for (const [id, days] of dates) {
    const [first, second] = days;
    const when = second
      ? `le Chabbat ${dayYear(first)}, puis le Chabbat ${dayYear(second)}`
      : `le Chabbat ${dayYear(first)}`;
    notes.set(id, `<p class="seo-note">Cette paracha se lit ${when}. ${links}</p>`);
  }
  // Vezot Haberakha ne se lit jamais un Chabbat ordinaire : elle clôt la
  // Torah à Simhat Torah. Le cycle des Chabbats ne la voit donc pas passer,
  // et sans ce cas elle serait la seule paracha sans date.
  const simhatTorah = simhatTorahDates(now).map(dayYear).join(", puis le ");
  for (const entry of torahEntries()) {
    const id = String(entry.id);
    if (notes.has(id)) continue;
    notes.set(
      id,
      `<p class="seo-note">Cette paracha ne se lit pas un Chabbat ordinaire : elle achève la
      Torah à Simhat Torah, le ${simhatTorah}. ${links}</p>`,
    );
  }
  return notes;
}

/** Les parachiot du catalogue : les entrées Tanakh des cinq livres de la Torah. */
function torahEntries(): TextStudyJsonEntry[] {
  return (textStudiesJson as TextStudiesJson).textStudies.filter(
    (entry) => String(entry.type) === "Tanakh" && TORAH_LIVRES.has(entry.livre),
  );
}

/**
 * Les dates civiles des deux prochaines Simhat Torah. En diaspora, elle tombe
 * le 23 Tichri (le lendemain de Chemini Atséret), et c'est le calendrier de
 * diaspora que suit le cycle des parachiot du site.
 */
function simhatTorahDates(now: Date): Date[] {
  const year = new HDate(now).getFullYear();
  return [year, year + 1, year + 2]
    .map((y) => new HDate(23, months.TISHREI, y))
    .filter((hd) => hd.greg().getTime() >= now.getTime())
    .slice(0, 2)
    .map((hd) => hd.greg());
}

/** « samedi 7 novembre 2026 », dans la langue demandée. */
const localeDay = (date: Date, locale: SeoLocale): string =>
  new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

/** « sam. 7 nov. 2026 », la cellule compacte, dans la langue demandée. */
const localeCell = (date: Date, locale: SeoLocale): string =>
  new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);

/** L'étiquette Intl de chaque langue : le format des dates en dépend. */
const INTL_LOCALE: Record<SeoLocale, string> = { fr: "fr-FR", en: "en-GB", he: "he-IL" };

/**
 * Le nom d'une paracha dans la langue de la page : le catalogue le donne en
 * translittération latine (« Ki Tetze »), qui sert au français comme à
 * l'anglais ; l'hébreu veut son nom hébreu, que hebcal sait rendre.
 */
function localeParashaLabel(parasha: WeeklyParasha, locale: SeoLocale): string {
  if (locale !== "he") return parashaLabel(parasha);
  return parasha.names.map((name) => Locale.gettext(name, "he")).join(" - ");
}

function buildParashaHub(now: Date, locale: SeoLocale): SeoPage {
  const weeks = parashaWeeks(now, CYCLE_WEEKS);
  const current = weeks[0];
  const path = sectionPath("paracha", locale);
  const s = PARASHA_STRINGS[locale]({
    horaires: sectionPath("horaires", locale),
    calendrier: sectionPath("calendrier", locale),
    chneiMikra: "/bibliotheque/chnei-mikra",
    tanakh: "/bibliotheque/tanakh",
    shareReading: "/share-reading",
  });

  const currentLabel = current ? localeParashaLabel(current.parasha, locale) : "";
  const currentDate = current ? localeDay(current.shabbat, locale) : "";

  const rows = weeks
    .map(
      ({ shabbat, parasha }) => `
          <tr>
            <td>${parasha.entries
              .map(
                (entry, index) =>
                  `<a href="${hubPath(entry)}">${
                    locale === "he"
                      ? (Locale.gettext(parasha.names[index] ?? entry.name, "he") ?? entry.name)
                      : entry.name
                  }</a>`,
              )
              .join(" - ")}</td>
            <td>${localeCell(shabbat, locale)}</td>
            <td>${entryBooks(parasha.entries)}</td>
          </tr>`,
    )
    .join("");

  const faq = s.faq(currentLabel, currentDate);

  return {
    file: fileForPath(path),
    path,
    locale,
    alternates: alternatesOf("paracha"),
    title: s.title(currentLabel),
    description: s.description(currentLabel, currentDate),
    sitemap: { priority: 0.8, changefreq: "weekly" },
    bodyHtml: `
  <main class="seo-article">
    <h1>${s.h1}</h1>
    <p class="seo-lead">${current ? s.lead(currentLabel, currentDate) : s.leadFallback}</p>

    <section class="seo-section">
      <h2>${s.cycleTitle}</h2>
      <table class="seo-table">
        <thead>
          <tr><th>${s.tableHead.parasha}</th><th>${s.tableHead.shabbat}</th><th>${s.tableHead.book}</th></tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>
    </section>

    <section class="seo-section">
      <h2>${s.readTitle}</h2>
      ${s.readHtml}
    </section>

    <section class="seo-section">
      <h2>${s.shabbatTitle}</h2>
      ${s.shabbatHtml}
    </section>

    ${faqHtml(faq, s.faqHeading)}
  </main>`,
    jsonLd: [
      breadcrumb([
        { name: s.breadcrumbHome, path: sectionPath("home", locale) },
        { name: s.breadcrumbName, path },
      ]),
      faqJsonLd(faq),
    ],
  };
}

/** « Berechit », ou « Berechit · Chemot » pour une double à cheval sur deux livres. */
function entryBooks(entries: { livre: string }[]): string {
  return [...new Set(entries.map((entry) => entry.livre))].join(" · ");
}

export type ParashaSeoBuild = { pages: SeoPage[]; sitemapEntries: SitemapEntry[] };

/** Le hub /paracha et son entrée de sitemap, calculés à `now`. */
export function buildParashaSeoPages(now: Date = new Date()): ParashaSeoBuild {
  const pages = SEO_LOCALES.map((locale) => buildParashaHub(now, locale));
  return {
    pages,
    sitemapEntries: pages.map((page) => {
      const s = page.sitemap || { priority: 0.5, changefreq: "weekly" };
      return {
        path: page.path,
        priority: s.priority,
        changefreq: s.changefreq,
        alternates: page.alternates,
      };
    }),
  };
}
