/**
 * Source vectorielle des icônes de l'application, et les deux greffes natives
 * qui les déclarent. Tout part d'ici : aucun fichier n'est dessiné à la main.
 *
 * Le dessin est celui de public/favicon.svg (mêmes chemins, mêmes couleurs) ;
 * les variantes ne changent que la palette et le cadrage, jamais la géométrie.
 *
 *   light        l'icône d'origine, fond beige. C'est celle des boutiques et
 *                de l'écran d'accueil quand le téléphone est en clair.
 *   dark         même dessin sur le fond sombre de l'app, pour la variante
 *                sombre des icônes iOS 18.
 *   tinted       silhouette blanche sur fond transparent : iOS 18 la teinte
 *                lui-même (il lit les niveaux de gris comme une intensité).
 *   monochrome   la même silhouette, mais cadrée pour la toile de 108 dp des
 *                icônes adaptatives Android, pour les « icônes thématiques »
 *                d'Android 13+ (le lanceur la teint aux couleurs du fond
 *                d'écran et du mode clair/sombre).
 *
 * Le noir et blanc n'est pas une décision d'esthétique : c'est ce que les deux
 * systèmes exigent pour pouvoir teinter l'icône eux-mêmes. Une icône en
 * couleurs ne peut pas suivre le thème de l'appareil, ils la laissent telle
 * quelle.
 */

// --- Géométrie du dessin -----------------------------------------------------

/**
 * Boîte occupée par le dessin, en unités du tracé : de la pointe du dôme
 * (y = 30.5) au coin bas des pages (y = 76, plus le demi-arrondi du dos).
 */
const ART = { minX: 15, minY: 30.5, maxX: 85, maxY: 77 };

/**
 * Cadrage de l'icône pleine. Mesuré sur assets/logo.png (bords du mur, du
 * livre et de la tour) : à ces valeurs, le rendu se superpose au pixel près à
 * l'icône déjà publiée sur les boutiques.
 */
const FULL_VIEW = { x: 8, y: 13, size: 84 };

/**
 * Icône adaptative Android : la toile fait 108 dp mais le lanceur applique son
 * masque, et seuls les 66 dp du centre sont garantis visibles. Le dessin tient
 * donc dans ce carré, le reste de la toile est du vide.
 */
const ANDROID_CANVAS_DP = 108;
const ANDROID_SAFE_DP = 66;

/**
 * Le cadrage de la couche monochrome, déduit de la zone sûre ci-dessus.
 *
 * On y inscrit le CERCLE qui contient le dessin, pas son rectangle : les
 * masques des lanceurs sont ronds aussi souvent que carrés, et le livre, large
 * et bas, sort de la zone sûre par les coins de sa boîte bien avant d'en sortir
 * par les côtés. Cadré au rectangle, il perdait les coins de ses pages.
 *
 * Le dessin paraît plus petit que sur l'icône en couleurs, mais seulement sur
 * la toile : une fois le masque appliqué (72 dp visibles sur 108), il occupe la
 * même part de ce qui se voit.
 */
function androidView() {
  const artWidth = ART.maxX - ART.minX;
  const artHeight = ART.maxY - ART.minY;
  const artRadius = Math.hypot(artWidth, artHeight) / 2;
  const scale = ANDROID_SAFE_DP / 2 / artRadius;
  const size = ANDROID_CANVAS_DP / scale;
  return {
    x: (ART.minX + ART.maxX) / 2 - size / 2,
    y: (ART.minY + ART.maxY) / 2 - size / 2,
    size,
  };
}

// Formes pleines : tour crénelée, mur du Kotel, dôme et sa flèche, cyprès.
const MASONRY = [
  "M22 34h8v20h-8z",
  "M22 32h2v2.5h-2zm3 0h2v2.5h-2zm3 0h2v2.5h-2z",
  "M20 45.5a1.5 1.5 0 0 1 1.5-1.5h57a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-57a1.5 1.5 0 0 1-1.5-1.5z",
  "M59 44a9 9 0 0 1 18 0z",
  "M68 30.5l1.3 5h-2.6z",
  "M49 34.5c1.3 2.4 1.8 5 1.8 7.8 0 .8-3.6.8-3.6 0 0-2.8.5-5.4 1.8-7.8z",
  "M48.4 41.6h1.2v2.4h-1.2z",
  "M54.4 36c1.05 2 1.5 4 1.5 6 0 .7-3 .7-3 0 0-2 .45-4 1.5-6z",
  "M53.9 41.9h1v2.1h-1z",
].join("");

/** Joints du mur : deux lits horizontaux et les montants qui les croisent. */
const MORTAR =
  "M20 49.3h60M20 54.6h60" +
  "M33 44v5.3M47 44v5.3M61 44v5.3" +
  "M27 49.3v5.3M40 49.3v5.3M54 49.3v5.3M68 49.3v5.3" +
  "M33 54.6v5.4M47 54.6v5.4M61 54.6v5.4";

