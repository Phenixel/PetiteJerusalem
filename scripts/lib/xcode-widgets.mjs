/**
 * La cible d'extension de widgets « PjWidgets », fabriquée dans le
 * project.pbxproj que produit `npx cap add ios`.
 *
 * Le dossier ios/ est git-ignoré et régénéré de zéro par la CI (voir
 * .github/workflows/deploy-ios.yml) : une cible créée à la main dans Xcode ne
 * survivrait pas au run suivant, et c'est très exactement pour cela que les
 * widgets iOS n'ont jamais atteint un iPhone, alors que leur code SwiftUI est
 * versionné dans native/ios/ depuis le début. Les sept sortes d'objets qu'une
 * extension demande à Xcode sont donc écrites ici, une fois, en texte.
 *
 * Le format pbxproj est un vieux plist NeXT : des objets à identifiant de 24
 * caractères hexadécimaux, groupés en sections `/* Begin X section *\/`. Les
 * identifiants sont dérivés de leur rôle (md5), donc stables d'un run à
 * l'autre : deux scaffolds successifs produisent le même fichier, et un
 * deuxième passage ne double rien.
 *
 * Ce module ne touche pas au disque : il prend un pbxproj, en rend un autre.
 * De quoi le tester sans macOS ni Xcode (src/__tests__/xcodeWidgets.test.ts),
 * comme scripts/lib/certificate-quota.mjs.
 */
import { createHash } from "node:crypto";

/** Nom de la cible, du dossier de ses sources et de son .appex. */
export const WIDGET_TARGET = "PjWidgets";

/** Seul espace lisible à la fois par l'app et par son extension. */
export const APP_GROUP = "group.fr.petitejerusalem.app";

/** Identifiant pbxproj (24 hexa majuscules) stable pour un même rôle. */
const objectId = (seed) =>
  createHash("md5").update(`${WIDGET_TARGET}#${seed}`).digest("hex").slice(0, 24).toUpperCase();

const ids = {
  group: objectId("group"),
  swiftRef: objectId("swift#fileRef"),
  swiftBuild: objectId("swift#buildFile"),
  infoRef: objectId("info#fileRef"),
  entitlementsRef: objectId("entitlements#fileRef"),
  appexRef: objectId("appex#fileRef"),
  appexBuild: objectId("appex#buildFile"),
  sources: objectId("phase#sources"),
  frameworks: objectId("phase#frameworks"),
  resources: objectId("phase#resources"),
  embed: objectId("phase#embed"),
  target: objectId("target"),
  configList: objectId("configList"),
  debug: objectId("config#debug"),
  release: objectId("config#release"),
  dependency: objectId("dependency"),
  proxy: objectId("proxy"),
};

/** Insère un bloc juste avant une ancre, en échouant si l'ancre a disparu. */
function insertBefore(pbxproj, anchor, block, what) {
  if (!pbxproj.includes(anchor)) {
    throw new Error(`ancre « ${anchor} » introuvable (${what})`);
  }
  return pbxproj.replace(anchor, () => `${block}${anchor}`);
}

/** Le premier groupe capturant d'un motif, ou une erreur explicite. */
function capture(pbxproj, pattern, what) {
  const match = pattern.exec(pbxproj);
  if (!match) throw new Error(`${what} introuvable dans le pbxproj`);
  return match[1];
}

/**
 * L'Info.plist de l'extension. Les versions suivent celles de l'app par
 * variables de build : l'App Store refuse un appex dont les numéros ne
 * correspondent pas à ceux de l'app qui le porte.
 */
export function widgetInfoPlist(displayName) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>CFBundleDevelopmentRegion</key>
\t<string>fr</string>
\t<key>CFBundleDisplayName</key>
\t<string>${displayName}</string>
\t<key>CFBundleExecutable</key>
\t<string>$(EXECUTABLE_NAME)</string>
\t<key>CFBundleIdentifier</key>
\t<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
\t<key>CFBundleInfoDictionaryVersion</key>
\t<string>6.0</string>
\t<key>CFBundleName</key>
\t<string>$(PRODUCT_NAME)</string>
\t<key>CFBundlePackageType</key>
\t<string>XPC!</string>
\t<key>CFBundleShortVersionString</key>
\t<string>$(MARKETING_VERSION)</string>
\t<key>CFBundleVersion</key>
\t<string>$(CURRENT_PROJECT_VERSION)</string>
\t<key>NSExtension</key>
\t<dict>
\t\t<key>NSExtensionPointIdentifier</key>
\t\t<string>com.apple.widgetkit-extension</string>
\t</dict>
</dict>
</plist>
`;
}

/** Les entitlements de l'extension : l'App Group, et rien d'autre. */
export function widgetEntitlements() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>com.apple.security.application-groups</key>
\t<array>
\t\t<string>${APP_GROUP}</string>
\t</array>
</dict>
</plist>
`;
}

