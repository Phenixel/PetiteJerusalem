/**
 * Les lignes de la page de Vilna (public/texts/talmud-layout, voir
 * docs/compatibilite-textes.md et scripts/layout/vilna.py).
 *
 * Un fichier de lignes ne porte aucun mot : pour chaque ligne de la page
 * imprimée, sa boîte sur la page et la place, dans les textes qu'on a déjà,
 * des mots qu'elle porte. Ce module en fait ce que TalmudPrintedPage.vue
 * écrit : chaque ligne à sa place, avec ses mots.
 *
 * Rien ici ne touche à l'écran.
 */
import { fetchTextResponse } from "./offlineTextStore";
import { gemaraPageText } from "./pageForm";
import type { DafZone } from "./dafLinks";
import type { DafMeforshim, RashiComment } from "./textService";

/** Les boîtes se comptent en dix-millièmes de la largeur de la page. */
export const DAF_UNITS = 10000;
/** Amoudim par fichier, comme les commentaires (MEFORSHIM_CHUNK). */
export const DAF_LAYOUT_CHUNK = 20;

/**
 * Un morceau de texte sur une ligne : `[passage, mot, nombre]`, et l'amoud
 * quand ce n'est pas celui de la page (un commentaire commencé à la page
 * d'avant). Le passage est celui de Sefaria (DafBlock.passages) ; le mot se
 * compte dans le passage tel que la page l'écrit (guemara), ou dans les
 * commentaires du passage bout à bout, dibbour puis texte (Rachi, Tossafot).
 */
export type DafRun = [passage: number, word: number, count: number, amud?: number];

/**
 * Une ligne : son bord gauche, le milieu de sa hauteur et sa largeur, en
 * dix-millièmes de la largeur de la page ; puis ses morceaux de texte.
 */
export type DafLayoutLine = [x: number, y: number, width: number, ...runs: DafRun[]];

export interface DafLayoutPage {
  /** La hauteur de la page, dans la même unité. */
  height: number;
  /** L'interligne de la guemara et celui des commentaires. */
  pitch: [number, number];
  main: DafLayoutLine[];
  rashi: DafLayoutLine[];
  tosafot: DafLayoutLine[];
  /**
   * Le mot d'ouverture d'un traité ou d'un chapitre, que le livre écrit en
   * très grand au-dessus de la guemara : sa boîte (bord gauche, milieu,
   * largeur, hauteur des lettres) et sa place dans la guemara. Il n'est dans
   * aucune ligne de `main`.
   */
  initial?: [
    x: number,
    y: number,
    width: number,
    height: number,
    passage: number,
    word: number,
    count: number,
  ][];
  /** Les mots de la guemara que le livre écrit plus grand dans leur ligne. */
  big?: DafRun[];
  /**
   * « הדרן עלך … » : la ligne qui clôt un chapitre, que le livre écrit à
   * part, en grand, sous la guemara et sous chaque commentaire. Même forme
   * que `initial` : sa boîte et la place de ses mots ; puis, pour celle d'un
   * commentaire, sa zone (1 pour Rachi, 2 pour Tossafot) et l'amoud quand ce
   * n'est pas celui de la page. Elle n'est dans aucune ligne courante.
   */
  closing?: [
    x: number,
    y: number,
    width: number,
    height: number,
    passage: number,
    word: number,
    count: number,
    zone?: number,
    amud?: number,
  ][];
  /**
   * Les abréviations du livre, là où nos mots en toutes lettres ne tiennent
   * pas dans la ligne (« המע"ה » pour « המוציא מחברו עליו הראיה ») :
   * `[zone, passage, mot, nombre, texte]`, zone 0 pour la guemara, 1 pour
   * Rachi, 2 pour Tossafot, et l'amoud quand ce n'est pas celui de la page.
   * La page écrit `texte` à la place de ces mots ; ailleurs, nos mots restent.
   */
  short?: [
    zone: number,
    passage: number,
    word: number,
    count: number,
    text: string,
    amud?: number,
  ][];
}

export interface DafLayoutChunk {
  edition: string;
  from: number;
  pages: (DafLayoutPage | null)[];
}

