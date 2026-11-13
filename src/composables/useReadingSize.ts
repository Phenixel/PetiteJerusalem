import { ref, computed, onBeforeUnmount, onMounted, type ComputedRef, type Ref } from "vue";

/**
 * The text size of the reading pages (A− / A+, and the pinch in the app).
 *
 * Kept on the device, not in the account: it is a comfort setting that
 * depends on the screen in hand, not on the person. A phone held at arm's
 * length and a computer don't call for the same size.
 *
 * Kept twice on the device, like the other settings of this kind:
 * `localStorage` to read it from the first render, the native preferences so
 * that it survives a cache wipe (see devicePreference).
 *
 * The form of the page (the Vilna daf, the Sefer Torah column) has a size of
 * its own (usePageFormSize): its lines only hold between two bounds, and the
 * size that suits the text of a prayer is not the one that suits a page.
 * A− / A+ and the pinch drive whichever one is on screen
 * (useReadingSizeControl).
 */
import { analyticsService } from "../services/analyticsService";
import { devicePreference } from "../services/devicePreference";

/** The size a reading page reads and the A− / A+ control drives. */
export interface ReadingSize {
  level: Ref<number>;
  scale: ComputedRef<number>;
  canIncrease: ComputedRef<boolean>;
  canDecrease: ComputedRef<boolean>;
  increase(): void;
  decrease(): void;
}

/** What the size is applied to, as `reading_size_changed` reports it. */
type SizedForm = "text" | PageFormKind;
/** The two forms of the page (`page_form_toggled` names them the same way). */
export type PageFormKind = "daf" | "scroll";

/**
 * One device setting: its key, its steps and the step it starts from. The
 * level stays in the module, so that every screen reads the same one.
 */
function readingSizeSetting(
  key: string,
  scales: readonly number[],
  defaultLevel: number,
  formOf: () => SizedForm,
): () => ReadingSize {
  /** What a level read from storage is worth: a step of the table, or nothing. */
  function parseLevel(value: string | null): number | null {
    // `Number(null)` is 0, a perfectly valid level: without this guard,
    // whoever had never touched A− / A+ read the whole corpus one step too
    // small (×0.85), and the default level only served browsers without
    // storage.
    if (value === null || value === "") return null;
    const raw = Number(value);
    return Number.isInteger(raw) && raw >= 0 && raw < scales.length ? raw : null;
  }

  const store = devicePreference(key, parseLevel, String);
  const stored = store.read();
  const level = ref(stored ?? defaultLevel);

  /**
   * Is the level already that of a recovered choice? Until it is, the native
   * preferences have something to tell us.
   */
  let restored = stored !== null;

  /** Takes back the level the native side kept when localStorage has none. */
  async function restoreFromDevice(): Promise<void> {
    if (restored) return;
    restored = true;
    const saved = await store.restore();
    if (saved !== null) level.value = saved;
  }

  const scale = computed(() => scales[level.value]);
  const canIncrease = computed(() => level.value < scales.length - 1);
  const canDecrease = computed(() => level.value > 0);

  /**
   * A− / A+ and the pinch in the app: reading comfort is the most used
   * setting of the text pages, and the only one that was not measured. The
   * level reached tells an adjustment from an accessibility need (the top
   * level kept from one reading to the next). `form` tells which of the two
   * settings moved (docs/tracking-plan.md).
   */
  function changed(direction: "increase" | "decrease") {
    store.write(level.value);
    analyticsService.capture("reading_size_changed", {
      direction,
      level: level.value,
      scale: scales[level.value],
      form: formOf(),
    });
  }

  function increase() {
    if (!canIncrease.value) return;
    level.value++;
    changed("increase");
  }

  function decrease() {
    if (!canDecrease.value) return;
    level.value--;
    changed("decrease");
  }

  const size: ReadingSize = { level, scale, canIncrease, canDecrease, increase, decrease };
  return () => {
    // On first use: the module is loaded by the reading pages, so the native
    // read lands before the text shows, and never weighs on the app's start.
    void restoreFromDevice();
    return size;
  };
}

/** The text of every reading page. */
export const READING_SCALES = [0.85, 1, 1.15, 1.35, 1.6] as const;

/**
 * The form of the page: the page as a whole, from its ordinary width (`1`,
 * the reading column) to a little over twice that. Never smaller: the
 * commentaries of the daf would fall below what a browser draws, come out
 * larger than the lines measured for them and run into one another
 * (MIN_DAF_PAGE in pageZoom.ts). Larger, the page slides sideways and keeps
 * its lines.
 */
export const PAGE_FORM_SCALES = [1, 1.15, 1.35, 1.6, 1.85, 2.1] as const;

/** The forms of the page on screen, and which one was shown last. */
const pageForms = ref<PageFormKind[]>([]);
const shownPageForm = computed(() => pageForms.value[pageForms.value.length - 1] ?? null);

export const useReadingSize = readingSizeSetting(
  "pj-reading-size",
  READING_SCALES,
  1,
  () => "text",
);

export const usePageFormSize = readingSizeSetting(
  "pj-page-form-size",
  PAGE_FORM_SCALES,
  0,
  () => shownPageForm.value ?? "daf",
);

/**
 * A component that draws a form of the page (TalmudDafPages, TorahScroll)
 * says so while it is mounted: A− / A+ and the pinch then drive its size, not
 * the text's. Returns that size.
 */
export function usePageFormShown(kind: PageFormKind): ReadingSize {
  onMounted(() => (pageForms.value = [...pageForms.value, kind]));
  onBeforeUnmount(() => {
    const at = pageForms.value.lastIndexOf(kind);
    if (at >= 0) pageForms.value = pageForms.value.filter((_, i) => i !== at);
  });
  return usePageFormSize();
}

/**
 * What A− / A+ and the pinch drive: the size of the form of the page while
 * one is on screen, the size of the text otherwise. The two are kept apart,
 * so going from a daf to a prayer and back keeps each one where it was left.
 */
export function useReadingSizeControl(): ReadingSize {
  const text = useReadingSize();
  const page = usePageFormSize();
  const active = (): ReadingSize => (shownPageForm.value ? page : text);
  return {
    level: computed({
      get: () => active().level.value,
      set: (value) => (active().level.value = value),
    }),
    scale: computed(() => active().scale.value),
    canIncrease: computed(() => active().canIncrease.value),
    canDecrease: computed(() => active().canDecrease.value),
    increase: () => active().increase(),
    decrease: () => active().decrease(),
  };
}
