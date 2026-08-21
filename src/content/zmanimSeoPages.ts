/**
 * Pages SEO « Horaires de Chabbat » (/horaires) et « Calendrier des fêtes »
 * (/calendrier), générées au build.
 *
 * Ces deux routes existent dans l'application (ZmanimPage, CalendarPage) mais,
 * sans ce module, les crawlers ne recevaient que la coquille vide app.html :
 * rien à indexer pour « horaires de chabbat », « allumage des bougies » ou
 * « date de Roch Hachana ». On prérend donc un contenu réel : les prochains
 * horaires d'entrée et de sortie de Chabbat et des fêtes, calculés pour Paris
 * (le repli de l'application), et le calendrier des fêtes de l'année
 * hébraïque en cours et de la suivante.
 *
 * Ce module vit à part de seoPages.ts : il importe @hebcal/core (via
 * zmanimService), trop lourd pour les chunks des vues qui importent seoPages
 * (ContentPage, TehilimPage). Il n'est chargé que par
 * scripts/prerender-seo.mjs (au build, via jiti) et par les tests. Les
 * horaires montrés aux visiteurs, eux, restent calculés sur l'appareil : Vue
 * remplace ce contenu au montage.
 *
 * Les heures embarquées sont calculées à la date du build. Le tableau couvre
 * plusieurs semaines pour rester juste entre deux déploiements, et chaque
 * ligne est datée : même ancienne, elle reste exacte.
 */

import { HDate, Locale, Sedra } from "@hebcal/core";
import {
  DEFAULT_PLACE,
  formatZmanTime,
  hebrewDayOf,
  restPeriodAt,
  yearCalendar,
  type CalendarEntry,
  type RestPeriod,
} from "../services/zmanimService";
import { breadcrumb, faqHtml, faqJsonLd, type SeoPage, type SitemapEntry } from "./seoPages";

const TZ = DEFAULT_PLACE.tzid;

/** hebcal-fr écrit « H̲anoukah » (H + trait souscrit) : on retire la marque. */
const cleanName = (name: string): string => name.replace(/[\u0331\u0332]/g, "");

/** « 20:32 », l'instant vu de Paris. */
const clock = (date: Date): string => formatZmanTime(date, TZ, "fr");

