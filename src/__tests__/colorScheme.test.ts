import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

/**
 * Apparence claire ou sombre.
 *
 * L'application suivait le système, sans rien à décider. Ce qui doit tenir
 * maintenant qu'il y a un choix :
 * - sans choix explicite, elle suit toujours le système, et le suit en direct
 *   (les téléphones basculent en sombre le soir, en pleine lecture) ;
 * - un choix explicite l'emporte, et le système peut basculer sans rien y
 *   changer ;
 * - le choix fait sans compte est gardé sur l'appareil et retrouvé au
 *   lancement suivant.
 */

vi.mock("firebase/firestore", () => ({
  doc: () => ({}),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  arrayUnion: (...values: unknown[]) => values,
  deleteDoc: vi.fn(),
}));
vi.mock("../firebase/firestore", () => ({ db: {} }));

/** Réglage système simulé : la valeur de départ et les bascules en cours de route. */
let systemDark = false;
let listeners: ((event: { matches: boolean }) => void)[] = [];

function stubMatchMedia() {
  listeners = [];
  window.matchMedia = ((query: string) => ({
    matches: systemDark,
    media: query,
    addEventListener: (_event: string, listener: (event: { matches: boolean }) => void) =>
      listeners.push(listener),
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

/** Le système bascule sous l'application. */
async function flipSystem(dark: boolean) {
  systemDark = dark;
  listeners.forEach((listener) => listener({ matches: dark }));
  await nextTick();
}

const isDarkApplied = () => document.documentElement.classList.contains("dark");

/** Recharge le module comme le ferait un nouveau lancement de l'application. */
async function launch() {
  vi.resetModules();
  stubMatchMedia();
  const module = await import("../composables/useColorScheme");
  module.loadGuestColorScheme();
  await nextTick();
  return module;
}

describe("apparence claire ou sombre", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    systemDark = false;
  });

  it("suit le système tant que rien n'a été choisi, y compris quand il bascule", async () => {
    systemDark = true;
    await launch();
    expect(isDarkApplied()).toBe(true);

    await flipSystem(false);
    expect(isDarkApplied()).toBe(false);
  });

  it("s'en tient au choix explicite, quoi que fasse le système", async () => {
    systemDark = true;
    const { useColorScheme } = await launch();
    await useColorScheme().setColorScheme(null, "light");
    await nextTick();
    expect(isDarkApplied()).toBe(false);

    // Le téléphone repasse en clair puis en sombre : le choix tient.
    await flipSystem(false);
    expect(isDarkApplied()).toBe(false);
    await flipSystem(true);
    expect(isDarkApplied()).toBe(false);
  });

  it("retrouve au lancement suivant le choix fait sans compte", async () => {
    const { useColorScheme } = await launch();
    await useColorScheme().setColorScheme(null, "dark");
    await nextTick();
    expect(isDarkApplied()).toBe(true);

    // Nouveau lancement, système clair : c'est le choix gardé qui décide.
    const relaunched = await launch();
    expect(relaunched.useColorScheme().currentSchemeId.value).toBe("dark");
    expect(isDarkApplied()).toBe(true);
  });

  it("ignore une valeur inconnue et revient au suivi du système", async () => {
    const { useColorScheme } = await launch();
    await useColorScheme().setColorScheme(null, "sepia");
    expect(useColorScheme().currentSchemeId.value).toBe("system");
  });
});
