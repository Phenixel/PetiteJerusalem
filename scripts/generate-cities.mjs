#!/usr/bin/env node
/**
 * Régénère `src/datas/cities.json`, la liste de villes du sélecteur de la page
 * Horaires.
 *
 * Pourquoi une liste à nous : `@hebcal/core` embarque 65 villes du monde, dont
 * **une seule en France**. Inutilisable pour choisir sa ville ici.
 *
 * Pourquoi une liste *curée* plutôt qu'un jeu de données complet : geonames
 * compte 140 000 villes. Cherchez « Paris », vous obtenez le Texas et l'Ontario
 * avant l'Île-de-France. La liste ci-dessous est écrite à la main — les villes
 * où l'application est réellement lue — et le script ne fait qu'y attacher les
 * coordonnées exactes de geonames, pour ne pas les saisir à la main.
 *
 * Le fuseau vient du pays : tous ceux retenus n'en ont qu'un, sauf les quelques
 * cas notés explicitement (`tz`) — États-Unis, Canada, Brésil, Australie.
 *
 * Usage : node scripts/generate-cities.mjs
 * (le résultat est versionné : ce script ne tourne qu'à la mise à jour)
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = "https://raw.githubusercontent.com/lutangar/cities.json/master/cities.json";
const OUT = join(import.meta.dirname, "..", "src", "datas", "cities.json");

/** Fuseau par défaut d'un pays — surchargé ville par ville si besoin. */
const COUNTRY_TZ = {
  FR: "Europe/Paris",
  IL: "Asia/Jerusalem",
  BE: "Europe/Brussels",
  CH: "Europe/Zurich",
  GB: "Europe/London",
  ES: "Europe/Madrid",
  PT: "Europe/Lisbon",
  IT: "Europe/Rome",
  DE: "Europe/Berlin",
  NL: "Europe/Amsterdam",
  AT: "Europe/Vienna",
  GR: "Europe/Athens",
  TR: "Europe/Istanbul",
  MA: "Africa/Casablanca",
  TN: "Africa/Tunis",
  DZ: "Africa/Algiers",
  RU: "Europe/Moscow",
  UA: "Europe/Kyiv",
  PL: "Europe/Warsaw",
  HU: "Europe/Budapest",
  CZ: "Europe/Prague",
  RO: "Europe/Bucharest",
  SE: "Europe/Stockholm",
  DK: "Europe/Copenhagen",
  NO: "Europe/Oslo",
  FI: "Europe/Helsinki",
  IE: "Europe/Dublin",
  LU: "Europe/Luxembourg",
  MC: "Europe/Monaco",
  ZA: "Africa/Johannesburg",
  AR: "America/Argentina/Buenos_Aires",
  CL: "America/Santiago",
  UY: "America/Montevideo",
  PA: "America/Panama",
  MX: "America/Mexico_City",
  CO: "America/Bogota",
  PE: "America/Lima",
  HK: "Asia/Hong_Kong",
  JP: "Asia/Tokyo",
  TH: "Asia/Bangkok",
  IN: "Asia/Kolkata",
  SG: "Asia/Singapore",
};

/**
 * Les villes proposées. `[nom affiché, pays, options]` :
 * - `geo` quand le nom de geonames diffère de celui qu'on affiche ;
 * - `tz` pour les pays à plusieurs fuseaux ;
 * - `near: [lat, lon]` pour départager les homonymes — la France compte
 *   plusieurs Montreuil, et le premier venu dans geonames est celui du
 *   Pas-de-Calais, pas celui de Seine-Saint-Denis.
 */
