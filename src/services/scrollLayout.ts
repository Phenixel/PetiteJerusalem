/**
 * Les lignes du Sefer Torah (public/texts/torah-layout, voir
 * docs/compatibilite-textes.md et scripts/layout/scroll.py).
 *
 * Un fichier de lignes ne porte aucun mot : pour chaque colonne du rouleau,
 * la place du premier mot de chaque ligne dans le texte qu'on a déjà. Ce
 * module en fait ce que TorahScroll.vue écrit : des colonnes, des lignes,
 * leurs morceaux et leurs mots ; puis il dit comment une ligne se pose sur
 * toute la largeur de la colonne, comme le sofer la justifie.
 *
 * Rien ici ne touche à l'écran : la largeur des mots est donnée par qui
 * appelle (TorahScroll.vue la mesure dans l'écriture du sofer).
 */
import { fetchTextResponse } from "./offlineTextStore";

/** La place d'un mot : son verset dans la paracha, son rang dans le verset. */
export type ScrollPlace = [verse: number, word: number];

/**
 * Une ligne du rouleau : ses morceaux, chacun par la place de son premier
 * mot, séparés par des blancs (setouma, chira). `null` tient la place d'un
 * blanc au bord : la ligne s'arrête là (petou'ha), ou ce qui précède, ce qui
 * suit, est d'une autre paracha. Aucun morceau : une ligne blanche.
 */
export type ScrollLayoutLine = (ScrollPlace | null)[];

export interface ScrollLayoutColumn {
  /** Le numéro de la colonne dans le rouleau (1 à 245). */
  column: number;
  /** La ligne de la colonne par laquelle la paracha y entre (0 à 41). */
  from: number;
  lines: ScrollLayoutLine[];
  /** Haazinou : de quelle ligne à quelle ligne (de `lines`) on écrit en deux moitiés. */
  halves?: [number, number];
}

export interface ScrollLayout {
  title: string;
  edition: string;
  columns: ScrollLayoutColumn[];
  /** Les grandes lettres : `[verset, mot, lettre]`. */
  big: [number, number, number][];
  /** Les petites lettres, de même. */
  small: [number, number, number][];
}

/** Une colonne de Sefer Torah a quarante-deux lignes. */
export const SCROLL_COLUMN_LINES = 42;

/** Des mots qui se suivent dans un même verset. */
export interface ScrollRun {
  verse: number;
  /** Le rang du premier de ces mots dans son verset. */
  from: number;
  words: string[];
}

/** Un morceau de ligne : ce qui s'écrit d'un trait, entre deux blancs. */
export interface ScrollPiece {
  runs: ScrollRun[];
  /** Le rang de son premier mot parmi tous les mots de la paracha. */
  rank: number;
  count: number;
}

export interface ScrollRow {
  /**
   * `full` : une ligne d'un bord à l'autre. `pieces` : des morceaux et des
   * blancs. `halves` : une ligne de Haazinou. `blank` : une ligne blanche.
   */
  kind: "blank" | "full" | "pieces" | "halves";
  pieces: ScrollPiece[];
  /** Un blanc avant le premier morceau. */
  lead: boolean;
  /** Un blanc après le dernier. */
  trail: boolean;
}

export interface ScrollColumn {
  column: number;
  from: number;
  rows: ScrollRow[];
}

/**
 * Les colonnes d'une paracha, prêtes à écrire. `verses` : les mots de chaque
 * verset (scrollVerseWords). `null` si le fichier de lignes ne colle pas au
 * texte (une place qui n'existe pas, des lignes qui ne se suivent pas) : la
 * colonne s'écrit alors sans lui, plutôt que de travers.
 */
