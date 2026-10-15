/**
 * Sur la page du daf (TalmudPage.vue), un passage de la guemara et ses
 * commentaires se répondent : on touche l'un, les deux se surlignent.
 *
 * Le lien est celui des fichiers : `rashi[p]` et `tosafot[p]` sont les
 * commentaires du passage `p` de l'amoud (DafMeforshim), et chaque ligne de
 * la guemara sait de quel passage elle vient (DafBlock.passages). Ce module
 * ne tient que ce lien et ce qu'on en fait, sans écran.
 */
import type { DafMeforshim, RashiComment } from "./textService";

/** Les deux commentaires de la page. */
export type DafZone = "rashi" | "tosafot";

/** Un commentaire de la page, et le passage de la guemara qu'il commente. */
export interface LinkedComment extends RashiComment {
  passage: number;
}

/** Les commentaires d'un amoud bout à bout, dans l'ordre de la page. */
export type LinkedMeforshim = Record<DafZone, LinkedComment[]>;

/**
 * Ce qu'on a touché : un passage de la guemara, ou l'un de ses commentaires
 * (son rang dans la liste de sa colonne).
 */
export interface DafLink {
  passage: number;
  comment?: { zone: DafZone; index: number };
}

/**
 * Tous les commentaires d'un amoud bout à bout, comme la page les écrit,
 * chacun gardant le passage qu'il commente.
 */
export function linkedMeforshim(m: DafMeforshim): LinkedMeforshim {
  const flat = (passages: RashiComment[][]): LinkedComment[] =>
    passages.flatMap((comments, passage) => comments.map((c) => ({ ...c, passage })));
  return { rashi: flat(m.rashi), tosafot: flat(m.tosafot) };
}

/** Les passages qu'un commentaire au moins explique : ceux qu'on peut toucher. */
export function commentedPassages(m: LinkedMeforshim | null): Set<number> {
  const passages = new Set<number>();
  for (const c of m?.rashi ?? []) passages.add(c.passage);
  for (const c of m?.tosafot ?? []) passages.add(c.passage);
  return passages;
}

function sameLink(a: DafLink | null, b: DafLink | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.passage === b.passage &&
    a.comment?.zone === b.comment?.zone &&
    a.comment?.index === b.comment?.index
  );
}

/**
 * Ce qui est choisi après qu'on a touché quelque chose : ce qu'on vient de
 * toucher, ou plus rien si c'était déjà lui (on le relâche).
 */
export function nextLink(current: DafLink | null, touched: DafLink | null): DafLink | null {
  return sameLink(current, touched) ? null : touched;
}

/**
 * Ce commentaire est-il surligné ? Un passage choisi surligne tous les siens ;
 * un commentaire choisi, lui seul.
 */
export function commentLinked(
  link: DafLink | null,
  zone: DafZone,
  index: number,
  comment: { passage?: number },
): boolean {
  if (!link || comment.passage !== link.passage) return false;
  return !link.comment || (link.comment.zone === zone && link.comment.index === index);
}

/**
 * Les dibbourim hamat'hilim à souligner dans le passage choisi : ceux de tous
 * ses commentaires, ou celui du seul commentaire choisi.
 */
export function linkLeads(link: DafLink | null, m: LinkedMeforshim | null): string[] {
  if (!link || !m) return [];
  const leads: string[] = [];
  for (const zone of ["rashi", "tosafot"] as const) {
    m[zone].forEach((comment, index) => {
      if (comment.lead && commentLinked(link, zone, index, comment)) leads.push(comment.lead);
    });
  }
  return leads;
}
