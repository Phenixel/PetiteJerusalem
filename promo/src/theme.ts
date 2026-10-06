/**
 * Les couleurs et les polices de l'app (docs/design.md), reprises pour les
 * vidéos : les trois duos de thème, le beige de la pierre, le gris nuit du
 * mode sombre ; Playfair Display pour les titres, Manrope pour le reste.
 * Pas de dégradé, comme dans l'app : des aplats.
 */
import { loadFont } from "@remotion/fonts";

// Les fichiers des polices viennent des paquets Fontsource (licence OFL),
// embarqués au rendu : aucun appel réseau, un rendu identique partout.
const fontFile = (pkg: string, subset: string, weight: number, style: "normal" | "italic") =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require(`@fontsource/${pkg}/files/${pkg}-${subset}-${weight}-${style}.woff2`) as string;

// L'hébreu (la série 2 parle aussi hébreu) : Frank Ruhl Libre sous les
// titres, Heebo sous le texte courant, les deux polices hébraïques de l'app.
export const DISPLAY = '"Playfair Display", "Frank Ruhl Libre", serif';
export const SANS = '"Manrope", "Heebo", sans-serif';

for (const weight of [600, 700, 800]) {
  for (const style of ["normal", "italic"] as const) {
    loadFont({ family: "Playfair Display", url: fontFile("playfair-display", "latin", weight, style), weight: String(weight), style });
  }
}
for (const weight of [500, 600, 700, 800]) {
  loadFont({ family: "Manrope", url: fontFile("manrope", "latin", weight, "normal"), weight: String(weight) });
}
for (const weight of [700, 800]) {
  loadFont({ family: "Frank Ruhl Libre", url: fontFile("frank-ruhl-libre", "hebrew", weight, "normal"), weight: String(weight) });
  loadFont({ family: "Heebo", url: fontFile("heebo", "hebrew", weight, "normal"), weight: String(weight) });
}

export type ThemeName = "sunset" | "ocean" | "emerald";

export const THEMES: Record<ThemeName, { primary: string; secondary: string }> = {
  sunset: { primary: "#DE4F17", secondary: "#C98A00" },
  ocean: { primary: "#1E6BF0", secondary: "#0891B2" },
  emerald: { primary: "#059C66", secondary: "#0D9488" },
};

export const STONE = {
  beige: "#f4f1ea",
  surface: "#ffffff",
  soft: "#f8f5ef",
  ink: "#35312a",
  inkSoft: "#6d6759",
  night: "#111827",
  nightSurface: "#1f2937",
  nightSoft: "#273244",
  nightInk: "#f3f4f6",
  nightInkSoft: "#9ca3af",
};

/** Ombre chaude de la maison (--shadow-pop), agrandie à l'échelle de la vidéo. */
export const SHADOW_POP = "0 12px 36px rgb(30 26 18 / 0.16), 0 48px 120px rgb(30 26 18 / 0.28)";

export type Look = { theme: ThemeName; dark: boolean };

export const palette = ({ theme, dark }: Look) => ({
  ...THEMES[theme],
  bg: dark ? STONE.night : STONE.beige,
  surface: dark ? STONE.nightSurface : STONE.surface,
  soft: dark ? STONE.nightSoft : STONE.soft,
  ink: dark ? STONE.nightInk : STONE.ink,
  inkSoft: dark ? STONE.nightInkSoft : STONE.inkSoft,
});

/** Les couleurs d'état de la barre d'avancement d'une chaîne (SessionProgressBar.vue, Tailwind). */
export const PROGRESS = { read: "#22c55e", readInk: "#16a34a", reserved: "#3b82f6", reservedInk: "#2563eb" };
