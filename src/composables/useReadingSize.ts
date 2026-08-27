import { ref, computed } from "vue";

/**
 * Reader text-size preference (A− / A+ on the reading pages).
 * Stored locally so it also works for visitors without an account.
 */
import { analyticsService } from "../services/analyticsService";

const STORAGE_KEY = "pj-reading-size";
const SCALES = [0.85, 1, 1.15, 1.35, 1.6];
const DEFAULT_LEVEL = 1;

function readStoredLevel(): number {
  if (typeof localStorage === "undefined") return DEFAULT_LEVEL;
  const raw = Number(localStorage.getItem(STORAGE_KEY));
  return Number.isInteger(raw) && raw >= 0 && raw < SCALES.length ? raw : DEFAULT_LEVEL;
}

const level = ref(readStoredLevel());

export function useReadingSize() {
  const scale = computed(() => SCALES[level.value]);
  const canIncrease = computed(() => level.value < SCALES.length - 1);
  const canDecrease = computed(() => level.value > 0);

  function persist() {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(level.value));
    }
  }

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