export function scrollColumns(layout: ScrollLayout, verses: string[][]): ScrollColumn[] | null {
  // Le rang de chaque mot dans la paracha, et l'inverse.
  const firstRank: number[] = [];
  let total = 0;
  for (const words of verses) {
    firstRank.push(total);
    total += words.length;
  }
  const rankOf = (place: ScrollPlace): number | null => {
    const [verse, word] = place;
    if (!Number.isInteger(verse) || !Number.isInteger(word)) return null;
    if (verse < 0 || verse >= verses.length || word < 0 || word >= verses[verse].length)
      return null;
    return firstRank[verse] + word;
  };

  // Les débuts de morceau, dans l'ordre : chacun finit où le suivant commence.
  const starts: number[] = [];
  for (const column of layout.columns) {
    if (column.from < 0 || column.from + column.lines.length > SCROLL_COLUMN_LINES) return null;
    for (const line of column.lines) {
      for (const place of line) {
        if (!place) continue;
        const rank = rankOf(place);
        const previous = starts[starts.length - 1];
        // Le premier morceau commence au premier mot, les suivants avancent.
        if (rank === null || (previous === undefined ? rank !== 0 : rank <= previous)) return null;
        starts.push(rank);
      }
    }
  }
  if (!starts.length) return null;
  starts.push(total);

  const runsOf = (from: number, to: number): ScrollRun[] => {
    const runs: ScrollRun[] = [];
    let verse = verseAt(firstRank, from);
    let rank = from;
    while (rank < to) {
      while (verse + 1 < verses.length && firstRank[verse + 1] <= rank) verse++;
      const word = rank - firstRank[verse];
      const count = Math.min(to - rank, verses[verse].length - word);
      runs.push({ verse, from: word, words: verses[verse].slice(word, word + count) });
      rank += count;
    }
    return runs;
  };

  let next = 0;
  return layout.columns.map((column) => ({
    column: column.column,
    from: column.from,
    rows: column.lines.map((line, index): ScrollRow => {
      const pieces: ScrollPiece[] = [];
      for (const place of line) {
        if (!place) continue;
        const from = starts[next];
        const to = starts[next + 1];
        next++;
        pieces.push({ runs: runsOf(from, to), rank: from, count: to - from });
      }
      const lead = line.length > 0 && line[0] === null;
      const trail = line.length > 0 && line[line.length - 1] === null;
      const inHalves = column.halves && index >= column.halves[0] && index <= column.halves[1];
      const kind = !pieces.length
        ? "blank"
        : inHalves && pieces.length === 2
          ? "halves"
          : pieces.length === 1 && !lead && !trail
            ? "full"
            : "pieces";
      return { kind, pieces, lead, trail };
    }),
  }));
}

