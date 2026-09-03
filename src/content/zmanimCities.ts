import type { City } from "../services/zmanimService";
import type { SeoLocale } from "./seoLocales";

/**
 * Les villes des pages « Horaires de Chabbat à … » (/horaires/:ville).
 *
 * Module volontairement minuscule (pas de catalogue, pas de hebcal) : il est
 * partagé entre la vue ZmanimPage (qui résout la ville de l'URL contre le
 * catalogue chargé à la demande) et le prérendu SEO (zmanimSeoPages.ts), pour
 * que les slugs ne divergent jamais entre le routeur et les pages générées.
 *
 * Toutes les villes du catalogue (src/datas/cities.json) ont désormais leur
 * page prérendue, Paris excepté : /horaires est déjà la sienne. La liste
 * n'est donc plus écrite à la main ici, elle se déduit du catalogue au build
 * (voir `seoCities` dans zmanimSeoPages.ts) ; ne restent ici que ce qui ne
 * s'en déduit pas : les slugs, les noms de pays et les villes mises en avant.
 */

/** La ville dont /horaires est la page : elle n'a pas de page à elle. */
export const HUB_CITY_NAME = "Paris";

/**
 * Slug d'URL d'une ville : minuscules, sans accents, tirets.
 * « Boulogne-Billancourt » → « boulogne-billancourt », « Genève » → « geneve »,
 * « Tel Aviv » → « tel-aviv ».
 */
export function citySlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Les villes mises en avant sur le hub /horaires, avant la liste complète :
 * les grandes communautés francophones et les villes d'Israël les plus
 * cherchées par ce public. Noms exacts du catalogue, un test le vérifie.
 */
export const FEATURED_CITY_NAMES: string[] = [
  "Marseille",
  "Lyon",
  "Nice",
  "Strasbourg",
  "Toulouse",
  "Sarcelles",
  "Créteil",
  "Boulogne-Billancourt",
  "Bordeaux",
  "Montpellier",
  "Cannes",
  "Grenoble",
  "Metz",
  "Nancy",
  "Bruxelles",
  "Genève",
  "Montréal",
  "Jérusalem",
  "Tel Aviv",
  "Netanya",
  "Ashdod",
];

/**
 * Les pays du catalogue, dans les trois langues, pour grouper l'annuaire des
 * villes.
 *
 * `where` porte la locution complète (« en France », « au Maroc », « aux
 * Pays-Bas », « à Monaco ») : la préposition ne se déduit pas du nom, et un
 * titre « Horaires de Chabbat en Maroc » se voit tout de suite. En anglais
 * c'est « in » partout sauf pour les pluriels, en hébreu le préfixe ב.
 */
export type CountryNames = {
  fr: { name: string; where: string };
  en: { name: string; where: string };
  he: { name: string; where: string };
};

const country = (
  fr: string,
  frWhere: string,
  en: string,
  enWhere: string,
  he: string,
): CountryNames => ({
  fr: { name: fr, where: frWhere },
  en: { name: en, where: enWhere },
  he: { name: he, where: `ב${he}` },
});

