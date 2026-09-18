import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Les thèmes des fêtes (voir services/holidayThemes et useHolidayTheme).
 *
 * Ce qui doit tenir :
 * - le calendrier : Tichri s'installe deux semaines avant Roch Hachana et
 *   tient jusqu'à Kippour, Souccot prend le lendemain et tient jusqu'au
 *   lendemain de Sim'hat Torah ; entre deux, rien, et la fenêtre de Tichri,
 *   qui commence en Eloul, est trouvée depuis l'année qui s'achève ;
 * - à l'écran, le thème de la fête passe devant le thème choisi, le survol
 *   d'un thème passe devant les deux, et le thème choisi reste le choix ;
 * - l'interrupteur coupe tout, est gardé sur l'appareil sans compte, et le
 *   thème choisi revient aussitôt.
 */

vi.mock("firebase/firestore", () => ({
  doc: () => ({}),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  arrayUnion: (...values: unknown[]) => values,
  deleteDoc: vi.fn(),
}));
vi.mock("../firebase/firestore", () => ({ db: {} }));

import {
  HOLIDAY_THEMES,
  holidayThemeById,
  holidayThemeOn,
  holidayThemeWindows,
} from "../services/holidayThemes";
import { refreshHolidayDay, useHolidayTheme } from "../composables/useHolidayTheme";
import { THEME_OPTIONS, useTheme } from "../composables/useTheme";

const tichri = holidayThemeById("tichri")!;
const souccot = holidayThemeById("souccot")!;
const sunset = THEME_OPTIONS[0];
const ocean = THEME_OPTIONS.find((t) => t.id === "ocean")!;

/** Un jour civil, à midi, pour ne pas dépendre du fuseau du test. */
const day = (iso: string) => new Date(`${iso}T12:00:00`);

function primaryColor() {
  return document.documentElement.style.getPropertyValue("--color-primary");
}

