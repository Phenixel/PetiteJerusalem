import { ref } from "vue";
import { devicePreference } from "../services/devicePreference";

/**
 * The books pinned to the home page: up to three volumes on one shelf, each a
 * whole section of the library (`book:sidour`, `book:talmud`...) or one text
 * of the catalog (`text:345`, Chaharit; `text:1`, Berakhot). Chosen in edit
 * mode (P2-AccueilModifier), under the « Livres épinglés » block, by typing
 * what one looks for; « Les trois offices » pins Chaharit, Min'ha and Arvit
 * at once. A device setting, like the order of the blocks (useHomeLayout).
 *
 * The catalog is not read here (it weighs on the home page's first load): a
 * `text:` reference is only checked for its form, and the shelf
 * (HomePinnedBooks) leaves out a text it does not find.
 */
export type PinRef = string;

export const MAX_PINNED = 3;

/** The whole sections one can pin, what they open, and the key of their title. */
export const PINNABLE_SECTIONS = [
  { corpus: "sidour", to: "/sidour", labelKey: "study.types.sidour" },
  { corpus: "tehilim", to: "/bibliotheque/tehilim", labelKey: "study.types.tehilim" },
  { corpus: "michna", to: "/bibliotheque/michna", labelKey: "study.types.mishna" },
  { corpus: "talmud", to: "/bibliotheque/talmud", labelKey: "study.types.talmud" },
  { corpus: "tanakh", to: "/bibliotheque/tanakh", labelKey: "study.types.tanakh" },
  { corpus: "moussar", to: "/bibliotheque/moussar", labelKey: "study.types.moussar" },
  { corpus: "halakha", to: "/bibliotheque/halakha", labelKey: "study.types.halakha" },
] as const;

/** Until one chooses: the Sidour and the Tehilim. */
export const DEFAULT_PINNED: readonly PinRef[] = ["book:sidour", "book:tehilim"];

/** « Les trois offices »: Chaharit, Min'ha and Arvit (their catalog ids). */
export const PRAYERS_PINNED: readonly PinRef[] = ["text:345", "text:346", "text:347"];

const isPinRef = (value: unknown): value is PinRef =>
  typeof value === "string" &&
  (/^text:\d+$/.test(value) ||
    PINNABLE_SECTIONS.some((section) => value === `book:${section.corpus}`));

/**
 * What the device keeps, set straight: a reference this version does not
 * understand (a newer one pinned it) is left out, a book is pinned once, and
 * the shelf holds three. Held by src/__tests__/homePinned.test.ts.
 */
export function normalizePinned(raw: unknown): PinRef[] {
  const items = (raw as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [...DEFAULT_PINNED];
  return [...new Set(items.filter(isPinRef))].slice(0, MAX_PINNED);
}

const store = devicePreference<PinRef[]>(
  "pj_home_pinned",
  (raw) => {
    if (!raw) return null;
    try {
      return normalizePinned(JSON.parse(raw));
    } catch {
      return null;
    }
  },
  (items) => JSON.stringify({ items }),
);

const pinned = ref<PinRef[]>(store.read() ?? normalizePinned(null));

export function useHomePinned() {
  function save(next: PinRef[]): void {
    pinned.value = normalizePinned({ items: next });
    store.write(pinned.value);
  }
  return {
    pinned,
    /** Adds a book at the end of the shelf, if it is not there and there is room. */
    pin(item: PinRef): void {
      if (pinned.value.includes(item) || pinned.value.length >= MAX_PINNED) return;
      save([...pinned.value, item]);
    },
    unpin(item: PinRef): void {
      save(pinned.value.filter((one) => one !== item));
    },
    /** Replaces the whole shelf (« Les trois offices »). */
    replace(next: readonly PinRef[]): void {
      save([...next]);
    },
  };
}
