import { computed, ref, watchEffect } from "vue";
import { createAccountPreference } from "./createAccountPreference";

/**
 * Higher contrast: an accessibility mode for whoever needs it.
 *
 * The default palette makes a deliberate exception: the sunset orange is
 * light and carries white, which reads on large text but stays below the
 * WCAG AA level on small labels. This mode brings every theme to AA: the
 * text written on a solid fill reaches 4.5:1 (a dark text, or a deeper fill),
 * and the inks reach 4.5:1 on the background, light or dark (see
 * `strengthenThemeColors` in useTheme, and docs/design.md, "Higher
 * contrast").
 *
 * Three values: `system` follows the device ("Increase contrast" on iOS and
 * macOS, read through `prefers-contrast: more`) as long as nobody has chosen;
 * `more` and `standard` are an explicit choice, made in the introduction or
 * in the appearance settings. The choice travels like the theme: on the
 * device without an account, in Firestore with one (createAccountPreference).
 * The `contrast-more` class on the document root lets the stylesheet
 * strengthen the neutral tokens too.
 */

export type ContrastPreference = "system" | "more" | "standard";

const PREFERENCES: ContrastPreference[] = ["system", "more", "standard"];

function isContrastPreference(value: unknown): value is ContrastPreference {
  return PREFERENCES.includes(value as ContrastPreference);
}

const preference = createAccountPreference<ContrastPreference>({
  field: "contrast",
  defaultValue: "system",
  isValid: isContrastPreference,
  eventName: "contrast_changed",
  eventProps: (value, _previous, scope) => ({ preference: value, scope }),
  failedEventName: "contrast_change_failed",
  failedEventProps: (value) => ({ preference: value, scope: "account" }),
});

const systemPrefersMore = ref(false);

if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  const query = window.matchMedia("(prefers-contrast: more)");
  systemPrefersMore.value = query.matches;
  query.addEventListener?.("change", (event) => {
    systemPrefersMore.value = event.matches;
  });
}

/** Higher contrast right now: the explicit choice, or the device by default. */
export const isContrastMore = computed(
  () =>
    preference.current.value === "more" ||
    (preference.current.value === "system" && systemPrefersMore.value),
);

watchEffect(
  () => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("contrast-more", isContrastMore.value);
  },
  { flush: "sync" },
);

export function useContrast() {
  /** Turns the mode on or off; from then on, the device setting no longer decides. */
  async function setContrastMore(userId: string | null, enabled: boolean) {
    if (enabled === isContrastMore.value && preference.current.value !== "system") return;
    await preference.set(userId, enabled ? "more" : "standard");
  }

  return { contrastPreference: preference.current, isContrastMore, setContrastMore };
}

/** The account's choice: local copy first, the server's answer next (see useTheme). */
export const loadContrast = preference.loadForUser;

/** Without an account: the choice kept on the device, or the device setting. */
export const loadGuestContrast = preference.loadForGuest;
