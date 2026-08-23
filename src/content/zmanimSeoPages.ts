/**
 * Pages SEO des horaires et du calendrier, générées au build.
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
 *   plus les dates des grandes fêtes sur six ans ;
 * - /calendrier/<fete> : une page par fête, avec ses dates sur six ans et ses
 *   heures d'entrée et de sortie.
 *
 * Ce module vit à part de seoPages.ts : il importe @hebcal/core (via
 * zmanimService), trop lourd pour les chunks des vues qui importent seoPages
 * (ContentPage, TehilimPage). Il n'est chargé que par
 * scripts/prerender-seo.mjs (au build, via jiti), par scripts/indexnow.mjs et
 * par les tests. Les horaires montrés aux visiteurs, eux, restent calculés
 * sur l'appareil : Vue remplace ce contenu au montage.
 *
 * Les heures embarquées sont calculées à la date du build. Les tableaux
 * couvrent plusieurs semaines ou plusieurs années pour rester justes entre
 * deux déploiements, et chaque ligne est datée : même ancienne, elle reste
 * exacte.
 */

import { HDate, Locale, Sedra } from "@hebcal/core";
import citiesJson from "../datas/cities.json";
import fr from "../locales/fr";
import { getParashaForShabbat } from "../services/dailyCycles";
import { hubPath } from "./etudeTexts";
import {
  DEFAULT_PLACE,
  candleLightingMinutes,
  computeZmanim,
  formatHebrewDate,
  formatZmanTime,
  hebrewDayOf,
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
  citySlug,
  countryName,
  inCountry,
} from "./zmanimCities";
import {
  SITE_URL,
  breadcrumb,
  faqHtml,
  faqJsonLd,
  type SeoPage,
  type SitemapEntry,
} from "./seoPages";

const TZ = DEFAULT_PLACE.tzid;

/** Israël ou diaspora, pour le cycle des parachiot (même règle que zmanimService). */
const isIsraelPlace = (place: ZmanimPlace): boolean => place.tzid === "Asia/Jerusalem";

/** hebcal-fr écrit « H̲anoukah » (H + trait souscrit) : on retire la marque. */
const cleanName = (name: string): string => name.replace(/[\u0331\u0332]/g, "");

/** « 20:32 », l'instant vu du lieu. */
const clock = (date: Date, tz: string): string => formatZmanTime(date, tz, "fr");

/** « vendredi 21 août 2026 », un instant précis vu du lieu. */
const instantDayYear = (date: Date, tz: string): string =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: tz,
  }).format(date);

/** « ven. 11 sept. à 19:54 » : la cellule compacte d'un tableau d'horaires. */
const instantCell = (date: Date, tz: string): string =>
  `${new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: tz,
  }).format(date)} à ${clock(date, tz)}`;

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

/**
 * Le début d'une plage « du samedi 12 au dimanche 13 septembre 2026 » : le
 * mois ne s'écrit qu'une fois quand les deux bouts le partagent, mais il
 * reparaît dès que la plage change de mois (« du samedi 31 mars au samedi
 * 7 avril 2029 »), sans quoi la première date devient fausse.
 */
