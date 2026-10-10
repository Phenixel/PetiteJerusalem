import { computed, reactive, type ComputedRef } from "vue";
import { useMiniPlayerVisible } from "./useAudioPlayer";
import { isNativeApp } from "./useNativeApp";

/**
 * Hauteur occupée en bas de l'écran par les barres fixes empilées :
 *   1. la bottom bar de l'app native (toujours présente dans l'app) ;
 *   2. le mini-lecteur audio, posé juste au-dessus, quand il est ouvert.
 *
 * Sert à ancrer les éléments flottants du bas (barre de sélection multiple,
 * toasts, bouton retour-en-haut) AU-DESSUS de ces barres, pour qu'ils ne
 * soient plus masqués par la bottom bar native, le bug remonté sur l'app.
 *
 * Un bottom sheet ouvert au bas de l'écran (commandes d'un passage, panneau
 * des commentaires, BottomSheet.vue) s'y empile aussi, à sa hauteur du
 * moment : la pastille du défilement automatique et les toasts passent
 * au-dessus de lui au lieu de disparaître dessous, et le suivent quand on le
 * tire.
 *
 * Retourne une expression CSS `calc(...)` à passer en `style="{ bottom }"`.
 * `extra` ajoute un écart supplémentaire (ex. marge visuelle des toasts).
 */

/** La hauteur de chaque volet ouvert au bas de l'écran, en px. */
const openSheets = reactive(new Map<symbol, number>());

/**
 * Un volet annonce sa hauteur (0 ou `null` : il n'occupe plus le bas de
 * l'écran). Rend de quoi la mettre à jour sans se tromper de volet.
 */
export function bottomSheetSlot(): (height: number | null) => void {
  const id = Symbol("sheet");
  return (height) => {
    if (height && height > 0) openSheets.set(id, height);
    else openSheets.delete(id);
  };
}

/** La hauteur du plus haut des volets ouverts, 0 s'il n'y en a pas. */
export function openSheetHeight(): number {
  let highest = 0;
  for (const h of openSheets.values()) highest = Math.max(highest, h);
  return highest;
}
export function useBottomChromeHeight(extra = "0px"): ComputedRef<string> {
  const isMiniPlayerVisible = useMiniPlayerVisible();
  return computed(() => {
    const layers: string[] = [extra];
    // Réserve système du bas : bottom bar native (3.5rem) ou, sur le web,
    // l'encoche safe-area des navigateurs mobiles.
    if (isNativeApp) layers.push("3.5rem", "var(--safe-bottom)");
    // Un volet ouvert : on passe au-dessus de lui (il porte lui-même la
    // marge de l'encoche sur le web, et couvre le mini-lecteur).
    const sheet = openSheetHeight();
    if (sheet > 0) {
      layers.push(`${Math.round(sheet)}px`);
      return `calc(${layers.join(" + ")})`;
    }
    if (!isNativeApp) layers.push("env(safe-area-inset-bottom, 0px)");
    // Mini-lecteur audio empilé par-dessus (même hauteur web/natif).
    if (isMiniPlayerVisible.value) layers.push("4.5rem");
    return `calc(${layers.join(" + ")})`;
  });
}