/** Le verset qui porte le mot de ce rang. */
function verseAt(firstRank: number[], rank: number): number {
  let lo = 0;
  let hi = firstRank.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (firstRank[mid] <= rank) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// ---- Poser une ligne sur la largeur de la colonne --------------------------

/**
 * La largeur d'une colonne ordinaire, en cadratins de l'écriture du sofer
 * (Stam Sefarad CLM) : la médiane des lignes du rouleau, qui ont de vingt-six
 * à trente-six lettres. Presque toutes tiennent à un dixième près.
 */
export const SCROLL_COLUMN_EMS = 16.75;

/**
 * La largeur de chaque lettre dans Stam Sefarad CLM, en cadratins, et celle
 * de l'espace : de quoi estimer une ligne là où rien ne se mesure (avant le
 * premier affichage, dans un test). À l'écran, TorahScroll.vue mesure la
 * police qui s'affiche vraiment.
 */
const STAM_ADVANCES: Record<string, number> = {
  א: 0.573,
  ב: 0.519,
  ג: 0.387,
  ד: 0.519,
  ה: 0.55,
  ו: 0.278,
  ז: 0.303,
  ח: 0.546,
  ט: 0.575,
  י: 0.265,
  ך: 0.528,
  כ: 0.529,
  ל: 0.557,
  ם: 0.541,
  מ: 0.549,
  ן: 0.303,
  נ: 0.34,
  ס: 0.541,
  ע: 0.541,
  ף: 0.492,
  פ: 0.515,
  ץ: 0.518,
  צ: 0.524,
  ק: 0.528,
  ר: 0.557,
  ש: 0.708,
  ת: 0.566,
  " ": 0.25,
};

/** La largeur estimée d'un texte dans l'écriture du sofer, en cadratins. */
export function estimatedWidth(text: string): number {
  let width = 0;
  for (const letter of text) width += STAM_ADVANCES[letter] ?? 0;
  return width;
}

/** Jusqu'où les lettres d'une ligne se resserrent et s'étirent. */
const STRETCH_MIN = 0.86;
const STRETCH_MAX = 1.16;
/** Une moitié de Haazinou, quelques mots dans une demi-colonne, s'étire plus. */
export const HALF_STRETCH_MAX = 1.3;

export interface LineFit {
  /** L'étirement des lettres (et des blancs entre les mots), en largeur. */
  stretch: number;
  /** Ce qui s'ajoute à chaque espace, en cadratins d'avant l'étirement. */
  spacing: number;
}

/**
 * Comment une ligne remplit sa largeur. Le sofer n'écarte pas les mots : il
 * élargit ou resserre ses lettres. On fait de même tant que l'écriture n'en
 * souffre pas ; au-delà, les espaces prennent le reste.
 *
 * @param natural la largeur de la ligne telle que la police l'écrit
 * @param gaps le nombre d'espaces entre ses mots
 * @param space la largeur d'une espace
 * @param target la largeur à remplir
 */
export function fitLine(
  natural: number,
  gaps: number,
  space: number,
  target: number,
  max: number = STRETCH_MAX,
): LineFit {
  if (!(natural > 0) || !(target > 0)) return { stretch: 1, spacing: 0 };
  const ratio = target / natural;
  if (ratio >= STRETCH_MIN && ratio <= max) return { stretch: ratio, spacing: 0 };
  if (ratio > max) {
    // Une ligne courte : les lettres au plus large, les espaces pour le reste.
    return { stretch: max, spacing: gaps > 0 ? (target / max - natural) / gaps : 0 };
  }
  // Une ligne longue : les espaces se serrent, jusqu'à leur moitié, puis les
  // lettres se resserrent encore.
  const lack = natural - target / STRETCH_MIN;
  const tight = gaps > 0 ? Math.min(lack / gaps, space / 2) : 0;
  return { stretch: Math.min(STRETCH_MIN, target / (natural - gaps * tight)), spacing: -tight };
}

/**
 * L'échelle de l'écriture dans une colonne. Les colonnes d'un rouleau n'ont
 * pas toutes la même largeur : celle d'Az yachir est d'un tiers plus large.
 * La page, elle, n'a qu'une largeur : une colonne large s'y écrit plus petit.
 *
 * @param naturals la largeur de chacune des lignes pleines de la colonne
 */
export function columnScale(naturals: number[], target: number = SCROLL_COLUMN_EMS): number {
  if (naturals.length < 3) return 1;
  const sorted = [...naturals].sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];
  return median > target * 1.1 ? target / median : 1;
}

// ---- Le fichier --------------------------------------------------------------

const layouts = new Map<string, Promise<ScrollLayout | null>>();

/**
 * Les lignes du rouleau pour ce texte (l'identifiant de la paracha), ou
 * `null` : pas de fichier, pas de réseau. La colonne s'écrit alors à notre
 * façon, justifiée, sans les lignes du rouleau.
 */
export function loadScrollLayout(id: number | string): Promise<ScrollLayout | null> {
  const key = String(id);
  let pending = layouts.get(key);
  if (!pending) {
    pending = fetchTextResponse(`/texts/torah-layout/${key}.json`)
      .then(async (res) => (res.ok ? ((await res.json()) as ScrollLayout) : null))
      .catch(() => null)
      .then((layout) => {
        // Un échec n'est pas gardé : le réseau peut revenir.
        if (!layout) layouts.delete(key);
        return layout;
      });
    layouts.set(key, pending);
  }
  return pending;
}