/** « vendredi 21 août 2026 », un instant précis vu de Paris. */
const instantDayYear = (date: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(date);

/** « ven. 11 sept. à 19:54 » : la cellule compacte d'un tableau d'horaires. */
const instantCell = (date: Date): string =>
  `${new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TZ,
  }).format(date)} à ${clock(date)}`;

// Les dates civiles issues de HDate.greg() sont construites à midi dans le
// repère local de la machine : on les formate sans fuseau, dans ce même
// repère, pour ne jamais glisser d'un jour (même logique que CalendarPage).

/** « samedi 12 septembre 2026 », le jour civil d'une date hébraïque. */
const civilDayYear = (date: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

/** « samedi 12 », le début d'une plage « du samedi 12 au dimanche 13… ». */
const civilDayShort = (date: Date): string =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric" }).format(date);

/**
 * Les temps de repos (Chabbat et Yom Tov) à venir à Paris, du jour du build à
 * l'horizon demandé. Même parcours que restPeriodsNear, sans sa limite à deux
 * blocs : ici on veut le tableau des semaines qui viennent.
 */
export function upcomingRestPeriods(now: Date, horizonDays: number): RestPeriod[] {
  const periods: RestPeriod[] = [];
  const firstAbs = hebrewDayOf(DEFAULT_PLACE, now).abs();
  let abs = firstAbs;
  while (abs <= firstAbs + horizonDays) {
    const period = restPeriodAt(DEFAULT_PLACE, new HDate(abs), "fr");
    if (!period) {
      abs += 1;
      continue;
    }
    if (period.end.getTime() > now.getTime()) periods.push(period);
    abs = period.last.abs() + 1;
  }
  return periods;
}

/** « Ki Tétzé », ou « Nitzavim - Vayelekh » pour une paracha double. */
function parashaName(period: RestPeriod): string | null {
  if (!period.shabbat) return null;
  const hd = new HDate(period.shabbat);
  const reading = new Sedra(hd.getFullYear(), false).lookup(hd);
  if (reading.chag) return null;
  return reading.parsha.map((name) => cleanName(Locale.gettext(name, "fr"))).join(" - ");
}

/** « Chabbat Ki Tétzé », « Chabbat Roch Hachanah » ou « Yom Kippour ». */
function periodLabel(period: RestPeriod): string {
  if (period.festivals.length) {
    const names = cleanName(period.festivals.join(" · "));
    return period.shabbat ? `Chabbat ${names}` : names;
  }
  const parasha = parashaName(period);
  return parasha ? `Chabbat ${parasha}` : "Chabbat";
}

// ---- /horaires : horaires de Chabbat semaine par semaine -----------------

/** Douze semaines d'avance : le tableau reste juste entre deux déploiements. */
const HORAIRES_HORIZON_DAYS = 12 * 7;

function buildHorairesPage(now: Date): SeoPage {
  const periods = upcomingRestPeriods(now, HORAIRES_HORIZON_DAYS);
  const nextShabbat = periods.find((p) => p.shabbat) ?? periods[0];

  const rows = periods
    .map(
      (p) => `
          <tr>
            <td>${periodLabel(p)}</td>
            <td>${instantCell(p.start)}</td>
            <td>${instantCell(p.end)}</td>
          </tr>`,
    )
    .join("");

  const faq = [
    {
      q: "A quelle heure commence Chabbat cette semaine ?",
      a: nextShabbat
        ? `Le prochain Chabbat à Paris commence le ${instantDayYear(nextShabbat.start)} avec l'allumage des bougies à ${clock(nextShabbat.start)}, soit 18 minutes avant le coucher du soleil. L'application affiche l'heure exacte pour votre ville ou votre position.`
        : "L'application affiche l'heure d'allumage des bougies de votre ville, 18 minutes avant le coucher du soleil.",
    },
    {
      q: "A quelle heure se termine Chabbat ?",
      a: nextShabbat
        ? `Chabbat se termine à la sortie des étoiles (tsét haKokhavim), le moment de la havdala. Le prochain Chabbat à Paris se termine le ${instantDayYear(nextShabbat.end)} à ${clock(nextShabbat.end)}. Pour votre ville, ouvrez la page des horaires dans l'application.`
        : "Chabbat se termine à la sortie des étoiles (tsét haKokhavim), le moment de la havdala, calculée pour votre ville par l'application.",
    },
    {
      q: "Comment l'heure d'allumage des bougies est-elle calculée ?",
      a: "L'entrée de Chabbat est fixée 18 minutes avant la chkia (le coucher du soleil), selon l'usage de la diaspora, et la sortie à la tombée de la nuit (sortie des étoiles). Le calcul astronomique se fait sur votre appareil, pour n'importe quelle ville du monde.",
    },
    {
      q: "Peut-on consulter les horaires de Chabbat hors ligne ?",
      a: "Oui. Tous les horaires sont calculés sur l'appareil, sans connexion : la page fonctionne hors ligne, et l'application propose aussi un widget d'écran d'accueil avec les horaires du jour. C'est entièrement gratuit.",
    },
  ];

  return {
    file: "horaires.html",
    path: "/horaires",
    title: "Horaires de Chabbat : allumage, sortie et zmanim du jour | Petite Jérusalem",
    description:
      "L'heure d'allumage des bougies et de sortie de Chabbat semaine par semaine, et tous les zmanim du jour (alot, fin du Chéma, chkia, tsét haKokhavim), calculés pour votre ville. Gratuit, hors ligne.",
    sitemap: { priority: 0.8, changefreq: "weekly" },
    bodyHtml: `
  <main class="seo-article">
    <h1>Horaires de Chabbat : allumage des bougies et sortie</h1>
    <p class="seo-lead">
      L'heure d'<strong>entrée de Chabbat</strong> (allumage des bougies, 18 minutes avant le
      coucher du soleil) et l'heure de <strong>sortie de Chabbat</strong> (sortie des étoiles,
      havdala), semaine par semaine. Les horaires ci-dessous sont calculés pour Paris ; ouvrez la
      page dans l'application pour votre ville ou votre position exacte, même hors ligne.
    </p>

    <section class="seo-section">
      <h2>Prochains horaires de Chabbat et des fêtes à Paris</h2>
      <table class="seo-table">
        <thead>
          <tr><th>Chabbat ou fête</th><th>Entrée (allumage)</th><th>Sortie</th></tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>
      <p>Ces horaires valent pour Paris (entrée 18 minutes avant la chkia, sortie aux étoiles).
      Pour Marseille, Lyon, Nice, Strasbourg, Toulouse, Sarcelles, Créteil, Jérusalem, Netanya ou
      n'importe quelle autre ville, l'application calcule les mêmes horaires sur votre appareil,
      à partir de votre position ou d'une ville choisie.</p>
    </section>

    <section class="seo-section">
      <h2>Tous les zmanim du jour</h2>
      <p>La page des horaires affiche aussi les horaires halakhiques de la journée, pour le lieu
      de votre choix : alot haCha'har (l'aube), misheyakir, le netz (lever du soleil), la fin du
      Chéma et de la Amida (selon le Maguen Avraham et le Gaon de Vilna), 'hatsot, min'ha guedola
      et min'ha ketana, plag hamin'ha, la chkia (coucher du soleil), le tsét haKokhavim (sortie
      des étoiles) et 'hatsot de la nuit.</p>
      <p>Voir aussi le <a href="/calendrier">calendrier des fêtes juives</a> : les dates de toutes
      les fêtes de l'année, avec leurs heures d'entrée et de sortie.</p>
    </section>

    ${faqHtml(faq, "Questions fréquentes sur les horaires de Chabbat")}
  </main>`,
    jsonLd: [
      breadcrumb([
        { name: "Accueil", path: "/" },
        { name: "Horaires de Chabbat", path: "/horaires" },
      ]),
      faqJsonLd(faq),
    ],
  };
}

// ---- /calendrier : les fêtes de l'année en cours et de la suivante -------

/**
 * Les fêtes sur lesquelles une question « Quand tombe… ? » est générée, avec
 * la graphie française la plus recherchée. `name` est le nom hebcal-fr exact
 * (après cleanName) de l'entrée du calendrier : l'égalité stricte évite de
 * confondre Pourim avec Chouchan Pourim ou Pourim Katan.
 */
const FESTIVAL_FAQS: { name: string; label: string }[] = [
  { name: "Roch Hachanah", label: "Roch Hachana" },
  { name: "Yom Kippour", label: "Yom Kippour" },
  { name: "Soukkot", label: "Souccot" },
  { name: "Chemini Atzéret · Simhat Torah", label: "Simhat Torah" },
  { name: "Hanoukah", label: "Hanouka" },
  { name: "Pourim", label: "Pourim" },
  { name: "Pessah", label: "Pessah" },
  { name: "Chavou'ot", label: "Chavouot" },
];

/** « Chabbat Roch Hachanah » quand le bloc englobe un Chabbat, sinon le nom. */
function entryTitle(entry: CalendarEntry): string {
  const name = cleanName(entry.name);
  return entry.period?.shabbat ? `Chabbat ${name}` : name;
}

/** « jeudi 22 avril 2027 », ou « du jeudi 22 au vendredi 23 avril 2027 ». */
function entryRange(entry: CalendarEntry): string {
  if (entry.first.abs() === entry.last.abs()) return civilDayYear(entry.first.greg());
  return `du ${civilDayShort(entry.first.greg())} au ${civilDayYear(entry.last.greg())}`;
}

function calendarRow(entry: CalendarEntry): string {
  const period = entry.period;
  return `
          <tr>
            <td>${entryTitle(entry)}</td>
            <td>${entryRange(entry)}</td>
            <td>${period ? instantCell(period.start) : ""}</td>
            <td>${period ? instantCell(period.end) : ""}</td>
          </tr>`;
}

/** La question-réponse « Quand tombe X ? » d'une entrée du calendrier. */
function festivalFaq(entry: CalendarEntry, label: string): { q: string; a: string } {
  const year = entry.first.greg().getFullYear();
  const q = `Quand tombe ${label} ${year} ?`;
  if (entry.period) {
    return {
      q,
      a: `${label} ${year} commence le ${instantDayYear(entry.period.start)} au soir (entrée à ${clock(entry.period.start)} à Paris) et se termine le ${instantDayYear(entry.period.end)} à la tombée de la nuit (${clock(entry.period.end)} à Paris).`,
    };
  }
  if (label === "Hanouka") {
    const eve = new Date(entry.first.greg());
    eve.setDate(eve.getDate() - 1);
    return {
      q,
      a: `La première bougie de Hanouka ${year} s'allume le ${civilDayYear(eve)} au soir ; la fête dure huit jours, ${entryRange(entry)}.`,
    };
  }
  if (entry.first.abs() === entry.last.abs()) {
    return {
      q,
      a: `${label} ${year} a lieu le ${civilDayYear(entry.first.greg())} (la fête commence la veille au soir).`,
    };
  }
  return { q, a: `${label} ${year} a lieu ${entryRange(entry)} (la fête commence la veille au soir).` };
}

function buildCalendrierPage(now: Date): SeoPage {
  const todayHd = hebrewDayOf(DEFAULT_PLACE, now);
  const today = todayHd.abs();

  // Même logique d'ouverture que CalendarPage : l'année en cours, sauf dans
  // les derniers jours d'Eloul où toutes ses fêtes sont passées.
  const currentYear = todayHd.getFullYear();
  const currentEntries = yearCalendar(DEFAULT_PLACE, currentYear, "fr");
  const openingYear = currentEntries.some((entry) => entry.last.abs() >= today)
    ? currentYear
    : currentYear + 1;
  const openingEntries = (
    openingYear === currentYear ? currentEntries : yearCalendar(DEFAULT_PLACE, openingYear, "fr")
  ).filter((entry) => entry.last.abs() >= today);
  const nextYear = openingYear + 1;
  const nextEntries = yearCalendar(DEFAULT_PLACE, nextYear, "fr");

  // Années civiles couvertes par ce qui est affiché : du jour du build à la
  // dernière fête de l'année hébraïque suivante.
  const civilFrom = now.getFullYear();
  const lastEntry = nextEntries[nextEntries.length - 1];
  const civilTo = lastEntry ? lastEntry.last.greg().getFullYear() : civilFrom + 1;

  const faq = FESTIVAL_FAQS.flatMap(({ name, label }) => {
    const entry = [...openingEntries, ...nextEntries].find((e) => cleanName(e.name) === name);
    return entry ? [festivalFaq(entry, label)] : [];
  });

  const tableHead = `
        <thead>
          <tr><th>Fête</th><th>Dates</th><th>Entrée</th><th>Sortie</th></tr>
        </thead>`;

  const openingSection = openingEntries.length
    ? `
    <section class="seo-section">
      <h2>Prochaines fêtes de l'année ${openingYear}</h2>
      <table class="seo-table">${tableHead}
        <tbody>${openingEntries.map(calendarRow).join("")}
        </tbody>
      </table>
    </section>`
    : "";

  return {
    file: "calendrier.html",
    path: "/calendrier",
    title: "Calendrier des fêtes juives : dates, entrée et sortie de chaque fête | Petite Jérusalem",
    description: `Les dates des fêtes juives ${civilFrom}-${civilTo} : Roch Hachana, Yom Kippour, Souccot, Hanouka, Pourim, Pessah, Chavouot et les jeûnes, avec l'heure d'entrée et de sortie de chaque fête.`,
    sitemap: { priority: 0.7, changefreq: "weekly" },
    bodyHtml: `
  <main class="seo-article">
    <h1>Calendrier des fêtes juives ${openingYear}-${nextYear} (${civilFrom}-${civilTo})</h1>
    <p class="seo-lead">
      Les dates de toutes les fêtes et de tous les jeûnes de l'année hébraïque, avec, pour chaque
      fête où le travail est interdit, l'heure d'entrée (allumage) et l'heure de sortie. Les
      heures ci-dessous sont calculées pour Paris ; l'application les calcule pour votre ville,
      même hors ligne.
    </p>
${openingSection}

    <section class="seo-section">
      <h2>Fêtes de l'année ${nextYear}</h2>
      <table class="seo-table">${tableHead}
        <tbody>${nextEntries.map(calendarRow).join("")}
        </tbody>
      </table>
    </section>

    <section class="seo-section">
      <h2>Chabbat, semaine par semaine</h2>
      <p>Pour l'heure d'allumage des bougies et la sortie de Chabbat chaque semaine, ainsi que
      tous les zmanim du jour, voir les <a href="/horaires">horaires de Chabbat</a>.</p>
    </section>

    ${faqHtml(faq, "Dates des prochaines fêtes juives")}
  </main>`,
    jsonLd: [
      breadcrumb([
        { name: "Accueil", path: "/" },
        { name: "Calendrier des fêtes", path: "/calendrier" },
      ]),
      faqJsonLd(faq),
    ],
  };
}

// ---- Assemblage ----------------------------------------------------------

export type ZmanimSeoBuild = { pages: SeoPage[]; sitemapEntries: SitemapEntry[] };

/**
 * Les deux pages et leurs entrées de sitemap, calculées à `now` (la date du
 * build en production, une date fixe dans les tests).
 */
export function buildZmanimSeoPages(now: Date = new Date()): ZmanimSeoBuild {
  const pages = [buildHorairesPage(now), buildCalendrierPage(now)];
  return {
    pages,
    sitemapEntries: pages.map((page) => {
      const s = page.sitemap || { priority: 0.5, changefreq: "weekly" };
      return { path: page.path, priority: s.priority, changefreq: s.changefreq };
    }),
  };
}
