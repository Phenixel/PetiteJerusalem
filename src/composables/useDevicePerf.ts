/**
 * Détection best-effort des appareils modestes, évaluée une fois au chargement.
 *
 * Sert à débrayer ce qui coûte du CPU/GPU en continu (animation du mur de
 * pierre, session replay PostHog) sur les machines où ça se paie en fluidité :
 * vieux téléphones, petits laptops. Les navigateurs qui n'exposent pas ces
 * APIs (Safari/Firefox pour deviceMemory) sont considérés capables — on ne
 * dégrade l'expérience que sur signal explicite.
 */
const cores = navigator.hardwareConcurrency ?? 8;
const memoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;

export const isLowEndDevice = cores <= 4 || memoryGb <= 4;
