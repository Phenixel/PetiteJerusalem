/**
 * Quand un bloc au-dessus du point de lecture se replie, la page « remonte »
 * et le lecteur perd sa place. Cet utilitaire ramène doucement un repère
 * (titre du texte ou du chapitre) près du haut de l'écran, pour que la suite
 * de la lecture se retrouve juste en dessous.
 */
export function anchorToElement(el: HTMLElement | null, offset = 90): void {
  if (!el) return;
  const top = el.getBoundingClientRect().top;
  // Déjà confortablement visible : ne pas bouger.
  if (top >= 0 && top <= window.innerHeight * 0.5) return;
  window.scrollTo({ top: window.scrollY + top - offset, behavior: "smooth" });
}
