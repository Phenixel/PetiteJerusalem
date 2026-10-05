import { computed, ref, watch, type Ref } from "vue";
import {
  cleanOccasionName,
  isFirstAdar,
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
 * À la connexion, le compte fait foi et remplace la copie locale, sans quoi
 * une date supprimée sur un autre appareil serait ressuscitée par la fusion à
 * chaque connexion. Seul ce qui a été saisi sans compte le rejoint. Pour le
 * reconnaître, l'appareil retient le dernier compte suivi et les dates qu'il
 * portait (OWNER_KEY) : une date locale qui n'en est pas a été saisie depuis,
 * sans compte. Celles qui en sont appartiennent à ce compte-là, et ne sont
 * pas versées dans un autre qui se connecterait sur le même appareil.
 */

const STORAGE_KEY = "pj_hebrew_occasions";
/**
 * Les comptes adoptés, du temps où l'appareil ne retenait que cela. Seulement
 * relue, pour un appareil qui n'a pas encore de OWNER_KEY.
 */
const ADOPTED_KEY = "pj_hebrew_occasions_adopted";
/** Le dernier compte suivi sur cet appareil et ses dates, voir adoptAccount. */
const OWNER_KEY = "pj_hebrew_occasions_owner";

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

interface OccasionsOwner {
  id: string;
  /** Les dates que ce compte portait la dernière fois qu'il a été lu ou écrit. */
  ids: string[];
}

function readOwner(): OccasionsOwner | null {
  try {
    const raw = localStorage.getItem(OWNER_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<OccasionsOwner>) : null;
    if (!parsed || typeof parsed.id !== "string" || !Array.isArray(parsed.ids)) return null;
    return { id: parsed.id, ids: parsed.ids.filter((id): id is string => typeof id === "string") };
  } catch {
    return null;
  }
}

function rememberOwner(userId: string, list: HebrewOccasion[]): void {
  try {
    const owner: OccasionsOwner = { id: userId, ids: list.map((entry) => entry.id) };
    localStorage.setItem(OWNER_KEY, JSON.stringify(owner));
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
    if (accountId.value === userId) rememberOwner(userId, list);
  } catch {
    // Hors ligne, ou Firestore injoignable : l'appareil garde la liste, et
    // elle repartira au retour du réseau ou au prochain changement.
    pendingPush = true;
  }
}

/**
 * Ce que l'appareil porte et qui n'appartient à aucun compte : saisi avant
 * toute connexion, ou depuis que le dernier compte suivi est parti.
 */
function enteredWithoutAccount(userId: string): HebrewOccasion[] {
  const owner = readOwner();
  if (owner) {
    const theirs = new Set(owner.ids);
    return occasions.value.filter((entry) => !theirs.has(entry.id));
  }
  // Appareil d'avant OWNER_KEY : on ne sait pas dire à qui sont ses dates. La
  // règle d'alors s'applique une dernière fois (tout rejoint un compte jamais
  // adopté, rien un compte déjà adopté), plutôt que d'en écarter à l'aveugle.
  return adoptedAccounts().includes(userId) ? [] : occasions.value;
}

/**
 * Prend en charge le compte connecté : ses dates deviennent celles à l'écran,
 * et ce qui a été saisi sans compte le rejoint. Ce qu'un autre compte a laissé
 * sur l'appareil cède la place.
 */
async function adoptAccount(userId: string): Promise<void> {
  try {
    const { userPreferencesService } = await import("../services/userPreferencesService");
    const prefs = await userPreferencesService.getPreferencesOrThrow(userId);
    if (accountId.value !== userId) return; // Déconnecté entre-temps.
    const remote = parseList(prefs.hebrewOccasions);
    const next = mergeOccasions(remote, enteredWithoutAccount(userId), MAX_OCCASIONS);
    // Ce que le compte porte déjà ; ce qui le rejoint ne sera tenu pour sien
    // qu'une fois écrit (pushToAccount), pour qu'un échec ne le perde pas.
    rememberOwner(userId, remote);
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
  void import("../services/authService")
    .then(({ authService }) => {
      authService.onAuthChanged((user) => {
        const userId = user?.id ?? null;
        if (userId === accountId.value) return;
        accountId.value = userId;
        // Déconnexion : les dates restent sur l'appareil, elles n'y ont pas
        // moins leur place qu'avant la connexion.
        if (userId) void adoptAccount(userId);
      });
      // Module introuvable (lot périmé après un déploiement) : l'appareil sert
      // seul, le prochain lancement retrouvera le compte.
    })
    .catch(() => {});
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
    // Le brouillon porte `firstAdar` vrai ou faux ; la date gardée ne le porte
    // que s'il dit quelque chose, comme celle qu'on relit (parseOccasion).
    if (isFirstAdar(entry)) entry.firstAdar = true;
    else delete entry.firstAdar;
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
