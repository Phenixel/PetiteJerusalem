/**
 * La forme de la page : un texte montré comme on le trouve dans le livre, et
 * non verset par verset. Deux corpus l'ont :
 *
 *  - la Torah, dans la forme du Sefer Torah : les lettres seules (ni voyelles
 *    ni teamim), en colonne justifiée, la petou'ha qui laisse la fin de la
 *    ligne vide, la setouma qui laisse un blanc dans la ligne, et les deux
 *    chirot écrites à part (TorahScroll.vue) ;
 *  - la guemara, dans la forme de la page de Vilna : le texte au centre,
 *    Rachi du côté de la reliure, Tossafot de l'autre (TalmudPage.vue).
 *
 * Ce module ne tient que ce qui se calcule sans écran : nettoyer le texte,
 * reconnaître les marques et les chirot, découper les lignes d'une chira,
 * et décider des blancs de la page du daf à partir de ce qui a été mesuré.
 */

/** La marque qui suit un verset dans le Sefer Torah. */
export type ParashaMark = "petoukha" | "setouma" | null;

/** « …יוֹם אֶחָֽד׃ {פ} » → petoukha ; « {ס} » → setouma ; sinon rien. */
export function parashaMark(rawVerse: string): ParashaMark {
  if (/\{פ\}/.test(rawVerse)) return "petoukha";
  if (/\{ס\}/.test(rawVerse)) return "setouma";
  return null;
}

/**
 * Les signes que le sofer n'écrit pas : les teamim (U+0591 à U+05AF), les
 * voyelles et le dagech (U+05B0 à U+05BD, U+05BF, U+05C1, U+05C2, U+05C4,
 * U+05C5, U+05C7), le sof passouk (U+05C3), le passek (U+05C0) et le noun
 * inversé (U+05C6). Le maqaf (U+05BE) devient une espace : deux mots liés à la
 * lecture restent deux mots sur le parchemin.
 */
const POINTING = /[\u0591-\u05BD\u05BF-\u05C2\u05C4\u05C5\u05C7]/g;

/**
 * Un verset de la Torah tel que le sofer l'écrit. Le fichier vient de Sefaria
 * et porte, en plus des signes : les marques de paracha ({פ}, {ס}), des notes
 * d'édition (« *(בכתר ארם צובה…) »), et le ktiv suivi du qri
 * (« (קצוותו) [קְצוֹתָ֖יו] ») : on garde le ktiv, qui est ce qui est écrit.
 */
export function scrollVerseWords(rawVerse: string): string[] {
  return rawVerse
    .replace(/&[a-z]+;/g, " ") // entité de la source (&thinsp;)
    .replace(/\*\([^)]*\)/g, " ") // note d'édition
    .replace(/\{[א-ת]\}/g, " ") // marque de paracha
    .replace(/\[[^\]]*\]/g, " ") // qri
    .replace(/[()]/g, "") // ktiv
    .replace(/<[^>]*>/g, "")
    .replace(/\u05BE/g, " ")
    .replace(/\u05C3/g, "")
    .replace(/\u05C6/g, "")
    .replace(/\u05C0/g, "")
    .replace(POINTING, "")
    .split(/\s+/)
    .filter((w) => /[א-ת]/.test(w));
}

/** Les lettres seules d'un verset, pour le reconnaître sans dépendre des signes. */
function letters(rawVerse: string): string {
  return scrollVerseWords(rawVerse).join("");
}

/** Une chira de la Torah, dans les versets d'une paracha (index à plat). */
export interface TorahSong {
  kind: "az-yashir" | "haazinou";
  /** Index du premier verset de la chira. */
  start: number;
  /** Index du dernier verset de la chira (inclus). */
  end: number;
}

/**
 * Les deux chirot que le Sefer Torah écrit dans une forme propre :
 *  - Az yachir (Chemot 15, 1 à 19), « une demi-brique sur une brique » ;
 *  - Haazinou (Devarim 32, 1 à 43), en deux colonnes.
 * Reconnues à leurs premiers mots et au verset qui les suit, pour ne dépendre
 * ni de la numérotation (le fichier de paracha n'a que des montées) ni des
 * voyelles.
 */
