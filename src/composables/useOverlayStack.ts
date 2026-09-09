import { onScopeDispose, watch, type Ref } from "vue";

/**
 * Pile des surcouches ouvertes (modales, dialogue de confirmation, menu de
 * lecture, introduction) et ce qui les ferme.
 *
 * Pourquoi : sur Android, le bouton retour ne voyait que la navigation. Une
 * modale ouverte, il naviguait dessous ou minimisait l'app (à la toute
 * première ouverture, depuis l'introduction). Le geste retour doit d'abord
 * fermer ce qui est au-dessus de la page, comme Échap le fait déjà ; main.ts
 * consulte la pile avant `router.back()`.
 *
 * Deux façons de s'inscrire :
 *  - `pushOverlay(close)` inscrit une fermeture et renvoie son retrait, à
 *    appeler quand la surcouche disparaît ;
 *  - `useOverlay(open, close)` suit une ref booléenne : inscrit à l'ouverture,
 *    retire à la fermeture et au démontage. C'est la forme pour un composant.
 */

type Close = () => void;

const stack: Close[] = [];

/** Inscrit une surcouche ouverte ; renvoie la fonction qui la retire. */
export function pushOverlay(close: Close): () => void {
  stack.push(close);
  return () => {
    const index = stack.lastIndexOf(close);
    if (index !== -1) stack.splice(index, 1);
  };
}

/** Ferme la surcouche du dessus ; vrai s'il y en avait une. */
export function closeTopOverlay(): boolean {
  const close = stack[stack.length - 1];
  if (!close) return false;
  close();
  return true;
}

/** Vrai si une surcouche est ouverte. */
export function hasOpenOverlay(): boolean {
  return stack.length > 0;
}

/**
 * Suit `open` : la surcouche est dans la pile tant qu'elle est vraie. Le
 * retour la ferme par `close`, qui doit ramener `open` à faux.
 */
export function useOverlay(open: Ref<boolean>, close: Close): void {
  let remove: (() => void) | null = null;
  const unregister = () => {
    remove?.();
    remove = null;
  };
  watch(
    open,
    (isOpen) => {
      if (isOpen && !remove) remove = pushOverlay(close);
      else if (!isOpen) unregister();
    },
    { immediate: true },
  );
  onScopeDispose(unregister);
}

/** Pour les tests : vide la pile. */
export function resetOverlayStack(): void {
  stack.length = 0;
}
