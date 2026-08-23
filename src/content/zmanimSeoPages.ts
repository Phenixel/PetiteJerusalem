/**
 * Pages SEO des horaires et du calendrier, générées au build, dans les trois
 * langues.
 *
 * Ces routes existent dans l'application (ZmanimPage, CalendarPage) mais,
 * sans ce module, les crawlers ne recevaient que la coquille vide app.html :
 * rien à indexer pour « horaires de chabbat », « allumage des bougies », « à
 * quelle heure est le netz » ou « date de Roch Hachana ». On prérend donc un
 * contenu réel, calculé à la date du build :
 *
 * - /horaires : les prochains horaires d'entrée et de sortie de Chabbat et
 *   des fêtes à Paris, les zmanim du jour, la paracha des semaines qui
 *   viennent et l'annuaire des villes ;
 * - /horaires/<ville> : la même chose pour chaque ville du catalogue ;
 * - /calendrier : les fêtes de l'année hébraïque en cours et de la suivante,
 *   plus les dates des grandes fêtes sur plusieurs années ;
 * - /calendrier/<fete> : une page par fête, avec ses dates sur six ans et ses
 *   heures d'entrée et de sortie.
 *
 * Chacune existe en français, en anglais et en hébreu, à trois adresses
 * distinctes (/horaires, /en/shabbat-times, /he/zmanei-shabbat) reliées par
 * des hreflang : sans cela, seule la version française était visible des
 * moteurs. Les phrases vivent dans zmanimSeoStrings.ts, écrites langue par
 * langue ; ce module n'assemble que les tableaux et les liens.
 *
 * Il vit à part de seoPages.ts : il importe @hebcal/core (via zmanimService),
 * trop lourd pour les chunks des vues qui importent seoPages (ContentPage,
 * TehilimPage). Il n'est chargé que par scripts/prerender-seo.mjs (au build,
 * via jiti), par scripts/indexnow.mjs et par les tests. Les horaires montrés
 * aux visiteurs, eux, restent calculés sur l'appareil : Vue remplace ce
 * contenu au montage.
 *
 * Les heures embarquées sont calculées à la date du build. Les tableaux
 * couvrent plusieurs semaines ou plusieurs années pour rester justes entre
 * deux déploiements, et chaque ligne est datée : même ancienne, elle reste
 * exacte.
 */

import { HDate, Locale, Sedra } from "@hebcal/core";
import citiesJson from "../datas/cities.json";
import localeMessages from "../locales/fr";
import enMessages from "../locales/en";
import heMessages from "../locales/he";
import { getParashaForShabbat } from "../services/dailyCycles";
import { hubPath } from "./etudeTexts";
import {
  DEFAULT_PLACE,
  candleLightingMinutes,
  computeZmanim,
  festivalsOn,
  formatHebrewDate,
  formatZmanTime,
  hebrewDayOf,
  nightfallOf,
  placeFromCity,
  restPeriodAt,
  yearCalendar,
  type CalendarEntry,
  type City,
  type RestPeriod,
  type ZmanimPlace,
} from "../services/zmanimService";
import { SEO_FESTIVALS, type SeoFestival } from "./zmanimFestivals";
import {
  COUNTRY_ORDER,
  FEATURED_CITY_NAMES,
  HUB_CITY_NAME,
  cityName,
  citySlug,
  countryName,
  inCountry,
} from "./zmanimCities";
import { ZMANIM_STRINGS, type Faq, type ZmanimLinks, type ZmanimStrings } from "./zmanimSeoStrings";
import { SEO_LOCALES, alternatesOf, fileForPath, sectionPath, type SeoLocale } from "./seoLocales";
import {
  SITE_URL,
  breadcrumb,
  faqHtml,
  faqJsonLd,
  type SeoPage,
  type SitemapEntry,
} from "./seoPages";

const TZ = DEFAULT_PLACE.tzid;

/** Les libellés des zmanim, déjà traduits pour l'application. */
const ZMAN_MESSAGES: Record<
  SeoLocale,
  { names: Record<string, string>; hints: Record<string, string> }
> = {
  fr: localeMessages.zmanim as never,
  en: enMessages.zmanim as never,
  he: heMessages.zmanim as never,
};

/** Israël ou diaspora, pour le cycle des parachiot (même règle que zmanimService). */
const isIsraelPlace = (place: ZmanimPlace): boolean => place.tzid === "Asia/Jerusalem";

/** hebcal-fr écrit « H̲anoukah » (H + trait souscrit) : on retire la marque. */
const cleanName = (name: string): string => name.replace(/[̱̲]/g, "");

/** « 20:32 », l'instant vu du lieu. */
const clock = (date: Date, tz: string, locale: SeoLocale): string =>
  formatZmanTime(date, tz, locale);

/** « vendredi 21 août 2026 », un instant précis vu du lieu. */
const instantDayYear = (date: Date, tz: string, s: ZmanimStrings): string =>
  new Intl.DateTimeFormat(s.intl, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: tz,
  }).format(date);

/** « ven. 11 sept. à 19:54 » : la cellule compacte d'un tableau d'horaires. */
const instantCell = (date: Date, tz: string, locale: SeoLocale, s: ZmanimStrings): string =>
  s.at(
    new Intl.DateTimeFormat(s.intl, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: tz,
    }).format(date),
    clock(date, tz, locale),
  );

