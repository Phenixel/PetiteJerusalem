/**
 * Valeur d'un champ de saisie, à lier avec `:value` + `@input` À LA PLACE de
 * `v-model` sur les barres de recherche.
 *
 * `v-model` ignore les frappes tant que le clavier est en « composition » :
 *
 *     addEventListener(el, "input", (e) => {
 *       if (e.target.composing) return;   // ← la frappe n'atteint pas le modèle
 *       ...
 *     });
 *
 * Or les claviers à prédiction (Gboard sur Android, saisie intuitive iOS
 * donc l'app native) composent chaque mot : `compositionend`, qui rejoue enfin
 * un `input`, n'arrive qu'à l'espace, à la ponctuation, à « Entrée », au choix
 * d'une suggestion ou à la perte du focus. La liste filtrée ne se mettait donc
 * à jour qu'une fois le mot terminé, et semblait ne se rafraîchir « toute
 * seule » que quand le clavier ne composait pas (chiffres, hébreu, correction
 * automatique désactivée…).
 *
 * Lire l'événement nous-mêmes contourne ce garde-fou : la recherche suit la
 * frappe, lettre par lettre. C'est le bon compromis ici, un filtre se relance
 * sans dommage à chaque caractère, contrairement à un formulaire où la
 * composition doit rester intacte jusqu'à sa validation.
 */
export function liveValue(event: Event): string {
  return (event.target as HTMLInputElement).value;
}
