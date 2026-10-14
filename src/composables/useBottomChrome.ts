import { computed, type ComputedRef } from "vue";
import { useMiniPlayerVisible } from "./useAudioPlayer";
import { isNativeApp } from "./useNativeApp";
import { tableBarVisible } from "./useReadingTable";

/**
 * La place que prend la barre de la table d'étude (ReadingTableBar) : la
 * barre elle-même (3 rem) et l'écart qui la sépare de ce qui est dessous.
 */
export const TABLE_BAR_REM = 3.5;

/**
 * Hauteur occupée en bas de l'écran par les barres fixes empilées :
 *   1. la bottom bar de l'app native (toujours présente dans l'app) ;
 *   2. le mini-lecteur audio, posé juste au-dessus, quand il est ouvert ;
 *   3. la barre de la table d'étude, au-dessus encore, quand un texte y est
 *      posé (`table: false` pour s'arrêter sous elle, ce que fait la barre
 *      elle-même pour se placer).
 *
 * Sert à ancrer les éléments flottants du bas (barre de sélection multiple,
 * toasts, bouton retour-en-haut) AU-DESSUS de ces barres, pour qu'ils ne
 * soient plus masqués par la bottom bar native, le bug remonté sur l'app.
 *
 * Retourne une expression CSS `calc(...)` à passer en `style="{ bottom }"`.
 * `extra` ajoute un écart supplémentaire (ex. marge visuelle des toasts).
 */
export function useBottomChromeHeight(
  extra = "0px",
  { table = true }: { table?: boolean } = {},
): ComputedRef<string> {
  const isMiniPlayerVisible = useMiniPlayerVisible();
  return computed(() => {
    const layers: string[] = [extra];
    // Réserve système du bas : bottom bar native (3.5rem) ou, sur le web,
    // l'encoche safe-area des navigateurs mobiles.
    if (isNativeApp) layers.push("3.5rem", "var(--safe-bottom)");
    else layers.push("env(safe-area-inset-bottom, 0px)");
    // Mini-lecteur audio empilé par-dessus (même hauteur web/natif).
    if (isMiniPlayerVisible.value) layers.push("4.5rem");
    if (table && tableBarVisible.value) layers.push(`${TABLE_BAR_REM}rem`);
    return `calc(${layers.join(" + ")})`;
  });
}