const CITIES = [
  // --- France : Paris et sa région, puis la province ---
  ["Paris", "FR"],
  ["Sarcelles", "FR"],
  ["Créteil", "FR"],
  ["Boulogne-Billancourt", "FR"],
  ["Neuilly-sur-Seine", "FR"],
  ["Saint-Mandé", "FR"],
  ["Vincennes", "FR"],
  ["Montreuil", "FR", { near: [48.86, 2.44] }], // celui de Seine-Saint-Denis
  ["Aulnay-sous-Bois", "FR"],
  ["Bondy", "FR"],
  ["Livry-Gargan", "FR"],
  ["Le Raincy", "FR"],
  ["Noisy-le-Grand", "FR"],
  ["Champigny-sur-Marne", "FR"],
  ["Villiers-sur-Marne", "FR"],
  ["Saint-Maur-des-Fossés", "FR"],
  ["Vitry-sur-Seine", "FR"],
  ["Antony", "FR"],
  ["Massy", "FR"],
  ["Versailles", "FR"],
  ["Cergy", "FR"],
  ["Évry", "FR"],
  ["Meaux", "FR"],
  ["Melun", "FR"],
  ["Marseille", "FR"],
  ["Lyon", "FR"],
  ["Villeurbanne", "FR"],
  ["Nice", "FR"],
  ["Cannes", "FR"],
  ["Antibes", "FR"],
  ["Menton", "FR"],
  ["Toulon", "FR"],
  ["Aix-en-Provence", "FR"],
  ["Avignon", "FR"],
  ["Nîmes", "FR"],
  ["Montpellier", "FR"],
  ["Béziers", "FR"],
  ["Narbonne", "FR"],
  ["Perpignan", "FR"],
  ["Toulouse", "FR"],
  ["Bordeaux", "FR"],
  ["Pau", "FR"],
  ["Bayonne", "FR"],
  ["Biarritz", "FR"],
  ["Limoges", "FR"],
  ["Poitiers", "FR"],
  ["Nantes", "FR"],
  ["Angers", "FR"],
  ["Le Mans", "FR"],
  ["Tours", "FR"],
  ["Orléans", "FR"],
  ["Rennes", "FR"],
  ["Brest", "FR"],
  ["Caen", "FR"],
  ["Rouen", "FR"],
  ["Le Havre", "FR"],
  ["Amiens", "FR"],
  ["Lille", "FR"],
  ["Roubaix", "FR"],
  ["Reims", "FR"],
  ["Troyes", "FR"],
  ["Metz", "FR"],
  ["Nancy", "FR"],
  ["Sarreguemines", "FR"],
  ["Épinal", "FR"],
  ["Strasbourg", "FR"],
  ["Colmar", "FR"],
  ["Mulhouse", "FR"],
  ["Belfort", "FR"],
  ["Besançon", "FR"],
  ["Dijon", "FR"],
  ["Chalon-sur-Saône", "FR"],
  ["Saint-Étienne", "FR"],
  ["Clermont-Ferrand", "FR"],
  ["Vichy", "FR"],
  ["Roanne", "FR"],
  ["Valence", "FR", { near: [44.93, 4.89] }], // Drôme, pas Lot-et-Garonne
  ["Grenoble", "FR"],
  ["Chambéry", "FR"],
  ["Annecy", "FR"],
  ["Thonon-les-Bains", "FR"],
  ["Ajaccio", "FR"],
  ["Bastia", "FR"],

  // --- Israël ---
  ["Jérusalem", "IL", { geo: "Jerusalem" }],
  ["Tel Aviv", "IL", { geo: "Tel Aviv" }],
  ["Bnei Brak", "IL", { geo: "Bnei Brak" }],
  ["Ramat Gan", "IL"],
  ["Guivatayim", "IL", { geo: "Giv'atayim" }],
  ["Holon", "IL"],
  ["Bat Yam", "IL"],
  ["Rishon LeZion", "IL", { geo: "Rishon LeTsiyyon" }],
  ["Petah Tikva", "IL", { geo: "Petaẖ Tiqva" }],
  ["Netanya", "IL"],
  ["Herzliya", "IL", { geo: "Herzliya" }],
  ["Raanana", "IL", { geo: "Ra'anana" }],
  ["Kfar Saba", "IL", { geo: "Kfar Saba" }],
  ["Hod HaSharon", "IL", { geo: "Hod HaSharon" }],
  ["Rehovot", "IL", { geo: "Rehovot" }],
  ["Ness Ziona", "IL", { geo: "Ness Ziona" }],
  ["Ashdod", "IL"],
  ["Ashkelon", "IL"],
  ["Beer Sheva", "IL", { geo: "Beersheba" }],
  ["Haïfa", "IL", { geo: "Haifa" }],
  ["Netivot", "IL"],
  ["Modiin", "IL", { geo: "Modi‘in Makkabbim Re‘ut" }],
  ["Beit Shemesh", "IL", { geo: "Bet Shemesh" }],
  ["Tibériade", "IL", { geo: "Tiberias" }],
  ["Safed", "IL"],
  ["Eilat", "IL"],
  ["Nahariya", "IL", { geo: "Nahariyya" }],
  ["Acre", "IL"],
  ["Lod", "IL"],
  ["Ramla", "IL", { geo: "Ramla" }],
  ["Yavné", "IL", { geo: "Yavne" }],
  ["Kiryat Gat", "IL"],
  ["Kiryat Shmona", "IL", { geo: "Qiryat Shmona" }],
  ["Arad", "IL"],
  ["Dimona", "IL"],

  // --- Europe ---
  ["Bruxelles", "BE", { geo: "Brussels" }],
  ["Anvers", "BE", { geo: "Antwerp" }],
  ["Liège", "BE"],
  ["Charleroi", "BE"],
  ["Gand", "BE", { geo: "Gent" }],
  ["Genève", "CH", { geo: "Geneva" }],
  ["Lausanne", "CH"],
  ["Zurich", "CH", { geo: "Zürich" }],
  ["Bâle", "CH", { geo: "Basel" }],
  ["Berne", "CH", { geo: "Bern" }],
  ["Lugano", "CH"],
  ["Luxembourg", "LU"],
  ["Monaco", "MC"],
  ["Londres", "GB", { geo: "London" }],
  ["Manchester", "GB"],
  ["Leeds", "GB"],
  ["Gateshead", "GB"],
  ["Glasgow", "GB"],
  ["Édimbourg", "GB", { geo: "Edinburgh" }],
  ["Dublin", "IE"],
  ["Amsterdam", "NL"],
  ["Rotterdam", "NL"],
  ["La Haye", "NL", { geo: "The Hague" }],
  ["Berlin", "DE"],
  ["Francfort", "DE", { geo: "Frankfurt am Main" }],
  ["Munich", "DE", { geo: "Munich" }],
  ["Düsseldorf", "DE"],
  ["Cologne", "DE", { geo: "Köln" }],
  ["Hambourg", "DE", { geo: "Hamburg" }],
  ["Vienne", "AT", { geo: "Vienna" }],
  ["Rome", "IT", { geo: "Rome" }],
  ["Milan", "IT", { geo: "Milan" }],
  ["Turin", "IT", { geo: "Turin" }],
  ["Florence", "IT", { geo: "Florence" }],
  ["Venise", "IT", { geo: "Venice" }],
  ["Naples", "IT", { geo: "Naples" }],
  ["Madrid", "ES"],
  ["Barcelone", "ES", { geo: "Barcelona" }],
  ["Malaga", "ES", { geo: "Málaga" }],
  ["Séville", "ES", { geo: "Sevilla" }],
  ["Lisbonne", "PT", { geo: "Lisbon" }],
  ["Porto", "PT"],
  ["Athènes", "GR", { geo: "Athens" }],
  ["Thessalonique", "GR", { geo: "Thessaloníki" }],
  ["Istanbul", "TR"],
  ["Varsovie", "PL", { geo: "Warsaw" }],
  ["Cracovie", "PL", { geo: "Kraków" }],
  ["Prague", "CZ"],
  ["Budapest", "HU"],
  ["Bucarest", "RO", { geo: "Bucharest" }],
  ["Stockholm", "SE"],
  ["Copenhague", "DK", { geo: "Copenhagen" }],
  ["Oslo", "NO"],
  ["Helsinki", "FI"],
  ["Moscou", "RU", { geo: "Moscow" }],
  ["Saint-Pétersbourg", "RU", { geo: "Saint Petersburg" }],
  ["Kiev", "UA", { geo: "Kyiv" }],
  ["Odessa", "UA", { geo: "Odesa" }],

  // --- Afrique du Nord ---
  ["Casablanca", "MA"],
  ["Rabat", "MA"],
  ["Marrakech", "MA", { geo: "Marrakesh" }],
  ["Fès", "MA", { geo: "Fes" }],
  ["Tanger", "MA", { geo: "Tangier" }],
  ["Agadir", "MA"],
  ["Meknès", "MA", { geo: "Meknes" }],
  ["Essaouira", "MA"],
  ["Tunis", "TN"],
  ["Djerba", "TN", { geo: "Houmt Souk" }],
  ["Sfax", "TN"],
  ["Alger", "DZ", { geo: "Algiers" }],
  ["Oran", "DZ"],

  // --- Amérique du Nord ---
  ["New York", "US", { geo: "New York City", tz: "America/New_York" }],
  ["Lakewood", "US", { near: [40.1, -74.22], tz: "America/New_York" }], // New Jersey
  ["Monsey", "US", { tz: "America/New_York" }],
  ["Passaic", "US", { tz: "America/New_York" }],
  ["Baltimore", "US", { near: [39.29, -76.61], tz: "America/New_York" }],
  ["Philadelphie", "US", { geo: "Philadelphia", near: [39.95, -75.16], tz: "America/New_York" }],
  ["Boston", "US", { near: [42.36, -71.06], tz: "America/New_York" }],
  ["Washington", "US", { near: [38.9, -77.04], tz: "America/New_York" }],
  ["Miami", "US", { near: [25.77, -80.19], tz: "America/New_York" }],
  ["Miami Beach", "US", { tz: "America/New_York" }],
  ["Atlanta", "US", { near: [33.75, -84.39], tz: "America/New_York" }],
  ["Cleveland", "US", { near: [41.5, -81.69], tz: "America/New_York" }],
  ["Detroit", "US", { tz: "America/Detroit" }],
  ["Chicago", "US", { tz: "America/Chicago" }],
  ["Houston", "US", { near: [29.76, -95.36], tz: "America/Chicago" }],
  ["Dallas", "US", { near: [32.78, -96.81], tz: "America/Chicago" }],
  ["Saint-Louis", "US", { geo: "St. Louis", tz: "America/Chicago" }],
  ["Memphis", "US", { near: [35.15, -90.05], tz: "America/Chicago" }],
  ["Denver", "US", { near: [39.74, -104.98], tz: "America/Denver" }],
  ["Phoenix", "US", { near: [33.45, -112.07], tz: "America/Phoenix" }],
  ["Las Vegas", "US", { near: [36.17, -115.14], tz: "America/Los_Angeles" }],
  ["Los Angeles", "US", { tz: "America/Los_Angeles" }],
  ["San Francisco", "US", { tz: "America/Los_Angeles" }],
  ["San Diego", "US", { near: [32.72, -117.16], tz: "America/Los_Angeles" }],
  ["Seattle", "US", { tz: "America/Los_Angeles" }],
  ["Portland", "US", { near: [45.52, -122.68], tz: "America/Los_Angeles" }], // Oregon
  ["Montréal", "CA", { geo: "Montréal", tz: "America/Toronto" }],
  ["Toronto", "CA", { tz: "America/Toronto" }],
  ["Ottawa", "CA", { tz: "America/Toronto" }],
  ["Québec", "CA", { geo: "Québec", tz: "America/Toronto" }],
  ["Winnipeg", "CA", { tz: "America/Winnipeg" }],
  ["Calgary", "CA", { tz: "America/Edmonton" }],
  ["Vancouver", "CA", { tz: "America/Vancouver" }],
  ["Mexico", "MX", { geo: "Mexico City" }],

  // --- Amérique latine ---
  ["Buenos Aires", "AR"],
  ["Córdoba", "AR", { geo: "Córdoba" }],
  ["Rosario", "AR"],
  ["São Paulo", "BR", { geo: "São Paulo", tz: "America/Sao_Paulo" }],
  ["Rio de Janeiro", "BR", { tz: "America/Sao_Paulo" }],
  ["Santiago", "CL"],
  ["Montevideo", "UY"],
  ["Panama", "PA", { geo: "Panama City" }],
  ["Bogota", "CO", { geo: "Bogotá" }],
  ["Lima", "PE"],

  // --- Reste du monde ---
  ["Johannesbourg", "ZA", { geo: "Johannesburg" }],
  ["Le Cap", "ZA", { geo: "Cape Town" }],
  ["Sydney", "AU", { tz: "Australia/Sydney" }],
  ["Melbourne", "AU", { tz: "Australia/Melbourne" }],
  ["Perth", "AU", { near: [-31.95, 115.86], tz: "Australia/Perth" }],
  ["Hong Kong", "HK"],
  ["Tokyo", "JP"],
  ["Bangkok", "TH"],
  ["Bombay", "IN", { geo: "Mumbai" }],
  ["Singapour", "SG", { geo: "Singapore" }],
];