/** Un mot à écrire, et d'où il vient. */
export interface DafWord {
  text: string;
  passage: number;
  /** Du dibbour hamat'hil : en lettres carrées grasses. */
  lead: boolean;
  /** Une abréviation du livre, écrite à la place de plusieurs de nos mots. */
  short?: boolean;
  /** Écrit plus grand dans sa ligne (« גמ׳ », le premier mot d'un chapitre). */
  big?: boolean;
  /** Le rang de son commentaire dans la colonne de la page (dafLinks.ts). */
  comment?: number;
}

export interface DafLine {
  zone: "main" | DafZone;
  x: number;
  y: number;
  width: number;
  words: DafWord[];
  /**
   * Hors des lignes courantes : le mot d'ouverture en très grand, ou la
   * ligne qui clôt un chapitre. `height` est alors la hauteur de ses lettres.
   */
  kind?: "initial" | "closing";
  height?: number;
}

/** Les mots qui annoncent la michna et la guemara, en gras sur la page. */
const HEADS = new Set(["מתני׳", "גמ׳", "מתני'", "גמ'"]);

/** Les mots d'un commentaire : son dibbour, puis son texte. */
function commentWords(comment: RashiComment): { words: string[]; lead: number } {
  const lead = comment.lead ? comment.lead.split(/\s+/).filter(Boolean) : [];
  const text = comment.text.split(/\s+/).filter(Boolean);
  return { words: [...lead, ...text], lead: leadLength(lead, text) };
}

/**
 * Le nombre de mots du dibbour hamat'hil. Le fichier le balise presque
 * toujours ; pour un Tossafot sur quatre il ne le fait pas, et le dibbour est
 * alors ce qui précède le premier point, comme sur la page.
 */
export function leadLength(lead: string[], text: string[]): number {
  if (lead.length) return lead.length;
  const stop = text.findIndex((word) => word.endsWith("."));
  return stop >= 0 && stop < 12 ? stop + 1 : 0;
}

/** Les mots des commentaires d'un amoud, passage par passage, bout à bout. */
function zoneWords(passages: RashiComment[][]): { passage: DafWord[][]; count: number } {
  let comment = 0;
  const out = passages.map((comments, passage) => {
    const words: DafWord[] = [];
    for (const c of comments) {
      const { words: all, lead } = commentWords(c);
      all.forEach((text, k) => words.push({ text, passage, lead: k < lead, comment }));
      comment++;
    }
    return words;
  });
  return { passage: out, count: comment };
}

/**
 * Les lignes d'une page, avec leurs mots. `lines` et `passages` : la guemara
 * de l'amoud (DafBlock) ; `meforshim` : les commentaires par amoud, celui de
 * la page et, s'il est chargé, celui d'avant. `null` si une place n'existe
 * pas dans la guemara : la page s'écrit alors sans ses lignes.
 */
