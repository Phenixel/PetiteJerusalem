import { loadFirestore } from "../../firebase/lazy";
import { parseParcours } from "./merge";
import type { ParcoursData } from "./model";
import type { DirtyEntries } from "./deviceStore";

/**
 * Mon parcours dans le compte : un document par personne, `parcours/{uid}`,
 * qui porte deux maps, `objectives` (par identifiant) et `days` (par jour).
 *
 * Pas dans `userPreferences` : ce document-là approche du nombre de champs
 * que ses règles permettent, et le suivi grossit d'un jour à l'autre.
 *
 * On n'écrit jamais le document entier : seulement les entrées qui ont
 * changé, chacune REMPLACÉE (`mergeFields` sur son chemin). Deux appareils qui
 * écrivent des jours différents ne s'écrasent pas, et une entrée qu'une
 * version plus récente aurait ajoutée n'est jamais réécrite par une plus
 * ancienne qui ne la connaît pas.
 */

const COLLECTION = "parcours";

/** Le serveur n'a pas répondu : la copie du cache de Firestore ne fait pas foi. */
export class ParcoursNotFromServerError extends Error {
  constructor() {
    super("PARCOURS_NOT_FROM_SERVER");
  }
}

/** Ce que porte le compte, tel que le serveur vient de le rendre (vide s'il n'y a rien). */
export async function fetchAccountParcours(uid: string): Promise<ParcoursData> {
  const { sdk, db } = await loadFirestore();
  const snapshot = await sdk.getDoc(sdk.doc(db, COLLECTION, uid));
  // Serveur injoignable, getDoc rend parfois son cache au lieu d'échouer : la
  // fusion qui suivrait réécrirait le compte d'après une copie d'hier.
  if (snapshot.metadata?.fromCache === true) throw new ParcoursNotFromServerError();
  return parseParcours(snapshot.exists() ? snapshot.data() : null);
}

/**
 * Une entrée telle que Firestore l'accepte : il refuse tout champ `undefined`
 * (un champ facultatif laissé vide par un objet recopié), et l'écriture
 * entière échouait. Les entrées ne portent que des données simples.
 */
const plain = <T>(entry: T): T => JSON.parse(JSON.stringify(entry)) as T;

/** Écrit les entrées données, telles que `data` les porte. */
export async function writeAccountEntries(
  uid: string,
  data: ParcoursData,
  entries: DirtyEntries,
): Promise<void> {
  if (entries.objectives.length === 0 && entries.days.length === 0) return;
  const { sdk, db } = await loadFirestore();
  const payload: Record<string, unknown> = { v: 1, objectives: {}, days: {} };
  const fields: InstanceType<typeof sdk.FieldPath>[] = [new sdk.FieldPath("v")];
  for (const id of entries.objectives) {
    if (!data.objectives[id]) continue;
    (payload.objectives as Record<string, unknown>)[id] = plain(data.objectives[id]);
    fields.push(new sdk.FieldPath("objectives", id));
  }
  for (const day of entries.days) {
    if (!data.days[day]) continue;
    (payload.days as Record<string, unknown>)[day] = plain(data.days[day]);
    fields.push(new sdk.FieldPath("days", day));
  }
  await sdk.setDoc(sdk.doc(db, COLLECTION, uid), payload, { mergeFields: fields });
}

/** Efface le document du compte (suppression du compte). */
export async function deleteAccountParcours(uid: string): Promise<void> {
  const { sdk, db } = await loadFirestore();
  await sdk.deleteDoc(sdk.doc(db, COLLECTION, uid));
}
