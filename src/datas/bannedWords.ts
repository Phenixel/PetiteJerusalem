/**
 * Liste des termes interdits dans les contenus écrits par les utilisateurs
 * (titres et descriptions de sessions, pseudos, noms d'invités).
 *
 * Exigence App Store (règle 1.2, contenu généré par les utilisateurs) : l'app
 * doit filtrer les contenus problématiques. Le filtrage est fait par
 * moderationService, qui normalise le texte avant comparaison (minuscules,
 * accents retirés, chiffres « leet » convertis : p0te → pote), puis compare
 * MOT À MOT — « députée » ne déclenche donc pas « pute ».
 *
 * Pour enrichir la liste : ajouter le terme en minuscules et SANS accents
 * (« encule », pas « enculé »). Les expressions de plusieurs mots vont dans
 * BANNED_PHRASES. L'hébreu s'écrit tel quel (sans niqqoud).
 */

/** Mots interdits, comparés à chaque mot du texte normalisé. */
export const BANNED_WORDS: string[] = [
  // --- Français : insultes et vulgarités ---
  "connard",
  "connards",
  "connasse",
  "connasses",
  "salope",
  "salopes",
  "salopard",
  "salaud",
  "salauds",
  "pute",
  "putes",
  "putain",
  "putains",
  "encule",
  "encules",
  "enculee",
  "enculees",
  "enfoire",
  "enfoires",
  "batard",
  "batards",
  "batarde",
  "batardes",
  "pouffiasse",
  "pouffiasses",
  "poufiasse",
  "bite",
  "bites",
  "couille",
  "couilles",
  "chiasse",
  "merde",
  "merdes",
  "merdique",
  "ntm",
  "fdp",
  "niquer",
  "nique",
  "niquee",
  // --- Français : injures discriminatoires ---
  "negre",
  "negres",
  "negresse",
  "bougnoule",
  "bougnoules",
  "bicot",
  "bicots",
  "youpin",
  "youpins",
  "youpine",
  "pede",
  "pedes",
  "tapette",
  "tapettes",
  "tarlouze",
  "tarlouzes",
  "gouine",
  "gouines",
  // --- Anglais ---
  "fuck",
  "fucking",
  "fucker",
  "fuckers",
  "motherfucker",
  "shit",
  "bullshit",
  "bitch",
  "bitches",
  "asshole",
  "assholes",
  "cunt",
  "cunts",
  "dick",
  "dickhead",
  "cock",
  "pussy",
  "whore",
  "whores",
  "slut",
  "sluts",
  "bastard",
  "bastards",
  "nigger",
  "niggers",
  "nigga",
  "faggot",
  "faggots",
  // --- Hébreu (écrit sans niqqoud) et translittérations courantes ---
  "זונה",
  "שרמוטה",
  "כוסאמק",
  "מניאק",
  "חרא",
  "sharmuta",
  "kusemek",
];

/**
 * Expressions interdites de plusieurs mots, comparées aux suites de mots
 * consécutifs du texte normalisé.
 */
export const BANNED_PHRASES: string[] = [
  "fils de pute",
  "fille de pute",
  "trou du cul",
  "gros con",
  "grosse conne",
  "sale juif",
  "sale juive",
  "sale arabe",
  "sale noir",
  "sale noire",
  "sale blanc",
  "sale race",
  "בן זונה",
  "בת זונה",
  "son of a bitch",
];