export const COUNTRIES: Record<string, CountryNames> = {
  FR: country("France", "en France", "France", "in France", "צרפת"),
  IL: country("Israël", "en Israël", "Israel", "in Israel", "ישראל"),
  BE: country("Belgique", "en Belgique", "Belgium", "in Belgium", "בלגיה"),
  CH: country("Suisse", "en Suisse", "Switzerland", "in Switzerland", "שווייץ"),
  CA: country("Canada", "au Canada", "Canada", "in Canada", "קנדה"),
  MA: country("Maroc", "au Maroc", "Morocco", "in Morocco", "מרוקו"),
  TN: country("Tunisie", "en Tunisie", "Tunisia", "in Tunisia", "תוניסיה"),
  DZ: country("Algérie", "en Algérie", "Algeria", "in Algeria", "אלג׳יריה"),
  LU: country("Luxembourg", "au Luxembourg", "Luxembourg", "in Luxembourg", "לוקסמבורג"),
  MC: country("Monaco", "à Monaco", "Monaco", "in Monaco", "מונקו"),
  GB: country(
    "Royaume-Uni",
    "au Royaume-Uni",
    "United Kingdom",
    "in the United Kingdom",
    "בריטניה",
  ),
  US: country(
    "États-Unis",
    "aux États-Unis",
    "United States",
    "in the United States",
    "ארצות הברית",
  ),
  AR: country("Argentine", "en Argentine", "Argentina", "in Argentina", "ארגנטינה"),
  AT: country("Autriche", "en Autriche", "Austria", "in Austria", "אוסטריה"),
  AU: country("Australie", "en Australie", "Australia", "in Australia", "אוסטרליה"),
  BR: country("Brésil", "au Brésil", "Brazil", "in Brazil", "ברזיל"),
  CL: country("Chili", "au Chili", "Chile", "in Chile", "צ׳ילה"),
  CO: country("Colombie", "en Colombie", "Colombia", "in Colombia", "קולומביה"),
  CZ: country("République tchèque", "en République tchèque", "Czechia", "in Czechia", "צ׳כיה"),
  DE: country("Allemagne", "en Allemagne", "Germany", "in Germany", "גרמניה"),
  DK: country("Danemark", "au Danemark", "Denmark", "in Denmark", "דנמרק"),
  ES: country("Espagne", "en Espagne", "Spain", "in Spain", "ספרד"),
  FI: country("Finlande", "en Finlande", "Finland", "in Finland", "פינלנד"),
  GR: country("Grèce", "en Grèce", "Greece", "in Greece", "יוון"),
  HK: country("Hong Kong", "à Hong Kong", "Hong Kong", "in Hong Kong", "הונג קונג"),
  HU: country("Hongrie", "en Hongrie", "Hungary", "in Hungary", "הונגריה"),
  IE: country("Irlande", "en Irlande", "Ireland", "in Ireland", "אירלנד"),
  IN: country("Inde", "en Inde", "India", "in India", "הודו"),
  IT: country("Italie", "en Italie", "Italy", "in Italy", "איטליה"),
  JP: country("Japon", "au Japon", "Japan", "in Japan", "יפן"),
  MX: country("Mexique", "au Mexique", "Mexico", "in Mexico", "מקסיקו"),
  NL: country("Pays-Bas", "aux Pays-Bas", "Netherlands", "in the Netherlands", "הולנד"),
  NO: country("Norvège", "en Norvège", "Norway", "in Norway", "נורווגיה"),
  PA: country("Panama", "au Panama", "Panama", "in Panama", "פנמה"),
  PE: country("Pérou", "au Pérou", "Peru", "in Peru", "פרו"),
  PL: country("Pologne", "en Pologne", "Poland", "in Poland", "פולין"),
  PT: country("Portugal", "au Portugal", "Portugal", "in Portugal", "פורטוגל"),
  RO: country("Roumanie", "en Roumanie", "Romania", "in Romania", "רומניה"),
  RU: country("Russie", "en Russie", "Russia", "in Russia", "רוסיה"),
  SE: country("Suède", "en Suède", "Sweden", "in Sweden", "שוודיה"),
  SG: country("Singapour", "à Singapour", "Singapore", "in Singapore", "סינגפור"),
  TH: country("Thaïlande", "en Thaïlande", "Thailand", "in Thailand", "תאילנד"),
  TR: country("Turquie", "en Turquie", "Turkey", "in Turkey", "טורקיה"),
  UA: country("Ukraine", "en Ukraine", "Ukraine", "in Ukraine", "אוקראינה"),
  UY: country("Uruguay", "en Uruguay", "Uruguay", "in Uruguay", "אורוגוואי"),
  ZA: country(
    "Afrique du Sud",
    "en Afrique du Sud",
    "South Africa",
    "in South Africa",
    "דרום אפריקה",
  ),
};

/** Les pays mis en tête de l'annuaire : c'est là qu'est le public du site. */
export const COUNTRY_ORDER: string[] = ["FR", "IL", "BE", "CH", "CA", "MA", "TN", "DZ", "LU", "MC"];

