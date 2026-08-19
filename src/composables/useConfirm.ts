import { readonly, ref, type DeepReadonly, type Ref } from "vue";

/**
 * Confirmation avant une action sans retour, dans le style de l'app.
 *
 * `window.confirm` ouvre une boîte du système : police, boutons et libellés
 * du navigateur, sans rapport avec le reste de l'interface, et sur l'app
 * native, le nom du domaine s'affiche en en-tête. On rend donc la même
 * promesse (une question, oui ou non) avec la modale de l'app.
 *
 * État module-level : une seule demande à la fois pour toute l'app, affichée
 * par ConfirmDialog monté dans App.vue, le même schéma que les toasts.
 */

export interface ConfirmRequest {
  title: string;
  /** Ce que l'action va faire, et ce qu'elle ne fait pas. */
  message?: string;
  /** Par défaut « Confirmer ». */
  confirmLabel?: string;
  /** Par défaut « Annuler ». */
  cancelLabel?: string;
  /** Action destructrice : bouton rouge, et le clavier arrive sur « Annuler ». */
  danger?: boolean;
}

const request = ref<ConfirmRequest | null>(null);
let settle: ((accepted: boolean) => void) | null = null;

function answer(accepted: boolean): void {
  request.value = null;
  const resolve = settle;
  settle = null;
  resolve?.(accepted);
}

export function useConfirm() {
  /** Pose la question et résout à `true` si l'utilisateur confirme. */
  function confirm(options: ConfirmRequest): Promise<boolean> {
    // Une demande déjà à l'écran est abandonnée, deux confirmations
    // superposées n'auraient aucun sens, mais sa promesse est tenue : son
    // appelant doit savoir qu'il n'a pas été confirmé.
    answer(false);
    request.value = options;
    return new Promise((resolve) => {
      settle = resolve;
    });
  }

  return { confirm };
}

/** Réservé à ConfirmDialog, monté une seule fois dans App.vue. */
export function useConfirmHost(): {
  request: DeepReadonly<Ref<ConfirmRequest | null>>;
  answer: (accepted: boolean) => void;
} {
  return { request: readonly(request), answer };
}
