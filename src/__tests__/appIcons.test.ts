import { describe, expect, it } from "vitest";
import {
  ANDROID_DENSITIES,
  ANDROID_MONOCHROME,
  appIconSvg,
  ICON_VARIANTS,
  IOS_ICON_FILES,
  iosAppIconContents,
  withMonochromeLayer,
} from "../../scripts/lib/app-icon.mjs";

/**
 * Icônes qui suivent le thème de l'appareil.
 *
 * Rien ici ne peut se voir avant d'avoir posé l'app sur un vrai écran
 * d'accueil, et une icône ratée ne casse aucun build : elle s'installe, et
 * personne ne s'en aperçoit avant la boutique. Ce sont donc les quelques
 * conditions dont dépend l'effet qui sont tenues ici, plutôt que le rendu.
 */

/** Le viewBox du SVG produit, sous forme de nombres. */
function viewBox(svg: string): { x: number; y: number; size: number } {
  const match = svg.match(/viewBox="([-\d. ]+)"/);
  if (!match) throw new Error("SVG sans viewBox");
  const [x, y, size] = match[1].split(" ").map(Number);
  return { x, y, size };
}

describe("source vectorielle des icônes", () => {
  it("donne un SVG carré pour chaque variante", () => {
    const malformees = ICON_VARIANTS.filter((variant: string) => {
      const svg = appIconSvg(variant);
      return !svg.startsWith("<svg") || !svg.endsWith("</svg>") || viewBox(svg).size <= 0;
    });
    expect(malformees).toEqual([]);
  });

  it("refuse une variante inconnue", () => {
    expect(() => appIconSvg("sepia")).toThrow(/variante inconnue/);
  });

  it("garde à l'icône claire le cadrage déjà publié sur les boutiques", () => {
    // Mesuré sur assets/logo.png : à ces valeurs le rendu se superpose au
    // fichier d'origine. Les changer déplace l'icône des fiches Play et App
    // Store, ce qui ne se fait pas par accident.
    expect(viewBox(appIconSvg("light"))).toEqual({ x: 8, y: 13, size: 84 });
  });

  it("donne le même cadrage aux deux variantes en couleurs", () => {
    // Le mode sombre du téléphone ne doit pas faire bouger le dessin d'un
    // pixel, seulement changer ses couleurs.
    expect(viewBox(appIconSvg("dark"))).toEqual(viewBox(appIconSvg("light")));
  });

  it("ne laisse aucune couleur dans les variantes que le système teinte", () => {
    // iOS et Android teignent eux-mêmes ces deux variantes : ils lisent la
    // luminosité, une couleur de marque qui traînerait ressortirait en gris
    // sale. Seuls le blanc de la silhouette et le noir du masque ont cours.
    const palettes = ["tinted", "monochrome"].map((variant) => [
      variant,
      [...new Set(appIconSvg(variant).match(/#[0-9a-fA-F]{3,6}/g) ?? [])].sort(),
    ]);
    expect(palettes).toEqual([
      ["tinted", ["#000", "#fff"]],
      ["monochrome", ["#000", "#fff"]],
    ]);
  });

  it("creuse la silhouette au lieu de la laisser en aplat", () => {
    // Sans les creux, le mur et le livre se touchent et l'icône teintée n'est
    // plus qu'une tache : c'est le masque qui garde le dessin lisible une fois
    // la couleur perdue.
    const svg = appIconSvg("monochrome");
    expect(svg).toContain("<mask");
    expect(svg.match(/stroke="#000"/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("tient le dessin monochrome dans la zone sûre d'Android", () => {
    // La toile d'une icône adaptative fait 108 dp, mais le masque du lanceur
    // peut manger tout ce qui sort des 66 dp du centre. Le livre est large et
    // bas : cadré trop grand, il perd les coins de ses pages sur un masque
    // rond, et personne ne le voit avant la publication.
    const { x, y, size } = viewBox(appIconSvg("monochrome"));
    // La boîte du dessin, en unités du tracé (voir ART dans app-icon.mjs).
    const art = { minX: 15, minY: 30.5, maxX: 85, maxY: 77 };
    const scale = 108 / size;
    const radiusDp = (Math.hypot(art.maxX - art.minX, art.maxY - art.minY) / 2) * scale;
    expect(radiusDp).toBeLessThanOrEqual(66 / 2 + 0.001);
    // Et le dessin est bien centré sur la toile, sinon la zone sûre ne sert à rien.
    expect(((art.minX + art.maxX) / 2 - x) * scale).toBeCloseTo(54, 6);
    expect(((art.minY + art.maxY) / 2 - y) * scale).toBeCloseTo(54, 6);
  });
});

describe("déclaration de l'icône thématique Android", () => {
  const adaptiveIcon = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">',
    '    <background android:drawable="@color/ic_launcher_background" />',
    '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />',
    "</adaptive-icon>",
  ].join("\n");

  it("ajoute la couche monochrome au ic_launcher.xml", () => {
    // Sans cette couche, Android 13+ n'a rien à teindre : icônes thématiques
    // activées, l'app reste en couleurs au milieu d'un écran d'accueil accordé.
    const patched = withMonochromeLayer(adaptiveIcon);
    expect(patched).toContain(`<monochrome android:drawable="@mipmap/${ANDROID_MONOCHROME}" />`);
    expect(patched.indexOf("<monochrome")).toBeLessThan(patched.indexOf("</adaptive-icon>"));
    expect(patched).toContain("<foreground");
  });

  it("ne pose la couche qu'une fois, quel que soit le nombre de passages", () => {
    // setup-android.mjs rejoue à chaque scaffold : deux couches, et Android
    // refuse la ressource.
    const once = withMonochromeLayer(adaptiveIcon);
    expect(withMonochromeLayer(once)).toBe(once);
  });

  it("laisse un fichier qui n'est pas une icône adaptative tel quel", () => {
    expect(withMonochromeLayer("<resources></resources>")).toBe("<resources></resources>");
  });

  it("couvre les cinq densités de mipmap", () => {
    expect(ANDROID_DENSITIES.map((d) => d.name)).toEqual([
      "mdpi",
      "hdpi",
      "xhdpi",
      "xxhdpi",
      "xxxhdpi",
    ]);
    // La toile fait 108 dp : chaque densité est ce 108 dp en pixels.
    expect(ANDROID_DENSITIES.map((d) => d.px)).toEqual([108, 162, 216, 324, 432]);
  });
});

describe("catalogue d'icônes iOS", () => {
  const contents = JSON.parse(iosAppIconContents()) as {
    images: { filename: string; appearances?: { appearance: string; value: string }[] }[];
  };

  it("déclare les trois apparences d'iOS 18", () => {
    // Une seule entrée sans `appearances` : c'est l'icône claire, celle que le
    // système prend par défaut. Les deux autres sont le mode sombre et la
    // teinte choisie pour l'écran d'accueil.
    expect(contents.images).toHaveLength(3);
    const appearances = contents.images.map((image) => image.appearances?.[0]?.value ?? "light");
    expect(appearances).toEqual(["light", "dark", "tinted"]);
  });

  it("donne un fichier distinct à chaque apparence", () => {
    // Même nom pour deux apparences, et Xcode compile la même image trois fois
    // sans se plaindre : l'icône ne suivrait plus rien.
    const filenames = contents.images.map((image) => image.filename);
    expect(new Set(filenames).size).toBe(3);
    expect(filenames).toEqual([IOS_ICON_FILES.light, IOS_ICON_FILES.dark, IOS_ICON_FILES.tinted]);
  });

  it("garde à l'icône claire le nom que @capacitor/assets produit", () => {
    // C'est lui qui écrit ce fichier ; le renommer ici laisserait le catalogue
    // pointer dans le vide.
    expect(IOS_ICON_FILES.light).toBe("AppIcon-512@2x.png");
  });
});
