import { readonly, ref } from "vue";
import { devicePreference } from "../services/devicePreference";

/**
 * La largeur de la colonne des commentaires sur un écran large
 * (CommentaryPanel.vue), quand on l'a choisie en tirant son bord gauche.
 *
 * Sans choix, la colonne prend la largeur que lui donne `--study-width`
 * (main.css) : la place que le texte laisse libre. Un choix écrit la même
 * variable sur la racine, en pixels ; la colonne de lecture, qui se range à
 * sa gauche (TextReadingPage.vue), suit d'elle-même : elle rétrécit quand la
 * colonne s'élargit, et reprend sa largeur ordinaire (48 rem au plus) quand
 * elle se resserre.
 *
 * La largeur se garde sur l'appareil (devicePreference), comme la taille du
 * texte : c'est l'écran qui décide. Elle se borne à chaque lecture à l'écran
 * du moment : ni plus étroite que 17 rem, ni assez large pour ne laisser au
 * texte moins de 20 rem (et l'écart de 2 rem qui le sépare de la colonne).
 */
const STORAGE_KEY = "pj-study-width";

/** La colonne la plus étroite : de quoi lire un Tossafot (17 rem). */
export const STUDY_MIN = 272;
/** Ce que la colonne laisse toujours au texte : 20 rem, plus l'écart de 2 rem. */
export const TEXT_ROOM = 352;

/** Une largeur voulue, ramenée dans ce que l'écran permet. */
export function clampStudyWidth(width: number, viewport: number): number {
  const max = Math.max(STUDY_MIN, viewport - TEXT_ROOM);
  return Math.round(Math.min(max, Math.max(STUDY_MIN, width)));
}

const store = devicePreference(
  STORAGE_KEY,
  (raw) => {
    const n = Number(raw);
    return raw && Number.isFinite(n) && n > 0 ? n : null;
  },
  (width: number) => String(Math.round(width)),
);

const chosen = ref<number | null>(store.read());
let restored = chosen.value !== null;

const root = typeof document !== "undefined" ? document.documentElement : null;

function viewport(): number {
  return typeof window !== "undefined" ? window.innerWidth : 0;
}

/** Écrit la largeur choisie sur la racine, ou rend la main à main.css. */
function apply(): void {
  if (!root) return;
  if (chosen.value === null) root.style.removeProperty("--study-width");
  else root.style.setProperty("--study-width", `${clampStudyWidth(chosen.value, viewport())}px`);
}

apply();
if (typeof window !== "undefined") window.addEventListener("resize", apply);

async function restoreFromDevice(): Promise<void> {
  if (restored) return;
  restored = true;
  const saved = await store.restore();
  if (saved !== null && chosen.value === null) {
    chosen.value = saved;
    apply();
  }
}

export function useStudyWidth() {
  void restoreFromDevice();

  /** Pendant le geste : la largeur suit le doigt, sans s'enregistrer. */
  function preview(width: number): void {
    chosen.value = clampStudyWidth(width, viewport());
    // Tout de suite, pas au prochain rendu : le texte suit le doigt.
    apply();
  }

  /** Le geste fini : la largeur atteinte devient celle de l'appareil. */
  function commit(): void {
    if (chosen.value !== null) store.write(chosen.value);
  }

  /** Retour à la largeur d'origine, celle de main.css. */
  function reset(): void {
    chosen.value = null;
    apply();
    store.clear();
  }

  return { chosen: readonly(chosen), preview, commit, reset };
}
