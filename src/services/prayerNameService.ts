import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebase/firestore";
import type { PrayerName } from "../models/models";
import { PrayerNameIncompleteError, PrayerNameLimitError } from "./appError";
import { moderationService } from "./moderationService";
import {
  isDated,
  isPrayerNameListed,
  MAX_NAMES_PER_OWNER,
  normalizeNamePart,
  PRAYER_NAME_MAX_LENGTH,
  prayerNameExpiry,
  sortPrayerNames,
  type PrayerNameInput,
} from "./perpetualChain";

/**
 * Les noms de la chaîne perpétuelle, dans `sessions/{id}/names` (voir
 * docs/chaine-perpetuelle.md). Lecture publique ; un compte n'écrit que ses
 * propres noms, ce que les règles Firestore vérifient (ownerId).
 */

function namesOf(sessionId: string) {
  return collection(db, "sessions", sessionId, "names");
}

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function toPrayerName(id: string, data: DocumentData): PrayerName {
  const now = new Date();
  return {
    id,
    ownerId: String(data.ownerId ?? ""),
    gender: data.gender === "female" ? "female" : "male",
    firstName: String(data.firstName ?? ""),
    motherName: String(data.motherName ?? ""),
    kind: data.kind === "leilouy" ? "leilouy" : "refoua",
    // Un serverTimestamp encore en route (écriture locale) se lit null.
    createdAt: toDate(data.createdAt) ?? now,
    updatedAt: toDate(data.updatedAt) ?? now,
    expiresAt: toDate(data.expiresAt),
    ...(typeof data.deathDay === "number" && { deathDay: data.deathDay }),
    ...(typeof data.deathMonth === "number" && { deathMonth: data.deathMonth }),
  };
}

/** Le texte saisi, propre et vérifié ; lève si un prénom manque ou dérange. */
function cleanInput(input: PrayerNameInput): PrayerNameInput {
  const firstName = normalizeNamePart(input.firstName).slice(0, PRAYER_NAME_MAX_LENGTH);
  const motherName = normalizeNamePart(input.motherName).slice(0, PRAYER_NAME_MAX_LENGTH);
  if (!firstName || !motherName) throw new PrayerNameIncompleteError();
  // Modération App Store : le nom s'affiche publiquement sur la chaîne.
  moderationService.assertClean(firstName, motherName);
  const dated = isDated(input);
  return {
    gender: input.gender,
    firstName,
    motherName,
    kind: input.kind,
    deathDay: dated ? input.deathDay : null,
    deathMonth: dated ? input.deathMonth : null,
  };
}

/** Les champs d'échéance et de date : l'un ou l'autre, jamais les deux. */
function timingFields(input: PrayerNameInput, now: Date, forUpdate: boolean) {
  if (isDated(input)) {
    return { expiresAt: null, deathDay: input.deathDay, deathMonth: input.deathMonth };
  }
  return {
    expiresAt: Timestamp.fromDate(prayerNameExpiry(now)),
    // À la création, un champ absent suffit ; à la modification, il faut
    // retirer la date qu'un nom daté portait.
    ...(forUpdate && { deathDay: deleteField(), deathMonth: deleteField() }),
  };
}

/**
 * Jours avant l'anniversaire du décès, par nom daté. Le calendrier hébraïque
 * ne se charge que s'il y a une date à placer : la page de la chaîne n'en a
 * pas besoin autrement.
 */
async function daysUntilAnniversaries(names: PrayerName[]): Promise<Map<string, number>> {
  const dated = names.filter(isDated);
  if (dated.length === 0) return new Map();
  const { daysUntilNext } = await import("./hebrewOccasions");
  const today = new Date();
  return new Map(
    dated.map((name) => [
      name.id,
      daysUntilNext({ day: name.deathDay!, month: name.deathMonth! }, today),
    ]),
  );
}

/** Ce que la page affiche : les noms lus aujourd'hui, et tous ceux du lecteur. */
export interface PrayerNameBoard {
  /** Lus aujourd'hui, ceux du lecteur en tête. */
  listed: PrayerName[];
  /** Tous les noms du lecteur, lus aujourd'hui ou non (échus, hors de leur fenêtre). */
  mine: PrayerName[];
  /** Jours avant l'anniversaire, pour les noms datés. */
  daysUntil: Map<string, number>;
}

