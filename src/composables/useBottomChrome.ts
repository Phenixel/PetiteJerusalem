import { computed, type ComputedRef } from "vue";
import { useMiniPlayerVisible } from "./useAudioPlayer";
import { isNativeApp } from "./useNativeApp";

/**
 * Hauteur occupée en bas de l'écran par les barres fixes empilées :
 *   1. la bottom bar de l'app native (toujours présente dans l'app) ;
 *   2. le mini-lecteur audio, posé juste au-dessus, quand il est ouvert.
 *
 * Sert à ancrer les éléments flottants du bas (barre de sélection multiple,
 * toasts, bouton retour-en-haut) AU-DESSUS de ces barres, pour qu'ils ne
 * soient plus masqués par la bottom bar native — le bug remonté sur l'app.
 *
 * Retourne une expression CSS `calc(...)` à passer en `style="{ bottom }"`.
 * `extra` ajoute un écart supplémentaire (ex. marge visuelle des toasts).
 */
export function useBottomChromeHeight(extra = "0px"): ComputedRef<string> {
  const isMiniPlayerVisible = useMiniPlayerVisible();
  return computed(() => {
    const layers: string[] = [extra];
    // Réserve système du bas : bottom bar native (3.5rem) ou, sur le web,
    // l'encoche safe-area des navigateurs mobiles.
    if (isNativeApp) layers.push("3.5rem", "var(--safe-bottom)");
    else layers.push("env(safe-area-inset-bottom, 0px)");
    // Mini-lecteur audio empilé par-dessus (même hauteur web/natif).
    if (isMiniPlayerVisible.value) layers.push("4.5rem");
    return `calc(${layers.join(" + ")})`;
  });
}
