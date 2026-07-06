import { Capacitor } from "@capacitor/core";

/**
 * Détection de la plateforme d'exécution (web, ou app native Capacitor).
 *
 * Figée au chargement : la plateforme ne change jamais en cours de vie de
 * l'app. Sert à n'exposer les fonctionnalités natives (téléchargements hors
 * ligne, notifications push, auth native) que dans l'app mobile, en laissant
 * le site web strictement inchangé.
 */
export const isNativeApp = Capacitor.isNativePlatform();

/** "web" | "ios" | "android" */
export const appPlatform = Capacitor.getPlatform();

export function useNativeApp() {
  return { isNative: isNativeApp, platform: appPlatform };
}
