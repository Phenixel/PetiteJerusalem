import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  ANDROID_CANVAS_DP,
  ANDROID_DENSITIES,
  ANDROID_MONOCHROME,
  ANDROID_SAFE_DP,
  ICON_BACKGROUND,
  ICON_BACKGROUND_DARK,
  ICON_FILES,
  ICON_VARIANTS,
  IOS_ICON_FILES,
  iosAppIconContents,
  NOTIFICATION_CANVAS_DP,
  NOTIFICATION_LIVE_DP,
  withMonochromeLayer,
} from "../../scripts/lib/app-icon.mjs";

/**
 * Icons that follow the device theme.
 *
 * Nothing here can be seen before the app is on a real home screen, and a
 * failed icon breaks no build: it installs, and nobody notices before the
 * store. So the few conditions the effect depends on are checked on the
 * versioned PNGs themselves, rather than on how they look.
 */

const ROOT = join(__dirname, "../..");

type Png = { width: number; height: number; colorType: number; channels: number; data: Uint8Array };

/** Minimal PNG reader: 8-bit, non-interlaced, which is all the icons are. */
function readPng(path: string): Png {
  const file = readFileSync(join(ROOT, path));
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString("ascii", offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[12] !== 0)
        throw new Error(`${path}: 8-bit non-interlaced PNG expected`);
      colorType = body[9];
    } else if (type === "IDAT") {
      idat.push(body);
    }
    offset += 12 + length;
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`${path}: unsupported color type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x];
      const left = x >= channels ? data[y * stride + x - channels] : 0;
      const up = y > 0 ? data[(y - 1) * stride + x] : 0;
      const upLeft = x >= channels && y > 0 ? data[(y - 1) * stride + x - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const [pa, pb, pc] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      data[y * stride + x] = (value + predictor) & 0xff;
    }
  }
  return { width, height, colorType, channels, data };
}

/** The box of the pixels that are not fully transparent, in pixels. */
function alphaBox(png: Png): { minX: number; minY: number; maxX: number; maxY: number } {
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const alpha = png.data[(y * png.width + x) * png.channels + png.channels - 1];
      if (alpha === 0) continue;
      box.minX = Math.min(box.minX, x);
      box.minY = Math.min(box.minY, y);
      box.maxX = Math.max(box.maxX, x + 1);
      box.maxY = Math.max(box.maxY, y + 1);
    }
  }
  return box;
}

const hex = (png: Png, x: number, y: number): string => {
  const i = (y * png.width + x) * png.channels;
  return `#${[0, 1, 2].map((c) => png.data[i + c].toString(16).padStart(2, "0")).join("")}`.toUpperCase();
};

/** Android density factor of the n-th file of a five-density list (mdpi to xxxhdpi). */
const DENSITY_FACTORS = [1, 1.5, 2, 3, 4];

describe("app icon files", () => {
  it("has a file for every variant", () => {
    expect(Object.keys(ICON_FILES)).toEqual(ICON_VARIANTS);
  });

  it("gives the two colored icons 1024 px without transparency", () => {
    // The App Store refuses an icon with an alpha channel, and iOS fills the
    // transparent pixels with black.
    for (const path of [...ICON_FILES.light, ...ICON_FILES.dark]) {
      const png = readPng(path);
      expect([path, png.width, png.height, png.colorType]).toEqual([path, 1024, 1024, 2]);
    }
  });

  it("puts the light icon on the logo's cream and the dark one on the app's dark", () => {
    expect(hex(readPng(ICON_FILES.light[0]), 2, 2)).toBe(ICON_BACKGROUND);
    expect(hex(readPng(ICON_FILES.dark[0]), 2, 2)).toBe(ICON_BACKGROUND_DARK);
  });

  it("leaves no color in the variants the system tints", () => {
    // iOS and Android tint these variants themselves: they read the
    // luminosity, and a brand color left behind would come out as a dirty
    // grey. Grey plus alpha, and only the white of the silhouette.
    for (const path of [
      ...ICON_FILES.tinted,
      ...ICON_FILES.monochrome,
      ...ICON_FILES.notification,
    ]) {
      const png = readPng(path);
      expect([path, png.colorType]).toEqual([path, 4]);
      const greys = new Set<number>();
      for (let i = 0; i < png.data.length; i += 2) if (png.data[i + 1] > 0) greys.add(png.data[i]);
      expect([path, [...greys]]).toEqual([path, [255]]);
    }
  });

  it("keeps the monochrome drawing inside the Android safe zone", () => {
    // The adaptive icon canvas is 108 dp, but the launcher mask may eat
    // everything outside the central 66 dp. The book is wide and low: framed
    // too big, it loses the corners of its pages on a round mask, and nobody
    // sees it before publication.
    ICON_FILES.monochrome.forEach((path: string, index: number) => {
      const png = readPng(path);
      const px = ANDROID_CANVAS_DP * DENSITY_FACTORS[index];
      expect([path, png.width, png.height]).toEqual([path, px, px]);
      expect(ANDROID_DENSITIES[index].px).toBe(px);
      const box = alphaBox(png);
      const dpPerPx = ANDROID_CANVAS_DP / px;
      const radiusDp = (Math.hypot(box.maxX - box.minX, box.maxY - box.minY) / 2) * dpPerPx;
      expect(radiusDp).toBeLessThanOrEqual(ANDROID_SAFE_DP / 2 + 0.5);
      // And centered, or the safe zone is useless.
      expect(Math.abs((box.minX + box.maxX) / 2 - px / 2) * dpPerPx).toBeLessThan(1);
      expect(Math.abs((box.minY + box.maxY) / 2 - px / 2) * dpPerPx).toBeLessThan(1);
    });
  });
});

describe("Android notification small icon", () => {
  it("fills the useful 22 dp of the 24 dp canvas", () => {
    // Android keeps only the opacity of this icon and shrinks it to the
    // height of a status bar line: 1 dp margin on each side, and the drawing
    // as big as possible in what is left.
    ICON_FILES.notification.forEach((path: string, index: number) => {
      const png = readPng(path);
      const px = NOTIFICATION_CANVAS_DP * DENSITY_FACTORS[index];
      expect([path, png.width, png.height]).toEqual([path, px, px]);
      const box = alphaBox(png);
      const dpPerPx = NOTIFICATION_CANVAS_DP / px;
      const sizeDp = Math.max(box.maxX - box.minX, box.maxY - box.minY) * dpPerPx;
      expect(sizeDp).toBeGreaterThan(NOTIFICATION_LIVE_DP - 1);
      expect(sizeDp).toBeLessThanOrEqual(NOTIFICATION_LIVE_DP + 0.5);
      expect(Math.abs((box.minX + box.maxX) / 2 - px / 2) * dpPerPx).toBeLessThan(1);
      expect(Math.abs((box.minY + box.maxY) / 2 - px / 2) * dpPerPx).toBeLessThan(1);
    });
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
