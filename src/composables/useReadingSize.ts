import { ref, computed } from "vue";

/**
 * La taille du texte des pages de lecture (A− / A+, et le pincement dans
 * l'app).
 *
 * Gardée sur l'appareil, pas dans le compte : c'est un réglage de confort qui
 * dépend de l'écran qu'on a en main, pas de la personne. Un téléphone tenu à
 * bout de bras et un ordinateur ne demandent pas la même taille.
 *
 * Deux stockages, et c'est voulu. Le `localStorage` se lit en SYNCHRONE, donc
 * dès le premier rendu, avant que le texte ne s'affiche : sans lui, la page
 * s'ouvrirait à la taille d'origine puis sauterait sous les yeux. Mais celui
 * d'une webview n'est pas durable, le système peut le vider sous la pression
 * mémoire ou au vidage du cache de l'app, et le réglage était alors perdu au
 * lancement suivant. Les préférences natives (@capacitor/preferences :
 * SharedPreferences côté Android, UserDefaults côté iOS) survivent, elles,
 * mais ne se lisent qu'en asynchrone : elles servent de filet, relu au premier
 * usage du réglage.
 */
import { analyticsService } from "../services/analyticsService";
import { isNativeApp } from "./useNativeApp";

const STORAGE_KEY = "pj-reading-size";
const SCALES = [0.85, 1, 1.15, 1.35, 1.6];
const DEFAULT_LEVEL = 1;

/** Ce que vaut un niveau lu d'un stockage : un cran de la table, ou rien. */
function parseLevel(value: string | null): number | null {
  // `Number(null)` vaut 0, un niveau parfaitement valide : sans ce garde, qui
  // n'a jamais touché à A− / A+ lisait tout le corpus un cran trop petit
  // (×0,85), et le niveau par défaut ne servait qu'aux navigateurs sans
  // stockage.
  if (value === null || value === "") return null;
  const raw = Number(value);
  return Number.isInteger(raw) && raw >= 0 && raw < SCALES.length ? raw : null;
}

function readStoredLevel(): number | null {
  try {
    return parseLevel(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null; // Stockage indisponible (navigation privée).
  }
}

const stored = readStoredLevel();
const level = ref(stored ?? DEFAULT_LEVEL);

/**
 * Le niveau est-il déjà celui d'un choix retrouvé ? Tant qu'il ne l'est pas,
 * les préférences natives ont quelque chose à nous apprendre.
 */
let restored = stored !== null;

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(level.value));
  } catch {
    // Stockage indisponible : le réglage vaut pour la lecture en cours.
  }
  if (!isNativeApp) return;
  void import("@capacitor/preferences")
    .then(({ Preferences }) => Preferences.set({ key: STORAGE_KEY, value: String(level.value) }))
    .catch(() => {
      // Plugin absent (vieux binaire) : le localStorage fait seul, comme avant.
    });
}

/** Reprend le niveau gardé par le natif quand le localStorage n'a rien. */
async function restoreFromDevice(): Promise<void> {
  if (restored || !isNativeApp) return;
  restored = true;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const saved = parseLevel((await Preferences.get({ key: STORAGE_KEY })).value);
    if (saved === null) return;
    level.value = saved;
    // Remis en place pour le prochain lancement : la lecture synchrone
    // retrouvera le réglage sans attendre le plugin.
    persist();
  } catch {
    // Plugin absent : rien à reprendre.
  }
}

export function useReadingSize() {
  // Au premier usage : le module est chargé par les pages de lecture, la
  // relecture native tombe donc avant que le texte ne s'affiche, et ne pèse
  // jamais sur le démarrage de l'app.
  void restoreFromDevice();

  const scale = computed(() => SCALES[level.value]);
  const canIncrease = computed(() => level.value < SCALES.length - 1);
  const canDecrease = computed(() => level.value > 0);

  /**
   * A− / A+ et le pincement dans l'app : le confort de lecture est le réglage
   * le plus utilisé des pages de texte, et le seul qui n'était pas mesuré.
   * Le niveau atteint dit s'il s'agit d'un ajustement ou d'un besoin
   * d'accessibilité (niveau maximal tenu d'une lecture à l'autre).
   */
  function trackSizeChanged(direction: "increase" | "decrease") {
    analyticsService.capture("reading_size_changed", {
      direction,
      level: level.value,
      scale: SCALES[level.value],
    });
  }

  function increase() {
    if (canIncrease.value) {
      level.value++;
      persist();
      trackSizeChanged("increase");
    }
  }

  function decrease() {
    if (canDecrease.value) {
      level.value--;
      persist();
      trackSizeChanged("decrease");
    }
  }

  return { level, scale, canIncrease, canDecrease, increase, decrease };
}
