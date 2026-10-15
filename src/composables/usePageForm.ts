import { ref } from "vue";
import { devicePreference } from "../services/devicePreference";

/**
 * La forme de la page (voir pageForm.ts) : la guemara dans la page de Vilna,
 * la Torah dans la forme du Sefer Torah. Un seul choix pour les deux : qui
 * lit dans la forme du livre le veut d'un texte à l'autre.
 *
 * Gardé sur l'appareil, comme la taille du texte : la page du daf se lit sur
 * une tablette ou un ordinateur, moins bien sur un petit téléphone ; c'est
 * l'écran qui décide, pas la personne. Deux stockages (devicePreference) :
 * le localStorage pour l'ouvrir dans la bonne forme dès le premier rendu, les
 * préférences natives pour survivre au vidage du cache.
 */
const STORAGE_KEY = "pj-page-form";

const store = devicePreference(
  STORAGE_KEY,
  (raw) => (raw === "1" ? true : raw === "0" ? false : null),
  (on: boolean) => (on ? "1" : "0"),
);

const stored = store.read();
const enabled = ref(stored ?? false);
let restored = stored !== null;

async function restoreFromDevice(): Promise<void> {
  if (restored) return;
  restored = true;
  const saved = await store.restore();
  if (saved !== null) enabled.value = saved;
}

export function usePageForm() {
  void restoreFromDevice();

  function set(on: boolean): void {
    if (enabled.value === on) return;
    enabled.value = on;
    store.write(on);
  }

  return { enabled, set };
}

/**
 * Le nom et l'explication de chaque forme, en clés écrites en clair : le test
 * des clés de traduction (i18nUsage.test.ts) les cherche telles quelles.
 */
export const PAGE_FORM_LABELS = {
  daf: {
    label: "textReading.pageForm.daf",
    hint: "textReading.pageForm.dafHint",
    icon: "book-open",
  },
  scroll: {
    label: "textReading.pageForm.scroll",
    hint: "textReading.pageForm.scrollHint",
    icon: "scroll",
  },
} as const;