/** Le nom d'un pays dans la langue demandée, ou son code quand il manque. */
export const countryName = (code: string, locale: SeoLocale = "fr"): string =>
  COUNTRIES[code]?.[locale].name ?? code;

/** « en France », « in Morocco », « בישראל » : le pays et sa préposition. */
export const inCountry = (code: string, locale: SeoLocale = "fr"): string =>
  COUNTRIES[code]?.[locale].where ?? code;

/**
 * Le nom d'une ville hors du français, quand il diffère du catalogue.
 *
 * Le catalogue est en français : « Londres », « Jérusalem », « Varsovie ». Une
 * page anglaise doit écrire London, une page hébraïque ירושלים. La table ne
 * porte que les écarts ; une ville absente garde le nom du catalogue, ce qui
 * est juste pour la plupart (Lyon, Marseille, Netanya…). En hébreu, les villes
 * d'Israël et les grandes communautés de diaspora sont nommées en hébreu, les
 * autres gardent leur graphie latine, comme le font les listes hébraïques.
 */
const CITY_NAMES: Record<string, { en?: string; he?: string }> = {
  // France
  Paris: { he: "פריז" },
  Marseille: { he: "מרסיי" },
  Lyon: { he: "ליון" },
  Nice: { he: "ניס" },
  Strasbourg: { he: "שטרסבורג" },
  Toulouse: { he: "טולוז" },
  Bordeaux: { he: "בורדו" },
  Sarcelles: { he: "סרסל" },
  Créteil: { he: "קרטיי" },
  Lille: { he: "ליל" },
  Nantes: { he: "נאנט" },
  Cannes: { he: "קאן" },
  Grenoble: { he: "גרנובל" },
  Metz: { he: "מץ" },
  Nancy: { he: "ננסי" },
  Montpellier: { he: "מונפלייה" },
  Versailles: { he: "ורסאי" },
  // Belgique, Suisse, Luxembourg, Monaco
  Bruxelles: { en: "Brussels", he: "בריסל" },
  Anvers: { en: "Antwerp", he: "אנטוורפן" },
  Gand: { en: "Ghent" },
  Liège: { he: "לייז׳" },
  Genève: { en: "Geneva", he: "ז׳נבה" },
  Zurich: { he: "ציריך" },
  Bâle: { en: "Basel", he: "בזל" },
  Berne: { en: "Bern" },
  Lausanne: { he: "לוזאן" },
  Luxembourg: { he: "לוקסמבורג" },
  Monaco: { he: "מונקו" },
  // Canada
  Montréal: { en: "Montreal", he: "מונטריאול" },
  Québec: { en: "Quebec City" },
  Toronto: { he: "טורונטו" },
  Vancouver: { he: "ונקובר" },
  Ottawa: { he: "אוטווה" },
  // Israël
  Jérusalem: { en: "Jerusalem", he: "ירושלים" },
  "Tel Aviv": { he: "תל אביב" },
  "Bnei Brak": { he: "בני ברק" },
  "Ramat Gan": { he: "רמת גן" },
  Guivatayim: { en: "Givatayim", he: "גבעתיים" },
  Holon: { he: "חולון" },
  "Bat Yam": { he: "בת ים" },
  "Rishon LeZion": { he: "ראשון לציון" },
  "Petah Tikva": { he: "פתח תקווה" },
  Netanya: { he: "נתניה" },
  Herzliya: { he: "הרצליה" },
  Raanana: { he: "רעננה" },
  "Kfar Saba": { he: "כפר סבא" },
  "Hod HaSharon": { he: "הוד השרון" },
  Rehovot: { he: "רחובות" },
  "Ness Ziona": { he: "נס ציונה" },
  Ashdod: { he: "אשדוד" },
  Ashkelon: { he: "אשקלון" },
  "Beer Sheva": { he: "באר שבע" },
  Haïfa: { en: "Haifa", he: "חיפה" },
  Netivot: { he: "נתיבות" },
  Modiin: { he: "מודיעין" },
  "Beit Shemesh": { he: "בית שמש" },
  Tibériade: { en: "Tiberias", he: "טבריה" },
  Safed: { he: "צפת" },
  Eilat: { he: "אילת" },
  Nahariya: { he: "נהריה" },
  Acre: { he: "עכו" },
  Lod: { he: "לוד" },
  Ramla: { he: "רמלה" },
  Yavné: { en: "Yavne", he: "יבנה" },
  "Kiryat Gat": { he: "קרית גת" },
  "Kiryat Shmona": { he: "קרית שמונה" },
  Arad: { he: "ערד" },
  Dimona: { he: "דימונה" },
  // Royaume-Uni, Irlande
  Londres: { en: "London", he: "לונדון" },
  Édimbourg: { en: "Edinburgh" },
  Manchester: { he: "מנצ׳סטר" },
  Gateshead: { he: "גייטסהד" },
  Leeds: { he: "לידס" },
  Glasgow: { he: "גלזגו" },
  Dublin: { he: "דבלין" },
  // États-Unis
  "New York": { he: "ניו יורק" },
  "Los Angeles": { he: "לוס אנג׳לס" },
  Miami: { he: "מיאמי" },
  "Miami Beach": { he: "מיאמי ביץ׳" },
  Chicago: { he: "שיקגו" },
  Boston: { he: "בוסטון" },
  Philadelphie: { en: "Philadelphia", he: "פילדלפיה" },
  Baltimore: { he: "בלטימור" },
  Lakewood: { he: "לייקווד" },
  Monsey: { he: "מונסי" },
  Passaic: { he: "פסאיק" },
  Cleveland: { he: "קליבלנד" },
  Detroit: { he: "דטרויט" },
  Atlanta: { he: "אטלנטה" },
  Denver: { he: "דנוור" },
  Dallas: { he: "דאלאס" },
  Houston: { he: "יוסטון" },
  Memphis: { he: "ממפיס" },
  "Saint-Louis": { en: "St. Louis" },
  "Las Vegas": { he: "לאס וגאס" },
  "San Diego": { he: "סן דייגו" },
  "San Francisco": { he: "סן פרנסיסקו" },
  Seattle: { he: "סיאטל" },
  Portland: { he: "פורטלנד" },
  Phoenix: { he: "פיניקס" },
  Washington: { he: "וושינגטון" },
  // Europe
  Vienne: { en: "Vienna", he: "וינה" },
  Berlin: { he: "ברלין" },
  Francfort: { en: "Frankfurt", he: "פרנקפורט" },
  Hambourg: { en: "Hamburg", he: "המבורג" },
  Cologne: { he: "קלן" },
  Munich: { he: "מינכן" },
  Düsseldorf: { he: "דיסלדורף" },
  Rome: { he: "רומא" },
  Milan: { he: "מילאנו" },
  Venise: { en: "Venice", he: "ונציה" },
  Florence: { he: "פירנצה" },
  Naples: { he: "נאפולי" },
  Turin: { he: "טורינו" },
  Madrid: { he: "מדריד" },
  Barcelone: { en: "Barcelona", he: "ברצלונה" },
  Séville: { en: "Seville" },
  Malaga: { en: "Malaga" },
  Lisbonne: { en: "Lisbon", he: "ליסבון" },
  Porto: { he: "פורטו" },
  Amsterdam: { he: "אמסטרדם" },
  "La Haye": { en: "The Hague" },
  Rotterdam: { he: "רוטרדם" },
  Copenhague: { en: "Copenhagen", he: "קופנהגן" },
  Stockholm: { he: "שטוקהולם" },
  Oslo: { he: "אוסלו" },
  Helsinki: { he: "הלסינקי" },
  Prague: { he: "פראג" },
  Budapest: { he: "בודפשט" },
  Varsovie: { en: "Warsaw", he: "ורשה" },
  Cracovie: { en: "Krakow", he: "קרקוב" },
  Bucarest: { en: "Bucharest", he: "בוקרשט" },
  Moscou: { en: "Moscow", he: "מוסקבה" },
  "Saint-Pétersbourg": { en: "Saint Petersburg", he: "סנט פטרסבורג" },
  Kiev: { en: "Kyiv", he: "קייב" },
  Odessa: { he: "אודסה" },
  Athènes: { en: "Athens", he: "אתונה" },
  Thessalonique: { en: "Thessaloniki", he: "סלוניקי" },
  Istanbul: { he: "איסטנבול" },
  // Afrique du Nord et du Sud
  Casablanca: { he: "קזבלנקה" },
  Marrakech: { en: "Marrakesh", he: "מרקש" },
  Fès: { en: "Fez", he: "פאס" },
  Meknès: { en: "Meknes" },
  Tanger: { en: "Tangier" },
  Rabat: { he: "רבאט" },
  Agadir: { he: "אגאדיר" },
  Essaouira: { he: "מוגדור" },
  Alger: { en: "Algiers", he: "אלג׳יר" },
  Oran: { he: "אוראן" },
  Tunis: { he: "תוניס" },
  Djerba: { he: "ג׳רבה" },
  Sfax: { he: "ספאקס" },
  Johannesbourg: { en: "Johannesburg", he: "יוהנסבורג" },
  "Le Cap": { en: "Cape Town", he: "קייפטאון" },
  // Amériques, Asie, Océanie
  "Buenos Aires": { he: "בואנוס איירס" },
  "São Paulo": { he: "סאו פאולו" },
  "Rio de Janeiro": { he: "ריו דה ז׳ניירו" },
  Santiago: { he: "סנטיאגו" },
  Montevideo: { he: "מונטווידאו" },
  Mexico: { en: "Mexico City", he: "מקסיקו סיטי" },
  Panama: { en: "Panama City" },
  Lima: { he: "לימה" },
  Bogota: { he: "בוגוטה" },
  Bombay: { en: "Mumbai", he: "מומבאי" },
  Singapour: { en: "Singapore", he: "סינגפור" },
  Tokyo: { he: "טוקיו" },
  Bangkok: { he: "בנגקוק" },
  "Hong Kong": { he: "הונג קונג" },
  Sydney: { he: "סידני" },
  Melbourne: { he: "מלבורן" },
  Perth: { he: "פרת׳" },
};