export function findTorahSongs(rawVerses: string[]): TorahSong[] {
  const songs: TorahSong[] = [];
  const keys = rawVerses.map(letters);
  const find = (kind: TorahSong["kind"], opening: string, after: string, length: number): void => {
    const start = keys.findIndex((k) => k.startsWith(opening));
    if (start < 0) return;
    // La fin : le verset d'avant celui qui suit la chira, ou sa longueur
    // connue quand la paracha s'arrête avec elle.
    const next = keys.findIndex((k, i) => i > start && k.startsWith(after));
    const end = next > 0 ? next - 1 : Math.min(start + length, keys.length) - 1;
    songs.push({ kind, start, end });
  };
  find("az-yashir", "אזישירמשה", "ותקחמרים", 19);
  find("haazinou", "האזינוהשמים", "ויבאמשה", 43);
  return songs.sort((a, b) => a.start - b.start);
}

/** L'etna'hta (U+0591), le repos du milieu du verset. */
const ETNAHTA = "\u0591";
/**
 * Les teamim qui marquent un repos dans le verset, du plus fort au plus
 * faible : etna'hta, segol, zakef katon et gadol, revia', tip'ha. C'est là
 * que se coupent les membres d'Az yachir.
 */
const PAUSES = /[\u0591\u0592\u0594\u0595\u0597\u0596]/;

/** Les mots d'un verset, avec leurs signes (pour trouver les repos). */
function rawWords(rawVerse: string): string[] {
  return rawVerse
    .replace(/&[a-z]+;/g, " ")
    .replace(/\*\([^)]*\)/g, " ")
    .replace(/\{[א-ת]\}/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[()]/g, "")
    .replace(/\u05BE/g, " ")
    .split(/\s+/)
    .filter((w) => /[א-ת]/.test(w));
}

/** Un mot nu, tel que le sofer l'écrit. */
function bare(word: string): string {
  return word.replace(/[\u05C0\u05C3\u05C6]/g, "").replace(POINTING, "");
}

/**
 * Haazinou : chaque verset sur une ligne, en deux moitiés séparées par un
 * blanc, coupé à l'etna'hta (au milieu à défaut).
 */
export function haazinouLine(rawVerse: string): [string, string] {
  const words = rawWords(rawVerse);
  let cut = words.findIndex((w) => w.includes(ETNAHTA)) + 1;
  if (cut <= 0 || cut >= words.length) cut = Math.ceil(words.length / 2);
  return [words.slice(0, cut).map(bare).join(" "), words.slice(cut).map(bare).join(" ")];
}

/**
 * Az yachir : la chira en membres coupés aux repos du verset, puis posés en
 * lignes qui alternent deux membres (un blanc au milieu) et trois (deux
 * blancs), la « demi-brique sur une brique » du parchemin. Le premier verset
 * ouvre la chira sur une ligne pleine. La découpe ligne à ligne d'un vrai
 * Sefer Torah n'est pas dans les données : celle-ci en garde le dessin, pas
 * les coupures exactes.
 */
export function azYashirLines(rawVerses: string[]): string[][] {
  const members: string[] = [];
  rawVerses.forEach((verse, v) => {
    const words = rawWords(verse);
    if (v === 0) {
      members.push(words.map(bare).join(" "));
      return;
    }
    let current: string[] = [];
    words.forEach((w, i) => {
      current.push(bare(w));
      if ((PAUSES.test(w) && current.length >= 2) || i === words.length - 1) {
        members.push(current.join(" "));
        current = [];
      }
    });
  });
  const lines: string[][] = [];
  const [opening, ...rest] = members;
  if (opening) lines.push([opening]);
  let i = 0;
  let width = 2;
  while (i < rest.length) {
    lines.push(rest.slice(i, i + width));
    i += width;
    width = width === 2 ? 3 : 2;
  }
  return lines;
}

/**
 * La guemara telle que l'imprime Vilna : sans voyelles ni ponctuation
 * moderne. Le fichier vient de l'édition vocalisée et ponctuée de Sefaria ;
 * on ne garde que les lettres, les guillemets d'abréviation (״ et ') et la
 * ponctuation de la page imprimée (le point, les deux-points).
 */
