import { computed, ref } from "vue";
import {
  parseZmanimOpinion,
  zmanimOpinionStore,
  type ZmanimOpinion,
} from "../services/zmanimOpinions";
import { setZmanimOpinion, zmanimOpinion } from "../services/zmanimService";

/**
 * L'opinion suivie pour les horaires : celle du Rav Posen, celle du Rav Ovadia
 * Yossef (voir services/zmanimOpinions).
 *
 * Le choix est gardé sur l'appareil, et lu en SYNCHRONE dès le chargement de
 * `zmanimService` (voir zmanimOpinionStore) : les horaires se calculent au
 * premier rendu, et un réglage qui n'arriverait qu'après ferait sauter toutes
 * les heures de la page sous les yeux.
 *
 * Le compte, lui, l'emporte quand il en porte une : l'avis qu'on suit ne
 * dépend pas de l'appareil qu'on a en main, et se retrouve donc sur le site
 * comme sur le téléphone. Sans compte, c'est l'appareil qui décide.
 */

// zmanimService a déjà lu le stockage à son chargement : on repart de ce
// qu'il en a tiré, plutôt que de le relire.
const opinion = ref<ZmanimOpinion>(zmanimOpinion());

/** Le choix est-il déjà celui d'une personne, et non le défaut ? */
let known = zmanimOpinionStore.read() !== null;

/** Le compte suivi : c'est lui qui reçoit le choix, et qui l'impose au départ. */
let accountId: string | null = null;
let watchingAuth = false;

/** Pose l'opinion partout : l'écran, le calcul des horaires, l'appareil. */
function apply(value: ZmanimOpinion): void {
  known = true;
  opinion.value = value;
  setZmanimOpinion(value);
}

/** Reprend le choix gardé par le natif quand le localStorage n'a rien. */
async function restoreFromDevice(): Promise<void> {
  if (known) return;
  const saved = await zmanimOpinionStore.restore();
  // La personne a pu choisir pendant l'attente : son geste l'emporte.
  if (saved !== null && !known) apply(saved);
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
        zmanimOpinionStore.write(remote);
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
  void import("../services/authService")
    .then(({ authService }) => {
      authService.onAuthChanged((user) => {
        const userId = user?.id ?? null;
        if (userId === accountId) return;
        accountId = userId;
        // Déconnexion : le choix reste sur l'appareil, il y a sa place.
        if (userId) void adoptAccount(userId);
      });
      // Module introuvable (lot périmé après un déploiement) : l'appareil sert
      // seul, le prochain lancement retrouvera le compte.
    })
    .catch(() => {});
}

export function useZmanimOpinion() {
  void restoreFromDevice();
  watchAccount();

  function choose(value: ZmanimOpinion): void {
    if (value === opinion.value && known) return;
    apply(value);
    zmanimOpinionStore.write(value);
    if (accountId) void pushToAccount(accountId, value);
  }

  return { opinion: computed(() => opinion.value), choose };
}
