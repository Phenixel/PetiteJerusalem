import { describe, expect, it } from "vitest";
import { createApp, h } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import en from "../locales/en";
import he from "../locales/he";
import { useZmanCountdown } from "../composables/useZmanCountdown";

/**
 * Le décompte affiché sous le prochain horaire, sur la carte de l'accueil
 * comme sur la page des horaires.
 */

/** Le composable a besoin d'un contexte de composant (useI18n). */
function countdownIn(localeName: "fr" | "en" | "he"): (date: Date, now: Date) => string {
  const i18n = createI18n({ legacy: false, locale: localeName, messages: { fr, en, he } });
  let countdown!: (date: Date, now: Date) => string;
  const app = createApp({
    setup() {
      countdown = useZmanCountdown();
      return () => h("div");
    },
  });
  app.use(i18n);
  app.mount(document.createElement("div"));
  return countdown;
}

const NOW = new Date(2026, 7, 4, 14, 0);
const inMinutes = (m: number) => new Date(NOW.getTime() + m * 60_000);

describe("useZmanCountdown", () => {
  it("compte en minutes sous l'heure", () => {
    const countdown = countdownIn("fr");
    expect(countdown(inMinutes(35), NOW)).toBe("dans 35 min");
    expect(countdown(inMinutes(59), NOW)).toBe("dans 59 min");
  });

  it("passe aux heures au-delà, minutes sur deux chiffres", () => {
    const countdown = countdownIn("fr");
    expect(countdown(inMinutes(135), NOW)).toBe("dans 2 h 15");
    // « 4 h 02 » et non « 4 h 2 » : les minutes d'une durée se lisent comme
    // celles d'une heure.
    expect(countdown(inMinutes(242), NOW)).toBe("dans 4 h 02");
    expect(countdown(inMinutes(120), NOW)).toBe("dans 2 h 00");
  });

  it("n'annonce rien pour un horaire passé ou atteint", () => {
    const countdown = countdownIn("fr");
    expect(countdown(inMinutes(0), NOW)).toBe("");
    expect(countdown(inMinutes(-10), NOW)).toBe("");
    // Moins de trente secondes : l'arrondi tombe à zéro, il n'y a plus rien à
    // annoncer plutôt qu'un « dans 0 min ».
    expect(countdown(new Date(NOW.getTime() + 20_000), NOW)).toBe("");
  });

  it("suit la langue de l'interface", () => {
    expect(countdownIn("en")(inMinutes(135), NOW)).toBe("in 2h 15m");
    expect(countdownIn("he")(inMinutes(35), NOW)).toBe("בעוד 35 דק׳");
  });
});
