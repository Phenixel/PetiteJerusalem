import { ref, type Ref } from "vue";

/**
 * Détection best-effort des machines où le rendu se paie en fluidité.
 *
 * Sert à débrayer ce qui coûte du CPU/GPU en continu (animation du mur de
 * pierre, session replay PostHog) sur les machines concernées. Deux étages :
 *
 * 1. `isLowEndDevice`, signal statique (cœurs/RAM), évalué immédiatement.
 *    Les navigateurs qui n'exposent pas ces APIs (Safari/Firefox pour
 *    deviceMemory) sont considérés capables, on ne dégrade que sur signal
 *    explicite.
 * 2. `isDegradedRendering`, réactif, s'allume aussi APRÈS le démarrage si :
 *    - le navigateur rend en LOGICIEL (llvmpipe/SwiftShader/Software
 *      WebRender…) : un CPU puissant n'y change rien, chaque effet plein
 *      écran (mask, backdrop-filter, gradients animés) est rasterisé au
 *      processeur à chaque frame. Cas typique : Firefox sur Linux avec un
 *      driver GPU sur liste noire, le site « rame sous Firefox mais pas
 *      sous Chrome » alors que le thread principal est presque idle ;
 *    - la cadence réelle mesurée à froid est mauvaise (sonde rAF), quel que
 *      soit le matériel déclaré.
 */
const cores = navigator.hardwareConcurrency ?? 8;
const memoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;

export const isLowEndDevice = cores <= 4 || memoryGb <= 4;

/**
 * Gecko (Firefox), détecté de façon SYNCHRONE : le mur de pierre y bascule en
 * rendu raster dès le premier frame (voir StoneWallBackground), Firefox
 * re-rasterise un mask SVG + feTurbulence à chaque tick quand du contenu bouge
 * derrière (bug Mozilla 1860510), quel que soit le matériel.
 */
export const isGecko =
  typeof CSS !== "undefined" && CSS.supports?.("-moz-appearance", "none") === true;

// Décision mémorisée : les sondes (WebGL, FPS) mettent quelques secondes à
// conclure, on persiste leur verdict pour que les visites suivantes
// démarrent directement en mode allégé, sans secondes lentes au chargement.
const DEGRADED_STORAGE_KEY = "pj_perf_degraded";

function readStoredDegraded(): boolean {
  try {
    return localStorage.getItem(DEGRADED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export const isDegradedRendering: Ref<boolean> = ref(isLowEndDevice || readStoredDegraded());

// La classe perf-lite sur <html> permet aux feuilles de style de couper les
// effets coûteux en rendu logiciel (backdrop-filter de la navbar et des
// barres sticky…).
function applyPerfLiteClass(): void {
  document.documentElement.classList.add("perf-lite");
}
if (isDegradedRendering.value && typeof document !== "undefined") applyPerfLiteClass();

function markDegraded(reason: string, detail?: string): void {
  if (isDegradedRendering.value) return;
  isDegradedRendering.value = true;
  applyPerfLiteClass();
  try {
    localStorage.setItem(DEGRADED_STORAGE_KEY, "1");
  } catch {
    // Stockage indisponible : la décision vaudra pour cette session.
  }
  // Trace produit : permet de voir dans PostHog combien de visiteurs passent
  // en rendu allégé, et pourquoi (import dynamique, jamais bloquant).
  import("../services/analyticsService")
    .then(({ analyticsService }) =>
      analyticsService.capture("perf_degraded_rendering", { reason, detail: detail ?? null }),
    )
    .catch(() => {});
}

/** Rendu logiciel ? Le nom du renderer WebGL est le meilleur proxy disponible. */
function detectSoftwareRenderer(): void {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (!gl) {
      // Pas de WebGL du tout : l'accélération graphique est très probablement
      // désactivée, même signal qu'un renderer logiciel.
      markDegraded("no_webgl");
      return;
    }
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    if (/llvmpipe|softpipe|swiftshader|software/i.test(renderer)) {
      markDegraded("software_renderer", renderer);
    }
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    // Détection impossible : on ne dégrade pas sans signal.
  }
}

/**
 * Sonde de cadence réelle : compte les frames rAF pendant 1,5 s, une fois le
 * démarrage passé (les animations d'entrée sont finies). Sous ~40 fps au
 * repos, l'expérience est déjà dégradée : autant couper le décoratif.
 * Un trou entre deux frames (> 500 ms : onglet caché, machine suspendue)
 * invalide la mesure, on abandonne plutôt que de conclure à tort.
 */
function probeFrameRate(): void {
  if (isDegradedRendering.value || typeof requestAnimationFrame !== "function") return;
  if (document.visibilityState !== "visible") return;
  const PROBE_MS = 1500;
  const MIN_FPS = 40;
  const start = performance.now();
  let last = start;
  let frames = 0;
  const tick = () => {
    const now = performance.now();
    if (now - last > 500) return; // mesure polluée : abandon silencieux
    last = now;
    frames++;
    const elapsed = now - start;
    if (elapsed < PROBE_MS) {
      requestAnimationFrame(tick);
      return;
    }
    const fps = frames / (elapsed / 1000);
    if (fps < MIN_FPS) markDegraded("low_fps", String(Math.round(fps)));
  };
  requestAnimationFrame(tick);
}

// Hors du chemin critique : la détection WebGL (création d'un contexte) part
// après le premier rendu, la sonde FPS après la fin des animations d'entrée.
if (typeof window !== "undefined") {
  setTimeout(detectSoftwareRenderer, 1_000);
  setTimeout(probeFrameRate, 5_000);
}
