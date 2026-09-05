import { watchEffect } from "vue";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isNativeApp } from "./useNativeApp";
import { useDarkMode } from "./useColorScheme";

// Doit rester synchronisé avec les fonds de src/assets/main.css :
// --color-bg-beige (body clair) et --color-bg-dark (body sombre).
const LIGHT_BG = "#f4efe4";
const DARK_BG = "#17140f";

/**
 * App native : la barre système Android prend la couleur de fond de l'app
 * (heure et icônes restent visibles), au lieu du bandeau blanc par défaut
 * qui trahit la webview. Suit le mode sombre en direct.
 */
export function useNativeStatusBar() {
  if (!isNativeApp) return;
  const { isDark } = useDarkMode();
  watchEffect(() => {
    const dark = isDark.value;
    // Style.Light = icônes sombres sur fond clair, Style.Dark = l'inverse.
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
    StatusBar.setBackgroundColor({ color: dark ? DARK_BG : LIGHT_BG }).catch(() => {});
  });
}
