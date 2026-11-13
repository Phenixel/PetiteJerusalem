import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { appPlatform, isNativeApp } from "../composables/useNativeApp";
import { accuracyFromAndroidStatus, type CompassAccuracy } from "./compassReading";

/**
 * L'étalonnage du magnétomètre, dans l'app Android.
 *
 * Chrome donne le cap à la page, jamais la précision : la webview Android
 * n'en sait pas plus. Le système, lui, la connaît (c'est elle qui fait dire à
 * Google Maps « précision de la boussole : faible »), et le plugin natif
 * PjCompass la remonte (native/android/, PjCompassPlugin.java). Sur iOS,
 * Safari la donne avec le cap (`webkitCompassAccuracy`) : rien à faire ici.
 */

interface PjCompassBridge {
  /** Branche le magnétomètre (rien ne remonte sur un appareil qui n'en a pas). */
  start(): Promise<void>;
  stop(): Promise<void>;
  /** L'étalonnage a changé : le statut de `SensorManager`, de -1 à 3. */
  addListener(
    event: "accuracy",
    listener: (data: { accuracy: number }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
}

const PjCompass = registerPlugin<PjCompassBridge>("PjCompass");

/**
 * Suit l'étalonnage tant que la boussole écoute ; rend de quoi arrêter. Ne
 * fait rien hors de l'app Android, ni sur un binaire plus ancien que le
 * plugin : la précision reste alors inconnue, et le cadran sert quand même.
 */
export function watchNativeCompassAccuracy(
  onAccuracy: (accuracy: CompassAccuracy) => void,
): () => void {
  if (!isNativeApp || appPlatform !== "android") return () => {};
  let stopped = false;
  let handle: PluginListenerHandle | null = null;
  try {
    // Le plugin n'est jamais rendu par une promesse (docs/app-native.md,
    // « A plugin never goes through a promise ») : seule la poignée de
    // l'écoute en sort.
    PjCompass.addListener("accuracy", ({ accuracy }) => {
      if (!stopped) onAccuracy(accuracyFromAndroidStatus(accuracy));
    }).then(
      (listener) => {
        if (stopped) void listener.remove();
        else handle = listener;
      },
      () => {},
    );
    PjCompass.start().catch(() => {});
  } catch {
    // Binaire sans le plugin : l'inscription peut échouer de façon synchrone.
  }
  return () => {
    if (stopped) return;
    stopped = true;
    void handle?.remove();
    try {
      PjCompass.stop().catch(() => {});
    } catch {
      // Même raison que plus haut.
    }
  };
}