const civilRangeStart = (from: Date, to: Date): string => {
  const sameYear = from.getFullYear() === to.getFullYear();
  return new Intl.DateTimeFormat("fr-FR", {
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
function hebrewRange(first: HDate, last: HDate): string {
  const to = formatHebrewDate(last, "fr");
  if (first.abs() === last.abs()) return to;
  if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
    return `du ${first.getDate()} au ${to}`;
  }
  return `du ${formatHebrewDate(first, "fr")} au ${to}`;
}

/** « sam. 12 sept. », la cellule compacte d'une date civile. */
const civilCell = (date: Date): string =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(
    date,
  );

/** « sam. 12 sept. 2026 » : la même, datée, quand la colonne ne dit pas l'année. */
const civilCellYear = (date: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
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
): RestPeriod[] {
  const periods: RestPeriod[] = [];
  const firstAbs = hebrewDayOf(place, now).abs();
  let abs = firstAbs;
  while (abs <= firstAbs + horizonDays) {
    const period = restPeriodAt(place, new HDate(abs), "fr");
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
function parashaName(place: ZmanimPlace, period: RestPeriod): string | null {
  if (!period.shabbat) return null;
  const hd = new HDate(period.shabbat);
  const reading = new Sedra(hd.getFullYear(), isIsraelPlace(place)).lookup(hd);
  if (reading.chag) return null;
  return reading.parsha.map((name) => cleanName(Locale.gettext(name, "fr"))).join(" - ");
}

/** « Chabbat Ki Tétzé », « Chabbat Roch Hachanah » ou « Yom Kippour ». */
function periodLabel(place: ZmanimPlace, period: RestPeriod): string {
  if (period.festivals.length) {
    const names = cleanName(period.festivals.join(" · "));
    return period.shabbat ? `Chabbat ${names}` : names;
  }
  const parasha = parashaName(place, period);
  return parasha ? `Chabbat ${parasha}` : "Chabbat";
}

/** Les lignes du tableau entrée/sortie d'un lieu. */
function restRows(place: ZmanimPlace, periods: RestPeriod[]): string {
  return periods
    .map(
      (p) => `
          <tr>
            <td>${periodLabel(place, p)}</td>
            <td>${instantCell(p.start, place.tzid)}</td>
            <td>${instantCell(p.end, place.tzid)}</td>
          </tr>`,
    )
    .join("");
}

// ---- Les zmanim du jour, prérendus --------------------------------------

/**
 * Les horaires halakhiques de la journée, nommés comme dans l'application
 * (mêmes libellés que src/locales/fr.ts, jamais deux vocabulaires pour la
 * même chose) et suivis de ce qu'ils marquent.
 *
 * Le tableau vaut pour le jour du build : il est daté en toutes lettres, et
 * la page rappelle que l'application recalcule celui d'aujourd'hui. C'est ce
 * qui manquait pour qu'une recherche « heure du netz à Lyon » trouve autre
 * chose qu'une coquille vide.
 */
function zmanimTable(place: ZmanimPlace, now: Date): string {
  const times = computeZmanim(place, now);
  if (!times.length) return "";
  const names = fr.zmanim.names as Record<string, string>;
  const hints = fr.zmanim.hints as Record<string, string>;
  const rows = times
    .map(
      (zman) => `
          <tr>
            <td>${names[zman.key] ?? zman.key}</td>
            <td>${clock(zman.date, place.tzid)}</td>
            <td>${hints[zman.key] ?? ""}</td>
          </tr>`,
    )
    .join("");
  return `
      <table class="seo-table">
        <thead>
          <tr><th>Horaire</th><th>Heure</th><th>Ce qu'il marque</th></tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>`;
}

/** L'heure d'un zman précis au lieu donné, pour les réponses de FAQ. */
function zmanAt(place: ZmanimPlace, now: Date, key: string): string | null {
  const zman = computeZmanim(place, now).find((z) => z.key === key);
  return zman ? clock(zman.date, place.tzid) : null;
}

/** Le jour civil du lieu, en toutes lettres : « vendredi 21 août 2026 ». */
const dayLabel = (place: ZmanimPlace, now: Date): string => instantDayYear(now, place.tzid);

/**
 * Les questions de FAQ sur les zmanim d'un lieu, datées comme le reste : une
 * heure du jour du build reste vraie pour ce jour-là.
 */
function zmanimFaq(place: ZmanimPlace, now: Date, where: string): { q: string; a: string }[] {
  const day = dayLabel(place, now);
  const netz = zmanAt(place, now, "sunrise");
  const chema = zmanAt(place, now, "sofZmanShma");
  const chkia = zmanAt(place, now, "sunset");
  const tzeit = zmanAt(place, now, "tzeit");
  const faq: { q: string; a: string }[] = [];
  if (netz) {
    faq.push({
      q: `A quelle heure est le netz haHama (lever du soleil) ${where} ?`,
      a: `Le ${day}, le netz haHama ${where} est à ${netz}. C'est l'heure à partir de laquelle se dit la prière de Cha'harit selon le meilleur usage (vatikin). La page des horaires recalcule le netz du jour sur votre appareil.`,
    });
  }
  if (chema) {
    faq.push({
      q: `A quelle heure se termine le Chéma du matin ${where} ?`,
      a: `Le ${day}, la fin du Chéma ${where} est à ${chema} selon le Gaon de Vilna, et un peu plus tôt selon le Maguen Avraham. Les deux opinions sont affichées côte à côte sur la page des horaires.`,
    });
  }
  if (chkia && tzeit) {
    faq.push({
      q: `Quelle différence entre la chkia et le tsét haKokhavim ${where} ?`,
      a: `La chkia est le coucher du soleil (${chkia} le ${day} ${where}), le tsét haKokhavim la sortie des étoiles, quand la nuit est faite (${tzeit}). Entre les deux se place le bein hachmachot, dont le statut est douteux : c'est pourquoi Chabbat commence avant la chkia et se termine au tsét.`,
    });
  }
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

/** Le lien d'une ville vers sa page d'horaires (Paris renvoie au hub). */
const cityLink = (name: string): string =>
  name === HUB_CITY_NAME
    ? `<a href="/horaires">Horaires de Chabbat à ${name}</a>`
    : `<a href="/horaires/${citySlug(name)}">Horaires de Chabbat à ${name}</a>`;

/** L'annuaire complet, groupé par pays : le public d'abord, le reste ensuite. */
function citiesByCountry(cities: City[]): string {
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
    .sort(([a], [b]) => rank(a) - rank(b) || countryName(a).localeCompare(countryName(b), "fr"))
    .map(([code, group]) => {
      const links = group.map((city) => `<li>${cityLink(city.name)}</li>`).join("\n          ");
      return `
      <h3>Horaires de Chabbat ${inCountry(code)}</h3>
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
function parashaRows(periods: RestPeriod[]): string {
  return periods
    .flatMap((period) => {
      if (!period.shabbat) return [];
      const parasha = getParashaForShabbat(period.shabbat);
      if (!parasha) return [];
      const links = parasha.entries
        .map((entry) => `<a href="${hubPath(entry)}">${entry.name}</a>`)
        .join(" · ");
      return [
        `
          <tr>
            <td>Parachat ${links}</td>
            <td>${civilCell(period.shabbat)}</td>
            <td>${instantCell(period.start, TZ)}</td>
          </tr>`,
      ];
    })
    .join("");
}

function buildHorairesPage(now: Date): SeoPage {
  const periods = upcomingRestPeriods(DEFAULT_PLACE, now, HORAIRES_HORIZON_DAYS);
  const nextShabbat = periods.find((p) => p.shabbat) ?? periods[0];
  const cities = seoCities();

  const rows = restRows(DEFAULT_PLACE, periods);
  const parashiot = parashaRows(periods);
  const day = dayLabel(DEFAULT_PLACE, now);

  const featured = FEATURED_CITY_NAMES.map((name) => `<li>${cityLink(name)}</li>`).join(
    "\n        ",
  );

  const faq = [
    {
      q: "A quelle heure commence Chabbat cette semaine ?",
      a: nextShabbat
        ? `Le prochain Chabbat à Paris commence le ${instantDayYear(nextShabbat.start, TZ)} avec l'allumage des bougies à ${clock(nextShabbat.start, TZ)}, soit 18 minutes avant le coucher du soleil. L'application affiche l'heure exacte pour votre ville ou votre position.`
        : "L'application affiche l'heure d'allumage des bougies de votre ville, 18 minutes avant le coucher du soleil.",
    },
    {
      q: "A quelle heure se termine Chabbat ?",
      a: nextShabbat
        ? `Chabbat se termine à la sortie des étoiles (tsét haKokhavim), le moment de la havdala. Le prochain Chabbat à Paris se termine le ${instantDayYear(nextShabbat.end, TZ)} à ${clock(nextShabbat.end, TZ)}. Pour votre ville, ouvrez la page des horaires dans l'application.`
        : "Chabbat se termine à la sortie des étoiles (tsét haKokhavim), le moment de la havdala, calculée pour votre ville par l'application.",
    },
    {
      q: "Comment l'heure d'allumage des bougies est-elle calculée ?",
      a: "L'entrée de Chabbat est fixée 18 minutes avant la chkia (le coucher du soleil), selon l'usage de la diaspora, et la sortie à la tombée de la nuit (sortie des étoiles). Le calcul astronomique se fait sur votre appareil, pour n'importe quelle ville du monde.",
    },
    {
      q: "Pourquoi l'heure d'allumage est-elle différente à Jérusalem ?",
      a: "A Jérusalem, l'usage est d'allumer 40 minutes avant le coucher du soleil, et non 18 : la page des horaires de Jérusalem applique cet usage. Partout ailleurs, le calcul reste de 18 minutes avant la chkia.",
    },
    ...zmanimFaq(DEFAULT_PLACE, now, "à Paris"),
    {
      q: "Quelle est la paracha de cette semaine ?",
      a: (() => {
        const shabbat = periods.find((p) => p.shabbat)?.shabbat;
        const parasha = shabbat ? getParashaForShabbat(shabbat) : null;
        return parasha && shabbat
          ? `Le Chabbat du ${civilDayYear(shabbat)}, on lit Parachat ${parasha.entries.map((e) => e.name).join(" - ")}. Le tableau des semaines à venir donne la paracha de chaque Chabbat, avec un lien vers son texte.`
          : "La paracha de chaque Chabbat est donnée semaine par semaine dans le tableau des parachiot, avec un lien vers son texte dans la bibliothèque.";
      })(),
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
      "L'heure d'allumage des bougies et de sortie de Chabbat semaine par semaine, et tous les zmanim du jour (alot, netz, fin du Chéma, chkia, tsét haKokhavim), calculés pour votre ville. Gratuit, hors ligne.",
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
      Pour une autre ville, voir l'annuaire ci-dessous, ou ouvrez la page dans l'application :
      elle calcule les mêmes horaires sur votre appareil, à partir de votre position ou d'une
      ville choisie.</p>
    </section>

    <section class="seo-section">
      <h2>Les zmanim du jour à Paris (${day})</h2>
      <p>Les horaires halakhiques de la journée : l'aube, le lever du soleil, les limites du
      matin, l'après-midi, la nuit. Le tableau est celui du ${day} à Paris ; l'application
      recalcule celui d'aujourd'hui, pour le lieu de votre choix.</p>
      ${zmanimTable(DEFAULT_PLACE, now)}
      <p>Ce que veut dire chaque horaire, opinion par opinion : voir
      <a href="/zmanim">les zmanim expliqués</a>.</p>
    </section>

    <section class="seo-section">
      <h2>Paracha de la semaine, Chabbat par Chabbat</h2>
      <p>La paracha lue à chacun des prochains Chabbats, avec l'heure d'allumage à Paris. Chaque
      nom mène au texte complet dans la bibliothèque, et le calendrier complet des 54 parachiot
      est sur la page <a href="/paracha">paracha de la semaine</a>.</p>
      <table class="seo-table">
        <thead>
          <tr><th>Paracha</th><th>Chabbat</th><th>Allumage à Paris</th></tr>
        </thead>
        <tbody>${parashiot}
        </tbody>
      </table>
    </section>

    <section class="seo-section">
      <h2>Horaires de Chabbat des grandes communautés</h2>
      <p>L'heure d'allumage et de sortie de Chabbat pour les villes les plus consultées :</p>
      <ul>
        ${featured}
      </ul>
    </section>

    <section class="seo-section">
      <h2>Toutes les villes, pays par pays</h2>
      <p>Chaque ville a sa page, avec ses horaires d'entrée et de sortie de Chabbat calculés à
      ses coordonnées et ses zmanim du jour.</p>
      ${citiesByCountry(cities)}
    </section>

    <section class="seo-section">
      <h2>Fêtes juives</h2>
      <p>Voir le <a href="/calendrier">calendrier des fêtes juives</a> : les dates de toutes les
      fêtes de l'année, avec leurs heures d'entrée et de sortie, et une page par fête
      (<a href="/calendrier/roch-hachana">Roch Hachana</a>,
      <a href="/calendrier/yom-kippour">Yom Kippour</a>,
      <a href="/calendrier/pessah">Pessah</a>,
      <a href="/calendrier/hanouka">Hanouka</a>).</p>
    </section>

    ${faqHtml(faq, "Questions fréquentes sur les horaires de Chabbat")}
  </main>`,
    jsonLd: [
      breadcrumb([
        { name: "Accueil", path: "/" },
        { name: "Horaires de Chabbat", path: "/horaires" },
      ]),
      faqJsonLd(faq),
      // Les villes mises en avant seulement : les 242 pages sont dans le
      // sitemap et liées en clair dans le corps ; les répéter toutes ici ne
      // ferait qu'alourdir la page de vingt kilo-octets de JSON.
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Horaires de Chabbat par ville",
        itemListElement: FEATURED_CITY_NAMES.map((name, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: `Horaires de Chabbat à ${name}`,
          url: `${SITE_URL}/horaires/${citySlug(name)}`,
        })),
      },
    ],
  };
}

// ---- /horaires/:ville : les horaires d'une ville -------------------------

function buildCityPage(city: City, all: City[], now: Date): SeoPage {
  const place = placeFromCity(city);
  const slug = citySlug(city.name);
  const tz = place.tzid;
  const minutes = candleLightingMinutes(place);
  const periods = upcomingRestPeriods(place, now, HORAIRES_HORIZON_DAYS);
  const nextShabbat = periods.find((p) => p.shabbat) ?? periods[0];
  const neighbours = nearestCities(city, all, 6);
  const country = inCountry(city.country);
  const day = dayLabel(place, now);

  const faq = [
    {
      q: `A quelle heure commence Chabbat à ${city.name} cette semaine ?`,
      a: nextShabbat
        ? `Le prochain Chabbat à ${city.name} commence le ${instantDayYear(nextShabbat.start, tz)} avec l'allumage des bougies à ${clock(nextShabbat.start, tz)}, soit ${minutes} minutes avant le coucher du soleil.`
        : `L'allumage des bougies à ${city.name} a lieu ${minutes} minutes avant le coucher du soleil, calculé par l'application.`,
    },
    {
      q: `A quelle heure se termine Chabbat à ${city.name} ?`,
      a: nextShabbat
        ? `Chabbat se termine à la sortie des étoiles (tsét haKokhavim), le moment de la havdala. Le prochain Chabbat à ${city.name} se termine le ${instantDayYear(nextShabbat.end, tz)} à ${clock(nextShabbat.end, tz)}.`
        : `Chabbat se termine à la sortie des étoiles (tsét haKokhavim), calculée pour ${city.name} par l'application.`,
    },
    {
      q: `Comment les horaires de Chabbat de ${city.name} sont-ils calculés ?`,
      a: `L'entrée est fixée ${minutes} minutes avant la chkia (le coucher du soleil) aux coordonnées de ${city.name}, la sortie à la tombée de la nuit (sortie des étoiles). Le calcul astronomique se fait sur votre appareil, gratuitement et même hors ligne, et la page affiche aussi tous les zmanim du jour.`,
    },
    ...zmanimFaq(place, now, `à ${city.name}`),
  ];

  const neighbourLinks = neighbours
    .map(({ city: other, km }) => `<li>${cityLink(other.name)} (à ${Math.round(km)} km)</li>`)
    .join("\n        ");

  const jerusalemNote =
    minutes === 40
      ? `<p>A ${city.name}, l'usage est d'allumer 40 minutes avant le coucher du soleil, et non 18
      comme dans la plupart des communautés : les heures ci-dessus suivent cet usage.</p>`
      : "";

  return {
    file: `horaires/${slug}.html`,
    path: `/horaires/${slug}`,
    title: `Horaires de Chabbat à ${city.name} : allumage, sortie et zmanim | Petite Jérusalem`,
    description: `L'heure d'allumage des bougies (entrée de Chabbat) et l'heure de sortie de Chabbat à ${city.name}, semaine par semaine, et tous les zmanim du jour : netz, fin du Chéma, chkia, tsét haKokhavim. Gratuit, hors ligne.`,
    sitemap: { priority: 0.6, changefreq: "weekly" },
    bodyHtml: `
  <main class="seo-article">
    <h1>Horaires de Chabbat à ${city.name}</h1>
    <p class="seo-lead">
      L'heure d'<strong>entrée de Chabbat à ${city.name}</strong> (allumage des bougies,
      ${minutes} minutes avant le coucher du soleil) et l'heure de <strong>sortie de
      Chabbat</strong> (sortie des étoiles, havdala), semaine par semaine, ainsi que les fêtes à
      venir et tous les zmanim du jour à ${city.name}, même hors ligne.
    </p>

    <section class="seo-section">
      <h2>Entrée et sortie de Chabbat à ${city.name}</h2>
      <table class="seo-table">
        <thead>
          <tr><th>Chabbat ou fête</th><th>Entrée (allumage)</th><th>Sortie</th></tr>
        </thead>
        <tbody>${restRows(place, periods)}
        </tbody>
      </table>
      ${jerusalemNote}
      <p>Entrée calculée ${minutes} minutes avant la chkia de ${city.name}, sortie à la sortie
      des étoiles. Voir aussi l'annuaire des
      <a href="/horaires">horaires de Chabbat ville par ville</a> et le
      <a href="/calendrier">calendrier des fêtes juives</a>.</p>
    </section>

    <section class="seo-section">
      <h2>Les zmanim du jour à ${city.name} (${day})</h2>
      <p>Les horaires halakhiques de la journée à ${city.name} : alot haCha'har, le netz, la fin
      du Chéma et de la Amida, 'hatsot, min'ha, la chkia et le tsét haKokhavim. Le tableau est
      celui du ${day} ; l'application recalcule celui d'aujourd'hui sur votre appareil.</p>
      ${zmanimTable(place, now)}
      <p>Ce que marque chacun de ces horaires : voir
      <a href="/zmanim">les zmanim expliqués</a>.</p>
    </section>

    <section class="seo-section">
      <h2>Villes proches de ${city.name}</h2>
      <p>Les horaires changent de quelques minutes d'une ville à l'autre. Les plus proches de
      ${city.name}, ${country} et alentour :</p>
      <ul>
        ${neighbourLinks}
      </ul>
    </section>

    ${faqHtml(faq, `Questions fréquentes sur les horaires de Chabbat à ${city.name}`)}
  </main>`,
    jsonLd: [
      breadcrumb([
        { name: "Accueil", path: "/" },
        { name: "Horaires de Chabbat", path: "/horaires" },
        { name: city.name, path: `/horaires/${slug}` },
      ]),
      faqJsonLd(faq),
    ],
  };
}

// ---- Les fêtes : socle commun au calendrier et aux pages par fête --------

/**
 * Les fêtes qui reçoivent leur page, et ce qu'elles sont, en deux phrases.
 *
 * Les noms, libellés et slugs vivent dans zmanimFestivals.ts, partagé avec le
 * routeur ; seuls les textes de présentation sont ici, ils ne servent qu'au
 * prérendu. Une fête sans texte n'aurait rien à dire d'elle-même : la clé est
 * obligatoire pour chaque slug (un test le vérifie).
 */
type FestivalDef = SeoFestival & { intro: string };

const FESTIVAL_INTROS: Record<string, string> = {
  "roch-hachana":
    "Roch Hachana est le nouvel an juif et le jour du jugement : deux jours de fête, le 1er et le 2 Tichri, où l'on sonne le chofar, où l'on mange des simanim (la pomme dans le miel, la tête de poisson) et où la prière est plus longue que de coutume.",
  "jeune-guedalia":
    "Le jeûne de Guedalia, le 3 Tichri, suit Roch Hachana : il rappelle l'assassinat de Guedalia ben Ahikam, dernier gouverneur juif après la destruction du premier Temple. On jeûne de l'aube à la sortie des étoiles.",
  "yom-kippour":
    "Yom Kippour, le 10 Tichri, est le jour du Grand Pardon : un jeûne de vingt-cinq heures, de l'entrée de la fête au soir jusqu'à la sortie des étoiles du lendemain, ouvert par Kol Nidré et refermé par la Néïla et le chofar.",
  souccot:
    "Souccot, la fête des cabanes, commence le 15 Tichri : on mange (et on dort) dans la soucca sept jours durant, et l'on prend chaque matin les quatre espèces, le loulav et l'étrog. Les deux premiers jours sont Yom Tov en diaspora, les suivants 'Hol haMoed.",
  "simhat-torah":
    "Chemini Atséret et Simhat Torah closent le cycle de Tichri : on demande la pluie, puis on achève la lecture annuelle de la Torah et on la recommence aussitôt, en dansant avec les rouleaux (les hakafot).",
  hanouka:
    "Hanouka dure huit jours à partir du 25 Kislev : on allume chaque soir une bougie de plus sur la 'hanoukia, en souvenir de la fiole d'huile du Temple. Le travail y est permis, et la première bougie s'allume la veille du premier jour, au soir.",
  "10-tevet":
    "Assara beTevet, le 10 Tevet, rappelle le début du siège de Jérusalem par Nabuchodonosor. C'est un jeûne de l'aube à la sortie des étoiles.",
  "tou-bichvat":
    "Tou Bichvat, le 15 Chvat, est le nouvel an des arbres. On y mange les fruits d'Israël, et beaucoup tiennent un séder de Tou Bichvat. Le travail y est permis.",
  "jeune-esther":
    "Le jeûne d'Esther précède Pourim, le 13 Adar. On jeûne de l'aube à la sortie des étoiles, en souvenir du jeûne des Juifs de Suse avant la délivrance.",
  pourim:
    "Pourim, le 14 Adar, célèbre la délivrance racontée dans la Meguila d'Esther : on lit la Meguila le soir et le matin, on envoie des michloa'h manot, on donne aux pauvres et on fait un repas de fête. A Jérusalem, Pourim se célèbre le 15 Adar (Chouchan Pourim).",
  pessah:
    "Pessah commence le 15 Nissan et dure huit jours en diaspora (sept en Israël) : le séder et la Haggada les deux premiers soirs, le pain levé banni de la maison, puis 'Hol haMoed et deux derniers jours de fête.",
  "lag-baomer":
    "Lag Baomer, le 33e jour du compte du Omer, est le jour de la hiloula de Rabbi Chimon bar Yohaï. Le deuil du Omer s'y interrompt : on allume des feux, on coupe les cheveux, on célèbre des mariages.",
  chavouot:
    "Chavouot, le 6 Sivan, célèbre le don de la Torah au Sinaï, sept semaines après Pessah. On veille la première nuit pour étudier (le tikoun lel Chavouot), on lit les Dix Commandements et le livre de Ruth, et l'usage est de manger laitage.",
  "17-tamouz":
    "Le 17 Tamouz rappelle la brèche ouverte dans les murailles de Jérusalem. Il ouvre les trois semaines de deuil qui mènent au 9 Av. On jeûne de l'aube à la sortie des étoiles.",
  "ticha-beav":
    "Tich'a beAv, le 9 Av, est le jour de la destruction des deux Temples : un jeûne de vingt-cinq heures, du coucher du soleil à la sortie des étoiles du lendemain, où l'on lit les Lamentations assis à terre.",
};

const FESTIVALS: FestivalDef[] = SEO_FESTIVALS.map((festival) => ({
  ...festival,
  intro: FESTIVAL_INTROS[festival.slug] ?? "",
}));

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

/** Les entrées d'une fête dans une année : Pessah en compte deux (le 'Hol haMoed les sépare). */
const entriesOf = (entries: CalendarEntry[], def: FestivalDef): CalendarEntry[] =>
  entries.filter((entry) => cleanName(entry.name) === def.name);

/** « jeudi 22 avril 2027 », ou « du jeudi 22 au vendredi 23 avril 2027 ». */
function entryRange(entry: CalendarEntry): string {
  if (entry.first.abs() === entry.last.abs()) return civilDayYear(entry.first.greg());
  const from = entry.first.greg();
  const to = entry.last.greg();
  return `du ${civilRangeStart(from, to)} au ${civilDayYear(to)}`;
}

/** La plage complète d'une fête en plusieurs blocs (Pessah, du 15 au 22 Nissan). */
function spanOf(entries: CalendarEntry[]): { first: CalendarEntry; last: CalendarEntry } | null {
  if (!entries.length) return null;
  return { first: entries[0], last: entries[entries.length - 1] };
}

/** « du jeudi 2 au jeudi 9 avril 2026 » pour toute la fête, blocs compris. */
function spanRange(entries: CalendarEntry[]): string {
  const span = spanOf(entries);
  if (!span) return "";
  if (span.first.first.abs() === span.last.last.abs()) {
    return civilDayYear(span.first.first.greg());
  }
  const from = span.first.first.greg();
  const to = span.last.last.greg();
  return `du ${civilRangeStart(from, to)} au ${civilDayYear(to)}`;
}

/** La question-réponse « Quand tombe X ? » d'une fête, une année donnée. */
function festivalFaq(def: FestivalDef, entries: CalendarEntry[]): { q: string; a: string } | null {
  const span = spanOf(entries);
  if (!span) return null;
  const year = span.first.first.greg().getFullYear();
  const q = `Quand tombe ${def.label} ${year} ?`;
  const period = span.first.period;
  if (period) {
    const end = span.last.period ?? period;
    return {
      q,
      a: `${def.label} ${year} commence le ${instantDayYear(period.start, TZ)} au soir (entrée à ${clock(period.start, TZ)} à Paris) et se termine le ${instantDayYear(end.end, TZ)} à la tombée de la nuit (${clock(end.end, TZ)} à Paris).`,
    };
  }
  if (def.slug === "hanouka") {
    const eve = new Date(span.first.first.greg());
    eve.setDate(eve.getDate() - 1);
    return {
      q,
      a: `La première bougie de Hanouka ${year} s'allume le ${civilDayYear(eve)} au soir ; la fête dure huit jours, ${spanRange(entries)}.`,
    };
  }
  // Une plage garde son « du … au … » ; un jour seul veut son article.
  const when =
    span.first.first.abs() === span.last.last.abs()
      ? `le ${spanRange(entries)}`
      : spanRange(entries);
  if (def.fast === "dawn") {
    return {
      q,
      a: `${def.label} ${year} tombe ${when} : on jeûne de l'aube (alot haCha'har) à la sortie des étoiles.`,
    };
  }
  if (def.fast === "eve") {
    return {
      q,
      a: `${def.label} ${year} tombe ${when} : le jeûne commence la veille au coucher du soleil et se termine à la sortie des étoiles, vingt-cinq heures plus tard.`,
    };
  }
  return {
    q,
    a: `${def.label} ${year} a lieu ${when} (la journée commence la veille au soir).`,
  };
}

// ---- /calendrier : les fêtes de l'année en cours et de la suivante -------

/** « Chabbat Roch Hachanah » quand le bloc englobe un Chabbat, sinon le nom. */
function entryTitle(entry: CalendarEntry): string {
  const name = cleanName(entry.name);
  return entry.period?.shabbat ? `Chabbat ${name}` : name;
}

/** Le nom de l'entrée, lié à sa page de fête quand elle en a une. */
function entryTitleLinked(entry: CalendarEntry): string {
  const def = FESTIVALS.find((f) => f.name === cleanName(entry.name));
  const title = entryTitle(entry);
  return def ? `<a href="/calendrier/${def.slug}">${title}</a>` : title;
}

function calendarRow(entry: CalendarEntry): string {
  const period = entry.period;
  return `
          <tr>
            <td>${entryTitleLinked(entry)}</td>
            <td>${entryRange(entry)}</td>
            <td>${period ? instantCell(period.start, TZ) : ""}</td>
            <td>${period ? instantCell(period.end, TZ) : ""}</td>
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
function multiYearTable(years: { year: number; entries: CalendarEntry[] }[]): string {
  const head = years
    .map(({ year, entries }) => {
      const from = entries[0]?.first.greg().getFullYear();
      const to = entries[entries.length - 1]?.last.greg().getFullYear();
      const civil = from && to ? ` (${from === to ? from : `${from}-${to}`})` : "";
      return `<th>${year}${civil}</th>`;
    })
    .join("");
  const rows = FESTIVALS.map((def) => {
    const cells = years
      .map(({ entries }) => {
        const span = spanOf(entriesOf(entries, def));
        return `<td>${span ? civilCellYear(span.first.first.greg()) : ""}</td>`;
      })
      .join("");
    return `
          <tr>
            <td><a href="/calendrier/${def.slug}">${def.label}</a></td>${cells}
          </tr>`;
  }).join("");
  return `
      <table class="seo-table">
        <thead>
          <tr><th>Fête</th>${head}</tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>`;
}

function buildCalendrierPage(
  now: Date,
  years: { year: number; entries: CalendarEntry[] }[],
): SeoPage {
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

  const faq = FESTIVALS.flatMap((def) => {
    for (const { entries } of years) {
      const found = entriesOf(entries, def).filter((entry) => entry.last.abs() >= today);
      const faqEntry = festivalFaq(def, found);
      if (faqEntry) return [faqEntry];
    }
    return [];
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

  const festivalLinks = FESTIVALS.map(
    (def) => `<li><a href="/calendrier/${def.slug}">Dates de ${def.label}</a></li>`,
  ).join("\n        ");

  return {
    file: "calendrier.html",
    path: "/calendrier",
    title:
      "Calendrier des fêtes juives : dates, entrée et sortie de chaque fête | Petite Jérusalem",
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
      <h2>Dates des grandes fêtes juives sur ${years.length} ans</h2>
      <p>Le premier jour de chaque fête, année hébraïque par année hébraïque : une même année
      hébraïque court sur deux années civiles, les cellules portent donc la leur. Chaque fête a
      sa page, avec ses dates et ses heures d'entrée et de sortie.</p>
      ${multiYearTable(years)}
    </section>

    <section class="seo-section">
      <h2>Une page par fête</h2>
      <ul>
        ${festivalLinks}
      </ul>
    </section>

    <section class="seo-section">
      <h2>Chabbat, semaine par semaine</h2>
      <p>Pour l'heure d'allumage des bougies et la sortie de Chabbat chaque semaine, ainsi que
      tous les zmanim du jour, voir les <a href="/horaires">horaires de Chabbat</a>, ville par
      ville, et <a href="/zmanim">les zmanim expliqués</a>.</p>
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

// ---- /calendrier/:fete : une page par fête -------------------------------

function buildFestivalPage(
  def: FestivalDef,
  years: { year: number; entries: CalendarEntry[] }[],
  today: number,
): SeoPage | null {
  // Seules les occurrences à venir : une page qui s'ouvre sur « Hanouka 2025 »
  // a l'air périmée, même quand la date est juste.
  const perYear = years
    .map(({ entries }) => entriesOf(entries, def))
    .filter((entries) => entries.length > 0 && entries[entries.length - 1].last.abs() >= today)
    .slice(0, FESTIVAL_YEARS);
  if (!perYear.length) return null;

  // Un Yom Tov a une entrée et une sortie ; un jeûne ou une fête de travail
  // permis n'en a pas, et deux colonnes vides valent moins que pas de colonne.
  const hasTimes = perYear.some((entries) => entries.some((entry) => entry.period));
  // Pessah compte deux blocs de fête séparés par le 'Hol haMoed : l'entrée est
  // celle du premier jour, la sortie celle du dernier.
  const splitFestival = perYear.some((entries) => entries.length > 1);

  const rows = perYear
    .map((entries) => {
      const span = spanOf(entries);
      if (!span) return "";
      const period = span.first.period;
      const end = span.last.period ?? period;
      const times = hasTimes
        ? `
            <td>${period ? instantCell(period.start, TZ) : ""}</td>
            <td>${end ? instantCell(end.end, TZ) : ""}</td>`
        : "";
      return `
          <tr>
            <td>${span.first.first.greg().getFullYear()}</td>
            <td>${spanRange(entries)}</td>
            <td>${hebrewRange(span.first.first, span.last.last)}</td>${times}
          </tr>`;
    })
    .join("");

  const faq = perYear.flatMap((entries) => {
    const entry = festivalFaq(def, entries);
    return entry ? [entry] : [];
  });

  const span = spanOf(perYear[0]);
  const fromYear = span ? span.first.first.greg().getFullYear() : "";

  faq.push({
    q: `${def.label} est-il un jour où le travail est interdit ?`,
    a: hasTimes
      ? `Oui : ${def.label} est un Yom Tov, le travail y est interdit comme à Chabbat, avec une entrée (allumage des bougies) et une sortie données dans le tableau ci-dessus. En diaspora, les jours de fête sont doublés.`
      : def.fast
        ? `Non : ${def.label} est un jour de jeûne, pas un Yom Tov ; le travail y reste permis.`
        : `Non : ${def.label} n'est pas un jour de Yom Tov, le travail y reste permis. La journée a ses usages propres, mais pas d'entrée ni de sortie comme Chabbat.`,
  });
  faq.push({
    q: `Comment connaître l'heure exacte de ${def.label} dans ma ville ?`,
    a: `Les heures ci-dessus sont calculées pour Paris. Ouvrez les horaires dans l'application, ou la page d'horaires de votre ville, pour l'heure d'entrée et de sortie à vos coordonnées, calculée sur votre appareil et même hors ligne.`,
  });

  const timeHeaders = hasTimes ? "<th>Entrée</th><th>Sortie</th>" : "";
  const splitNote = splitFestival
    ? `<p>${def.label} compte deux blocs de fête, séparés par le 'Hol haMoed (les jours
      intermédiaires, où le travail est permis) : l'heure d'entrée est celle du premier jour, la
      sortie celle du dernier.</p>`
    : "";
  const timesNote = hasTimes
    ? `<p>Les heures d'entrée et de sortie sont calculées pour Paris. Pour votre ville, voir les
      <a href="/horaires">horaires ville par ville</a> : l'application les recalcule à vos
      coordonnées, même hors ligne.</p>`
    : `<p>Le travail n'est pas interdit ce jour-là : il n'a donc pas d'heure d'entrée ni de
      sortie comme Chabbat. Pour les horaires de la journée (l'aube, le netz, la sortie des
      étoiles) à votre ville, voir les <a href="/horaires">horaires</a>.</p>`;

  return {
    file: `calendrier/${def.slug}.html`,
    path: `/calendrier/${def.slug}`,
    title: `${def.label} : dates, heure d'entrée et de sortie | Petite Jérusalem`,
    description: hasTimes
      ? `Quand tombe ${def.label} ? Les dates de ${def.label} sur ${perYear.length} ans à partir de ${fromYear}, avec l'heure d'entrée et de sortie de la fête, et ce qu'on y fait.`
      : `Quand tombe ${def.label} ? Les dates de ${def.label} sur ${perYear.length} ans à partir de ${fromYear}, en dates civiles et hébraïques, et ce qu'on y fait.`,
    sitemap: { priority: 0.6, changefreq: "monthly" },
    bodyHtml: `
  <main class="seo-article">
    <h1>${def.label} : dates, entrée et sortie</h1>
    <p class="seo-lead">${def.intro}</p>

    <section class="seo-section">
      <h2>Quand tombe ${def.label} ?</h2>
      <table class="seo-table">
        <thead>
          <tr><th>Année</th><th>Dates</th><th>Date hébraïque</th>${timeHeaders}</tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>
      ${splitNote}
      ${timesNote}
    </section>

    <section class="seo-section">
      <h2>Autour de ${def.label}</h2>
      <p>Voir le <a href="/calendrier">calendrier complet des fêtes juives</a>, les
      <a href="/horaires">horaires de Chabbat et des fêtes</a> et
      <a href="/zmanim">les zmanim expliqués</a> (l'aube, le netz, la chkia, la sortie des
      étoiles), qui donnent le sens des heures de ce tableau.</p>
    </section>

    ${faqHtml(faq, `Questions fréquentes sur ${def.label}`)}
  </main>`,
    jsonLd: [
      breadcrumb([
        { name: "Accueil", path: "/" },
        { name: "Calendrier des fêtes", path: "/calendrier" },
        { name: def.label, path: `/calendrier/${def.slug}` },
      ]),
      faqJsonLd(faq),
    ],
  };
}

// ---- Assemblage ----------------------------------------------------------

export type ZmanimSeoBuild = { pages: SeoPage[]; sitemapEntries: SitemapEntry[] };

/**
 * Toutes les pages (hub des horaires, une page par ville, calendrier, une
 * page par fête) et leurs entrées de sitemap, calculées à `now` (la date du
 * build en production, une date fixe dans les tests).
 */
export function buildZmanimSeoPages(now: Date = new Date()): ZmanimSeoBuild {
  const cities = seoCities();
  const all = citiesJson as City[];
  const cityPages = cities.map((city) => buildCityPage(city, all, now));

  const opening = openingHebrewYear(now);
  // Une année de plus que ce qu'on affiche : les fêtes déjà passées de
  // l'année en cours sont écartées des pages par fête, et il en faut une de
  // rab pour que le tableau garde ses six lignes.
  const years = Array.from({ length: FESTIVAL_YEARS + 1 }, (_, i) => ({
    year: opening + i,
    entries: yearCalendar(DEFAULT_PLACE, opening + i, "fr"),
  }));
  const today = hebrewDayOf(DEFAULT_PLACE, now).abs();
  const festivalPages = FESTIVALS.flatMap((def) => {
    const page = buildFestivalPage(def, years, today);
    return page ? [page] : [];
  });

  const pages = [
    buildHorairesPage(now),
    buildCalendrierPage(now, years),
    ...cityPages,
    ...festivalPages,
  ];
  return {
    pages,
    sitemapEntries: pages.map((page) => {
      const s = page.sitemap || { priority: 0.5, changefreq: "weekly" };
      return { path: page.path, priority: s.priority, changefreq: s.changefreq };
    }),
  };
}

/** Les fêtes qui ont leur page, textes de présentation compris (pour les tests). */
export { FESTIVALS };
