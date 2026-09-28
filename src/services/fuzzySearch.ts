/**
 * Recherche tolérante, la même pour toutes les barres de recherche du site :
 * bibliothèque, lecture du jour, chaînes de lecture, chiourim, villes, invités,
 * administration.
 *
 * Un même nom s'écrit de dix façons : « Chabbat », « Shabbat », « Shabat » ;
 * « Berakhot », « Brakhot », « Berachot », « Brahot » ; « Pessa'him »,
 * « Pesachim ». Le catalogue lui-même mélange l'anglais de Sefaria
 * (« Chagigah ») et le français (« Kaddich »). Chercher la chaîne exacte
 * ne trouvait donc que ceux qui tapaient la graphie du catalogue.
 *
 * On n'énumère pas toutes les graphies possibles : on ramène chaque mot à
 * une clé phonétique, où les graphies d'un même son se confondent (voir
 * `latinKey`). Deux graphies d'un même nom ont la même clé, et la clé de ce
 * qu'on tape se cherche dans celle du texte. Par-dessus, une distance
 * d'édition rattrape les fautes de frappe (une lettre de trop, de moins,
 * changée ou inversée).
 *
 * Trois rangs, du plus sûr au plus large :
 * 1. le texte tel quel, sans accents ni casse (« berakh » dans « Berakhot ») ;
 * 2. la clé phonétique (« brakhot » dans « Berakhot ») ;
 * 3. la clé à une ou deux fautes près (« brakot » pour « Berakhot »).
 *
 * Le troisième rang ne sert que de repli : dès qu'un résultat répond aux deux
 * premiers, les approchants se taisent. Sans ce garde-fou, « bava » (Bava
 * Kamma) ramènerait aussi « Shabbat », à une lettre près.
 *
 * Plusieurs mots se cherchent chacun de leur côté, dans n'importe quel ordre
 * (« metsia baba »). Un résultat où tous les mots tombent dans le même champ
 * passe devant celui qui les ramasse dans plusieurs (« sefer 1 » : le livre
 * 1 des Tehilim, pas le Tehilim 100 du livre 4).
 *
 * Aucune dépendance à Vue : le module se lit aussi depuis les services.
 */

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const HEBREW_FINALS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

/**
 * Forme comparable d'une chaîne : minuscules, sans accents ni ponctuation,
 * hébreu sans voyelles ni cantillation et sans lettres finales. Les mots
 * restent séparés par une espace.
 *
 * L'apostrophe s'efface (`apostrophe` vide, par défaut) : elle tient au mot
 * dans une translittération (« Min'ha » = « Minha »). Elle sépare deux mots
 * dans une élision française (« d'Abraham ») : `apostrophe` à " " donne
 * cette seconde lecture.
 */
