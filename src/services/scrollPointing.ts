/**
 * Les voyelles et les teamim dans la forme du Sefer Torah.
 *
 * Le parchemin ne porte que les lettres (scrollVerseWords, pageForm.ts). Qui
 * prépare une lecture veut pourtant les voyelles et les teamim sous les yeux,
 * sans quitter la colonne qu'il lira : mêmes lignes, mêmes mots aux mêmes
 * places. On garde donc le découpage du parchemin, mot pour mot, et l'on
 * donne à chaque mot sa forme lue.
 */

/**
 * Les mots d'un verset avec leurs voyelles et leurs teamim, un pour chaque
 * mot que le sofer écrit (`scrollVerseWords` du même verset, même ordre) :
 *  - le maqaf reste au mot qu'il suit, puisque le parchemin en fait deux mots ;
 *  - le sof passouk reste au dernier mot ;
 *  - là où l'on ne lit pas ce qui est écrit, « (ktiv) [qri] », c'est le qri
 *    qui se lit, à la place du ktiv ; s'ils n'ont pas le même nombre de mots,
 *    le ktiv reste, sans voyelles ;
 *  - le passek, qui n'est pas un mot, n'est pas gardé.
 */
export function pointedVerseWords(rawVerse: string): string[] {
  return rawVerse
    .replace(/&[a-z]+;/g, " ") // entité de la source (&thinsp;)
    .replace(/\*\([^)]*\)/g, " ") // note d'édition
    .replace(/\{[א-ת]\}/g, " ") // marque de paracha
    .replace(/\(([^)]*)\)\s*\[([^\]]*)\]/g, (_, ktiv: string, qri: string) => {
      const written = ktiv.replace(/־/g, " ").trim().split(/\s+/);
      const read = qri.replace(/־/g, "־ ").trim().split(/\s+/);
      return ` ${(read.length === written.length ? read : written).join(" ")} `;
    })
    .replace(/\[[^\]]*\]/g, " ") // qri sans ktiv : il n'est pas écrit
    .replace(/[()]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/־/g, "־ ")
    .replace(/׀/g, " ")
    .split(/\s+/)
    .filter((w) => /[א-ת]/.test(w));
}
