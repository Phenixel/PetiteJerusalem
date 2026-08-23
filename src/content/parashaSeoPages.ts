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

import { HDate, months } from "@hebcal/core";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { TORAH_LIVRES, hubPath } from "./etudeTexts";
import { PARASHA_PATH, parashaLabel, parashaWeeks, readingDatesByEntry } from "./parashaCalendar";
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

/** « sam. 7 nov. 2026 », la cellule compacte. */
const cell = (date: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);

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

function buildParashaHub(now: Date): SeoPage {
  const weeks = parashaWeeks(now, CYCLE_WEEKS);
  const current = weeks[0];

  const rows = weeks
    .map(
      ({ shabbat, parasha }) => `
          <tr>
            <td>${parasha.entries
              .map((entry) => `<a href="${hubPath(entry)}">${entry.name}</a>`)
              .join(" - ")}</td>
            <td>${cell(shabbat)}</td>
            <td>${entryBooks(parasha.entries)}</td>
          </tr>`,
    )
    .join("");

  const faq = [
    {
      q: "Quelle est la paracha de cette semaine ?",
      a: current
        ? `Le Chabbat ${dayYear(current.shabbat)}, on lit Parachat ${parashaLabel(current.parasha)}. Le tableau ci-dessus donne la paracha de chaque Chabbat de l'année, avec un lien vers son texte en hébreu et en phonétique.`
        : "Le tableau ci-dessus donne la paracha de chaque Chabbat de l'année, avec un lien vers son texte.",
    },
    {
      q: "Qu'est-ce qu'une paracha ?",
      a: "Une paracha (parachat hachavoua, la « section de la semaine ») est la portion de la Torah lue à la synagogue le Chabbat. Les cinq livres sont découpés en 54 sections, lues d'un Chabbat à l'autre : le cycle se referme à Simhat Torah, où l'on achève le Deutéronome et où l'on recommence aussitôt la Genèse.",
    },
    {
      q: "Pourquoi lit-on parfois deux parachiot le même Chabbat ?",
      a: "Parce que l'année hébraïque compte tantôt 50 Chabbats, tantôt moins, et que les jours de fête en occupent quelques-uns. Pour que le cycle se referme à Simhat Torah, certaines paires (Vayakhel et Pekoudé, Nitzavim et Vayelekh, et d'autres) sont lues ensemble les années courtes.",
    },
    {
      q: "Où lire la paracha de la semaine en ligne ?",
      a: 'Chaque paracha a sa page dans la bibliothèque, en hébreu et en phonétique, gratuitement et sans compte. Pour le chnei mikra (chaque verset deux fois, puis le Targoum Onkelos), la <a href="/bibliotheque/chnei-mikra">page du chnei mikra</a> déroule la paracha de la semaine verset par verset.',
    },
    {
      q: "A quelle heure commence le Chabbat où on la lit ?",
      a: "L'heure d'allumage des bougies et de sortie de Chabbat de votre ville est sur la page des <a href=\"/horaires\">horaires de Chabbat</a>, semaine par semaine, avec le nom de la paracha en regard.",
    },
  ];

  return {
    file: "paracha.html",
    path: PARASHA_PATH,
    title: "Paracha de la semaine : le calendrier des parachiot et leurs textes | Petite Jérusalem",
    description: current
      ? `La paracha de la semaine : Parachat ${parashaLabel(current.parasha)} le Chabbat ${dayYear(current.shabbat)}, puis le calendrier daté des 54 parachiot, chacune liée à son texte en hébreu et en phonétique.`
      : "Le calendrier daté des 54 parachiot, chacune liée à son texte en hébreu et en phonétique, et la paracha lue à chaque Chabbat de l'année.",
    sitemap: { priority: 0.8, changefreq: "weekly" },
    bodyHtml: `
  <main class="seo-article">
    <h1>Paracha de la semaine</h1>
    <p class="seo-lead">
      ${
        current
          ? `Cette semaine, le Chabbat ${dayYear(current.shabbat)}, on lit <strong>Parachat ${parashaLabel(current.parasha)}</strong>.`
          : "La paracha lue à chaque Chabbat de l'année."
      }
      Le calendrier ci-dessous donne la paracha de chacun des prochains Chabbats, chacune liée à
      son texte en hébreu et en phonétique.
    </p>

    <section class="seo-section">
      <h2>Le calendrier des parachiot</h2>
      <table class="seo-table">
        <thead>
          <tr><th>Paracha</th><th>Chabbat</th><th>Livre</th></tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>
    </section>

    <section class="seo-section">
      <h2>Lire la paracha</h2>
      <p>Chaque paracha a sa page dans la bibliothèque, en hébreu et en phonétique. Pour le
      <a href="/bibliotheque/chnei-mikra">chnei mikra</a>, chaque verset est suivi de son Targoum
      Onkelos, et Rachi s'ajoute en option. Le <a href="/bibliotheque/tanakh">Tanakh</a> complet
      est là aussi.</p>
      <p>Pour étudier à plusieurs, une <a href="/share-reading">session de partage</a> répartit un
      texte entre les participants et suit la progression jusqu'au siyoum.</p>
    </section>

    <section class="seo-section">
      <h2>Le Chabbat où on la lit</h2>
      <p>L'heure d'entrée et de sortie du Chabbat de chaque paracha, pour votre ville, est sur la
      page des <a href="/horaires">horaires de Chabbat</a> ; les dates des fêtes sont sur le
      <a href="/calendrier">calendrier des fêtes juives</a>.</p>
    </section>

    ${faqHtml(faq, "Questions fréquentes sur la paracha de la semaine")}
  </main>`,
    jsonLd: [
      breadcrumb([
        { name: "Accueil", path: "/" },
        { name: "Paracha de la semaine", path: PARASHA_PATH },
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
  const pages = [buildParashaHub(now)];
  return {
    pages,
    sitemapEntries: pages.map((page) => {
      const s = page.sitemap || { priority: 0.5, changefreq: "weekly" };
      return { path: page.path, priority: s.priority, changefreq: s.changefreq };
    }),
  };
}