class PrayerNameService {
  async list(sessionId: string): Promise<PrayerName[]> {
    const snapshot = await getDocs(namesOf(sessionId));
    return snapshot.docs.map((d) => toPrayerName(d.id, d.data()));
  }

  /** Les noms rangés pour la page : voir PrayerNameBoard. */
  async board(sessionId: string, ownerId: string | null): Promise<PrayerNameBoard> {
    const names = await this.list(sessionId);
    return this.arrange(names, ownerId);
  }

  async arrange(names: PrayerName[], ownerId: string | null): Promise<PrayerNameBoard> {
    const daysUntil = await daysUntilAnniversaries(names);
    const now = new Date();
    const sorted = sortPrayerNames(names, ownerId);
    return {
      listed: sorted.filter((name) =>
        isPrayerNameListed(name, now, daysUntil.get(name.id) ?? null),
      ),
      mine: sorted.filter((name) => ownerId !== null && name.ownerId === ownerId),
      daysUntil,
    };
  }

  async add(
    sessionId: string,
    ownerId: string,
    input: PrayerNameInput,
    ownedCount: number,
  ): Promise<PrayerName> {
    if (ownedCount >= MAX_NAMES_PER_OWNER) throw new PrayerNameLimitError();
    const clean = cleanInput(input);
    const now = new Date();
    const fields = {
      ownerId,
      gender: clean.gender,
      firstName: clean.firstName,
      motherName: clean.motherName,
      kind: clean.kind,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...timingFields(clean, now, false),
    };
    const ref = await addDoc(namesOf(sessionId), fields);
    return {
      id: ref.id,
      ownerId,
      gender: clean.gender,
      firstName: clean.firstName,
      motherName: clean.motherName,
      kind: clean.kind,
      createdAt: now,
      updatedAt: now,
      ...this.localTiming(clean, now),
    };
  }

  async update(sessionId: string, name: PrayerName, input: PrayerNameInput): Promise<PrayerName> {
    const clean = cleanInput(input);
    const now = new Date();
    // Corriger un nom ne remet pas son échéance à zéro : seul « Prolonger »
    // le fait. Sauf s'il change de forme (une date retirée, un défunt devenu
    // malade) : il repart alors pour 30 jours.
    const keepsExpiry = !isDated(clean) && !isDated(name) && name.expiresAt !== null;
    const timing = keepsExpiry
      ? { expiresAt: Timestamp.fromDate(name.expiresAt!) }
      : timingFields(clean, now, true);
    await updateDoc(doc(namesOf(sessionId), name.id), {
      gender: clean.gender,
      firstName: clean.firstName,
      motherName: clean.motherName,
      kind: clean.kind,
      updatedAt: serverTimestamp(),
      ...timing,
    });
    const updated: PrayerName = {
      ...name,
      gender: clean.gender,
      firstName: clean.firstName,
      motherName: clean.motherName,
      kind: clean.kind,
      updatedAt: now,
      ...(keepsExpiry ? { expiresAt: name.expiresAt } : this.localTiming(clean, now)),
    };
    if (!isDated(clean)) {
      delete updated.deathDay;
      delete updated.deathMonth;
    }
    return updated;
  }

  /** Trente jours de plus, à compter d'aujourd'hui. */
  async renew(sessionId: string, name: PrayerName): Promise<PrayerName> {
    const now = new Date();
    const expiresAt = prayerNameExpiry(now);
    await updateDoc(doc(namesOf(sessionId), name.id), {
      expiresAt: Timestamp.fromDate(expiresAt),
      updatedAt: serverTimestamp(),
    });
    return { ...name, expiresAt, updatedAt: now };
  }

  async remove(sessionId: string, nameId: string): Promise<void> {
    await deleteDoc(doc(namesOf(sessionId), nameId));
  }

  private localTiming(
    input: PrayerNameInput,
    now: Date,
  ): Pick<PrayerName, "expiresAt" | "deathDay" | "deathMonth"> {
    return isDated(input)
      ? { expiresAt: null, deathDay: input.deathDay!, deathMonth: input.deathMonth! }
      : { expiresAt: prayerNameExpiry(now) };
  }
}

export const prayerNameService = new PrayerNameService();
