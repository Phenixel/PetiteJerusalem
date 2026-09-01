import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { addWidgetExtension } from "../../scripts/lib/xcode-widgets.mjs";
import {
  addWatchApp,
  watchAppIconContents,
  watchInfoPlist,
  WATCH_BUNDLE_SUFFIX,
  WATCH_TARGET,
  WATCHOS_DEPLOYMENT_TARGET,
} from "../../scripts/lib/xcode-watch.mjs";

/**
 * La cible de l'app Apple Watch est écrite dans le project.pbxproj par
 * scripts/lib/xcode-watch.mjs, ios/ étant régénéré de zéro à chaque run de CI
 * (docs/app-watch.md). Personne ici n'a de macOS pour ouvrir le résultat dans
 * Xcode : ces tests le lisent donc à sa place, à partir du VRAI template de
 * Capacitor, celui de node_modules, comme ceux des widgets.
 */

const root = join(import.meta.dirname, "../..");

/** Le project.pbxproj nu, extrait du template de `npx cap add ios`. */
function templatePbxproj(): string {
  const archive = join(root, "node_modules/@capacitor/cli/assets/ios-spm-template.tar.gz");
  return execFileSync("tar", ["-xzOf", archive, "App/App.xcodeproj/project.pbxproj"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

/** Les identifiants d'objets définis dans le fichier (« \t\tID = { »). */
function definedIds(pbxproj: string): Set<string> {
  const ids = new Set<string>();
  for (const match of pbxproj.matchAll(/^\t\t([0-9A-F]{24})(?: \/\*[^*]*\*\/)? = \{/gm)) {
    ids.add(match[1]);
  }
  return ids;
}

/** Aucun identifiant cité qui ne soit défini, et des accolades équilibrées. */
function expectCoherent(pbxproj: string) {
  const defined = definedIds(pbxproj);
  const dangling = [...pbxproj.matchAll(/([0-9A-F]{24})/g)]
    .map((match) => match[1])
    .filter((id) => !defined.has(id));
  expect(dangling).toEqual([]);
  let depth = 0;
  for (const character of pbxproj) {
    if (character === "{") depth++;
    if (character === "}") depth--;
  }
  expect(depth).toBe(0);
  const stack: string[] = [];
  for (const [, kind, name] of pbxproj.matchAll(/\/\* (Begin|End) (\w+) section \*\//g)) {
    if (kind === "Begin") stack.push(name);
    else expect(stack.pop()).toBe(name);
  }
  expect(stack).toEqual([]);
}

const options = {
  bundleId: `fr.petitejerusalem.app.${WATCH_BUNDLE_SUFFIX}`,
  teamId: "AB12CD34EF",
  marketingVersion: "3.8.0",
  buildNumber: "3080000",
  signing: { manual: false as const },
};

const widgetOptions = {
  bundleId: "fr.petitejerusalem.app.PjWidgets",
  teamId: "AB12CD34EF",
  marketingVersion: "3.8.0",
  buildNumber: "3080000",
  signing: { manual: false as const },
};

describe("addWatchApp", () => {
  const template = templatePbxproj();
  const patched = addWatchApp(template, options);

  it("laisse un pbxproj cohérent, seule ou après la cible des widgets", () => {
    expectCoherent(patched);
    // L'ordre d'appel ne doit rien changer : la cible des widgets crée trois
    // sections que le template n'a pas (proxy, copie, dépendance), et celle de
    // la montre doit savoir les créer comme s'y ranger.
    expectCoherent(addWatchApp(addWidgetExtension(template, widgetOptions), options));
    expectCoherent(addWidgetExtension(addWatchApp(template, options), widgetOptions));
  });

  it("déclare une APPLICATION watchOS, et non une extension", () => {
    expect(patched).toContain(`productType = "com.apple.product-type.application"`);
    // Sans SDKROOT, la cible se compilerait pour iOS et l'archive embarquerait
    // un binaire que la montre ne sait pas lire.
    expect(patched).toContain("SDKROOT = watchos;");
    expect(patched).toContain('SUPPORTED_PLATFORMS = "watchsimulator watchos";');
    // 4 = Apple Watch.
    expect(patched).toContain("TARGETED_DEVICE_FAMILY = 4;");
    expect(patched).toContain(`WATCHOS_DEPLOYMENT_TARGET = ${WATCHOS_DEPLOYMENT_TARGET};`);
    expect(patched).toContain(`PRODUCT_BUNDLE_IDENTIFIER = ${options.bundleId};`);
    expect(patched).toContain(`INFOPLIST_FILE = ${WATCH_TARGET}/Info.plist;`);
    // Sans catalogue d'icônes nommé, l'App Store refuse l'archive.
    expect(patched).toContain("ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;");
  });

  it("suit les numéros de version de l'app qui la porte", () => {
    // Un paquet embarqué dont les numéros diffèrent est refusé à l'envoi.
    expect(patched.match(/MARKETING_VERSION = 3\.8\.0;/g)).toHaveLength(2);
    expect(patched.match(/CURRENT_PROJECT_VERSION = 3080000;/g)).toHaveLength(2);
    expect(patched).toContain("DEVELOPMENT_TEAM = AB12CD34EF;");
  });

  it("embarque l'app de montre dans App.app/Watch/, et rien ailleurs", () => {
    const appTarget = /\/\* App \*\/ = \{\n\t\t\tisa = PBXNativeTarget;[\s\S]*?\n\t\t\};/.exec(patched);
    expect(appTarget?.[0]).toContain("Embed Watch Content");
    expect(appTarget?.[0]).toContain("PBXTargetDependency");
    // C'est là, et nulle part ailleurs, qu'iOS va chercher l'app à installer
    // sur le poignet : ni PlugIns/ (13), ni la racine du paquet.
    expect(patched).toContain('dstPath = "$(CONTENTS_FOLDER_PATH)/Watch";');
    expect(patched).toContain("dstSubfolderSpec = 16;");
  });

  it("embarque ses ressources : l'icône et les Tehilim", () => {
    const resources = [...patched.matchAll(/isa = PBXResourcesBuildPhase;[\s\S]*?\n\t\t\};/g)]
      .map((match) => match[0])
      .join("\n");
    expect(resources).toContain("Assets.xcassets in Resources");
    expect(resources).toContain("tehilim.json in Resources");
  });

  it("ne double rien à un deuxième passage", () => {
    expect(addWatchApp(patched, options)).toBe(patched);
  });

  it("en signature manuelle, pose le profil propre à l'app de montre", () => {
    // Elle a son propre App ID : le profil de l'app iPhone ne le couvre pas.
    const manual = addWatchApp(template, {
      ...options,
      signing: { manual: true, identity: "Apple Distribution: Test", profile: "PJ CI montre" },
    });
    expect(manual).toContain('PROVISIONING_PROFILE_SPECIFIER = "PJ CI montre";');
    expect(manual).toContain("CODE_SIGN_STYLE = Manual;");
  });
});

describe("fichiers de l'app de montre", () => {
  it("se déclare app de montre et se relie à l'app iPhone", () => {
    const plist = watchInfoPlist("Petite Jérusalem", "fr.petitejerusalem.app");
    // WKApplication (et non l'ancien WKWatchKitApp) : l'app d'un seul tenant
    // qu'Apple demande depuis watchOS 9.
    expect(plist).toContain("<key>WKApplication</key>");
    expect(plist).not.toContain("WKWatchKitApp");
    // Sans le compagnon, l'app ne s'installe pas avec celle du téléphone.
    expect(plist).toContain("<key>WKCompanionAppBundleIdentifier</key>");
    expect(plist).toContain("<string>fr.petitejerusalem.app</string>");
    expect(plist).toContain("$(MARKETING_VERSION)");
    expect(plist).toContain("$(CURRENT_PROJECT_VERSION)");
  });

  it("porte une icône de 1024 points, la seule taille que watchOS demande", () => {
    const contents = JSON.parse(watchAppIconContents("AppIcon.png"));
    expect(contents.images).toEqual([
      { filename: "AppIcon.png", idiom: "universal", platform: "watchos", size: "1024x1024" },
    ]);
  });

  it("garde le suffixe d'App ID qu'Apple impose à une app de montre", () => {
    expect(WATCH_BUNDLE_SUFFIX).toBe("watchkitapp");
  });
});
