import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

  /**
   * La classe `dark` doit commander tout ce qui est sombre, sans exception.
   * Les utilitaires `dark:` de Tailwind compilent sinon en
   * `@media (prefers-color-scheme: dark)` : ils suivraient le téléphone
   * pendant que les couleurs du thème suivent le choix de l'utilisateur, et
   * une apparence choisie à contre-courant du système donnerait une page
   * moitié claire, moitié sombre, par endroits illisible.
   */
  it("fait suivre la classe aux utilitaires sombres de Tailwind", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
    const css = readFileSync(join(root, "src/assets/main.css"), "utf-8");
    expect(css).toMatch(/@custom-variant\s+dark\s*\(&:where\(\.dark, \.dark \*\)\);/);

    // Et la classe est posée avant le premier pixel, sinon un téléphone en
    // sombre ouvre l'application sur un éclair blanc.
    const html = readFileSync(join(root, "index.html"), "utf-8");
    expect(html).toContain("pj-preferences:guest");
    expect(html).toContain('classList.add("dark")');
  });

  it("ignore une valeur inconnue et revient au suivi du système", async () => {
    const { useColorScheme } = await launch();
    await useColorScheme().setColorScheme(null, "sepia");
    expect(useColorScheme().currentSchemeId.value).toBe("system");
  });
});
