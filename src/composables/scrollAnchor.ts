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

/**
 * Amène un verset à l'écran et le surligne le temps que l'œil le retrouve
 * (retour de marque-page, reprise de lecture). `highlight` reçoit `key`
 * pendant la surbrillance puis null — sauf si une autre surbrillance a pris
 * le relais entre-temps.
 */
export function scrollToVerse<K>(
  find: () => Element | null | undefined,
  key: K,
  highlight: { value: K | null },
  duration = 2600,
): void {
  const el = find();
  if (!(el instanceof HTMLElement)) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  highlight.value = key;
  setTimeout(() => {
    if (highlight.value === key) highlight.value = null;
  }, duration);
}
