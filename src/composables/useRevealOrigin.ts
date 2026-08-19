/**
 * Ouverture d'une page « depuis » l'élément qui l'a déclenchée.
 *
 * Le bouton rond de la barre du bas note d'où part la navigation ; la page
 * d'arrivée s'y raccroche et se dévoile en cercle depuis ce point, au lieu
 * d'apparaître d'un coup. Le lien entre les deux tient dans ce module plutôt
 * que dans la route : l'origine est un détail d'affichage, elle n'a rien à
 * faire dans l'URL, et une page ouverte autrement (lien, retour arrière)
 * s'affiche simplement.
 *
 * L'origine est consommée à la première lecture : sans cela, un retour
 * arrière rejouerait l'animation sans qu'on ait touché le bouton.
 */

export interface RevealOrigin {
  /** Centre du déclencheur, en coordonnées de la fenêtre. */
  x: number;
  y: number;
  /** Rayon du déclencheur : le cercle démarre à sa taille, pas à zéro. */
  radius: number;
}

let pending: RevealOrigin | null = null;

/** Mémorise le centre de l'élément cliqué comme point de départ. */
export function setRevealOrigin(element: HTMLElement | null): void {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  pending = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    radius: Math.max(rect.width, rect.height) / 2,
  };
}

/** Récupère l'origine en attente, et l'oublie. */
export function takeRevealOrigin(): RevealOrigin | null {
  const origin = pending;
  pending = null;
  return origin;
}

/**
 * Dévoile l'élément en cercle depuis l'origine mémorisée.
 *
 * Le centre passe du repère de la fenêtre à celui de l'élément (le
 * `clip-path` s'y rapporte), mais le rayon final se calcule sur la fenêtre :
 * une page longue mesure plusieurs milliers de pixels, un cercle taillé pour
 * la couvrir entièrement remplirait l'écran en deux images et l'animation ne
 * se verrait pas. Sans origine, ou si l'utilisateur a demandé moins
 * d'animations, la fonction ne fait rien.
 */
export function revealFromOrigin(element: HTMLElement | null): void {
  const origin = takeRevealOrigin();
  if (!element || !origin) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const rect = element.getBoundingClientRect();
  const x = origin.x - rect.left;
  const y = origin.y - rect.top;
  const radius = Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  );

  // Animation par l'API Web plutôt qu'une classe CSS : elle ne laisse aucun
  // style à nettoyer une fois finie (un `clip-path` résiduel rognerait les
  // barres collantes de la page), et elle ne peut pas être interrompue par
  // l'`animationend` d'un enfant, qui remonte jusqu'ici.
  element.animate(
    [
      { clipPath: `circle(${origin.radius}px at ${x}px ${y}px)`, opacity: 0.4 },
      { clipPath: `circle(${radius}px at ${x}px ${y}px)`, opacity: 1 },
    ],
    { duration: 420, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
  );
}
