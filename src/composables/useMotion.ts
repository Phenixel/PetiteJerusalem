/**
 * Le mouvement d'une interaction : il répond à un geste (un onglet touché, un
 * téléchargement lancé), jamais à une simple apparition (voir docs/design.md,
 * « Le mouvement répond à un geste »).
 *
 * Il se coupe quand le système demande moins d'animations, et sur une petite
 * machine (`perf-lite`, posé par useDevicePerf) : l'état final s'affiche
 * alors d'emblée, rien ne manque, seul le trajet disparaît.
 */
export function prefersLessMotion(): boolean {
  if (typeof window === "undefined") return true;
  if (document.documentElement.classList.contains("perf-lite")) return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