/** Retire accents et ponctuation : « Saint-Étienne » et « st etienne » se rejoignent. */
const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

console.log(`generate-cities: téléchargement de ${SOURCE}…`);
const response = await fetch(SOURCE);
if (!response.ok) {
  console.error(`generate-cities: téléchargement impossible (HTTP ${response.status})`);
  process.exit(1);
}
const geonames = await response.json();
console.log(`generate-cities: ${geonames.length} villes lues.`);

// Index par pays → nom normalisé, **toutes** les occurrences. Prendre la
// première conduirait à des erreurs silencieuses : les homonymes sont
// fréquents et geonames ne les classe pas par importance.
const byCountry = new Map();
for (const entry of geonames) {
  const key = `${entry.country}:${normalize(entry.name)}`;
  const bucket = byCountry.get(key);
  if (bucket) bucket.push(entry);
  else byCountry.set(key, [entry]);
}

const distance = (entry, [lat, lon]) =>
  Math.hypot(parseFloat(entry.lat) - lat, parseFloat(entry.lng) - lon);

const cities = [];
const missing = [];
const ambiguous = [];
for (const [name, country, options = {}] of CITIES) {
  const searched = options.geo ?? name;
  const candidates = byCountry.get(`${country}:${normalize(searched)}`) ?? [];
  if (candidates.length === 0) {
    missing.push(`${name} (${country}) — cherché : « ${searched} »`);
    continue;
  }
  let match = candidates[0];
  if (options.near) {
    match = candidates.reduce((best, entry) =>
      distance(entry, options.near) < distance(best, options.near) ? entry : best,
    );
  } else if (candidates.length > 1) {
    ambiguous.push(
      `${name} (${country}) — ${candidates.length} homonymes, retenu ${match.lat},${match.lng} ; ` +
        `autres : ${candidates
          .slice(1, 4)
          .map((c) => `${c.lat},${c.lng}`)
          .join(" / ")}`,
    );
  }
  const tzid = options.tz ?? COUNTRY_TZ[country];
  if (!tzid) {
    missing.push(`${name} (${country}) — fuseau inconnu pour ce pays`);
    continue;
  }
  cities.push({
    name,
    country,
    lat: Math.round(parseFloat(match.lat) * 10000) / 10000,
    lon: Math.round(parseFloat(match.lng) * 10000) / 10000,
    tz: tzid,
  });
}

if (ambiguous.length) {
  console.warn(
    `generate-cities: ⚠️ ${ambiguous.length} nom(s) ambigu(s) — vérifier, et départager avec \`near\` :`,
  );
  for (const line of ambiguous) console.warn(`  - ${line}`);
}

if (missing.length) {
  console.warn(`generate-cities: ⚠️ ${missing.length} entrée(s) non résolue(s) :`);
  for (const line of missing) console.warn(`  - ${line}`);
}

writeFileSync(OUT, `${JSON.stringify(cities, null, 0)}\n`, "utf8");
console.log(`generate-cities: ${cities.length} villes écrites dans ${OUT}`);
