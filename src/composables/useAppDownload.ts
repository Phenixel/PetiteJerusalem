import type { IconName } from "../components/icons/registry";
import { APP_STORE_URL, PLAY_STORE_URL } from "../config/stores";

/**
 * Quel store proposer au visiteur du site web.
 *
 * Un lien de téléchargement qui tombe sur le mauvais store ne sert à rien :
 * personne n'installe une app Android depuis un iPhone. On lit donc l'agent
 * utilisateur, et on n'en tire une conclusion que lorsqu'elle est nette.
 * Dans le doute (ordinateur de bureau, agent inconnu), les deux liens sont
 * affichés : c'est au visiteur de savoir sur quel appareil il installera.
 */

export type StoreKey = "apple" | "android";

export interface StoreLink {
  key: StoreKey;
  url: string;
  icon: IconName;
  /** Libellé du bouton. */
  labelKey: string;
  /** Intitulé accessible, plus explicite que le libellé seul. */
  ariaKey: string;
}

const APPLE: StoreLink = {
  key: "apple",
  url: APP_STORE_URL,
  icon: "apple",
  labelKey: "appDownload.apple",
  ariaKey: "appDownload.appleAria",
};

const ANDROID: StoreLink = {
  key: "android",
  url: PLAY_STORE_URL,
  icon: "google-play",
  labelKey: "appDownload.android",
  ariaKey: "appDownload.androidAria",
};

/**
 * Les stores à proposer, déduits de l'agent utilisateur.
 *
 * Fonction pure, l'environnement lui est passé : c'est ce qui la rend
 * vérifiable agent par agent (src/__tests__/appDownload.test.ts).
 */
export function storesForUserAgent(userAgent: string, touchPoints = 0): StoreLink[] {
  if (/android/i.test(userAgent)) return [ANDROID];
  if (/iphone|ipad|ipod/i.test(userAgent)) return [APPLE];
  // iPadOS 13+ se donne pour un Mac de bureau, agent utilisateur compris ;
  // seul l'écran tactile le trahit. Un Mac, lui, n'a aucun point tactile et
  // reçoit les deux liens : il peut très bien servir à équiper un téléphone
  // Android.
  if (/macintosh/i.test(userAgent) && touchPoints > 1) return [APPLE];
  return [APPLE, ANDROID];
}

/** Les stores à proposer ici et maintenant. */
export function detectStores(): StoreLink[] {
  if (typeof navigator === "undefined") return [APPLE, ANDROID];
  return storesForUserAgent(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}
