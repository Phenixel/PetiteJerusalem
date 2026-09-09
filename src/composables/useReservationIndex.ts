import { computed, type Ref } from "vue";
import type { Session, TextStudy, TextStudyReservation } from "../models/models";
import { reservationService, type TextDisplayStatus } from "../services/reservationService";

export type { TextDisplayStatus };

/**
 * Index des réservations d'une chaîne, pour les vues qui en affichent les
 * textes chapitre par chapitre (page publique, page de gestion).
 *
 * Pourquoi : ces vues appellent « ce chapitre est-il pris ? » depuis leur
 * gabarit, pour chaque carte et chaque section, à chaque rendu. Parcourir les
 * réservations à chaque appel rendait chaque frappe de la recherche
 * quadratique sur une chaîne du Talmud. Les index se reconstruisent quand les
 * réservations changent, et le gabarit ne fait que des lectures O(1). Les
 * deux vues en avaient chacune une copie ; la voici partagée.
 *
 * Les réservations expirées (tirage aléatoire abandonné) n'y figurent pas :
 * leur emplacement est disponible, partout et de la même façon.
 */

/** Marque de l'emplacement « texte entier » dans une clé. */
const FULL_TEXT = "full";

/** Clé d'un emplacement réservable : un chapitre précis, ou le texte entier. */
export function slotKey(textStudyId: string, section?: number): string {
  return `${textStudyId}#${section === undefined ? FULL_TEXT : section}`;
}

/** Inverse de slotKey. */
export function parseSlotKey(key: string): { textStudyId: string; section?: number } {
  const hashIndex = key.lastIndexOf("#");
  const textStudyId = key.slice(0, hashIndex);
  const suffix = key.slice(hashIndex + 1);
  return suffix === FULL_TEXT
    ? { textStudyId }
    : { textStudyId, section: Number.parseInt(suffix, 10) };
}

// [1..n] par nombre de sections : allouer le tableau par carte et par rendu
// coûtait plus que tout le reste du gabarit.
const chaptersCache = new Map<number, number[]>();

/** Les numéros de chapitre d'un texte, 1 à `totalSections`. */
export function chaptersOf(totalSections: number): number[] {
  let chapters = chaptersCache.get(totalSections);
  if (!chapters) {
    chapters = Array.from({ length: totalSections }, (_, i) => i + 1);
    chaptersCache.set(totalSections, chapters);
  }
  return chapters;
}

export function useReservationIndex(
  session: Ref<Session | null | undefined>,
  textStudies: Ref<readonly TextStudy[]>,
) {
  /** Les réservations qui tiennent encore leur emplacement. */
  const activeReservations = computed(() =>
    reservationService.activeReservations(session.value?.reservations ?? []),
  );

  // Emplacement → réservation ; `has` avant `set` pour garder la sémantique
  // « première trouvée » de l'ancien .find() en cas de doublon.
  const slotIndex = computed(() => {
    const bySlot = new Map<string, TextStudyReservation>();
    for (const r of activeReservations.value) {
      const key = slotKey(r.textStudyId, r.section);
      if (!bySlot.has(key)) bySlot.set(key, r);
    }
    return bySlot;
  });

  /** Texte → statut d'affichage (disponible, partiel, complet). */
  const statusIndex = computed(() => {
    const byText = new Map<string, TextDisplayStatus>();
    const current = session.value;
    if (!current) return byText;
    for (const text of textStudies.value) {
      byText.set(text.id, reservationService.getTextDisplayStatus(text.id, text, current));
    }
    return byText;
  });

  /**
   * La réservation qui tient un emplacement : celle de la section, ou celle
   * du texte entier qui la couvre.
   */
  const reservationAt = (textStudyId: string, section?: number) =>
    slotIndex.value.get(slotKey(textStudyId, section)) ??
    (section === undefined ? undefined : slotIndex.value.get(slotKey(textStudyId)));

  const isSlotReserved = (textStudyId: string, section?: number) =>
    reservationAt(textStudyId, section) !== undefined;

  const statusOf = (text: TextStudy): TextDisplayStatus =>
    statusIndex.value.get(text.id) ??
    (session.value
      ? reservationService.getTextDisplayStatus(text.id, text, session.value)
      : { status: "available", reservedBy: null });

  // Texte → sections encore libres, cibles du « Tout sélectionner ». Une Map
  // en computed plutôt qu'une fonction : le gabarit la lit pour chaque carte.
  const availableSectionsIndex = computed(() => {
    const byText = new Map<string, number[]>();
    for (const text of textStudies.value) {
      byText.set(
        text.id,
        chaptersOf(text.totalSections).filter((section) => !isSlotReserved(text.id, section)),
      );
    }
    return byText;
  });

  const availableSections = (text: TextStudy): number[] =>
    availableSectionsIndex.value.get(text.id) ??
    chaptersOf(text.totalSections).filter((section) => !isSlotReserved(text.id, section));

  const availableKeys = (text: TextStudy) =>
    availableSections(text).map((section) => slotKey(text.id, section));

  /** Vrai si toutes les sections libres du texte sont dans `selected`. */
  const allAvailableSelected = (text: TextStudy, selected: Set<string>): boolean => {
    const keys = availableKeys(text);
    return keys.length > 0 && keys.every((key) => selected.has(key));
  };

  /**
   * Coche d'un coup toutes les sections libres d'un texte, ou les décoche si
   * elles le sont déjà toutes. Les sections réservées ne sont jamais touchées.
   * Renvoie vrai quand des sections viennent d'être cochées.
   */
  const selectAllAvailable = (text: TextStudy, selected: Set<string>): boolean => {
    const keys = availableKeys(text);
    if (keys.length === 0) return false;
    if (keys.every((key) => selected.has(key))) {
      keys.forEach((key) => selected.delete(key));
      return false;
    }
    keys.forEach((key) => selected.add(key));
    return true;
  };

  return {
    activeReservations,
    slotIndex,
    statusIndex,
    reservationAt,
    isSlotReserved,
    statusOf,
    availableSections,
    allAvailableSelected,
    selectAllAvailable,
  };
}
