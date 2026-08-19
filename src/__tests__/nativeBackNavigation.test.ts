import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), "utf8");

/**
 * Le retour arrière de l'app native, dont chaque plateforme a sa mécanique :
 *
 * - **Android** : le bouton retour du système, câblé dans `src/main.ts` (sans
 *   ce listener, il quitte l'app au lieu de revenir en arrière) ;
 * - **iOS** : le glissement depuis le bord de l'écran, un geste de la WebView.
 *   Il lui faut deux choses, et il ne fonctionne pas si l'une manque : le
 *   réglage natif (`scripts/setup-ios.mjs`, WKWebView le désactive par défaut)
 *   et la liberté de l'axe horizontal côté CSS.
 *
 * Ce dernier point est le piège : `overscroll-behavior: none`, écrit pour
 * l'étirement vertical d'Android, vaut aussi pour l'horizontale, où WebKit y
 * lit l'ordre de couper la navigation par glissement. Le suffixe `-y` n'est
 * donc pas un détail de style.
 */
describe("retour arrière de l'app native", () => {
  it("laisse l'axe horizontal libre dans la webview (geste iOS)", () => {
    const css = read("src/assets/main.css");
    const offenders = css
      .split("\n")
      .filter((line) => /overscroll-behavior(-x)?\s*:\s*(none|contain)/.test(line));

    expect(
      offenders.map((line) => line.trim()),
      "Utilisez overscroll-behavior-y : sur l'axe horizontal, cela coupe le retour arrière par glissement sur iOS",
    ).toEqual([]);
  });

  it("active le geste de glissement sur la WKWebView", () => {
    expect(read("scripts/setup-ios.mjs")).toContain(
      "allowsBackForwardNavigationGestures = true",
    );
  });

  it("garde le bouton retour d'Android branché sur le routeur", () => {
    const main = read("src/main.ts");
    expect(main).toContain('addListener("backButton"');
    expect(main).toContain("router.back()");
  });
});
