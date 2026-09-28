/**
 * Recherche tolérante, commune à toutes les barres de recherche du site.
 *
 * Un même nom s'écrit de dix façons (« Chabbat », « Shabbat » ; « Berakhot »,
 * « Brakhot », « Brahot »). Plutôt qu'énumérer les graphies, chaque mot est
 * ramené à une clé phonétique où elles se confondent (voir `latinKey`), et
 * la clé de ce qu'on tape se cherche dans celle du texte. Trois rangs :
 * 1. le texte sans casse, accents ni apostrophes ;
 * 2. la clé phonétique ;
 * 3. la clé à une ou deux fautes de frappe près, seulement faute de mieux :
 *    sans quoi « bava » ramènerait aussi « Shabbat ».
 *
 * Chaque mot de la requête doit répondre, dans n'importe quel ordre ; un
 * résultat qui les tient tous dans un même champ passe devant (« sefer 1 » :
 * le livre 1 des Tehilim, pas le Tehilim 100 du livre 4).
 */

const HEBREW_FINALS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };
const HEBREW_LETTER = /[\u05D0-\u05EA]/;
const NUMBER = /^\d+$/;

/**
 * Minuscules, sans accents, ponctuation, voyelles hébraïques ni lettres
 * finales. L'apostrophe s'efface (« Min'ha » = « Minha ») ; `apostrophe`
 * à " " la lit comme une séparation (« d'Abraham »).
 */