// Les dates civiles issues de HDate.greg() sont construites à midi dans le
// repère local de la machine : on les formate sans fuseau, dans ce même
// repère, pour ne jamais glisser d'un jour (même logique que CalendarPage).

/** « samedi 12 septembre 2026 », le jour civil d'une date hébraïque. */
const civilDayYear = (date: Date, s: ZmanimStrings): string =>
  new Intl.DateTimeFormat(s.intl, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

/**
 * Le début d'une plage « du samedi 12 au dimanche 13 septembre 2026 » : le
 * mois ne s'écrit qu'une fois quand les deux bouts le partagent, mais il
 * reparaît dès que la plage change de mois (« du samedi 31 mars au samedi
 * 7 avril 2029 »), sans quoi la première date devient fausse.
 */
const civilRangeStart = (from: Date, to: Date, s: ZmanimStrings): string => {
  const sameYear = from.getFullYear() === to.getFullYear();
  return new Intl.DateTimeFormat(s.intl, {
    weekday: "long",
    day: "numeric",
    ...(sameYear && from.getMonth() === to.getMonth() ? {} : { month: "long" }),
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(from);
};

/**
 * « 15 Nissan 5786 », ou « du 15 au 22 Nissan 5786 » : le mois hébraïque ne
 * s'écrit qu'une fois quand la plage n'en change pas.
 */
function hebrewRange(first: HDate, last: HDate, locale: SeoLocale, s: ZmanimStrings): string {
  const to = formatHebrewDate(last, locale);
  if (first.abs() === last.abs()) return to;
  if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
    return s.range(String(first.getDate()), to);
  }
  return s.range(formatHebrewDate(first, locale), to);
}

/** « sam. 12 sept. », la cellule compacte d'une date civile. */
const civilCell = (date: Date, s: ZmanimStrings): string =>
  new Intl.DateTimeFormat(s.intl, { weekday: "short", day: "numeric", month: "short" }).format(
    date,
  );

/** « sam. 12 sept. 2026 » : la même, datée, quand la colonne ne dit pas l'année. */
const civilCellYear = (date: Date, s: ZmanimStrings): string =>
  new Intl.DateTimeFormat(s.intl, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);

/**
 * Les temps de repos (Chabbat et Yom Tov) à venir au lieu donné, du jour du
 * build à l'horizon demandé. Même parcours que restPeriodsNear, sans sa
 * limite à deux blocs : ici on veut le tableau des semaines qui viennent.
 */
export function upcomingRestPeriods(
  place: ZmanimPlace,
  now: Date,
  horizonDays: number,
  locale: SeoLocale = "fr",
): RestPeriod[] {
  const periods: RestPeriod[] = [];
  const firstAbs = hebrewDayOf(place, now).abs();
  let abs = firstAbs;
  while (abs <= firstAbs + horizonDays) {
    const period = restPeriodAt(place, new HDate(abs), locale);
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
function parashaName(place: ZmanimPlace, period: RestPeriod, locale: SeoLocale): string | null {
  if (!period.shabbat) return null;
  const hd = new HDate(period.shabbat);
  const reading = new Sedra(hd.getFullYear(), isIsraelPlace(place)).lookup(hd);
  if (reading.chag) return null;
  return reading.parsha.map((name) => cleanName(Locale.gettext(name, locale))).join(" - ");
}

/** « Chabbat Ki Tétzé », « Chabbat Roch Hachanah » ou « Yom Kippour ». */
function periodLabel(place: ZmanimPlace, period: RestPeriod, locale: SeoLocale, s: ZmanimStrings) {
  if (period.festivals.length) {
    const names = cleanName(period.festivals.join(" · "));
    return period.shabbat ? s.shabbatOf(names) : names;
  }
  const parasha = parashaName(place, period, locale);
  return parasha ? s.shabbatOf(parasha) : s.shabbat;
}

/** Les lignes du tableau entrée/sortie d'un lieu. */
function restRows(
  place: ZmanimPlace,
  periods: RestPeriod[],
  locale: SeoLocale,
  s: ZmanimStrings,
): string {
  return periods
    .map(
      (p) => `
          <tr>
            <td>${periodLabel(place, p, locale, s)}</td>
            <td>${instantCell(p.start, place.tzid, locale, s)}</td>
            <td>${instantCell(p.end, place.tzid, locale, s)}</td>
          </tr>`,
    )
    .join("");
}

/** Un tableau, en-tête et lignes. */
const table = (head: string[], rows: string): string => `
      <table class="seo-table">
        <thead>
          <tr>${head.map((cell) => `<th>${cell}</th>`).join("")}</tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>`;

/** Une section : un titre, puis ce qui suit. */
const section = (title: string, html: string): string => `
    <section class="seo-section">
      <h2>${title}</h2>
      ${html}
    </section>`;

// ---- Les zmanim du jour, prérendus --------------------------------------

/**
 * Les horaires halakhiques de la journée, nommés comme dans l'application
 * (mêmes libellés que src/locales, jamais deux vocabulaires pour la même
 * chose) et suivis de ce qu'ils marquent.
 *
 * Le tableau vaut pour le jour du build : il est daté en toutes lettres, et
 * la page rappelle que l'application recalcule celui d'aujourd'hui. C'est ce
 * qui manquait pour qu'une recherche « heure du netz à Lyon » trouve autre
 * chose qu'une coquille vide.
 */
function zmanimTable(place: ZmanimPlace, now: Date, locale: SeoLocale, s: ZmanimStrings): string {
  const times = computeZmanim(place, now);
  if (!times.length) return "";
  const { names, hints } = ZMAN_MESSAGES[locale];
  const rows = times
    .map(
      (zman) => `
          <tr>
            <td>${names[zman.key] ?? zman.key}</td>
            <td>${clock(zman.date, place.tzid, locale)}</td>
            <td>${hints[zman.key] ?? ""}</td>
          </tr>`,
    )
    .join("");
  return table(s.zmanimHead, rows);
}

/** L'heure d'un zman précis au lieu donné, pour les réponses de FAQ. */
function zmanAt(place: ZmanimPlace, now: Date, key: string, locale: SeoLocale): string | null {
  const zman = computeZmanim(place, now).find((z) => z.key === key);
  return zman ? clock(zman.date, place.tzid, locale) : null;
}

/**
 * Les questions de FAQ sur les zmanim d'un lieu, datées comme le reste : une
 * heure du jour du build reste vraie pour ce jour-là.
 */
function zmanimFaq(
  place: ZmanimPlace,
  now: Date,
  where: string,
  locale: SeoLocale,
  s: ZmanimStrings,
): Faq[] {
  const day = instantDayYear(now, place.tzid, s);
  const netz = zmanAt(place, now, "sunrise", locale);
  const chema = zmanAt(place, now, "sofZmanShma", locale);
  const chkia = zmanAt(place, now, "sunset", locale);
  const tzeit = zmanAt(place, now, "tzeit", locale);
  const faq: Faq[] = [];
  if (netz) faq.push(s.faqSunrise(where, day, netz));
  if (chema) faq.push(s.faqShema(where, day, chema));
  if (chkia && tzeit) faq.push(s.faqShkiaTzeit(where, day, chkia, tzeit));
  return faq;
}

// ---- Villes -------------------------------------------------------------

/**
 * Les villes qui reçoivent leur page : tout le catalogue sauf Paris, dont
 * /horaires est déjà la page. L'ordre du catalogue est celui du sélecteur de
 * l'application (les grandes communautés d'abord) ; on le garde.
 */
export function seoCities(): City[] {
  return (citiesJson as City[]).filter((city) => city.name !== HUB_CITY_NAME);
}

/** Distance approximative entre deux villes, en kilomètres (formule de haversine). */
function distanceKm(a: City, b: City): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Les villes les plus proches, pour un maillage qui suit la géographie. */
function nearestCities(city: City, all: City[], count: number): { city: City; km: number }[] {
  return all
    .filter((other) => other.name !== city.name)
    .map((other) => ({ city: other, km: distanceKm(city, other) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, count);
}

/** Le chemin de la page d'une ville, dans la langue demandée. */
const cityPath = (name: string, locale: SeoLocale): string =>
  name === HUB_CITY_NAME
    ? sectionPath("horaires", locale)
    : sectionPath("horaires", locale, citySlug(name));

/** Le lien d'une ville vers sa page d'horaires (Paris renvoie au hub). */
const cityLink = (name: string, locale: SeoLocale, s: ZmanimStrings): string =>
  `<a href="${cityPath(name, locale)}">${s.cityLink(cityName(name, locale))}</a>`;

/** L'annuaire complet, groupé par pays : le public d'abord, le reste ensuite. */
function citiesByCountry(cities: City[], locale: SeoLocale, s: ZmanimStrings): string {
  const groups = new Map<string, City[]>();
  for (const city of cities) {
    const group = groups.get(city.country);
    if (group) group.push(city);
    else groups.set(city.country, [city]);
  }
  const rank = (code: string): number => {
    const index = COUNTRY_ORDER.indexOf(code);
    return index === -1 ? COUNTRY_ORDER.length : index;
  };
  return [...groups.entries()]
    .sort(
      ([a], [b]) =>
        rank(a) - rank(b) || countryName(a, locale).localeCompare(countryName(b, locale), s.intl),
    )
    .map(([code, group]) => {
      const links = group
        .map((city) => `<li>${cityLink(city.name, locale, s)}</li>`)
        .join("\n          ");
      return `
      <h3>${s.countryHeading(inCountry(code, locale))}</h3>
      <ul>
          ${links}
      </ul>`;
    })
    .join("\n");
}

// ---- /horaires : horaires de Chabbat semaine par semaine -----------------

/** Douze semaines d'avance : le tableau reste juste entre deux déploiements. */
const HORAIRES_HORIZON_DAYS = 12 * 7;

/**
 * La paracha des Chabbats qui viennent, chacune liée à son texte dans la
 * bibliothèque : la question « quelle est la paracha de la semaine » est
 * l'une des plus posées, et la réponse mène ici à la lecture elle-même.
 * Calendrier de diaspora, comme le reste du hub (calculé pour Paris).
 */
/**
 * Le nom d'une paracha tel que le tableau l'affiche : celui de la
 * bibliothèque, rendu en hébreu sur la page hébraïque. La FAQ passe par le
 * même chemin, sans quoi elle nommerait la paracha en caractères latins au
 * milieu du texte hébreu.
 */
function parashaLabel(
  parasha: NonNullable<ReturnType<typeof getParashaForShabbat>>,
  index: number,
  locale: SeoLocale,
): string {
  const entry = parasha.entries[index];
  return locale === "he"
    ? (Locale.gettext(parasha.names[index] ?? entry.name, "he") ?? entry.name)
    : entry.name;
}

function parashaRows(periods: RestPeriod[], locale: SeoLocale, s: ZmanimStrings): string {
  return periods
    .flatMap((period) => {
      if (!period.shabbat) return [];
      const parasha = getParashaForShabbat(period.shabbat);
      if (!parasha) return [];
      const links = parasha.entries
        .map(
          (entry, index) => `<a href="${hubPath(entry)}">${parashaLabel(parasha, index, locale)}</a>`,
        )
        .join(" · ");
      return [
        `
          <tr>
            <td>${links}</td>
            <td>${civilCell(period.shabbat, s)}</td>
            <td>${instantCell(period.start, TZ, locale, s)}</td>
          </tr>`,
      ];
    })
    .join("");
}

/** Les chemins vers lesquels les pages d'une langue renvoient. */
const linksOf = (locale: SeoLocale): ZmanimLinks => ({
  horaires: sectionPath("horaires", locale),
  calendrier: sectionPath("calendrier", locale),
  zmanim: sectionPath("zmanim", locale),
  paracha: sectionPath("paracha", locale),
});

/** Le chemin de la page d'une fête, désignée par son slug français. */
function festivalPathOf(frSlug: string, locale: SeoLocale): string {
  const festival = SEO_FESTIVALS.find((f) => f.slugs.fr === frSlug);
  return sectionPath("calendrier", locale, festival ? festival.slugs[locale] : frSlug);
}

function buildHorairesPage(now: Date, locale: SeoLocale): SeoPage {
  const s = ZMANIM_STRINGS[locale];
  const links = linksOf(locale);
  const periods = upcomingRestPeriods(DEFAULT_PLACE, now, HORAIRES_HORIZON_DAYS, locale);
  const nextShabbat = periods.find((p) => p.shabbat) ?? periods[0];
  const cities = seoCities();
  const hubCity = cityName(HUB_CITY_NAME, locale);
  const day = instantDayYear(now, TZ, s);

  const featured = FEATURED_CITY_NAMES.map((name) => `<li>${cityLink(name, locale, s)}</li>`).join(
    "\n        ",
  );

  const currentShabbat = periods.find((p) => p.shabbat)?.shabbat;
  const currentParasha = currentShabbat ? getParashaForShabbat(currentShabbat) : null;

  const faq: Faq[] = [
    ...(nextShabbat
      ? [
          s.faqShabbatStart(
            hubCity,
            instantDayYear(nextShabbat.start, TZ, s),
            clock(nextShabbat.start, TZ, locale),
            18,
          ),
          s.faqShabbatEnd(
            hubCity,
            instantDayYear(nextShabbat.end, TZ, s),
            clock(nextShabbat.end, TZ, locale),
          ),
        ]
      : []),
    s.faqHowComputed(hubCity, 18),
    s.faqJerusalem,
    ...zmanimFaq(DEFAULT_PLACE, now, s.inCity(hubCity), locale, s),
    ...(currentParasha && currentShabbat
      ? [
          s.faqParasha(
            currentParasha.entries
              .map((_, index) => parashaLabel(currentParasha, index, locale))
              .join(" - "),
            civilDayYear(currentShabbat, s),
          ),
        ]
      : []),
    s.faqOffline,
  ];

  const path = sectionPath("horaires", locale);
  return {
    file: fileForPath(path),
    path,
    locale,
    alternates: alternatesOf("horaires"),
    title: s.hubTitle,
    description: s.hubDescription,
    sitemap: { priority: 0.8, changefreq: "weekly" },
    bodyHtml: `
  <main class="seo-article">
    <h1>${s.hubH1}</h1>
    <p class="seo-lead">${s.hubLead(hubCity)}</p>
${section(
  s.hubRestTitle(hubCity),
  `${table(s.restHead, restRows(DEFAULT_PLACE, periods, locale, s))}
      <p>${s.hubRestNote(hubCity)}</p>`,
)}
${section(
  s.zmanimTitle(hubCity, day),
  `<p>${s.zmanimIntro(hubCity, day)}</p>
      ${zmanimTable(DEFAULT_PLACE, now, locale, s)}
      <p>${s.zmanimGuideNote(links.zmanim)}</p>`,
)}
${section(
  s.parashaTitle,
  `<p>${s.parashaIntro(links.paracha)}</p>
      ${table(s.parashaHead, parashaRows(periods, locale, s))}`,
)}
${section(
  s.featuredTitle,
  `<p>${s.featuredIntro}</p>
      <ul>
        ${featured}
      </ul>`,
)}
${section(
  s.directoryTitle,
  `<p>${s.directoryIntro}</p>
      ${citiesByCountry(cities, locale, s)}`,
)}
${section(
  s.festivalsTitle,
  s.festivalsHtml(links, (slug) => festivalPathOf(slug, locale)),
)}

    ${faqHtml(faq, s.hubFaqHeading)}
  </main>`,
    jsonLd: [
      breadcrumb([
        { name: s.breadcrumbHome, path: sectionPath("home", locale) },
        { name: s.hubH1, path },
      ]),
      faqJsonLd(faq),
      // Les villes mises en avant seulement : les 242 pages sont dans le
      // sitemap et liées en clair dans le corps ; les répéter toutes ici ne
      // ferait qu'alourdir la page de vingt kilo-octets de JSON.
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: s.featuredTitle,
        itemListElement: FEATURED_CITY_NAMES.map((name, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: s.cityLink(cityName(name, locale)),
          url: `${SITE_URL}${cityPath(name, locale)}`,
        })),
      },
    ],
  };
}

// ---- /horaires/:ville : les horaires d'une ville -------------------------

function buildCityPage(city: City, all: City[], now: Date, locale: SeoLocale): SeoPage {
  const s = ZMANIM_STRINGS[locale];
  const links = linksOf(locale);
  const place = placeFromCity(city);
  const slug = citySlug(city.name);
  const name = cityName(city.name, locale);
  const tz = place.tzid;
  const minutes = candleLightingMinutes(place);
  const periods = upcomingRestPeriods(place, now, HORAIRES_HORIZON_DAYS, locale);
  const nextShabbat = periods.find((p) => p.shabbat) ?? periods[0];
  const neighbours = nearestCities(city, all, 6);
  const day = instantDayYear(now, tz, s);

  const faq: Faq[] = [
    ...(nextShabbat
      ? [
          s.faqShabbatStart(
            name,
            instantDayYear(nextShabbat.start, tz, s),
            clock(nextShabbat.start, tz, locale),
            minutes,
          ),
          s.faqShabbatEnd(
            name,
            instantDayYear(nextShabbat.end, tz, s),
            clock(nextShabbat.end, tz, locale),
          ),
        ]
      : []),
    s.faqHowComputed(name, minutes),
    ...zmanimFaq(place, now, s.inCity(name), locale, s),
  ];

  const neighbourLinks = neighbours
    .map(
      ({ city: other, km }) =>
        `<li>${cityLink(other.name, locale, s)} ${s.distance(Math.round(km))}</li>`,
    )
    .join("\n        ");

  const jerusalemNote = minutes === 40 ? `<p>${s.cityJerusalemNote(name)}</p>` : "";
  const path = sectionPath("horaires", locale, slug);

  return {
    file: fileForPath(path),
    path,
    locale,
    alternates: alternatesOf("horaires", slug),
    title: s.cityTitle(name),
    description: s.cityDescription(name),
    sitemap: { priority: 0.6, changefreq: "weekly" },
    bodyHtml: `
  <main class="seo-article">
    <h1>${s.cityH1(name)}</h1>
    <p class="seo-lead">${s.cityLead(name, minutes)}</p>
${section(
  s.cityRestTitle(name),
  `${table(s.restHead, restRows(place, periods, locale, s))}
      ${jerusalemNote}
      <p>${s.cityRestNote(name, minutes, links)}</p>`,
)}
${section(
  s.zmanimTitle(name, day),
  `<p>${s.cityZmanimIntro(name, day)}</p>
      ${zmanimTable(place, now, locale, s)}
      <p>${s.zmanimGuideNote(links.zmanim)}</p>`,
)}
${section(
  s.neighboursTitle(name),
  `<p>${s.neighboursIntro(name, inCountry(city.country, locale))}</p>
      <ul>
        ${neighbourLinks}
      </ul>`,
)}

    ${faqHtml(faq, s.cityFaqHeading(name))}
  </main>`,
    jsonLd: [
      breadcrumb([
        { name: s.breadcrumbHome, path: sectionPath("home", locale) },
        { name: s.hubH1, path: links.horaires },
        { name, path },
      ]),
      faqJsonLd(faq),
    ],
  };
}

// ---- Les fêtes : socle commun au calendrier et aux pages par fête --------

/** Combien d'années hébraïques les tableaux et les FAQ des fêtes couvrent. */
const FESTIVAL_YEARS = 6;

/** L'année hébraïque à partir de laquelle on compte, au jour du build. */
const openingHebrewYear = (now: Date): number => {
  const todayHd = hebrewDayOf(DEFAULT_PLACE, now);
  const entries = yearCalendar(DEFAULT_PLACE, todayHd.getFullYear(), "fr");
  return entries.some((entry) => entry.last.abs() >= todayHd.abs())
    ? todayHd.getFullYear()
    : todayHd.getFullYear() + 1;
};

/** Une année hébraïque et ses fêtes, dans une langue. */
type YearEntries = { year: number; entries: CalendarEntry[] };

/**
 * Les entrées d'une fête dans une année, reconnues à leur nom hebcal exact
 * dans la langue du calendrier. L'égalité est stricte : sans quoi Pourim
 * attraperait Chouchan Pourim. Pessah en compte deux, séparées par le
 * 'Hol haMoed.
 */
function entriesOf(entries: CalendarEntry[], def: SeoFestival, locale: SeoLocale) {
  return entries.filter((entry) => cleanName(entry.name) === def.names[locale]);
}

/**
 * Un bloc d'une fête, réduit à ses propres jours.
 *
 * Les entrées du calendrier portent les bornes du bloc de repos entier, qui
 * réunit la fête et le Chabbat qui la jouxte : c'est la bonne présentation
 * pour le calendrier (on vit le bloc d'un trait), mais pas pour dater la fête.
 * Présenté tel quel, Chavouot 5789 « commencerait » le vendredi soir, un jour
 * trop tôt : le samedi 5 Sivan est le Chabbat, pas la fête. Ici, les dates
 * sont celles de la fête seule ; l'entrée est l'allumage de sa veille (la
 * sortie du Chabbat quand la veille en est un), la sortie celle de son
 * dernier jour.
 */
type FestivalBlock = { first: HDate; last: HDate; start: Date | null; end: Date | null };

function festivalBlock(entry: CalendarEntry, def: SeoFestival, locale: SeoLocale): FestivalBlock {
  // « Chemini Atzéret · Simhat Torah » : le nom d'un bloc peut réunir deux
  // fêtes, chaque jour n'en porte qu'une.
  const wanted = def.names[locale].split(" · ");
  let first: HDate | null = null;
  let last: HDate | null = null;
  for (let day = entry.first; day.abs() <= entry.last.abs(); day = day.next()) {
    const owns = festivalsOn(DEFAULT_PLACE, day, locale).some((name) =>
      wanted.includes(cleanName(name)),
    );
    if (!owns) continue;
    first ??= day;
    last = day;
  }
  // Fête sans bloc de repos ('Hanouka, Pourim, les jeûnes) : ses bornes sont
  // déjà les siennes, et elle n'a ni entrée ni sortie.
  if (!first || !last || !entry.period) {
    return { first: entry.first, last: entry.last, start: null, end: null };
  }
  const start =
    first.abs() === entry.first.abs()
      ? entry.period.start
      : nightfallOf(DEFAULT_PLACE, first.prev());
  const end =
    last.abs() === entry.last.abs() ? entry.period.end : nightfallOf(DEFAULT_PLACE, last);
  return { first, last, start, end };
}

/** Les blocs d'une fête dans une année, réduits à leurs propres jours. */
function blocksOf(entries: CalendarEntry[], def: SeoFestival, locale: SeoLocale): FestivalBlock[] {
  return entriesOf(entries, def, locale).map((entry) => festivalBlock(entry, def, locale));
}

/** Des jours qui se suivent : un bloc de repos, ou un bloc de fête réduit. */
type DaySpan = { first: HDate; last: HDate };

/** « jeudi 22 avril 2027 », ou « du jeudi 22 au vendredi 23 avril 2027 ». */
function entryRange(entry: DaySpan, s: ZmanimStrings): string {
  if (entry.first.abs() === entry.last.abs()) return civilDayYear(entry.first.greg(), s);
  const from = entry.first.greg();
  const to = entry.last.greg();
  return s.range(civilRangeStart(from, to, s), civilDayYear(to, s));
}

/** La plage complète d'une fête en plusieurs blocs (Pessah, du 15 au 22 Nissan). */
function spanOf<T extends DaySpan>(entries: T[]): { first: T; last: T } | null {
  if (!entries.length) return null;
  return { first: entries[0], last: entries[entries.length - 1] };
}

/** « du jeudi 2 au jeudi 9 avril 2026 » pour toute la fête, blocs compris. */
function spanRange(entries: DaySpan[], s: ZmanimStrings): string {
  const span = spanOf(entries);
  if (!span) return "";
  if (span.first.first.abs() === span.last.last.abs()) {
    return civilDayYear(span.first.first.greg(), s);
  }
  const from = span.first.first.greg();
  const to = span.last.last.greg();
  return s.range(civilRangeStart(from, to, s), civilDayYear(to, s));
}

/** La question-réponse « Quand tombe X ? » d'une fête, une année donnée. */
function festivalFaq(
  def: SeoFestival,
  blocks: FestivalBlock[],
  locale: SeoLocale,
  s: ZmanimStrings,
): Faq | null {
  const span = spanOf(blocks);
  if (!span) return null;
  const label = def.labels[locale];
  const year = span.first.first.greg().getFullYear();
  const hubCity = cityName(HUB_CITY_NAME, locale);
  if (span.first.start && span.last.end) {
    return s.faqWhenFestival(
      label,
      year,
      instantDayYear(span.first.start, TZ, s),
      clock(span.first.start, TZ, locale),
      instantDayYear(span.last.end, TZ, s),
      clock(span.last.end, TZ, locale),
      hubCity,
    );
  }
  if (def.slugs.fr === "hanouka") {
    const eve = new Date(span.first.first.greg());
    eve.setDate(eve.getDate() - 1);
    return s.faqWhenHanukkah(label, year, civilDayYear(eve, s), spanRange(blocks, s));
  }
  const when = spanRange(blocks, s);
  if (def.fast) return s.faqWhenFast(label, year, when, def.fast);
  return s.faqWhenPlain(label, year, when);
}

// ---- /calendrier : les fêtes de l'année en cours et de la suivante -------

/** « Chabbat Roch Hachanah » quand le bloc englobe un Chabbat, sinon le nom. */
function entryTitle(entry: CalendarEntry, s: ZmanimStrings): string {
  const name = cleanName(entry.name);
  return entry.period?.shabbat ? s.shabbatOf(name) : name;
}

/** Le nom de l'entrée, lié à sa page de fête quand elle en a une. */
function entryTitleLinked(entry: CalendarEntry, locale: SeoLocale, s: ZmanimStrings): string {
  const def = SEO_FESTIVALS.find((f) => f.names[locale] === cleanName(entry.name));
  const title = entryTitle(entry, s);
  return def
    ? `<a href="${sectionPath("calendrier", locale, def.slugs[locale])}">${title}</a>`
    : title;
}

function calendarRow(entry: CalendarEntry, locale: SeoLocale, s: ZmanimStrings): string {
  const period = entry.period;
  return `
          <tr>
            <td>${entryTitleLinked(entry, locale, s)}</td>
            <td>${entryRange(entry, s)}</td>
            <td>${period ? instantCell(period.start, TZ, locale, s) : ""}</td>
            <td>${period ? instantCell(period.end, TZ, locale, s) : ""}</td>
          </tr>`;
}

/**
 * Le tableau « les grandes fêtes, année après année ».
 *
 * Une colonne par année hébraïque, pas par année civile : une même année
 * hébraïque s'étale sur deux années civiles (Roch Hachana 5786 est en 2025,
 * Pessah 5786 en 2026), et une colonne « 2026 » mentirait sur la moitié de
 * ses lignes. Les cellules portent donc leur année.
 */
function multiYearTable(years: YearEntries[], locale: SeoLocale, s: ZmanimStrings): string {
  const head = years.map(({ year, entries }) => {
    const from = entries[0]?.first.greg().getFullYear();
    const to = entries[entries.length - 1]?.last.greg().getFullYear();
    const civil = from && to ? ` (${from === to ? from : `${from}-${to}`})` : "";
    return `${year}${civil}`;
  });
  const rows = SEO_FESTIVALS.map((def) => {
    const cells = years
      .map((year) => {
        const span = spanOf(blocksOf(year.entries, def, locale));
        return `<td>${span ? civilCellYear(span.first.first.greg(), s) : ""}</td>`;
      })
      .join("");
    return `
          <tr>
            <td><a href="${sectionPath("calendrier", locale, def.slugs[locale])}">${def.labels[locale]}</a></td>${cells}
          </tr>`;
  }).join("");
  return table([s.multiYearHead, ...head], rows);
}

function buildCalendrierPage(now: Date, years: YearEntries[], locale: SeoLocale): SeoPage {
  const s = ZMANIM_STRINGS[locale];
  const links = linksOf(locale);
  const today = hebrewDayOf(DEFAULT_PLACE, now).abs();
  const openingYear = years[0].year;
  const nextYear = years[1].year;
  const openingEntries = years[0].entries.filter((entry) => entry.last.abs() >= today);
  const nextEntries = years[1].entries;

  // Années civiles couvertes par ce qui est affiché : du jour du build à la
  // dernière fête de la dernière année hébraïque calculée.
  const civilFrom = now.getFullYear();
  const lastEntries = years[years.length - 1].entries;
  const lastEntry = lastEntries[lastEntries.length - 1];
  const civilTo = lastEntry ? lastEntry.last.greg().getFullYear() : civilFrom + 1;

  const faq = SEO_FESTIVALS.flatMap((def) => {
    for (const year of years) {
      // La fête entière tant qu'elle n'est pas finie : filtrée bloc par bloc,
      // un build pendant 'Hol haMoed Pessah daterait la fête de ses derniers
      // jours seulement.
      const blocks = blocksOf(year.entries, def, locale);
      if (!blocks.length || blocks[blocks.length - 1].last.abs() < today) continue;
      const faqEntry = festivalFaq(def, blocks, locale, s);
      if (faqEntry) return [faqEntry];
    }
    return [];
  });

  const openingSection = openingEntries.length
    ? section(
        s.calendarOpeningTitle(openingYear),
        table(s.calendarHead, openingEntries.map((e) => calendarRow(e, locale, s)).join("")),
      )
    : "";

  const festivalLinks = SEO_FESTIVALS.map(
    (def) =>
      `<li><a href="${sectionPath("calendrier", locale, def.slugs[locale])}">${s.festivalListItem(def.labels[locale])}</a></li>`,
  ).join("\n        ");

  const path = sectionPath("calendrier", locale);
  return {
    file: fileForPath(path),
    path,
    locale,
    alternates: alternatesOf("calendrier"),
    title: s.calendarTitle,
    description: s.calendarDescription(civilFrom, civilTo),
    sitemap: { priority: 0.7, changefreq: "weekly" },
    bodyHtml: `
  <main class="seo-article">
    <h1>${s.calendarH1(openingYear, nextYear, civilFrom, civilTo)}</h1>
    <p class="seo-lead">${s.calendarLead}</p>
${openingSection}
${section(
  s.calendarNextTitle(nextYear),
  table(s.calendarHead, nextEntries.map((e) => calendarRow(e, locale, s)).join("")),
)}
${section(
  s.multiYearTitle(years.length),
  `<p>${s.multiYearIntro}</p>
      ${multiYearTable(years, locale, s)}`,
)}
${section(
  s.festivalListTitle,
  `<ul>
        ${festivalLinks}
      </ul>`,
)}
${section(s.calendarShabbatTitle, s.calendarShabbatHtml(links))}

    ${faqHtml(faq, s.calendarFaqHeading)}
  </main>`,
    jsonLd: [
      breadcrumb([
        { name: s.breadcrumbHome, path: sectionPath("home", locale) },
        { name: s.calendarH1(openingYear, nextYear, civilFrom, civilTo), path },
      ]),
      faqJsonLd(faq),
    ],
  };
}

// ---- /calendrier/:fete : une page par fête -------------------------------

function buildFestivalPage(
  def: SeoFestival,
  years: YearEntries[],
  today: number,
  locale: SeoLocale,
): SeoPage | null {
  const s = ZMANIM_STRINGS[locale];
  const links = linksOf(locale);
  const label = def.labels[locale];

  // Seules les occurrences à venir : une page qui s'ouvre sur « Hanouka 2025 »
  // a l'air périmée, même quand la date est juste.
  const perYear = years
    .map((year) => blocksOf(year.entries, def, locale))
    .filter((blocks) => blocks.length > 0 && blocks[blocks.length - 1].last.abs() >= today)
    .slice(0, FESTIVAL_YEARS);
  if (!perYear.length) return null;

  // Un Yom Tov a une entrée et une sortie ; un jeûne ou une fête de travail
  // permis n'en a pas, et deux colonnes vides valent moins que pas de colonne.
  const hasTimes = perYear.some((blocks) => blocks.some((block) => block.start && block.end));
  // Pessah compte deux blocs de fête séparés par le 'Hol haMoed : l'entrée est
  // celle du premier jour, la sortie celle du dernier.
  const splitFestival = perYear.some((blocks) => blocks.length > 1);

  const rows = perYear
    .map((blocks) => {
      const span = spanOf(blocks);
      if (!span) return "";
      const times = hasTimes
        ? `
            <td>${span.first.start ? instantCell(span.first.start, TZ, locale, s) : ""}</td>
            <td>${span.last.end ? instantCell(span.last.end, TZ, locale, s) : ""}</td>`
        : "";
      return `
          <tr>
            <td>${span.first.first.greg().getFullYear()}</td>
            <td>${spanRange(blocks, s)}</td>
            <td>${hebrewRange(span.first.first, span.last.last, locale, s)}</td>${times}
          </tr>`;
    })
    .join("");

  const faq = perYear.flatMap((blocks) => {
    const entry = festivalFaq(def, blocks, locale, s);
    return entry ? [entry] : [];
  });
  faq.push(s.faqFestivalWork(label, hasTimes, Boolean(def.fast)));
  faq.push(s.faqFestivalCity(label));

  const span = spanOf(perYear[0]);
  const fromYear = span ? span.first.first.greg().getFullYear() : 0;
  const head = hasTimes
    ? [...s.festivalHead, s.calendarHead[2], s.calendarHead[3]]
    : [...s.festivalHead];
  const path = sectionPath("calendrier", locale, def.slugs[locale]);

  return {
    file: fileForPath(path),
    path,
    locale,
    alternates: Object.fromEntries(
      SEO_LOCALES.map((l) => [l, sectionPath("calendrier", l, def.slugs[l])]),
    ),
    title: s.festivalTitle(label),
    description: s.festivalDescription(label, perYear.length, fromYear, hasTimes),
    sitemap: { priority: 0.6, changefreq: "monthly" },
    bodyHtml: `
  <main class="seo-article">
    <h1>${s.festivalH1(label)}</h1>
    <p class="seo-lead">${s.festivalIntro[def.slugs.fr] ?? ""}</p>
${section(
  s.festivalWhenTitle(label),
  `${table(head, rows)}
      ${splitFestival ? `<p>${s.festivalSplitNote(label)}</p>` : ""}
      <p>${hasTimes ? s.festivalTimesNote(links) : s.festivalNoTimesNote(links)}</p>`,
)}
${section(s.festivalAroundTitle(label), s.festivalAroundHtml(links))}

    ${faqHtml(faq, s.festivalFaqHeading(label))}
  </main>`,
    jsonLd: [
      breadcrumb([
        { name: s.breadcrumbHome, path: sectionPath("home", locale) },
        { name: s.calendarTitle.split(":")[0], path: links.calendrier },
        { name: label, path },
      ]),
      faqJsonLd(faq),
    ],
  };
}

// ---- Assemblage ----------------------------------------------------------

export type ZmanimSeoBuild = { pages: SeoPage[]; sitemapEntries: SitemapEntry[] };

/**
 * Toutes les pages (hub des horaires, une page par ville, calendrier, une
 * page par fête), dans les trois langues, et leurs entrées de sitemap,
 * calculées à `now` (la date du build en production, une date fixe dans les
 * tests).
 */
export function buildZmanimSeoPages(now: Date = new Date()): ZmanimSeoBuild {
  const cities = seoCities();
  const all = citiesJson as City[];

  const opening = openingHebrewYear(now);
  // Une année de plus que ce qu'on affiche : les fêtes déjà passées de
  // l'année en cours sont écartées des pages par fête, et il en faut une de
  // rab pour que le tableau garde ses six lignes.
  const yearNumbers = Array.from({ length: FESTIVAL_YEARS + 1 }, (_, i) => opening + i);
  const yearsByLocale = Object.fromEntries(
    SEO_LOCALES.map((locale) => [
      locale,
      yearNumbers.map((year) => ({
        year,
        entries: yearCalendar(DEFAULT_PLACE, year, locale),
      })),
    ]),
  ) as Record<SeoLocale, YearEntries[]>;
  const today = hebrewDayOf(DEFAULT_PLACE, now).abs();

  const pages = SEO_LOCALES.flatMap((locale) => {
    const years = yearsByLocale[locale];
    return [
      buildHorairesPage(now, locale),
      buildCalendrierPage(now, years, locale),
      ...cities.map((city) => buildCityPage(city, all, now, locale)),
      ...SEO_FESTIVALS.flatMap((def) => {
        const page = buildFestivalPage(def, years, today, locale);
        return page ? [page] : [];
      }),
    ];
  });

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
