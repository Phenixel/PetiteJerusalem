import { readonly, ref } from "vue";

/**
 * L'écran est-il assez large pour lire côte à côte ? Le texte à gauche, ses
 * commentaires à droite (CommentaryPanel.vue), et les commandes d'un passage
 * en bulle contre lui (ReadingSelectionMenu.vue). En dessous, sur un
 * téléphone, ils montent du bas de l'écran dans un bottom sheet, app et site
 * confondus.
 *
 * Le seuil, 640 px de large, est celui où un téléphone cesse d'en être un :
 * une tablette, un ordinateur, mais aussi un pliant ouvert (de 690 à 880 px
 * environ selon les modèles) ou un téléphone tenu en paysage. Tous ont la
 * place d'une colonne de texte et d'une colonne de commentaires. Il suit
 * l'écran en direct : déplier un pliant fait passer le volet à droite.
 *
 * À garder d'accord avec `--study-width` et la règle de TextReadingPage.vue
 * qui range le texte à gauche du panneau (même seuil).
 */
export const SIDE_BY_SIDE_QUERY = "(min-width: 640px)";

const query =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(SIDE_BY_SIDE_QUERY)
    : null;

const wide = ref(query?.matches ?? false);
query?.addEventListener?.("change", (event) => {
  wide.value = event.matches;
});

/** Vrai quand le texte et ses commentaires tiennent côte à côte. */
export const sideBySide = readonly(wide);
