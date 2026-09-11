import { ref, computed } from "vue";

/**
 * La taille du texte des pages de lecture (A− / A+, et le pincement dans
 * l'app).
 *
 * Gardée sur l'appareil, pas dans le compte : c'est un réglage de confort qui
 * dépend de l'écran qu'on a en main, pas de la personne. Un téléphone tenu à
 * bout de bras et un ordinateur ne demandent pas la même taille.
 *
 * Gardée deux fois sur l'appareil, comme les autres réglages de ce genre :
 * le `localStorage` pour la lire dès le premier rendu, les préférences
 * natives pour qu'elle survive au vidage du cache (voir devicePreference).
 */
import { analyticsService } from "../services/analyticsService";
import { devicePreference } from "../services/devicePreference";

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

const store = devicePreference(STORAGE_KEY, parseLevel, String);

const stored = store.read();
const level = ref(stored ?? DEFAULT_LEVEL);

/**
 * Le niveau est-il déjà celui d'un choix retrouvé ? Tant qu'il ne l'est pas,
 * les préférences natives ont quelque chose à nous apprendre.
 */
let restored = stored !== null;

function persist(): void {
  store.write(level.value);
}

/** Reprend le niveau gardé par le natif quand le localStorage n'a rien. */
async function restoreFromDevice(): Promise<void> {
  if (restored) return;
  restored = true;
  const saved = await store.restore();
  if (saved !== null) level.value = saved;
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