const PAGE_LEFT = "M50 62C40 57 27 58 15 63v13c12-5 25-6 35-1z";
const PAGE_RIGHT = "M50 62C60 57 73 58 85 63v13c-12-5-25-6-35-1z";
const SPINE = "M50 62v14";
const PAGE_LINES =
  "M22 65.5c8-2.5 17-2.7 25 .6M22 69.5c8-2.5 17-2.7 25 .6" +
  "M53 66.1c8-3.3 17-3.1 25-.6M53 70.1c8-3.3 17-3.1 25-.6";
/** Le bord haut des pages, seul trait qui sépare le livre du mur. */
const BOOK_TOP = "M50 62C40 57 27 58 15 63M50 62C60 57 73 58 85 63";

// --- Palettes ----------------------------------------------------------------

/**
 * Les joints du mur portent la couleur du fond, dans les deux palettes : c'est
 * ce qui les fait lire comme des creux entre les pierres, et non comme des
 * traits posés dessus.
 */
const PALETTES = {
  light: {
    // Dégradé relevé sur assets/logo.png : radial, centre en haut à gauche.
    background: { from: "#FAF5E8", to: "#E9DCBD" },
    stone: "#C79A3B",
    mortar: "#F1E7CF",
    pageLeft: "#1D6FDB",
    pageRight: "#2E7BE6",
    spine: "#16467E",
    pageLines: "#CFE1FB",
  },
  dark: {
    // Les gris de l'app en mode sombre (src/assets/main.css, gray-900).
    background: { from: "#1F2A3C", to: "#0D1420" },
    // L'or est repris d'un ton pour tenir sur le fond sombre.
    stone: "#D3A544",
    mortar: "#1B2536",
    pageLeft: "#1D6FDB",
    pageRight: "#2E7BE6",
    spine: "#0E2F55",
    pageLines: "#CFE1FB",
  },
};

// --- Fabrication du SVG ------------------------------------------------------

function colourIcon(view, palette) {
  const { x, y, size } = view;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${size} ${size}" width="${size}" height="${size}">`,
    `<defs><radialGradient id="bg" cx="25%" cy="12.5%" r="115%">`,
    `<stop offset="0" stop-color="${palette.background.from}"/>`,
    `<stop offset="1" stop-color="${palette.background.to}"/>`,
    `</radialGradient></defs>`,
    `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="url(#bg)"/>`,
    `<path d="${MASONRY}" fill="${palette.stone}"/>`,
    `<path d="${MORTAR}" fill="none" stroke="${palette.mortar}" stroke-width="1" opacity=".9"/>`,
    `<path d="${PAGE_LEFT}" fill="${palette.pageLeft}"/>`,
    `<path d="${PAGE_RIGHT}" fill="${palette.pageRight}"/>`,
    `<path d="${SPINE}" fill="none" stroke="${palette.spine}" stroke-width="2" stroke-linecap="round"/>`,
    `<path d="${PAGE_LINES}" fill="none" stroke="${palette.pageLines}" stroke-width="1.1" opacity=".85"/>`,
    `</svg>`,
  ].join("");
}

/**
 * La silhouette : un aplat blanc sur fond transparent, dans lequel les joints
 * du mur, les lignes des pages et le dos du livre sont creusés.
 *
 * Le creusement compte autant que la forme. Sans lui, le mur et le livre se
 * touchent et l'icône teintée n'est plus qu'une tache ; c'est le masque qui
 * garde le dessin lisible une fois la couleur perdue. Le trait le plus
 * important est BOOK_TOP, le seul qui sépare les pages des pierres.
 */
function silhouette(view) {
  const { x, y, size } = view;
  const cut = (d, width, extra = "") =>
    `<path d="${d}" fill="none" stroke="#000" stroke-width="${width}"${extra}/>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${size} ${size}" width="${size}" height="${size}">`,
    `<mask id="cut" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${size}" height="${size}">`,
    `<path d="${MASONRY}" fill="#fff"/>`,
    `<path d="${PAGE_LEFT}" fill="#fff"/>`,
    `<path d="${PAGE_RIGHT}" fill="#fff"/>`,
    cut(MORTAR, 1),
    cut(BOOK_TOP, 1.6),
    cut(SPINE, 1.6, ' stroke-linecap="round"'),
    cut(PAGE_LINES, 1.1),
    `</mask>`,
    `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#fff" mask="url(#cut)"/>`,
    `</svg>`,
  ].join("");
}

/** Le SVG d'une variante, prêt à être rasterisé. */
export function appIconSvg(variant) {
  switch (variant) {
    case "light":
      return colourIcon(FULL_VIEW, PALETTES.light);
    case "dark":
      return colourIcon(FULL_VIEW, PALETTES.dark);
    case "tinted":
      return silhouette(FULL_VIEW);
    case "monochrome":
      return silhouette(androidView());
    default:
      throw new Error(`app-icon: variante inconnue « ${variant} »`);
  }
}

export const ICON_VARIANTS = ["light", "dark", "tinted", "monochrome"];

// --- Déclaration côté natif --------------------------------------------------

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