/** Les réglages de build d'une configuration de l'extension. */
function widgetBuildSettings({ configuration, bundleId, teamId, marketingVersion, buildNumber, signing }) {
  const settings = [
    [`CODE_SIGN_ENTITLEMENTS`, `${WIDGET_TARGET}/${WIDGET_TARGET}.entitlements`],
    ...(signing.manual
      ? [
          ["CODE_SIGN_STYLE", "Manual"],
          ["CODE_SIGN_IDENTITY", `"${signing.identity}"`],
          ["PROVISIONING_PROFILE_SPECIFIER", `"${signing.profile}"`],
        ]
      : [["CODE_SIGN_STYLE", "Automatic"]]),
    ["CURRENT_PROJECT_VERSION", buildNumber],
    ...(teamId ? [["DEVELOPMENT_TEAM", teamId]] : []),
    // L'Info.plist est écrit à la main (NSExtension), Xcode ne doit pas en
    // synthétiser un par-dessus.
    ["GENERATE_INFOPLIST_FILE", "NO"],
    ["INFOPLIST_FILE", `${WIDGET_TARGET}/Info.plist`],
    // Un appex vit dans PlugIns/ de l'app : ses frameworks sont deux crans
    // plus haut que les siens.
    [
      "LD_RUNPATH_SEARCH_PATHS",
      '(\n\t\t\t\t\t"$(inherited)",\n\t\t\t\t\t"@executable_path/Frameworks",\n\t\t\t\t\t"@executable_path/../../Frameworks",\n\t\t\t\t)',
    ],
    ["MARKETING_VERSION", marketingVersion],
    ["PRODUCT_BUNDLE_IDENTIFIER", bundleId],
    ["PRODUCT_NAME", '"$(TARGET_NAME)"'],
    // Seule l'app s'installe ; l'extension part dans son paquet.
    ["SKIP_INSTALL", "YES"],
    ...(configuration === "Debug" ? [["SWIFT_ACTIVE_COMPILATION_CONDITIONS", "DEBUG"]] : []),
    ["SWIFT_VERSION", "5.0"],
    ["TARGETED_DEVICE_FAMILY", '"1,2"'],
  ];
  return settings.map(([key, value]) => `\t\t\t\t${key} = ${value};`).join("\n");
}

/**
 * Ajoute un fichier de ios/App/App/ à la phase Sources de la cible App.
 * À appeler AVANT `addWidgetExtension`, dont la cible a sa propre phase
 * Sources : l'ancre ci-dessous vise la première, celle de l'app.
 */