export function gemaraPageText(lines: string[]): string {
  return lines
    .join(" ")
    .replace(POINTING, "")
    .replace(/[\u05BE\u05C3]/g, " ")
    .replace(/[?!,;…\u2013\u2014]/g, " ")
    .replace(/(^|\s)\u05F4(\S)/g, "$1$2") // guillemet ouvrant d'une citation
    .replace(/(\S)\u05F4(?=[\s.:]|$)/g, "$1") // guillemet fermant
    .replace(/\s+([.:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Les côtés de la page : Rachi va vers la reliure, Tossafot vers le bord. */
export function dafSides(amud: "a" | "b"): { rashi: "left" | "right"; tosafot: "left" | "right" } {
  // L'amoud a est la page de gauche du livre ouvert (on lit de droite à
  // gauche) : sa reliure est à droite. L'amoud b, page de droite, l'a à gauche.
  return amud === "a" ? { rashi: "right", tosafot: "left" } : { rashi: "left", tosafot: "right" };
}

/** « 2a » → « a », « 13b » → « b ». */
export function amudOf(daf: string): "a" | "b" {
  return daf.endsWith("b") ? "b" : "a";
}

/**
 * Ce qui a été mesuré d'une page du daf, en pixels depuis son haut, quand
 * chaque commentaire descend dans sa colonne sans s'arrêter.
 */
export interface DafMeasure {
  /** La hauteur de l'en-tête où les commentaires prennent chacun une moitié. */
  head: number;
  /** Le bas de Rachi, de Tossafot (0 : pas de commentaire). */
  rashiEnd: number;
  tosafotEnd: number;
  /** Le bas de la guemara, les colonnes des commentaires réglées. */
  mainEnd: number;
  /** L'interligne des commentaires, pour arrondir les blancs à une ligne. */
  sideLine: number;
  /** L'écart vertical entre la guemara et ce qui passe dessous. */
  gap: number;
}

/**
 * La colonne de chaque commentaire, à partir du haut de la page : un
 * commentaire plus long que la guemara la contourne par-dessous, en reprenant
 * sa moitié de la page après elle ; un commentaire plus court s'arrête dans sa
 * colonne, et la guemara s'élargit de son côté. La colonne vaut alors jusqu'à
 * la fin de la guemara (et l'écart), arrondie à une ligne de commentaire pour
 * qu'aucune ligne ne passe à cheval.
 */
export function dafColumns(m: DafMeasure): { rashi: number | null; tosafot: number | null } {
  const column = (end: number): number | null => {
    if (end <= m.mainEnd) return null; // s'arrête dans sa colonne
    const height = Math.max(0, m.mainEnd + m.gap - m.head);
    return Math.ceil(height / m.sideLine) * m.sideLine;
  };
  return { rashi: column(m.rashiEnd), tosafot: column(m.tosafotEnd) };
}

// ---- Le dibbour hamat'hil dans le passage ----------------------------------

/** Les lettres finales, ramenées à leur forme ordinaire pour comparer. */
const FINALS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

/** Un mot réduit à ses lettres : sans voyelles, teamim, guillemets ni finales. */
function wordKey(word: string): string {
  let key = "";
  for (const c of word) if (c >= "א" && c <= "ת") key += FINALS[c] ?? c;
  return key;
}

/**
 * Ce que le commentateur écrit dans son dibbour sans que ce soit un mot du
 * passage : « וכו' », « וגו' » (et la suite), « גמ' », « מתני' ».
 */
const NOT_QUOTED = new Set(["וכו", "כו", "וגו", "גמ", "גמרא", "מתני", "מתניתין"]);

/**
 * Les mots du dibbour hamat'hil de chaque commentaire, retrouvés dans le
 * passage tel qu'il s'affiche (vocalisé ou non) : leur place dans la chaîne,
 * `[début, fin)`, pour les souligner. On cherche la plus longue suite des
 * premiers mots du dibbour (deux au moins quand il en a deux) ; un dibbour
 * qui cite le passage d'avant, ou qui abrège, ne souligne que ce qu'il cite
 * vraiment, ou rien.
 */
/**
 * Les mots d'un texte, réduits à leurs lettres (`key`), avec leur place sans
 * la ponctuation qui les borde (« השחר. », « ״וטהר״ ») : du premier signe
 * hébreu au dernier, le géresh d'une abréviation compris (« מתני׳ »).
 */
function textWords(text: string): { key: string; start: number; end: number }[] {
  const words: { key: string; start: number; end: number }[] = [];
  for (const m of text.matchAll(/[^\s\u05BE]+/g)) {
    const key = wordKey(m[0]);
    if (!key) continue;
    const first = m[0].search(/[\u0591-\u05C7\u05D0-\u05EA]/);
    let last = m[0].length;
    while (last > first && !/[\u0591-\u05C7\u05D0-\u05EA\u05F3']/.test(m[0][last - 1])) last--;
    words.push({ key, start: m.index! + first, end: m.index! + last });
  }
  return words;
}

export function leadRanges(text: string, leads: string[]): [number, number][] {
  const words = textWords(text);
  const ranges: [number, number][] = [];
  for (const lead of leads) {
    const keys = lead
      .split(/[\s\u05BE]+/)
      .map(wordKey)
      .filter((k) => k && !NOT_QUOTED.has(k));
    if (keys.length === 0) continue;
    let best = { at: -1, length: 0 };
    for (let i = 0; i < words.length && best.length < keys.length; i++) {
      let k = 0;
      while (k < keys.length && i + k < words.length && words[i + k].key === keys[k]) k++;
      if (k > best.length) best = { at: i, length: k };
    }
    if (best.length >= Math.min(2, keys.length)) {
      ranges.push([words[best.at].start, words[best.at + best.length - 1].end]);
    }
  }
  // Dans l'ordre du texte, les chevauchements réunis.
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

/** Un morceau de texte : souligné (dibbour), en gras (début de Michna, de Guemara). */
export interface TextPiece {
  text: string;
  marked: boolean;
  strong: boolean;
}

/**
 * Un texte coupé aux mots soulignés (`ranges`) et aux mots en gras
 * (`strong`) : les morceaux, chacun avec ce qu'il porte.
 */
export function markedPieces(
  text: string,
  ranges: [number, number][],
  strong: [number, number][] = [],
): TextPiece[] {
  const cuts = new Set([0, text.length]);
  for (const [a, b] of [...ranges, ...strong]) {
    cuts.add(a);
    cuts.add(b);
  }
  const sorted = [...cuts].filter((c) => c >= 0 && c <= text.length).sort((a, b) => a - b);
  const within = (list: [number, number][], at: number) => list.some(([a, b]) => at >= a && at < b);
  const pieces: TextPiece[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const [a, b] = [sorted[i], sorted[i + 1]];
    if (a === b) continue;
    const piece = { text: text.slice(a, b), marked: within(ranges, a), strong: within(strong, a) };
    const last = pieces[pieces.length - 1];
    if (last && last.marked === piece.marked && last.strong === piece.strong)
      last.text += piece.text;
    else pieces.push(piece);
  }
  return pieces;
}

/**
 * Ce que la page imprimée met en gras dans une ligne de guemara, pour qu'on
 * retrouve d'un coup d'œil où commence chaque partie :
 *  - le « מתני׳ » qui ouvre une Michna et le « גמ׳ » qui ouvre la Guemara,
 *    avec le mot qui les suit ;
 *  - le premier mot du traité (`tractateStart`), dont la Michna n'a pas de
 *    « מתני׳ » ;
 *  - la formule qui clôt un chapitre, « הדרן עלך … », jusqu'à la fin de la
 *    ligne.
 */
export function talmudOpenings(line: string, tractateStart = false): [number, number][] {
  const words = textWords(line);
  if (words.length === 0) return [];
  const ranges: [number, number][] = [];
  const opener = words[0].key === "מתני" || words[0].key === "גמ";
  if (opener) ranges.push([words[0].start, (words[1] ?? words[0]).end]);
  else if (tractateStart) ranges.push([words[0].start, words[0].end]);
  const hadran = words.findIndex((w, i) => w.key === "הדרנ" && words[i + 1]?.key === "עלכ");
  if (hadran >= 0) ranges.push([words[hadran].start, words[words.length - 1].end]);
  return ranges;
}
