import { ref, watch } from "vue";

/**
 * Options d'affichage du chnei mikra, partagées entre sa page de la
 * bibliothèque et la paracha de la lecture quotidienne : le verset écrit deux
 * fois (chnayim mikra : chaque verset se lit deux fois, puis son Targoum) et
 * le commentaire de Rachi. Rangées en local, comme la taille de lecture
 * (useReadingSize) : c'est un réglage de lecture, pas un réglage de compte.
 */
const STORAGE_KEY = "pj-chnei-mikra-options";

interface StoredOptions {
  doubleVerses?: boolean;
  withRashi?: boolean;
}

function readStored(): StoredOptions {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as StoredOptions;
  } catch {
    return {};
  }
}

const stored = readStored();
// Écrire le verset deux fois est la pratique même du chnei mikra : actif par
// défaut. Rachi est un accompagnement : à activer soi-même.
const doubleVerses = ref(stored.doubleVerses !== false);
const withRashi = ref(stored.withRashi === true);

watch([doubleVerses, withRashi], () => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ doubleVerses: doubleVerses.value, withRashi: withRashi.value }),
  );
});

export function useChneiMikraOptions() {
  return { doubleVerses, withRashi };
}
