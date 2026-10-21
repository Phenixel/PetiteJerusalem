/**
 * The app icons and the two native grafts that declare them.
 *
 * The drawing is the designer's: a raster master, not a vector. Its files live
 * in `assets/` and every variant is derived from them, never redrawn:
 *
 *   light        `assets/logo.png`, the designer's logo on its cream
 *                background, opaque. The stores, the home screen in light
 *                mode, the launch screen.
 *   dark         `assets/brand/logo-transparent.png` on the app's dark
 *                background, same framing, for the iOS 18 dark icon.
 *   tinted       the silhouette of the same drawing, white on transparent:
 *                iOS 18 tints it itself (it reads grey levels as intensity).
 *   monochrome   the same silhouette, framed for the 108 dp canvas of Android
 *                adaptive icons, for the "themed icons" of Android 13+ (the
 *                launcher tints it with the wallpaper and light/dark colors).
 *   notification the star alone (`assets/brand/star-orange.png`), framed for
 *                the 24 dp of the Android notification small icon, which
 *                Android tints too. The whole logo is a smudge at that size;
 *                the star is the brand mark that still reads in a status bar.
 *
 * Black and white is not an aesthetic choice: it is what both systems require
 * to tint the icon themselves. A colored icon cannot follow the device theme,
 * they leave it as it is.
 *
 * The silhouette keeps the saturated colors of the drawing (the orange stones,
 * the blue outline of the book) and carves out the pale ones (the mortar, the
 * inside of the pages). Without the hollows the wall and the book touch and the
 * tinted icon is nothing but a blob.
 */

/** The variants, in the order of the table above. */
export const ICON_VARIANTS = ["light", "dark", "tinted", "monochrome", "notification"];

/** Where each derived file is versioned, by variant. */
export const ICON_FILES = {
  light: ["assets/logo.png"],
  dark: ["assets/themed/icon-dark.png"],
  tinted: ["assets/themed/icon-tinted.png"],
  monochrome: ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"].map(
    (density) => `assets/themed/monochrome-${density}.png`,
  ),
  notification: ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"].map(
    (density) => `native/android/app/src/main/res/drawable-${density}/ic_stat_pj.png`,
  ),
};

/**
 * Android adaptive icon: the canvas is 108 dp but the launcher applies its
 * mask, and only the central 66 dp are guaranteed visible. The drawing is
 * inscribed there by its CIRCLE, not its rectangle: launcher masks are round
 * as often as square, and the book, wide and low, leaves the safe zone through
 * the corners of its box long before it leaves through the sides.
 */
export const ANDROID_CANVAS_DP = 108;
export const ANDROID_SAFE_DP = 66;

/**
 * Android notification small icon: a 24 dp canvas of which Android keeps only
 * the opacity. The drawing fills the central 22 dp (1 dp margin on each side,
 * the status bar icon rule), inscribed by its rectangle since nothing masks it.
 */
export const NOTIFICATION_CANVAS_DP = 24;
export const NOTIFICATION_LIVE_DP = 22;

/** The cream background of the designer's logo, also the adaptive icon background. */
export const ICON_BACKGROUND = "#FFF9F3";

/** The app's dark background (`--color-bg-beige` in dark mode, docs/design.md). */
export const ICON_BACKGROUND_DARK = "#111827";

// --- Native declarations ---------------------------------------------------

/**
 * Densités de la couche monochrome. Android choisit le fichier au plus près de
 * l'écran ; la toile de l'icône adaptative fait 108 dp, d'où ces tailles.
 */
export const ANDROID_DENSITIES = [
  { name: "mdpi", px: 108 },
  { name: "hdpi", px: 162 },
  { name: "xhdpi", px: 216 },
  { name: "xxhdpi", px: 324 },
  { name: "xxxhdpi", px: 432 },
];

/** Nom de la ressource monochrome dans les mipmap Android. */
export const ANDROID_MONOCHROME = "ic_launcher_monochrome";

/**
 * Ajoute la couche `<monochrome>` à un ic_launcher.xml d'icône adaptative.
 * Sans elle, Android 13+ ignore l'app quand les icônes thématiques sont
 * activées et garde l'icône en couleurs.
 *
 * Rejoue sans dégât : la couche déjà posée est laissée telle quelle.
 */
export function withMonochromeLayer(xml) {
  if (xml.includes("<monochrome")) return xml;
  const layer = `    <monochrome android:drawable="@mipmap/${ANDROID_MONOCHROME}" />\n`;
  const closing = xml.lastIndexOf("</adaptive-icon>");
  if (closing === -1) return xml;
  return xml.slice(0, closing) + layer + xml.slice(closing);
}

/** Le fichier 1024 d'une variante iOS, tel que le catalogue le nomme. */
export const IOS_ICON_FILES = {
  light: "AppIcon-512@2x.png",
  dark: "AppIcon-512@2x-dark.png",
  tinted: "AppIcon-512@2x-tinted.png",
};

/**
 * Le Contents.json du catalogue d'icônes iOS, dans la forme « une seule taille,
 * trois apparences » attendue depuis Xcode 16. C'est cette déclaration qui
 * donne à iOS 18 de quoi suivre le mode clair/sombre du téléphone et la
 * teinte choisie par son propriétaire.
 */
export function iosAppIconContents() {
  const entry = (variant, appearance) => ({
    filename: IOS_ICON_FILES[variant],
    idiom: "universal",
    platform: "ios",
    size: "1024x1024",
    ...(appearance ? { appearances: [{ appearance: "luminosity", value: appearance }] } : {}),
  });
  return (
    JSON.stringify(
      {
        images: [entry("light", null), entry("dark", "dark"), entry("tinted", "tinted")],
        info: { author: "xcode", version: 1 },
      },
      null,
      2,
    ) + "\n"
  );
}