export function addAppSource(pbxproj, name) {
  if (pbxproj.includes(`/* ${name} */`)) return pbxproj;
  const fileRefId = objectId(`app#${name}#fileRef`);
  const buildFileId = objectId(`app#${name}#buildFile`);

  let out = insertBefore(
    pbxproj,
    "/* End PBXBuildFile section */",
    `\t\t${buildFileId} /* ${name} in Sources */ = {isa = PBXBuildFile; fileRef = ${fileRefId} /* ${name} */; };\n`,
    `PBXBuildFile de ${name}`,
  );
  out = insertBefore(
    out,
    "/* End PBXFileReference section */",
    `\t\t${fileRefId} /* ${name} */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${name}; sourceTree = "<group>"; };\n`,
    `PBXFileReference de ${name}`,
  );
  const group = /(\/\* App \*\/ = \{\s*isa = PBXGroup;[\s\S]*?children = \(\n)/;
  if (!group.test(out)) throw new Error(`groupe App introuvable (${name})`);
  out = out.replace(group, `$1\t\t\t\t${fileRefId} /* ${name} */,\n`);
  const phase = /(isa = PBXSourcesBuildPhase;[\s\S]*?files = \(\n)/;
  if (!phase.test(out)) throw new Error(`phase Sources introuvable (${name})`);
  return out.replace(phase, `$1\t\t\t\t${buildFileId} /* ${name} in Sources */,\n`);
}

/**
 * Fabrique la cible d'extension « PjWidgets » et la fait embarquer par l'app.
 * Idempotent : un pbxproj qui la porte déjà est rendu tel quel.
 *
 * `signing` vaut `{ manual: false }` en local (Xcode signe) ou
 * `{ manual: true, identity, profile }` en CI, où le profil de l'extension est
 * distinct de celui de l'app : un appex a son propre App ID.
 */
export function addWidgetExtension(pbxproj, options) {
  if (pbxproj.includes(`${WIDGET_TARGET}.appex`)) return pbxproj;

  const {
    bundleId,
    teamId = null,
    marketingVersion = "1.0",
    buildNumber = "1",
    signing = { manual: false },
  } = options;

  const projectId = capture(
    pbxproj,
    /([0-9A-F]{24}) \/\* Project object \*\/ = \{\s*isa = PBXProject;/,
    "l'objet Project",
  );
  const appTargetId = capture(
    pbxproj,
    /([0-9A-F]{24}) \/\* App \*\/ = \{\s*isa = PBXNativeTarget;/,
    "la cible App",
  );
  const mainGroupId = capture(pbxproj, /mainGroup = ([0-9A-F]{24});/, "le groupe racine");

  let out = pbxproj;

  // --- La cible App : elle dépend de l'extension et l'embarque -------------
  // Patché en premier, sur le bloc extrait : la cible de l'extension aura les
  // mêmes ancres (`dependencies = (`), qui deviendraient ambiguës après coup.
  const appTarget = new RegExp(
    `(\\t\\t${appTargetId} \\/\\* App \\*\\/ = \\{\\n\\t\\t\\tisa = PBXNativeTarget;[\\s\\S]*?\\n\\t\\t\\};\\n)`,
  );
  const appTargetBlock = capture(out, appTarget, "le bloc de la cible App");
  let patchedAppTarget = appTargetBlock.replace(
    /(buildPhases = \([\s\S]*?)(\t\t\t\);)/,
    `$1\t\t\t\t${ids.embed} /* Embed Foundation Extensions */,\n$2`,
  );
  patchedAppTarget = patchedAppTarget.replace(
    /dependencies = \(\n(\t\t\t\);)/,
    `dependencies = (\n\t\t\t\t${ids.dependency} /* PBXTargetDependency */,\n$1`,
  );
  if (patchedAppTarget === appTargetBlock) {
    throw new Error("buildPhases/dependencies de la cible App introuvables");
  }
  out = out.replace(appTargetBlock, () => patchedAppTarget);

  // --- Objets rangés dans les sections déjà là ----------------------------
  out = insertBefore(
    out,
    "/* End PBXBuildFile section */",
    `\t\t${ids.swiftBuild} /* ${WIDGET_TARGET}.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${ids.swiftRef} /* ${WIDGET_TARGET}.swift */; };\n` +
      `\t\t${ids.appexBuild} /* ${WIDGET_TARGET}.appex in Embed Foundation Extensions */ = {isa = PBXBuildFile; fileRef = ${ids.appexRef} /* ${WIDGET_TARGET}.appex */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };\n`,
    "PBXBuildFile de l'extension",
  );
  out = insertBefore(
    out,
    "/* End PBXFileReference section */",
    `\t\t${ids.appexRef} /* ${WIDGET_TARGET}.appex */ = {isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; includeInIndex = 0; path = ${WIDGET_TARGET}.appex; sourceTree = BUILT_PRODUCTS_DIR; };\n` +
      `\t\t${ids.swiftRef} /* ${WIDGET_TARGET}.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${WIDGET_TARGET}.swift; sourceTree = "<group>"; };\n` +
      `\t\t${ids.infoRef} /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };\n` +
      `\t\t${ids.entitlementsRef} /* ${WIDGET_TARGET}.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = ${WIDGET_TARGET}.entitlements; sourceTree = "<group>"; };\n`,
    "PBXFileReference de l'extension",
  );
  out = insertBefore(
    out,
    "/* End PBXFrameworksBuildPhase section */",
    `\t\t${ids.frameworks} /* Frameworks */ = {\n\t\t\tisa = PBXFrameworksBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n`,
    "phase Frameworks de l'extension",
  );
  out = insertBefore(
    out,
    "/* End PBXResourcesBuildPhase section */",
    `\t\t${ids.resources} /* Resources */ = {\n\t\t\tisa = PBXResourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n`,
    "phase Resources de l'extension",
  );
  out = insertBefore(
    out,
    "/* End PBXSourcesBuildPhase section */",
    `\t\t${ids.sources} /* Sources */ = {\n\t\t\tisa = PBXSourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t\t${ids.swiftBuild} /* ${WIDGET_TARGET}.swift in Sources */,\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n`,
    "phase Sources de l'extension",
  );
  out = insertBefore(
    out,
    "/* End PBXGroup section */",
    `\t\t${ids.group} /* ${WIDGET_TARGET} */ = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n` +
      `\t\t\t\t${ids.swiftRef} /* ${WIDGET_TARGET}.swift */,\n` +
      `\t\t\t\t${ids.infoRef} /* Info.plist */,\n` +
      `\t\t\t\t${ids.entitlementsRef} /* ${WIDGET_TARGET}.entitlements */,\n` +
      `\t\t\t);\n\t\t\tpath = ${WIDGET_TARGET};\n\t\t\tsourceTree = "<group>";\n\t\t};\n`,
    "groupe de l'extension",
  );
  out = insertBefore(
    out,
    "/* End PBXNativeTarget section */",
    `\t\t${ids.target} /* ${WIDGET_TARGET} */ = {\n` +
      `\t\t\tisa = PBXNativeTarget;\n` +
      `\t\t\tbuildConfigurationList = ${ids.configList} /* Build configuration list for PBXNativeTarget "${WIDGET_TARGET}" */;\n` +
      `\t\t\tbuildPhases = (\n\t\t\t\t${ids.sources} /* Sources */,\n\t\t\t\t${ids.frameworks} /* Frameworks */,\n\t\t\t\t${ids.resources} /* Resources */,\n\t\t\t);\n` +
      `\t\t\tbuildRules = (\n\t\t\t);\n` +
      `\t\t\tdependencies = (\n\t\t\t);\n` +
      `\t\t\tname = ${WIDGET_TARGET};\n` +
      `\t\t\tproductName = ${WIDGET_TARGET};\n` +
      `\t\t\tproductReference = ${ids.appexRef} /* ${WIDGET_TARGET}.appex */;\n` +
      `\t\t\tproductType = "com.apple.product-type.app-extension";\n\t\t};\n`,
    "cible de l'extension",
  );
  for (const configuration of ["Debug", "Release"]) {
    const configId = configuration === "Debug" ? ids.debug : ids.release;
    out = insertBefore(
      out,
      "/* End XCBuildConfiguration section */",
      `\t\t${configId} /* ${configuration} */ = {\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = {\n` +
        `${widgetBuildSettings({ configuration, bundleId, teamId, marketingVersion, buildNumber, signing })}\n` +
        `\t\t\t};\n\t\t\tname = ${configuration};\n\t\t};\n`,
      `configuration ${configuration} de l'extension`,
    );
  }
  out = insertBefore(
    out,
    "/* End XCConfigurationList section */",
    `\t\t${ids.configList} /* Build configuration list for PBXNativeTarget "${WIDGET_TARGET}" */ = {\n` +
      `\t\t\tisa = XCConfigurationList;\n\t\t\tbuildConfigurations = (\n` +
      `\t\t\t\t${ids.debug} /* Debug */,\n\t\t\t\t${ids.release} /* Release */,\n\t\t\t);\n` +
      `\t\t\tdefaultConfigurationIsVisible = 0;\n\t\t\tdefaultConfigurationName = Release;\n\t\t};\n`,
    "liste de configurations de l'extension",
  );

  // --- Sections que le template Capacitor n'a pas ------------------------
  out = insertBefore(
    out,
    "/* Begin PBXFileReference section */",
    `/* Begin PBXContainerItemProxy section */\n` +
      `\t\t${ids.proxy} /* PBXContainerItemProxy */ = {\n\t\t\tisa = PBXContainerItemProxy;\n` +
      `\t\t\tcontainerPortal = ${projectId} /* Project object */;\n\t\t\tproxyType = 1;\n` +
      `\t\t\tremoteGlobalIDString = ${ids.target};\n\t\t\tremoteInfo = ${WIDGET_TARGET};\n\t\t};\n` +
      `/* End PBXContainerItemProxy section */\n\n` +
      `/* Begin PBXCopyFilesBuildPhase section */\n` +
      `\t\t${ids.embed} /* Embed Foundation Extensions */ = {\n\t\t\tisa = PBXCopyFilesBuildPhase;\n` +
      `\t\t\tbuildActionMask = 2147483647;\n\t\t\tdstPath = "";\n\t\t\tdstSubfolderSpec = 13;\n` +
      `\t\t\tfiles = (\n\t\t\t\t${ids.appexBuild} /* ${WIDGET_TARGET}.appex in Embed Foundation Extensions */,\n\t\t\t);\n` +
      `\t\t\tname = "Embed Foundation Extensions";\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n` +
      `/* End PBXCopyFilesBuildPhase section */\n\n` +
      `/* Begin PBXTargetDependency section */\n` +
      `\t\t${ids.dependency} /* PBXTargetDependency */ = {\n\t\t\tisa = PBXTargetDependency;\n` +
      `\t\t\ttarget = ${ids.target} /* ${WIDGET_TARGET} */;\n` +
      `\t\t\ttargetProxy = ${ids.proxy} /* PBXContainerItemProxy */;\n\t\t};\n` +
      `/* End PBXTargetDependency section */\n\n`,
    "sections PBXContainerItemProxy / PBXCopyFilesBuildPhase / PBXTargetDependency",
  );

  // --- Rattachements : groupe racine, Products, projet --------------------
  const mainGroup = new RegExp(`(${mainGroupId} = \\{\\n\\t\\t\\tisa = PBXGroup;\\n\\t\\t\\tchildren = \\(\\n)`);
  if (!mainGroup.test(out)) throw new Error("enfants du groupe racine introuvables");
  out = out.replace(mainGroup, `$1\t\t\t\t${ids.group} /* ${WIDGET_TARGET} */,\n`);

  const products = /(\/\* Products \*\/ = \{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = \(\n)/;
  if (!products.test(out)) throw new Error("groupe Products introuvable");
  out = out.replace(products, `$1\t\t\t\t${ids.appexRef} /* ${WIDGET_TARGET}.appex */,\n`);

  const targets = /(\n\t\t\ttargets = \(\n)/;
  if (!targets.test(out)) throw new Error("liste des cibles du projet introuvable");
  out = out.replace(targets, `$1\t\t\t\t${ids.target} /* ${WIDGET_TARGET} */,\n`);

  const attributes = /(TargetAttributes = \{\n)/;
  if (!attributes.test(out)) throw new Error("TargetAttributes du projet introuvables");
  out = out.replace(
    attributes,
    `$1\t\t\t\t\t${ids.target} = {\n\t\t\t\t\t\tCreatedOnToolsVersion = 26.0;\n\t\t\t\t\t};\n`,
  );

  return out;
}

/**
 * Remplace CAPBridgeViewController par PjViewController dans Main.storyboard,
 * pour que le plugin PjWidgets soit enregistré au chargement (obligatoire
 * depuis Capacitor 5, voir native/ios/App/PjViewController.swift).
 *
 * `customModule` et `customModuleProvider` ne sont PAS facultatifs. Une classe
 * Swift n'a pas de nom nu dans le runtime Objective-C : sans eux, UIKit
 * cherche « PjViewController », ne trouve rien, et instancie silencieusement
 * un UIViewController vide. L'app se lance alors sur un écran noir, sans
 * webview et sans plugin, donc sans le moindre payload pour les widgets, et
 * rien dans les logs ne le signale. Le module est celui de la cible App.
 *
 * Idempotent : un storyboard déjà transformé est rendu tel quel.
 */
export function registerViewController(storyboard) {
  if (storyboard.includes('customClass="PjViewController"')) return storyboard;
  const anchor = 'customClass="CAPBridgeViewController" customModule="Capacitor"';
  if (!storyboard.includes(anchor)) {
    throw new Error("Main.storyboard : CAPBridgeViewController introuvable");
  }
  return storyboard.replace(
    anchor,
    'customClass="PjViewController" customModule="App" customModuleProvider="target"',
  );
}