describe("le calendrier des thèmes de fête", () => {
  it("pose les fenêtres de 5787 sur les bons jours civils", () => {
    const [t, s] = holidayThemeWindows(5787);
    // Roch Hachana 5787 tombe le 12 septembre 2026.
    expect(t.first.greg().toDateString()).toBe(day("2026-08-29").toDateString());
    expect(t.last.greg().toDateString()).toBe(day("2026-09-21").toDateString());
    expect(s.first.greg().toDateString()).toBe(day("2026-09-22").toDateString());
    expect(s.last.greg().toDateString()).toBe(day("2026-10-05").toDateString());
  });

  it("trouve le thème de Tichri dès Eloul, depuis l'année qui s'achève", () => {
    expect(holidayThemeOn(day("2026-08-28"))).toBeNull();
    expect(holidayThemeOn(day("2026-08-29"))?.id).toBe("tichri");
    expect(holidayThemeOn(day("2026-09-12"))?.id).toBe("tichri");
  });

  it("passe de Tichri à Souccot le lendemain de Kippour, puis s'efface", () => {
    expect(holidayThemeOn(day("2026-09-21"))?.id).toBe("tichri");
    expect(holidayThemeOn(day("2026-09-22"))?.id).toBe("souccot");
    expect(holidayThemeOn(day("2026-10-05"))?.id).toBe("souccot");
    expect(holidayThemeOn(day("2026-10-06"))).toBeNull();
    expect(holidayThemeOn(day("2026-12-15"))).toBeNull();
  });

  it("pose les autres fêtes de 5787 sur les bons jours civils", () => {
    const windows = Object.fromEntries(holidayThemeWindows(5787).map((w) => [w.id, w]));
    const span = (id: string) =>
      `${windows[id].first.greg().toDateString()} .. ${windows[id].last.greg().toDateString()}`;
    // 'Hanouka 5787 : du 25 Kislev (5 décembre 2026), huit jours.
    expect(span("hanouka")).toBe(
      `${day("2026-12-05").toDateString()} .. ${day("2026-12-12").toDateString()}`,
    );
    // Tou Bichvat : le 15 Chevat, seul.
    expect(span("toubichvat")).toBe(
      `${day("2027-01-23").toDateString()} .. ${day("2027-01-23").toDateString()}`,
    );
    // 5787 est embolismique : Pourim est le 14 Adar II (23 mars 2027).
    expect(span("pourim")).toBe(
      `${day("2027-03-22").toDateString()} .. ${day("2027-03-24").toDateString()}`,
    );
    // Pessah : une semaine avant le 15 Nissan (22 avril), jusqu'au 23 Nissan.
    expect(span("pessah")).toBe(
      `${day("2027-04-15").toDateString()} .. ${day("2027-04-30").toDateString()}`,
    );
    // Chavouot : une semaine avant le 6 Sivan (11 juin), jusqu'au 8 Sivan.
    expect(span("chavouot")).toBe(
      `${day("2027-06-04").toDateString()} .. ${day("2027-06-13").toDateString()}`,
    );
  });

  it("prend Pourim en Adar tout court une année ordinaire", () => {
    // 5786 n'est pas embolismique : Pourim tombe le 14 Adar, le 3 mars 2026.
    expect(holidayThemeOn(day("2026-03-03"))?.id).toBe("pourim");
    expect(holidayThemeOn(day("2026-03-05"))).toBeNull();
  });

  it("ne laisse aucune fenêtre en chevaucher une autre", () => {
    for (const year of [5786, 5787, 5788]) {
      const windows = holidayThemeWindows(year);
      for (const a of windows) {
        for (const b of windows) {
          if (a === b) continue;
          const overlap = a.first.abs() <= b.last.abs() && b.first.abs() <= a.last.abs();
          expect({ year, a: a.id, b: b.id, overlap }).toEqual({
            year,
            a: a.id,
            b: b.id,
            overlap: false,
          });
        }
      }
    }
  });

  it("prend des couleurs lisibles dans les deux sens, comme les thèmes choisis", () => {
    // Même règle que docs/design.md : assez soutenu pour tenir en encre sur le
    // beige comme en fond sous du blanc (les bornes des thèmes choisis).
    const luminance = (hex: string) => {
      const channel = (i: number) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
    };
    const contrast = (a: string, b: string) => {
      const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    for (const theme of HOLIDAY_THEMES) {
      // Et en encre sur le fond sombre, où les trois thèmes choisis tiennent.
      const ratios = {
        id: theme.id,
        beige: contrast(theme.primary, "#f4f1ea") >= 3.1,
        white: contrast(theme.primary, "#ffffff") >= 3.5,
        dark: contrast(theme.primary, "#111827") >= 3.3,
      };
      expect(ratios).toEqual({ id: theme.id, beige: true, white: true, dark: true });
    }
  });
});

describe("le thème de fête à l'écran", () => {
  beforeEach(() => {
    localStorage.clear();
    useTheme().resetTheme();
    useHolidayTheme().resetHolidayThemes();
  });

  afterEach(() => {
    refreshHolidayDay();
  });

  const today = (iso: string) => refreshHolidayDay(day(iso));

  it("passe devant le thème choisi le temps de la fête, et s'efface après", () => {
    today("2026-09-18");
    expect(primaryColor()).toBe(tichri.primary);
    expect(useTheme().appliedTheme.value.primary).toBe(tichri.primary);
    // Le choix, lui, n'a pas bougé : les réglages le montrent toujours.
    expect(useTheme().currentThemeId.value).toBe(sunset.id);

    today("2026-09-28");
    expect(primaryColor()).toBe(souccot.primary);

    today("2026-11-02");
    expect(primaryColor()).toBe(sunset.primary);
  });

  it("garde le choix fait pendant la fête pour après", async () => {
    today("2026-09-18");
    await useTheme().setTheme(null, ocean.id);
    expect(primaryColor()).toBe(tichri.primary);
    expect(useTheme().currentThemeId.value).toBe(ocean.id);

    today("2026-11-02");
    expect(primaryColor()).toBe(ocean.primary);
  });

  it("laisse le survol d'un thème passer devant la fête", () => {
    today("2026-09-18");
    const { previewTheme, cancelPreview } = useTheme();
    previewTheme(ocean.id);
    expect(primaryColor()).toBe(ocean.primary);
    cancelPreview();
    expect(primaryColor()).toBe(tichri.primary);
  });

  it("se coupe dans les réglages, et le réglage reste sur l'appareil", async () => {
    today("2026-09-18");
    const { setHolidayThemesEnabled, activeHolidayTheme, holidayThemeOfDay } = useHolidayTheme();
    await setHolidayThemesEnabled(null, false);
    expect(primaryColor()).toBe(sunset.primary);
    expect(activeHolidayTheme.value).toBeNull();
    // Le calendrier, lui, sait toujours quelle fête c'est : les réglages
    // le montrent même interrupteur coupé.
    expect(holidayThemeOfDay.value?.id).toBe("tichri");
    expect(JSON.parse(localStorage.getItem("pj-preferences:guest") ?? "{}")).toEqual({
      holidayThemes: false,
    });

    // Au lancement suivant, le réglage d'appareil est relu.
    useHolidayTheme().resetHolidayThemes();
    expect(primaryColor()).toBe(tichri.primary);
    useHolidayTheme().loadGuestHolidayThemes();
    expect(primaryColor()).toBe(sunset.primary);
  });
});