export function dafLines(
  page: DafLayoutPage,
  amud: number,
  lines: string[],
  passages: number[] | undefined,
  meforshim: Map<number, DafMeforshim> | null,
): DafLine[] | null {
  const gemara = new Map<number, string[]>();
  lines.forEach((line, k) => {
    const text = gemaraPageText([line]);
    gemara.set(passages?.[k] ?? k, text ? text.split(" ") : []);
  });
  const out: DafLine[] = [];
  const short = new Map<string, { count: number; text: string }>();
  for (const [zone, passage, word, count, text, other] of page.short ?? [])
    short.set(`${zone}:${other ?? amud}:${passage}:${word}`, { count, text });
  const big = new Set<string>();
  for (const [passage, from, count] of page.big ?? [])
    for (let k = from; k < from + count; k++) big.add(`${passage}:${k}`);
  const gemaraWords = (runs: DafRun[]): DafWord[] | null => {
    const words: DafWord[] = [];
    for (const [passage, from, count] of runs) {
      const source = gemara.get(passage);
      if (!source || from + count > source.length) return null;
      for (let k = from; k < from + count; k++) {
        const brief = short.get(`0:${amud}:${passage}:${k}`);
        if (brief && k + brief.count <= from + count) {
          words.push({ text: brief.text, passage, lead: false, short: true });
          k += brief.count - 1;
          continue;
        }
        const word: DafWord = { text: source[k], passage, lead: false };
        if (big.has(`${passage}:${k}`) || HEADS.has(source[k])) word.big = true;
        words.push(word);
      }
    }
    return words;
  };
  for (const [x, y, width, height, passage, word, count] of page.initial ?? []) {
    const words = gemaraWords([[passage, word, count]]);
    if (!words) return null;
    out.push({ zone: "main", kind: "initial", x, y, width, height, words });
  }
  for (const [x, y, width, ...runs] of page.main) {
    const words = gemaraWords(runs);
    if (!words) return null;
    out.push({ zone: "main", x, y, width, words });
  }
  for (const [x, y, width, height, passage, word, count, zone] of page.closing ?? []) {
    if (zone) continue;
    const words = gemaraWords([[passage, word, count]]);
    if (!words) return null;
    out.push({ zone: "main", kind: "closing", x, y, width, height, words });
  }
  // Les commentaires : ceux de la page, et ceux d'une autre que cite une ligne.
  const cache = new Map<string, DafWord[][]>();
  const wordsOf = (zone: DafZone, at: number): DafWord[][] | null => {
    const key = `${zone}:${at}`;
    if (!cache.has(key)) {
      const m = meforshim?.get(at);
      if (!m) return null;
      cache.set(key, zoneWords(m[zone]).passage);
    }
    return cache.get(key)!;
  };
  for (const zone of ["rashi", "tosafot"] as const) {
    if (!meforshim?.get(amud)) continue;
    for (const [x, y, width, ...runs] of page[zone]) {
      const words: DafWord[] = [];
      for (const [passage, from, count, other] of runs) {
        const source = wordsOf(zone, other ?? amud)?.[passage];
        // Un commentaire d'une page qu'on n'a pas : la ligne s'écrit sans lui.
        if (!source) continue;
        const end = Math.min(from + count, source.length);
        for (let k = from; k < end; k++) {
          const at = other ?? amud;
          const brief = short.get(`${zone === "rashi" ? 1 : 2}:${at}:${passage}:${k}`);
          let word = source[k];
          if (brief && k + brief.count <= end) {
            word = { ...word, text: brief.text, short: true };
            k += brief.count - 1;
          }
          // Un mot d'une autre page ne se relie pas aux passages de celle-ci.
          words.push(other === undefined ? word : { ...word, passage: -1, comment: -1 });
        }
      }
      out.push({ zone, x, y, width, words });
    }
  }
  // La clôture sous Rachi et sous Tossafot, écrite à part comme sous la guemara.
  for (const [x, y, width, height, passage, word, count, z, other] of page.closing ?? []) {
    if (!z) continue;
    const zone = z === 1 ? "rashi" : "tosafot";
    const source = wordsOf(zone, other ?? amud)?.[passage];
    if (!source) continue;
    const words = source
      .slice(word, word + count)
      .map((w) => ({ text: w.text, lead: false, passage: -1 }));
    if (words.length) out.push({ zone, kind: "closing", x, y, width, height, words });
  }
  return out;
}

// ---- Le fichier --------------------------------------------------------------

const chunks = new Map<string, Promise<DafLayoutChunk | null>>();

/**
 * Les lignes d'un amoud (son index dans le fichier du traité), ou `null` :
 * pas de fichier pour ce traité, pas de réseau. La page se compose alors à
 * notre façon (TalmudPage.vue).
 */
export async function loadDafLayout(slug: string, amud: number): Promise<DafLayoutPage | null> {
  const n = Math.floor(amud / DAF_LAYOUT_CHUNK);
  const key = `${slug}/${n}`;
  let pending = chunks.get(key);
  if (!pending) {
    pending = fetchTextResponse(`/texts/talmud-layout/${key}.json`)
      .then(async (res) => (res.ok ? ((await res.json()) as DafLayoutChunk) : null))
      .catch(() => null)
      .then((chunk) => {
        if (!chunk) chunks.delete(key);
        return chunk;
      });
    chunks.set(key, pending);
  }
  const chunk = await pending;
  return chunk?.pages[amud - chunk.from] ?? null;
}
