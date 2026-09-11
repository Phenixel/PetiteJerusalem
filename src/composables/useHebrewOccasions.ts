import { computed, ref, watch, type Ref } from "vue";
import {
  cleanOccasionName,
  mergeOccasions,
  newOccasionId,
  parseOccasion,
  type HebrewOccasion,
} from "../services/hebrewOccasions";

/**
 * Les dates personnelles du calendrier : ce que l'appareil en garde, et ce que
 * le compte en porte.
 *
 * Deux stockages, deux rôles. L'APPAREIL (localStorage) est le socle : il se
 * lit en synchrone, il sert sans compte et sans réseau, et c'est lui que
 * zmanReminderService suit pour programmer les rappels. Le COMPTE (Firestore),
 * lui, les emporte d'un appareil à l'autre et jusqu'au site : une date qu'on a
 * pris la peine d'inscrire ne doit pas mourir avec un téléphone.
 *
 * L'adoption n'a lieu qu'une fois par compte et par appareil : à la première
 * connexion, ce qui a été saisi sans compte rejoint le compte (union des deux
 * listes). Ensuite, c'est le compte qui fait foi et qui remplace la copie
 * locale, sans quoi une date supprimée sur un autre appareil serait
 * ressuscitée par la fusion à chaque connexion.
 */

const STORAGE_KEY = "pj_hebrew_occasions";
/** Le compte dont les dates ont déjà été adoptées sur cet appareil. */
const ADOPTED_KEY = "pj_hebrew_occasions_adopted";

/** Au-delà, la liste ne se lit plus, et les notifications ne suivraient pas. */
export const MAX_OCCASIONS = 40;

/** Une liste lue d'un stockage ou du compte, ramenée à des dates sûres. */
function parseList(value: unknown): HebrewOccasion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseOccasion)
    .filter((entry): entry is HebrewOccasion => entry !== null)
    .slice(0, MAX_OCCASIONS);
}

function readStored(): HebrewOccasion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseList(JSON.parse(raw)) : [];
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

// ---- Le compte -----------------------------------------------------------

/** Le compte suivi : ses dates sont celles à l'écran, et il reçoit les nôtres. */
const accountId = ref<string | null>(null);
let watchingAuth = false;
/** Écriture que le réseau a refusée : elle repart au retour de la connexion. */
let pendingPush = false;

function adoptedAccounts(): string[] {
  try {
    const raw = localStorage.getItem(ADOPTED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function rememberAdopted(userId: string): void {
  try {
    const known = adoptedAccounts();
    if (known.includes(userId)) return;
    localStorage.setItem(ADOPTED_KEY, JSON.stringify([...known, userId].slice(-5)));
  } catch {
    // Stockage indisponible : la fusion se refera, au pire une fois de trop.
  }
}

const sameList = (a: HebrewOccasion[], b: HebrewOccasion[]): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** Écrit la liste dans le compte ; l'échec est retenu pour un nouvel essai. */
async function pushToAccount(userId: string, list: HebrewOccasion[]): Promise<void> {
  try {
    const { userPreferencesService } = await import("../services/userPreferencesService");
    await userPreferencesService.savePreferences(userId, { hebrewOccasions: list });
    pendingPush = false;
  } catch {
    // Hors ligne, ou Firestore injoignable : l'appareil garde la liste, et
    // elle repartira au retour du réseau ou au prochain changement.
    pendingPush = true;
  }
}

/**
 * Prend en charge le compte connecté : ses dates deviennent celles à l'écran.
 * À la première connexion sur cet appareil, ce qui a été saisi sans compte le
 * rejoint ; ensuite, le compte fait foi.
 */
async function adoptAccount(userId: string): Promise<void> {
  try {
    const { userPreferencesService } = await import("../services/userPreferencesService");
    const prefs = await userPreferencesService.getPreferencesOrThrow(userId);
    if (accountId.value !== userId) return; // Déconnecté entre-temps.
    const remote = parseList(prefs.hebrewOccasions);
    const first = !adoptedAccounts().includes(userId);
    const next = first ? mergeOccasions(remote, occasions.value, MAX_OCCASIONS) : remote;
    rememberAdopted(userId);
    if (!sameList(next, occasions.value)) occasions.value = next;
    if (!sameList(next, remote)) await pushToAccount(userId, next);
  } catch {
    // Profil illisible (hors ligne au lancement) : l'appareil sert seul, et
    // la prochaine ouverture retentera.
  }
}

/**
 * Suit le compte connecté. Démarré au premier usage des dates, pas au
 * lancement de l'app : qui n'ouvre ni le calendrier ni l'accueil n'a aucune
 * raison de charger de quoi lire un profil.
 */
function watchAccount(): void {
  if (watchingAuth) return;
  watchingAuth = true;
  void import("../services/authService").then(({ authService }) => {
    authService.onAuthChanged((user) => {
      const userId = user?.id ?? null;
      if (userId === accountId.value) return;
      accountId.value = userId;
      // Déconnexion : les dates restent sur l'appareil, elles n'y ont pas
      // moins leur place qu'avant la connexion.
      if (userId) void adoptAccount(userId);
    });
  });
  // Une écriture refusée par le réseau repart dès qu'il revient.
  window.addEventListener("online", () => {
    const userId = accountId.value;
    if (pendingPush && userId) void pushToAccount(userId, occasions.value);
  });
}

/** Une date à enregistrer, telle que le formulaire la remonte (sans identifiant). */
export type OccasionDraft = Omit<HebrewOccasion, "id"> & { id?: string };

export function useHebrewOccasions() {
  watchAccount();

  const list = computed(() => occasions.value);
  const full = computed(() => occasions.value.length >= MAX_OCCASIONS);
  /** Vrai quand les dates suivent un compte : l'écran le dit. */
  const syncedToAccount = computed(() => accountId.value !== null);

  function commit(next: HebrewOccasion[]): void {
    occasions.value = next;
    const userId = accountId.value;
    if (userId) void pushToAccount(userId, next);
  }

  /** Ajoute la date, ou remplace celle qui porte le même identifiant. */
  function saveOccasion(draft: OccasionDraft): void {
    const name = cleanOccasionName(draft.name);
    if (!name) return;
    const entry: HebrewOccasion = { ...draft, name, id: draft.id ?? newOccasionId() };
    const index = occasions.value.findIndex((known) => known.id === entry.id);
    if (index === -1) {
      if (full.value) return;
      commit([...occasions.value, entry]);
      return;
    }
    const next = [...occasions.value];
    next[index] = entry;
    commit(next);
  }

  function removeOccasion(id: string): void {
    commit(occasions.value.filter((known) => known.id !== id));
  }

  return { occasions: list, full, syncedToAccount, saveOccasion, removeOccasion };
}
