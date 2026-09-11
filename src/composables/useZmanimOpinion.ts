import { computed, ref } from "vue";
import {
  parseZmanimOpinion,
  storedZmanimOpinion,
  ZMANIM_OPINION_KEY,
  type ZmanimOpinion,
} from "../services/zmanimOpinions";
import { setZmanimOpinion, zmanimOpinion } from "../services/zmanimService";
import { isNativeApp } from "./useNativeApp";

/**
 * L'opinion suivie pour les horaires : celle du Rav Posen, celle du Rav Ovadia
 * Yossef (voir services/zmanimOpinions).
 *
 * Le choix se lit en SYNCHRONE au chargement du module, depuis le
 * `localStorage` : les horaires se calculent au premier rendu, et un réglage
 * qui n'arriverait qu'après ferait sauter toutes les heures de la page sous
 * les yeux. Les préférences natives (@capacitor/preferences) servent de filet,
 * comme pour la taille du texte : le stockage d'une webview peut être vidé par
 * le système, pas elles.
 *
 * Le compte, lui, l'emporte quand il en porte une : l'avis qu'on suit ne
 * dépend pas de l'appareil qu'on a en main, et se retrouve donc sur le site
 * comme sur le téléphone. Sans compte, c'est l'appareil qui décide.
 */

// La lecture synchrone du stockage vit dans zmanimOpinions : zmanimService en
// a besoin au chargement, avant que ce composable n'existe (voir la note là-bas).
const opinion = ref<ZmanimOpinion>(zmanimOpinion());

/** Le choix est-il déjà celui d'une personne, et non le défaut ? */
let known = storedZmanimOpinion() !== null;

/** Le compte suivi : c'est lui qui reçoit le choix, et qui l'impose au départ. */
let accountId: string | null = null;
let watchingAuth = false;

function persistLocally(value: ZmanimOpinion): void {
  try {
    localStorage.setItem(ZMANIM_OPINION_KEY, value);
  } catch {
    // Stockage indisponible : le choix vaut pour la session en cours.
  }
  if (!isNativeApp) return;
  void import("@capacitor/preferences")
    .then(({ Preferences }) => Preferences.set({ key: ZMANIM_OPINION_KEY, value }))
    .catch(() => {
      // Plugin absent (vieux binaire) : le localStorage fait seul.
    });
}

/** Pose l'opinion partout : l'écran, le calcul des horaires, l'appareil. */
function apply(value: ZmanimOpinion): void {
  known = true;
  opinion.value = value;
  setZmanimOpinion(value);
}

/** Reprend le choix gardé par le natif quand le localStorage n'a rien. */
async function restoreFromDevice(): Promise<void> {
  if (known || !isNativeApp) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const saved = parseZmanimOpinion((await Preferences.get({ key: ZMANIM_OPINION_KEY })).value);
    if (saved === null || known) return;
    apply(saved);
    persistLocally(saved);
  } catch {
    // Plugin absent : rien à reprendre.
  }
}

async function pushToAccount(userId: string, value: ZmanimOpinion): Promise<void> {
  try {
    const { userPreferencesService } = await import("../services/userPreferencesService");
    await userPreferencesService.savePreferences(userId, { zmanimOpinion: value });
  } catch {
    // Hors ligne : l'appareil garde le choix, le compte le recevra au
    // prochain changement.
  }
}

/**
 * Prend en charge le compte connecté : l'opinion qu'il porte devient celle de
 * l'appareil. S'il n'en porte pas encore, c'est le choix de l'appareil qui la
 * lui donne, mais seulement s'il a été fait : une connexion n'écrit jamais un
 * défaut que personne n'a choisi.
 */
async function adoptAccount(userId: string): Promise<void> {
  try {
    const { userPreferencesService } = await import("../services/userPreferencesService");
    const prefs = await userPreferencesService.getPreferencesOrThrow(userId);
    if (accountId !== userId) return; // Déconnecté entre-temps.
    const remote = parseZmanimOpinion(prefs.zmanimOpinion);
    if (remote) {
      if (remote !== opinion.value) {
        apply(remote);
        persistLocally(remote);
      }
      return;
    }
    if (known) await pushToAccount(userId, opinion.value);
  } catch {
    // Profil illisible (hors ligne au lancement) : l'appareil sert seul.
  }
}

/**
 * Suit le compte connecté. Démarré au premier usage du réglage, pas au
 * lancement : lire un profil n'a pas à peser sur l'ouverture de l'app.
 */
function watchAccount(): void {
  if (watchingAuth) return;
  watchingAuth = true;
  void import("../services/authService").then(({ authService }) => {
    authService.onAuthChanged((user) => {
      const userId = user?.id ?? null;
      if (userId === accountId) return;
      accountId = userId;
      // Déconnexion : le choix reste sur l'appareil, il y a sa place.
      if (userId) void adoptAccount(userId);
    });
  });
}

export function useZmanimOpinion() {
  void restoreFromDevice();
  watchAccount();

  function choose(value: ZmanimOpinion): void {
    if (value === opinion.value && known) return;
    apply(value);
    persistLocally(value);
    if (accountId) void pushToAccount(accountId, value);
  }

  return { opinion: computed(() => opinion.value), choose };
}