export function normalizeText(value: string, apostrophe: "" | " " = ""): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05F3\u05F4]/g, "")
    .replace(/[ךםןףץ]/g, (letter) => HEBREW_FINALS[letter])
    .replace(/(?<=[\u05D0-\u05EA])["'](?=[\u05D0-\u05EA])/g, "")
    .replace(/['‘’ʼ`´]/g, apostrophe)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Les mots ; « tehilim23 » donne « tehilim », « 23 ». */
function splitWords(normalized: string): string[] {
  return normalized.split(/ |(?<=\p{L})(?=\p{N})|(?<=\p{N})(?=\p{L})/u).filter(Boolean);
}

/**
 * Clé d'un mot latin. `H` : sh, ch, sch, kh et h (le ch vaut chin en français,
 * 'het en anglais) ; `C` : tz, ts. Se confondent aussi b, v, w ; k, c dur, q ;
 * y, i, j ; ou et u ; ei et e ; ph et f ; th et t ; gu devant e, i et g. Les
 * lettres doublées se simplifient, et un e entre deux consonnes tombe (le
 * chva s'écrit ou non : Berakhot, Brakhot). Le h final après une voyelle est
 * facultatif dans ce qu'on tape (`typed`) : « havdalah » trouve « Havdala ».
 */
function latinKey(word: string, typed: boolean): string {
  const spelled = word
    .replace(/sch|[sck]h/g, "H")
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    .replace(/gh/g, "g")
    .replace(/gu(?=[eiy])/g, "g")
    .replace(/qu?|ck/g, "k")
    .replace(/t[sz]/g, "C")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/c/g, "k")
    .replace(/x/g, "ks")
    .replace(/[vw]/g, "b")
    .replace(/[yj]/g, "i")
    .replace(/ou|oo/g, "u")
    .replace(/(\D)\1+/g, "$1")
    .replace(/ei/g, "e");
  // Le h final se met de côté avant la chute des e (Tetzaveh, Tetsavé).
  const finalH = /[aeiou]h$/.test(spelled);
  const key = (finalH ? spelled.slice(0, -1) : spelled)
    .replace(/h/g, "H")
    .replace(/(\D)\1+/g, "$1")
    .replace(/(?<=[^aeiou\d])e(?=[^aeiou\d])/g, "");
  return finalH && !typed ? key + "H" : key;
}

/**
 * Clé d'un mot hébreu : sans vav ni yod après la première lettre, et ק/כ,
 * ח/כ, ט/ת, ס/ש, ע/א confondus. Trois lettres ou moins restent telles
 * quelles : c'est souvent un nombre (« כג », 23, n'est pas « קג », 103).
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

export function phoneticKey(word: string, typed = false): string {
  if (NUMBER.test(word)) return word;
  return HEBREW_LETTER.test(word) ? hebrewKey(word) : latinKey(word, typed);
}

/**
 * Le moins de fautes (lettre ajoutée, retirée, changée, ou deux voisines
 * inversées) pour trouver `pattern` dans `text` en partant d'un début de mot
 * (`wordStarts`). Sans cet ancrage, « ohalot » tombait sur le « oharot » de
 * Toharot et ramenait tout le seder.
 */
export function approximateDistance(pattern: string, text: string, wordStarts = [0]): number {
  const m = pattern.length;
  const starts = new Set(wordStarts);
  let lastStart = 0;
  let before: number[] = [];
  let previous = Array.from({ length: m + 1 }, (_, i) => i);
  let best = m;
  for (let j = 1; j <= text.length; j++) {
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

interface PreparedText {
  /** Les mots, apostrophe effacée et apostrophe séparatrice. */
  words: string[];
  compact: string;
  wordKeys: string[];
  key: string;
  keyStarts: number[];
}

// Le catalogue ne change pas : chaque texte ne se prépare qu'une fois.
const prepared = new Map<string, PreparedText>();

function prepareText(value: string): PreparedText {
  const cached = prepared.get(value);
  if (cached) return cached;
  const merged = splitWords(normalizeText(value));
  const words = [...new Set([...merged, ...splitWords(normalizeText(value, " "))])];
  const wordKeys = merged.map((word) => phoneticKey(word));
  const keyStarts = wordKeys.map((_, i) => wordKeys.slice(0, i).join("").length);
  const text = { words, compact: merged.join(""), wordKeys, key: wordKeys.join(""), keyStarts };
  if (prepared.size > 5000) prepared.clear();
  prepared.set(value, text);
  return text;
}

/** « st etienne » trouve Saint-Étienne ; « rabbi » trouve le « Rav » d'un auteur. */
const EQUIVALENTS: Record<string, string[]> = {
  st: ["saint"],
  ste: ["sainte"],
  rav: ["rabbi", "rabbin", "harav"],
  rabbi: ["rav", "rabbin", "harav"],
  rabbin: ["rav", "rabbi", "harav"],
  harav: ["rav", "rabbi", "rabbin"],
};

/** En deçà, la correspondance n'est qu'approchante. */
const STRONG = 60;

/** Un mot de la requête : tel quel et sa clé. */
interface Token {
  norm: string;
  key: string;
}

function tokenScore(
  { norm, key }: Token,
  field: PreparedText,
  long: boolean,
  typos: boolean,
): number {
  // Un nombre reste un nombre : « 23 » trouve 23 et 230, jamais 123 ni 24.
  if (NUMBER.test(norm)) {
    if (field.words.includes(norm)) return 100;
    return field.words.some((w) => NUMBER.test(w) && w.startsWith(norm)) ? 95 : 0;
  }
  // Deux lettres ne comptent qu'en début de mot : « bo » n'est pas dans
  // « Ketubot ». Un texte long ne se cherche que par débuts de mots.
  if (field.words[0]?.startsWith(norm)) return 100;
  if (field.words.some((w) => w.startsWith(norm))) return 95;
  if (!long && norm.length > 2 && field.compact.includes(norm)) return 85;
  if (field.wordKeys.some((k) => k.startsWith(key))) return 75;
  if (!long && key.length > 2 && field.key.includes(key)) return 70;
  if (!typos || long || key.length < 4) return 0;
  const distance = approximateDistance(key, field.key, field.keyStarts);
  return distance <= (key.length < 8 ? 1 : 2) ? 50 - 10 * distance : 0;
}

/**
 * Un champ où chercher. Un texte long (une description) se déclare
 * `{ text, long: true }` : débuts de mots seulement, sans fautes de frappe.
 */
export type SearchField =
  | string
  | null
  | undefined
  | { text: string | null | undefined; long?: boolean };

/** Rang (millier) et score : 2 = tous les mots dans un champ, 1 = dans plusieurs, 0 = approchant. */
function scoreItem(words: Token[][], fields: SearchField[], typos: boolean): number {
  const prepared = fields.flatMap((field) => {
    const text = typeof field === "object" && field ? field.text : field;
    const long = typeof field === "object" && field?.long === true;
    return text ? [{ text: prepareText(text), long }] : [];
  });
  if (prepared.length === 0) return 0;
  // scores[w][f] : le mot w de la requête (ou une de ses équivalences) dans le champ f.
  const scores = words.map((forms) =>
    prepared.map((f) =>
      Math.max(...forms.map((token) => tokenScore(token, f.text, f.long, typos))),
    ),
  );
  const sameField = Math.max(...prepared.map((_, f) => Math.min(...scores.map((row) => row[f]))));
  const acrossFields = Math.min(...scores.map((row) => Math.max(...row)));
  if (sameField >= STRONG) return 2000 + sameField;
  if (acrossFields >= STRONG) return 1000 + acrossFields;
  return Math.max(sameField, acrossFields);
}

/**
 * Les éléments qui répondent à la recherche, du plus pertinent au moins
 * pertinent (`keepOrder` : dans l'ordre d'origine). Seul le meilleur rang
 * présent est rendu ; une recherche vide rend la liste telle quelle.
 */
export function searchItems<T>(
  items: readonly T[],
  term: string,
  fieldsOf: (item: T) => SearchField[],
  { keepOrder = false } = {},
): T[] {
  const words = splitWords(normalizeText(term)).map((w) =>
    [w, ...(EQUIVALENTS[w] ?? [])].map((norm) => ({ norm, key: phoneticKey(norm, true) })),
  );
  if (words.length === 0) return items as T[];
  const score = (typos: boolean) =>
    items
      .map((item, index) => ({ item, index, score: scoreItem(words, fieldsOf(item), typos) }))
      .filter((entry) => entry.score > 0);
  // Les fautes de frappe, les plus coûteuses, ne se cherchent que faute de mieux.
  let found = score(false);
  if (found.length === 0) found = score(true);
  const tier = Math.max(...found.map((entry) => Math.floor(entry.score / 1000)));
  const kept = found.filter((entry) => Math.floor(entry.score / 1000) === tier);
  if (!keepOrder) kept.sort((a, b) => b.score - a.score || a.index - b.index);
  return kept.map((entry) => entry.item);
}