export function normalizeText(value: string, apostrophe: "" | " " = ""): string {
  return (
    value
      .normalize("NFD")
      // Accents latins : « Béréchit » = « Berechit ».
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/œ/g, "oe")
      .replace(/æ/g, "ae")
      .replace(/ß/g, "ss")
      // Hébreu : niqqud, te'amim, points du shin, geresh et gershayim
      // (« כ״ג » = « כג »). Le maqaf et les signes de fin de verset séparent.
      .replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05F3\u05F4]/g, "")
      .replace(/[ךםןףץ]/g, (letter) => HEBREW_FINALS[letter])
      // Le geresh et les gershayim tapés au clavier : « כ"ג » = « כג ».
      .replace(/(?<=[\u05D0-\u05EA])["'](?=[\u05D0-\u05EA])/g, "")
      .replace(/['‘’ʼ`´]/g, apostrophe)
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
  );
}

/** Les mots d'une chaîne normalisée ; « tehilim23 » donne « tehilim », « 23 ». */
function splitWords(normalized: string): string[] {
  if (normalized === "") return [];
  return normalized
    .split(" ")
    .flatMap((word) => word.split(/(?<=\p{L})(?=\p{N})|(?<=\p{N})(?=\p{L})/u))
    .filter((word) => word !== "");
}

// ---------------------------------------------------------------------------
// Clé phonétique
// ---------------------------------------------------------------------------

const HEBREW_LETTER = /[\u05D0-\u05EA]/;

/**
 * Clé d'un mot écrit en lettres latines. Les majuscules `H` et `C` sont des
 * classes, jamais des lettres tapées (tout est déjà en minuscules) :
 *
 * - `H` : « sh », « ch », « sch », « kh » et « h ». Le « ch » vaut chin en
 *   français (Chabbat) et 'het en anglais (Pesachim) ; le « h » vaut 'het en
 *   français (Pessah) et hé partout. Tout se confond, c'est le prix d'une
 *   clé qui retrouve les deux écoles ;
 * - `C` : « tz », « ts » (tsadi : Metzia, Metsia) ;
 * - b, v, w se confondent (Bava, Baba ; Yevamot, Yebamot) ; k, c dur, q,
 *   ck aussi (Souccot, Sukkot ; Qohelet) ; y, i, j (Yoma, Ioma ; Jonathan,
 *   Yonathan) ; « ou », « oo » et u ; « ei » et e ; « ph » et f ; « th »
 *   et t ; « gu » devant e, i et g (Meguila) ;
 * - les lettres doublées se simplifient (Kiddushin, Kidouchin) ;
 * - un e entre deux consonnes tombe, parce que le chva s'écrit ou non selon
 *   les gens : Berakhot, Brakhot ; Shemot, Chmot ; Devarim, Dvarim.
 *
 * Le h final après une voyelle (Megillah, Havdalah, Noah) est facultatif
 * dans ce qu'on tape : `optionalFinalH` le retire de la clé de la requête,
 * pas de celle du texte. « havdalah » trouve ainsi « Havdala », « meguila »
 * trouve « Megillah », et « noach » trouve toujours « Noah ».
 */
function latinKey(word: string, optionalFinalH: boolean): string {
  const spelled = word
    .replace(/sch|[sck]h/g, "H")
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    .replace(/gh/g, "g")
    .replace(/gu(?=[eiy])/g, "g")
    .replace(/qu?/g, "k")
    .replace(/ck/g, "k")
    .replace(/t[sz]/g, "C")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/c/g, "k")
    .replace(/x/g, "ks")
    .replace(/[vw]/g, "b")
    .replace(/[yj]/g, "i")
    .replace(/ou|oo/g, "u")
    .replace(/(\D)\1+/g, "$1")
    .replace(/ei/g, "e");
  // Le h final se met de côté avant la chute des e : « Tetzaveh » et
  // « Tetsavé » gardent ainsi le même e final.
  const finalH = /[aeiou]h$/.test(spelled);
  const key = (finalH ? spelled.slice(0, -1) : spelled)
    .replace(/h/g, "H")
    .replace(/(\D)\1+/g, "$1")
    .replace(/(?<=[^aeiou\d])e(?=[^aeiou\d])/g, "");
  return finalH && !optionalFinalH ? key + "H" : key;
}

/**
 * Clé d'un mot hébreu : sans les lettres-voyelles (vav et yod après la
 * première lettre : « מידות » = « מדות »), et les lettres qu'on confond en
 * écrivant de mémoire, parce qu'elles se prononcent pareil, ramenées à une
 * seule : ק et כ, ח et כ, ט et ת, ס et ש, ע et א.
 *
 * Un mot de trois lettres ou moins reste tel quel : on l'écrit rarement de
 * travers, et c'est souvent un nombre (« כג », 23, n'est pas « קג », 103).
 */
function hebrewKey(word: string): string {
  if (word.length <= 3) return word;
  return word
    .replace(/(?<!^)[וי]/g, "")
    .replace(/[קח]/g, "כ")
    .replace(/ט/g, "ת")
    .replace(/ס/g, "ש")
    .replace(/ע/g, "א")
    .replace(/(\D)\1+/g, "$1");
}

/**
 * La clé phonétique d'un mot normalisé ; un nombre reste un nombre.
 * `typed` : le mot vient de la requête (voir `latinKey`, le h final).
 */
export function phoneticKey(word: string, typed = false): string {
  if (/^\d+$/.test(word)) return word;
  return HEBREW_LETTER.test(word) ? hebrewKey(word) : latinKey(word, typed);
}

// ---------------------------------------------------------------------------
// Distance approchée
// ---------------------------------------------------------------------------

/**
 * Le moins de fautes (lettre ajoutée, retirée, changée, ou deux lettres
 * voisines inversées) pour trouver `pattern` dans `text`, en partant d'un
 * début de mot (`wordStarts`, positions dans `text`) ; la fin est libre.
 * Distance d'édition de Damerau restreinte, en recherche de sous-chaîne
 * (Sellers). L'ancrage compte : sans lui, « ohalot » tombait sur le
 * « oharot » de Toharot, à une lettre près, et ramenait tout le seder.
 */
export function approximateDistance(
  pattern: string,
  text: string,
  wordStarts: readonly number[] = [0],
): number {
  const m = pattern.length;
  if (m === 0) return 0;
  const starts = new Set(wordStarts);
  let lastStart = 0;
  let before: number[] = [];
  let previous = Array.from({ length: m + 1 }, (_, i) => i);
  let best = m;
  for (let j = 1; j <= text.length; j++) {
    // Les lettres sautées depuis le dernier début de mot se paient.
    if (starts.has(j - 1)) lastStart = j - 1;
    const current = [starts.has(j) ? 0 : j - lastStart];
    for (let i = 1; i <= m; i++) {
      const cost = pattern[i - 1] === text[j - 1] ? 0 : 1;
      let value = Math.min(previous[i] + 1, current[i - 1] + 1, previous[i - 1] + cost);
      if (i > 1 && j > 1 && pattern[i - 1] === text[j - 2] && pattern[i - 2] === text[j - 1]) {
        value = Math.min(value, before[i - 2] + 1);
      }
      current.push(value);
    }
    best = Math.min(best, current[m]);
    before = previous;
    previous = current;
  }
  return best;
}

/** Les fautes tolérées selon la longueur de la clé cherchée. */
function allowedMistakes(keyLength: number): number {
  if (keyLength < 4) return 0;
  if (keyLength < 8) return 1;
  return 2;
}

// ---------------------------------------------------------------------------
// Textes et requêtes préparés
// ---------------------------------------------------------------------------

interface PreparedText {
  /** Les mots, dans les deux lectures de l'apostrophe (voir `normalizeText`). */
  words: string[];
  /** Le texte normalisé, sans espaces : « roch hachana » → « rochhachana ». */
  compact: string;
  wordKeys: string[];
  /** Les clés des mots mises bout à bout. */
  key: string;
  /** Où commence chaque mot dans `key`. */
  keyStarts: number[];
}

const preparedTexts = new Map<string, PreparedText>();
const PREPARED_TEXTS_LIMIT = 5000;

/** Prépare un texte une fois pour toutes : le catalogue ne change pas. */
function prepareText(value: string): PreparedText {
  let prepared = preparedTexts.get(value);
  if (prepared) return prepared;
  const merged = splitWords(normalizeText(value));
  const split = splitWords(normalizeText(value, " "));
  const words = split.length === merged.length ? merged : [...new Set([...merged, ...split])];
  const wordKeys = merged.map((word) => phoneticKey(word));
  const keyStarts: number[] = [];
  let length = 0;
  for (const key of wordKeys) {
    keyStarts.push(length);
    length += key.length;
  }
  prepared = { words, compact: merged.join(""), wordKeys, key: wordKeys.join(""), keyStarts };
  if (preparedTexts.size >= PREPARED_TEXTS_LIMIT) preparedTexts.clear();
  preparedTexts.set(value, prepared);
  return prepared;
}

interface Token {
  norm: string;
  key: string;
  numeric: boolean;
}

/**
 * Les abréviations et les titres qu'on écrit de plusieurs façons : un mot de
 * la requête vaut aussi chacune de ses équivalences. « st etienne » trouve
 * Saint-Étienne ; « rabbi » trouve le « Rav » d'un auteur.
 */
const EQUIVALENTS: Record<string, string[]> = {
  st: ["saint"],
  ste: ["sainte"],
  rav: ["rabbi", "rabbin", "harav"],
  rabbi: ["rav", "rabbin", "harav"],
  rabbin: ["rav", "rabbi", "harav"],
  harav: ["rav", "rabbi", "rabbin"],
};

function makeToken(norm: string): Token {
  return { norm, key: phoneticKey(norm, true), numeric: /^\d+$/.test(norm) };
}

/** Un mot de la requête, et les formes qui valent pour lui. */
type QueryWord = Token[];

interface PreparedQuery {
  words: QueryWord[];
  /** Toute la requête d'un seul tenant, pour « a mazon » (Hamazon). */
  whole: QueryWord | null;
}

function prepareQuery(term: string): PreparedQuery | null {
  const words = splitWords(normalizeText(term));
  if (words.length === 0) return null;
  const queryWords = words.map((word) => [word, ...(EQUIVALENTS[word] ?? [])].map(makeToken));
  // Pas de lecture d'un seul tenant dès qu'un nombre s'y trouve : elle le
  // rendrait approchable (« tehilim24 » à une faute de « tehilim23 »).
  const hasNumber = words.some((word) => /^\d+$/.test(word));
  const whole = words.length > 1 && !hasNumber ? [makeToken(words.join(""))] : null;
  return { words: queryWords, whole };
}

// ---------------------------------------------------------------------------
// Score
// ---------------------------------------------------------------------------

/** En deçà, la correspondance n'est qu'approchante (troisième rang). */
const STRONG = 60;

/**
 * Jusqu'où chercher dans un champ :
 * - `approximate` : tous les rangs, fautes de frappe comprises ;
 * - `exact` : le texte et sa clé phonétique, sans les fautes ;
 * - `words` : les débuts de mots seulement (texte ou clé), pour un texte
 *   long où un bout de mot tomberait n'importe où (« rav » dans « travail »).
 */
type Reach = "approximate" | "exact" | "words";

function tokenScore(token: Token, field: PreparedText, reach: Reach): number {
  // Un nombre se cherche comme un nombre : « 23 » trouve le Tehilim 23 (et
  // 230), pas le 123 ; jamais « à une faute près ».
  if (token.numeric) {
    let score = 0;
    for (const word of field.words) {
      if (word === token.norm) return 100;
      if (/^\d/.test(word) && word.startsWith(token.norm)) score = 95;
    }
    return score;
  }

  // 1. Le texte normalisé. Deux lettres ne comptent qu'en début de mot :
  // « bo » est la paracha Bo, pas le milieu de « Ketubot ».
  if (field.words[0]?.startsWith(token.norm)) return 100;
  if (field.words.some((word) => word.startsWith(token.norm))) return 95;
  const inside = reach !== "words";
  if (inside && token.norm.length > 2 && field.compact.includes(token.norm)) return 85;

  // 2. La clé phonétique. Une clé de deux lettres ne compte qu'en début de mot.
  if (token.key !== "") {
    if (field.wordKeys.some((key) => key.startsWith(token.key))) return 75;
    if (inside && token.key.length > 2 && field.key.includes(token.key)) return 70;
  }

  // 3. À quelques fautes près.
  if (reach === "approximate") {
    const allowed = allowedMistakes(token.key.length);
    if (allowed > 0) {
      const distance = approximateDistance(token.key, field.key, field.keyStarts);
      if (distance <= allowed) return 50 - 10 * distance;
    }
  }
  return 0;
}

/**
 * Un champ où chercher : un nom, un auteur, une ville. Un texte long (une
 * description) se déclare `{ text, long: true }` : on n'y cherche que des
 * débuts de mots, sans fautes de frappe, sans quoi une phrase entière
 * répondrait à presque tout.
 */
export type SearchField =
  | string
  | null
  | undefined
  | { text: string | null | undefined; long?: boolean };

interface PreparedField {
  text: PreparedText;
  long: boolean;
}

function prepareFields(fields: SearchField[]): PreparedField[] {
  const prepared: PreparedField[] = [];
  for (const field of fields) {
    const text = typeof field === "object" && field !== null ? field.text : field;
    if (!text) continue;
    const long = typeof field === "object" && field !== null && field.long === true;
    prepared.push({ text: prepareText(text), long });
  }
  return prepared;
}

function wordScore(word: QueryWord, field: PreparedField, withTypos: boolean): number {
  const reach: Reach = field.long ? "words" : withTypos ? "approximate" : "exact";
  let best = 0;
  for (const token of word) best = Math.max(best, tokenScore(token, field.text, reach));
  return best;
}

/**
 * Le score d'un élément (0 : ne répond pas). Tous les mots de la requête
 * doivent répondre. Au-dessus de `STRONG`, la correspondance est franche ;
 * un résultat qui tient tous les mots dans un même champ gagne un rang.
 */
function scoreItem(query: PreparedQuery, fields: PreparedField[], withTypos: boolean): number {
  if (fields.length === 0) return 0;
  // scores[w][f] : le mot w de la requête dans le champ f.
  const scores = query.words.map((word) =>
    fields.map((field) => wordScore(word, field, withTypos)),
  );

  let sameField = 0;
  for (let f = 0; f < fields.length; f++) {
    sameField = Math.max(sameField, Math.min(...scores.map((row) => row[f])));
  }
  if (query.whole) {
    for (const field of fields) {
      sameField = Math.max(sameField, wordScore(query.whole, field, withTypos));
    }
  }
  const acrossFields = Math.min(...scores.map((row) => Math.max(...row)));

  // Le rang « même champ » passe devant « plusieurs champs », qui passe
  // devant les approchants ; le millier porte le rang (voir `tierOf`).
  if (sameField >= STRONG) return 2000 + sameField;
  if (acrossFields >= STRONG) return 1000 + acrossFields;
  return Math.max(sameField, acrossFields);
}

/** 2 : tous les mots dans un même champ ; 1 : dans plusieurs ; 0 : approchant. */
function tierOf(score: number): number {
  return Math.floor(score / 1000);
}

export interface SearchOptions {
  /**
   * Garder l'ordre d'origine plutôt que ranger du plus pertinent au moins
   * pertinent : la bibliothèque regroupe par corpus et par livre, dans
   * l'ordre du catalogue.
   */
  keepOrder?: boolean;
}

/**
 * Les éléments qui répondent à la recherche, du plus pertinent au moins
 * pertinent (à pertinence égale, dans l'ordre d'origine). Seul le meilleur
 * rang présent est rendu : les approchants ne s'affichent que faute de mieux.
 * Une recherche vide rend la liste telle quelle.
 */
export function searchItems<T>(
  items: readonly T[],
  term: string,
  fieldsOf: (item: T) => SearchField[],
  options: SearchOptions = {},
): T[] {
  const query = prepareQuery(term);
  if (query === null) return items as T[];
  const fields = items.map((item) => prepareFields(fieldsOf(item)));

  // D'abord sans les approchants, qui coûtent le plus cher ; ils ne se
  // calculent que si rien ne répond franchement.
  let scored = items
    .map((item, index) => ({ item, index, score: scoreItem(query, fields[index], false) }))
    .filter((entry) => entry.score > 0);
  if (scored.length === 0) {
    scored = items
      .map((item, index) => ({ item, index, score: scoreItem(query, fields[index], true) }))
      .filter((entry) => entry.score > 0);
  }

  const bestTier = Math.max(-1, ...scored.map((entry) => tierOf(entry.score)));
  const kept = scored.filter((entry) => tierOf(entry.score) === bestTier);
  if (!options.keepOrder) kept.sort((a, b) => b.score - a.score || a.index - b.index);
  return kept.map((entry) => entry.item);
}

/**
 * Vrai si les champs répondent à la recherche, à n'importe quel rang. Pour
 * filtrer une liste, préférer `searchItems`, qui écarte les approchants
 * quand mieux existe.
 */
export function matchesQuery(term: string, fields: SearchField[]): boolean {
  const query = prepareQuery(term);
  if (query === null) return true;
  return scoreItem(query, prepareFields(fields), true) > 0;
}

/** Vrai si la recherche est vide (espaces et ponctuation seuls compris). */
export function isBlankQuery(term: string): boolean {
  return prepareQuery(term) === null;
}