/**
 * Une lettre de service hébraïque attachée à un nom : « בליון », mais
 * « ב־Charleroi ».
 *
 * En hébreu, les lettres de service (ב, ל, מ, ה…) se collent au mot ; devant
 * un mot en caractères latins, l'usage veut un maqaf, sans quoi la lettre
 * paraît avalée par le mot étranger. 83 villes du catalogue n'ont pas encore
 * de nom hébreu et gardent leur graphie latine ; leur en donner un fait
 * disparaître le maqaf de lui-même, sans rien changer d'autre.
 */
export const hePrefix = (letter: string, name: string): string =>
  /^[\u0590-\u05ff]/.test(name) ? `${letter}${name}` : `${letter}\u05be${name}`;

/**
 * Le nom d'une ville dans la langue demandée. Le catalogue est en français :
 * c'est lui qui sert de repli, y compris en hébreu, où une ville sans nom
 * hébreu garde sa graphie latine plutôt qu'une translittération inventée.
 */
export function cityName(name: string, locale: SeoLocale = "fr"): string {
  if (locale === "fr") return name;
  return CITY_NAMES[name]?.[locale] ?? name;
}

/**
 * Le nom d'une ville tel qu'il s'insère dans une phrase, quand la langue met
 * la préposition sur le mot plutôt que dans le gabarit.
 *
 * Le français et l'anglais portent « à » et « in » dans leurs propres
 * phrases : le nom leur suffit tel quel. L'hébreu colle sa lettre au nom,
 * avec le maqaf qu'il faut : c'est donc ici que la préposition s'attache, et
 * les gabarits hébreux n'en portent pas.
 */
export const cityInSentence = (name: string, locale: SeoLocale): string =>
  locale === "he" ? hePrefix("\u05d1", cityName(name, locale)) : cityName(name, locale);

/** La ville du catalogue qui porte ce slug, ou null. */
export function findCityBySlug(cities: City[], slug: string): City | null {
  return cities.find((city) => citySlug(city.name) === slug) ?? null;
}
