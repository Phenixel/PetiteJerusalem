import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Les deux plateformes proposent les mêmes widgets.
 *
 * Rien ne relie le WidgetBundle d'iOS aux receivers du manifest Android : un
 * widget ajouté d'un seul côté ne casse rien, il manque simplement chez la
 * moitié du public, et personne ne le voit avant d'installer l'app. C'est
 * exactement ce qui s'était passé : les six raccourcis de la PR 193 n'ont
 * existé que sur iPhone.
 *
 * Le test compare ce que chaque plateforme MONTRE (les noms du sélecteur de
 * widgets), puis vérifie que le câblage Android est complet : provider Java,
 * fichier appwidget-provider, gabarit, libellés.
 *
 * Les sources natives sont lues au texte, comme dans widgetDeepLinks.test.ts :
 * ni le Swift ni le Java ne se compilent ici, et ce sont bien ces fichiers-là
 * qui partent dans les apps.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const androidRes = join(root, "native/android/app/src/main/res");
const androidJava = join(root, "native/android/app/src/main/java/fr/petitejerusalem/app");

/** Les noms affichés par le sélecteur de widgets d'iOS. */
function iosNames(): string[] {
  const source = readFileSync(join(root, "native/ios/PjWidgets/PjWidgets.swift"), "utf8");
  return [...source.matchAll(/\.configurationDisplayName\("([^"]+)"\)/g)].map(([, name]) => name);
}

/** Les widgets déclarés au manifest par le scaffold Android. */
function androidReceivers(): { provider: string; label: string; info: string }[] {
  const source = readFileSync(join(root, "scripts/setup-android.mjs"), "utf8");
  const block = source.slice(source.indexOf("const WIDGET_RECEIVERS = ["));
  return [
    ...block
      .slice(0, block.indexOf("];"))
      .matchAll(/provider: "(\w+)",\s*label: "(\w+)",\s*info: "(\w+)"/g),
  ].map(([, provider, label, info]) => ({ provider, label, info }));
}

/** Les chaînes de res/values/pj_widgets.xml, celles du sélecteur du launcher. */
function androidStrings(): Map<string, string> {
  const source = readFileSync(join(androidRes, "values/pj_widgets.xml"), "utf8");
  return new Map(
    [...source.matchAll(/<string name="([^"]+)">([^<]*)<\/string>/g)].map(([, name, value]) => [
      name,
      // Une apostrophe s'échappe dans une ressource Android, pas sur iOS.
      value.replace(/\\'/g, "'"),
    ]),
  );
}

describe("les widgets des deux plateformes", () => {
  const receivers = androidReceivers();
  const strings = androidStrings();

  it("proposent les mêmes noms dans les deux sélecteurs", () => {
    const android = receivers.map(({ label }) => strings.get(`pj_widget_${label}_label`));
    expect(android.sort()).toEqual(iosNames().sort());
  });

  it("décrivent les mêmes widgets", () => {
    const source = readFileSync(join(root, "native/ios/PjWidgets/PjWidgets.swift"), "utf8");
    // iOS ponctue ses descriptions, le sélecteur d'Android non : c'est la
    // seule différence qu'on laisse passer.
    const ios = [...source.matchAll(/\.description\("([^"]+)"\)/g)]
      .map(([, text]) => text.replace(/\.$/, ""))
      .sort();
    const android = receivers
      .map(({ label }) => strings.get(`pj_widget_${label}_description`))
      .sort();
    expect(android).toEqual(ios);
  });

  it("câblent chaque widget Android de bout en bout", () => {
    const missing: string[] = [];
    for (const { provider, label, info } of receivers) {
      if (!existsSync(join(androidJava, `${provider}.java`))) missing.push(`${provider}.java`);
      const infoPath = join(androidRes, "xml", `${info}.xml`);
      if (!existsSync(infoPath)) {
        missing.push(`${info}.xml`);
        continue;
      }
      // Le gabarit que le fichier appwidget-provider désigne : un nom faux ne
      // se verrait qu'à la compilation des ressources, ou pas du tout.
      const layout = /@layout\/(\w+)/.exec(readFileSync(infoPath, "utf8"))?.[1];
      if (!layout || !existsSync(join(androidRes, "layout", `${layout}.xml`))) {
        missing.push(`${info}.xml → @layout/${layout}`);
      }
      for (const key of [`pj_widget_${label}_label`, `pj_widget_${label}_description`]) {
        if (!strings.get(key)) missing.push(key);
      }
    }
    expect(missing, "pièces manquantes côté Android").toEqual([]);
  });
});
