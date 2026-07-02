import { ref, computed } from "vue";

/**
 * Reader text-size preference (A− / A+ on the reading pages).
 * Stored locally so it also works for visitors without an account.
 */
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

  function increase() {
    if (canIncrease.value) {
      level.value++;
      persist();
    }
  }

  function decrease() {
    if (canDecrease.value) {
      level.value--;
      persist();
    }
  }

  return { level, scale, canIncrease, canDecrease, increase, decrease };
}
