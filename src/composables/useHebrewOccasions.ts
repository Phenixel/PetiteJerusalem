import { computed, ref, watch, type Ref } from "vue";
import {
  cleanOccasionName,
  newOccasionId,
  parseOccasion,
  type HebrewOccasion,
} from "../services/hebrewOccasions";

/**
 * Les dates personnelles du calendrier, telles que l'appareil les garde.
 *
 * Comme les rappels d'horaires (useZmanReminders), elles vivent dans le
 * localStorage et ne montent pas dans le compte : c'est ce téléphone-ci qui
 * fera sonner leur rappel. La contrepartie est qu'elles ne suivent pas d'un
 * appareil à l'autre ; c'est dit dans l'écran qui les tient.
 *
 * Le module ne planifie rien : zmanReminderService suit cet état et en fait
 * des notifications.
 */

const STORAGE_KEY = "pj_hebrew_occasions";

/** Au-delà, la liste ne se lit plus, et les notifications ne suivraient pas. */
export const MAX_OCCASIONS = 40;

function readStored(): HebrewOccasion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(parseOccasion)
      .filter((entry): entry is HebrewOccasion => entry !== null)
      .slice(0, MAX_OCCASIONS);
  } catch {
    return [];
  }
}

const occasions: Ref<HebrewOccasion[]> = ref(readStored());

watch(
  occasions,
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Stockage indisponible : les dates valent pour la session en cours.
    }
  },
  { deep: true },
);

/** Une date à enregistrer, telle que le formulaire la remonte (sans identifiant). */
export type OccasionDraft = Omit<HebrewOccasion, "id"> & { id?: string };

export function useHebrewOccasions() {
  const list = computed(() => occasions.value);
  const full = computed(() => occasions.value.length >= MAX_OCCASIONS);

  /** Ajoute la date, ou remplace celle qui porte le même identifiant. */
  function saveOccasion(draft: OccasionDraft): void {
    const name = cleanOccasionName(draft.name);
    if (!name) return;
    const entry: HebrewOccasion = { ...draft, name, id: draft.id ?? newOccasionId() };
    const index = occasions.value.findIndex((known) => known.id === entry.id);
    if (index === -1) {
      if (full.value) return;
      occasions.value = [...occasions.value, entry];
      return;
    }
    const next = [...occasions.value];
    next[index] = entry;
    occasions.value = next;
  }

  function removeOccasion(id: string): void {
    occasions.value = occasions.value.filter((known) => known.id !== id);
  }

  return { occasions: list, full, saveOccasion, removeOccasion };
}
