import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  addAppSource,
  addWidgetExtension,
  APP_GROUP,
  widgetEntitlements,
  widgetInfoPlist,
  WIDGET_TARGET,
} from "../../scripts/lib/xcode-widgets.mjs";

/**
 * La cible d'extension des widgets iOS est écrite dans le project.pbxproj par
 * scripts/lib/xcode-widgets.mjs, ios/ étant régénéré de zéro à chaque run de
 * CI (docs/app-widgets.md). Personne ici n'a de macOS pour ouvrir le résultat
 * dans Xcode : ces tests le lisent donc à sa place, à partir du VRAI template
 * de Capacitor, celui de node_modules. Une mise à jour du template qui
 * déplacerait une ancre casse ces tests plutôt que le build de release.
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

const options = {
  bundleId: "fr.petitejerusalem.app.PjWidgets",
  teamId: "AB12CD34EF",
  marketingVersion: "3.8.0",
  buildNumber: "3080000",
  signing: { manual: false as const },
};

describe("addWidgetExtension", () => {
  const template = templatePbxproj();
  const patched = addWidgetExtension(template, options);

  it("laisse un pbxproj cohérent : aucun renvoi dans le vide", () => {
    const defined = definedIds(patched);
    const dangling = [...patched.matchAll(/([0-9A-F]{24})/g)]
      .map((match) => match[1])
      .filter((id) => !defined.has(id));
    expect(dangling).toEqual([]);
    // Les accolades du dictionnaire racine se referment toutes.
    let depth = 0;
    for (const character of patched) {
      if (character === "{") depth++;
      if (character === "}") depth--;
    }
    expect(depth).toBe(0);
  });

  it("ferme toutes les sections qu'elle ouvre", () => {
    const stack: string[] = [];
    for (const [, kind, name] of patched.matchAll(/\/\* (Begin|End) (\w+) section \*\//g)) {
      if (kind === "Begin") stack.push(name);
      else expect(stack.pop()).toBe(name);
    }
    expect(stack).toEqual([]);
  });

  it("déclare une cible d'extension, avec son App Group et ses versions", () => {
    expect(patched).toContain(`productType = "com.apple.product-type.app-extension"`);
    expect(patched).toContain(`PRODUCT_BUNDLE_IDENTIFIER = ${options.bundleId};`);
    expect(patched).toContain(`CODE_SIGN_ENTITLEMENTS = ${WIDGET_TARGET}/${WIDGET_TARGET}.entitlements;`);
    expect(patched).toContain(`INFOPLIST_FILE = ${WIDGET_TARGET}/Info.plist;`);
    // Un appex dont les numéros diffèrent de ceux de l'app est refusé à l'envoi.
    expect(patched.match(/MARKETING_VERSION = 3\.8\.0;/g)).toHaveLength(2);
    expect(patched.match(/CURRENT_PROJECT_VERSION = 3080000;/g)).toHaveLength(2);
    expect(patched).toContain("DEVELOPMENT_TEAM = AB12CD34EF;");
  });

  it("fait embarquer l'extension par l'app, et l'app en dépendre", () => {
    // Sans la phase de copie, l'appex ne monte pas dans l'IPA ; sans la
    // dépendance, il n'est même pas construit avant elle.
    const appTarget = /\/\* App \*\/ = \{\n\t\t\tisa = PBXNativeTarget;[\s\S]*?\n\t\t\};/.exec(patched);
    expect(appTarget?.[0]).toContain("Embed Foundation Extensions");
    expect(appTarget?.[0]).toContain("PBXTargetDependency");
    expect(patched).toContain("dstSubfolderSpec = 13;");
  });

  it("ne double rien à un deuxième passage", () => {
    expect(addWidgetExtension(patched, options)).toBe(patched);
  });

  it("en signature manuelle, pose le profil propre à l'extension", () => {
    // L'appex a son propre App ID, donc son propre profil : celui de l'app ne
    // couvre pas son bundle id.
    const manual = addWidgetExtension(template, {
      ...options,
      signing: { manual: true, identity: "Apple Distribution: Test", profile: "PJ CI widgets" },
    });
    expect(manual).toContain('PROVISIONING_PROFILE_SPECIFIER = "PJ CI widgets";');
    expect(manual).toContain("CODE_SIGN_STYLE = Manual;");
  });
});

describe("addAppSource", () => {
  const template = templatePbxproj();

  it("ajoute le fichier au groupe App et à sa phase Sources", () => {
    const patched = addAppSource(template, "PjWidgetsPlugin.swift");
    const appGroup = /\/\* App \*\/ = \{\n\t\t\tisa = PBXGroup;[\s\S]*?\n\t\t\};/.exec(patched);
    expect(appGroup?.[0]).toContain("PjWidgetsPlugin.swift");
    const sources = /isa = PBXSourcesBuildPhase;[\s\S]*?\n\t\t\};/.exec(patched);
    expect(sources?.[0]).toContain("PjWidgetsPlugin.swift in Sources");
  });

  it("ne double rien à un deuxième passage", () => {
    const once = addAppSource(template, "PjViewController.swift");
    expect(addAppSource(once, "PjViewController.swift")).toBe(once);
  });
});

describe("fichiers de l'extension", () => {
  it("déclare le point d'extension WidgetKit et suit les versions de l'app", () => {
    const plist = widgetInfoPlist("Petite Jérusalem");
    expect(plist).toContain("com.apple.widgetkit-extension");
    expect(plist).toContain("$(MARKETING_VERSION)");
    expect(plist).toContain("$(CURRENT_PROJECT_VERSION)");
  });

  it("ouvre l'App Group, seul espace partagé avec l'app", () => {
    // Le même que celui de PjWidgetsPlugin.swift et de App.entitlements : sans
    // lui, l'extension ne lit aucun payload.
    expect(widgetEntitlements()).toContain(APP_GROUP);
    const plugin = readFileSync(join(root, "native/ios/App/PjWidgetsPlugin.swift"), "utf8");
    const widgets = readFileSync(join(root, `native/ios/${WIDGET_TARGET}/${WIDGET_TARGET}.swift`), "utf8");
    expect(plugin).toContain(`"${APP_GROUP}"`);
    expect(widgets).toContain(`"${APP_GROUP}"`);
  });
});
