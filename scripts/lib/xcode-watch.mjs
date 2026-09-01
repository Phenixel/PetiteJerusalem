/**
 * La cible « PjWatch », l'app Apple Watch, fabriquée dans le project.pbxproj
 * que produit `npx cap add ios`.
 *
 * Même raison d'être que scripts/lib/xcode-widgets.mjs, dont ce module reprend
 * la mécanique : le dossier ios/ est git-ignoré et régénéré de zéro par la CI,
 * une cible créée à la main dans Xcode ne survivrait donc à aucun run, et les
 * builds partiraient sur l'App Store sans app de montre, sans rien signaler.
 *
 * Ce qu'une app de montre demande de plus qu'une extension :
 *
 *   - c'est une APPLICATION (`com.apple.product-type.application`), pas un
 *     appex : elle a son propre SDK (`SDKROOT = watchos`), sa propre famille
 *     d'appareils (4) et sa propre cible de déploiement ;
 *   - elle s'embarque dans `App.app/Watch/`, et non dans `PlugIns/` : la phase
 *     de copie vise `$(CONTENTS_FOLDER_PATH)/Watch` ;
 *   - elle a des ressources à elle (le catalogue d'icônes, sans lequel l'App
 *     Store refuse l'archive, et les Tehilim embarqués), donc une phase
 *     Resources qui n'est pas vide, contrairement à celle des widgets.
 *
 * Ce module ne touche pas au disque : il prend un pbxproj, en rend un autre.
 * De quoi le tester sans macOS ni Xcode (src/__tests__/xcodeWatch.test.ts).
 */
import { createHash } from "node:crypto";

/** Nom de la cible, du dossier de ses sources et de son .app. */
export const WATCH_TARGET = "PjWatch";

/**
 * Suffixe imposé par Apple : l'App ID d'une app de montre doit être préfixé
 * par celui de l'app qui la porte.
 */
export const WATCH_BUNDLE_SUFFIX = "watchkitapp";

/**
 * watchOS 10 : le plancher des montres qui reçoivent encore des mises à jour,
 * et la version depuis laquelle une app de montre tient dans une seule cible.
 */
export const WATCHOS_DEPLOYMENT_TARGET = "10.0";

/** Les sources SwiftUI de l'app de montre, dans l'ordre de lecture. */
export const WATCH_SOURCES = ["Payloads.swift", "PjWatchApp.swift", "Screens.swift"];

/** Les ressources embarquées : les icônes, et les 150 Tehilim. */
export const WATCH_RESOURCES = ["Assets.xcassets", "tehilim.json"];

/** Identifiant pbxproj (24 hexa majuscules) stable pour un même rôle. */
const objectId = (seed) =>
  createHash("md5").update(`${WATCH_TARGET}#${seed}`).digest("hex").slice(0, 24).toUpperCase();

const ids = {
  group: objectId("group"),
  infoRef: objectId("info#fileRef"),
  appRef: objectId("app#fileRef"),
  appBuild: objectId("app#buildFile"),
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
  sourceRef: (name) => objectId(`source#${name}#fileRef`),
  sourceBuild: (name) => objectId(`source#${name}#buildFile`),
  resourceRef: (name) => objectId(`resource#${name}#fileRef`),
  resourceBuild: (name) => objectId(`resource#${name}#buildFile`),
};

/** Insère un bloc juste avant une ancre, en échouant si l'ancre a disparu. */
function insertBefore(pbxproj, anchor, block, what) {
  if (!pbxproj.includes(anchor)) {
    throw new Error(`ancre « ${anchor} » introuvable (${what})`);
  }
  return pbxproj.replace(anchor, () => `${block}${anchor}`);
}

/**
 * Range un objet dans une section, que le template la porte déjà ou non.
 *
 * Trois des sections dont l'app de montre a besoin (proxy, copie, dépendance)
 * n'existent pas dans le template nu, mais la cible des widgets les a créées
 * si elle est passée avant : il faut donc savoir faire les deux, sans quoi
 * l'ordre d'appel des deux modules changerait le résultat.
 */
function insertIntoSection(pbxproj, section, block, anchor) {
  const end = `/* End ${section} section */`;
  if (pbxproj.includes(end)) return insertBefore(pbxproj, end, block, `section ${section}`);
  return insertBefore(
    pbxproj,
    anchor,
    `/* Begin ${section} section */\n${block}/* End ${section} section */\n\n`,
    `création de la section ${section}`,
  );
}

/** Le premier groupe capturant d'un motif, ou une erreur explicite. */
function capture(pbxproj, pattern, what) {
  const match = pattern.exec(pbxproj);
  if (!match) throw new Error(`${what} introuvable dans le pbxproj`);
  return match[1];
}

/**
 * L'Info.plist de l'app de montre.
 *
 * `WKApplication` (et non l'ancien `WKWatchKitApp`) est ce qui dit au système
 * qu'il s'agit d'une app de montre d'un seul tenant, celle qu'Apple demande
 * depuis watchOS 9 ; `WKCompanionAppBundleIdentifier` la relie à l'app iPhone,
 * sans quoi elle ne s'installe pas avec elle. Les versions suivent celles de
 * l'app par variables de build : l'App Store refuse un paquet embarqué dont
 * les numéros ne correspondent pas à ceux de l'app qui le porte.
 */
export function watchInfoPlist(displayName, companionBundleId) {
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
\t<string>APPL</string>
\t<key>CFBundleShortVersionString</key>
\t<string>$(MARKETING_VERSION)</string>
\t<key>CFBundleVersion</key>
\t<string>$(CURRENT_PROJECT_VERSION)</string>
\t<key>WKApplication</key>
\t<true/>
\t<key>WKCompanionAppBundleIdentifier</key>
\t<string>${companionBundleId}</string>
\t<key>WKRunsIndependentlyOfCompanionApp</key>
\t<true/>
</dict>
</plist>
`;
}

/**
 * Le catalogue d'icônes de l'app de montre : une seule image de 1024 points,
 * la forme que watchOS attend depuis Xcode 14. Sans catalogue d'icônes,
 * l'archive est refusée à la validation, et rien avant ne le signale.
 */
export function watchAppIconContents(filename) {
  return `${JSON.stringify(
    {
      images: [{ filename, idiom: "universal", platform: "watchos", size: "1024x1024" }],
      info: { author: "xcode", version: 1 },
    },
    null,
    2,
  )}\n`;
}

/** Les réglages de build d'une configuration de l'app de montre. */
function watchBuildSettings({ configuration, bundleId, teamId, marketingVersion, buildNumber, signing }) {
  const settings = [
    ["ASSETCATALOG_COMPILER_APPICON_NAME", "AppIcon"],
    ...(signing.manual
      ? [
          ["CODE_SIGN_STYLE", "Manual"],
          ["CODE_SIGN_IDENTITY", `"${signing.identity}"`],
          ["PROVISIONING_PROFILE_SPECIFIER", `"${signing.profile}"`],
        ]
      : [["CODE_SIGN_STYLE", "Automatic"]]),
    ["CURRENT_PROJECT_VERSION", buildNumber],
    ...(teamId ? [["DEVELOPMENT_TEAM", teamId]] : []),
    // L'Info.plist est écrit à la main (WKApplication), Xcode ne doit pas en
    // synthétiser un par-dessus.
    ["GENERATE_INFOPLIST_FILE", "NO"],
    ["INFOPLIST_FILE", `${WATCH_TARGET}/Info.plist`],
    ["LD_RUNPATH_SEARCH_PATHS", '(\n\t\t\t\t\t"$(inherited)",\n\t\t\t\t\t"@executable_path/Frameworks",\n\t\t\t\t)'],
    ["MARKETING_VERSION", marketingVersion],
    ["PRODUCT_BUNDLE_IDENTIFIER", bundleId],
    ["PRODUCT_NAME", '"$(TARGET_NAME)"'],
    // Le SDK de la montre, et lui seul : sans SDKROOT, la cible se compilerait
    // pour iOS et l'archive embarquerait un binaire que la montre ne lit pas.
    ["SDKROOT", "watchos"],
    ["SKIP_INSTALL", "YES"],
    ["SUPPORTED_PLATFORMS", '"watchsimulator watchos"'],
    ...(configuration === "Debug" ? [["SWIFT_ACTIVE_COMPILATION_CONDITIONS", "DEBUG"]] : []),
    ["SWIFT_VERSION", "5.0"],
    // 4 = Apple Watch.
    ["TARGETED_DEVICE_FAMILY", "4"],
    ["WATCHOS_DEPLOYMENT_TARGET", WATCHOS_DEPLOYMENT_TARGET],
  ];
  return settings.map(([key, value]) => `\t\t\t\t${key} = ${value};`).join("\n");
}

/**
 * Fabrique la cible « PjWatch » et la fait embarquer par l'app iPhone.
 * Idempotent : un pbxproj qui la porte déjà est rendu tel quel.
 *
 * `signing` vaut `{ manual: false }` en local (Xcode signe) ou
 * `{ manual: true, identity, profile }` en CI, où l'app de montre a son propre
 * profil : elle a son propre App ID.
 */
export function addWatchApp(pbxproj, options) {
  if (pbxproj.includes(`${WATCH_TARGET}.app`)) return pbxproj;

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

  // --- La cible App : elle dépend de la montre et l'embarque --------------
  // Patché en premier, sur le bloc extrait : la cible de la montre aura les
  // mêmes ancres (`dependencies = (`), qui deviendraient ambiguës après coup.
  const appTarget = new RegExp(
    `(\\t\\t${appTargetId} \\/\\* App \\*\\/ = \\{\\n\\t\\t\\tisa = PBXNativeTarget;[\\s\\S]*?\\n\\t\\t\\};\\n)`,
  );
  const appTargetBlock = capture(out, appTarget, "le bloc de la cible App");
  let patchedAppTarget = appTargetBlock.replace(
    /(buildPhases = \([\s\S]*?)(\t\t\t\);)/,
    `$1\t\t\t\t${ids.embed} /* Embed Watch Content */,\n$2`,
  );
  patchedAppTarget = patchedAppTarget.replace(
    /(dependencies = \(\n)/,
    `$1\t\t\t\t${ids.dependency} /* PBXTargetDependency */,\n`,
  );
  if (patchedAppTarget === appTargetBlock) {
    throw new Error("buildPhases/dependencies de la cible App introuvables");
  }
  out = out.replace(appTargetBlock, () => patchedAppTarget);

  // --- Fichiers : sources, ressources, produit ----------------------------
  const buildFiles = [
    `\t\t${ids.appBuild} /* ${WATCH_TARGET}.app in Embed Watch Content */ = {isa = PBXBuildFile; fileRef = ${ids.appRef} /* ${WATCH_TARGET}.app */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };\n`,
    ...WATCH_SOURCES.map(
      (name) =>
        `\t\t${ids.sourceBuild(name)} /* ${name} in Sources */ = {isa = PBXBuildFile; fileRef = ${ids.sourceRef(name)} /* ${name} */; };\n`,
    ),
    ...WATCH_RESOURCES.map(
      (name) =>
        `\t\t${ids.resourceBuild(name)} /* ${name} in Resources */ = {isa = PBXBuildFile; fileRef = ${ids.resourceRef(name)} /* ${name} */; };\n`,
    ),
  ].join("");
  out = insertBefore(out, "/* End PBXBuildFile section */", buildFiles, "PBXBuildFile de la montre");

  const fileTypes = { "Assets.xcassets": "folder.assetcatalog", "tehilim.json": "text.json" };
  const fileRefs = [
    `\t\t${ids.appRef} /* ${WATCH_TARGET}.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = ${WATCH_TARGET}.app; sourceTree = BUILT_PRODUCTS_DIR; };\n`,
    ...WATCH_SOURCES.map(
      (name) =>
        `\t\t${ids.sourceRef(name)} /* ${name} */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${name}; sourceTree = "<group>"; };\n`,
    ),
    ...WATCH_RESOURCES.map(
      (name) =>
        `\t\t${ids.resourceRef(name)} /* ${name} */ = {isa = PBXFileReference; lastKnownFileType = ${fileTypes[name]}; path = ${name}; sourceTree = "<group>"; };\n`,
    ),
    `\t\t${ids.infoRef} /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };\n`,
  ].join("");
  out = insertBefore(out, "/* End PBXFileReference section */", fileRefs, "PBXFileReference de la montre");

  // --- Phases de la cible ------------------------------------------------
  out = insertBefore(
    out,
    "/* End PBXFrameworksBuildPhase section */",
    `\t\t${ids.frameworks} /* Frameworks */ = {\n\t\t\tisa = PBXFrameworksBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n`,
    "phase Frameworks de la montre",
  );
  out = insertBefore(
    out,
    "/* End PBXResourcesBuildPhase section */",
    `\t\t${ids.resources} /* Resources */ = {\n\t\t\tisa = PBXResourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n` +
      WATCH_RESOURCES.map(
        (name) => `\t\t\t\t${ids.resourceBuild(name)} /* ${name} in Resources */,\n`,
      ).join("") +
      `\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n`,
    "phase Resources de la montre",
  );
  out = insertBefore(
    out,
    "/* End PBXSourcesBuildPhase section */",
    `\t\t${ids.sources} /* Sources */ = {\n\t\t\tisa = PBXSourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n` +
      WATCH_SOURCES.map((name) => `\t\t\t\t${ids.sourceBuild(name)} /* ${name} in Sources */,\n`).join("") +
      `\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n`,
    "phase Sources de la montre",
  );

  // --- Groupe, cible, configurations -------------------------------------
  out = insertBefore(
    out,
    "/* End PBXGroup section */",
    `\t\t${ids.group} /* ${WATCH_TARGET} */ = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n` +
      WATCH_SOURCES.map((name) => `\t\t\t\t${ids.sourceRef(name)} /* ${name} */,\n`).join("") +
      WATCH_RESOURCES.map((name) => `\t\t\t\t${ids.resourceRef(name)} /* ${name} */,\n`).join("") +
      `\t\t\t\t${ids.infoRef} /* Info.plist */,\n` +
      `\t\t\t);\n\t\t\tpath = ${WATCH_TARGET};\n\t\t\tsourceTree = "<group>";\n\t\t};\n`,
    "groupe de la montre",
  );
  out = insertBefore(
    out,
    "/* End PBXNativeTarget section */",
    `\t\t${ids.target} /* ${WATCH_TARGET} */ = {\n` +
      `\t\t\tisa = PBXNativeTarget;\n` +
      `\t\t\tbuildConfigurationList = ${ids.configList} /* Build configuration list for PBXNativeTarget "${WATCH_TARGET}" */;\n` +
      `\t\t\tbuildPhases = (\n\t\t\t\t${ids.sources} /* Sources */,\n\t\t\t\t${ids.frameworks} /* Frameworks */,\n\t\t\t\t${ids.resources} /* Resources */,\n\t\t\t);\n` +
      `\t\t\tbuildRules = (\n\t\t\t);\n` +
      `\t\t\tdependencies = (\n\t\t\t);\n` +
      `\t\t\tname = ${WATCH_TARGET};\n` +
      `\t\t\tproductName = ${WATCH_TARGET};\n` +
      `\t\t\tproductReference = ${ids.appRef} /* ${WATCH_TARGET}.app */;\n` +
      `\t\t\tproductType = "com.apple.product-type.application";\n\t\t};\n`,
    "cible de la montre",
  );
  for (const configuration of ["Debug", "Release"]) {
    const configId = configuration === "Debug" ? ids.debug : ids.release;
    out = insertBefore(
      out,
      "/* End XCBuildConfiguration section */",
      `\t\t${configId} /* ${configuration} */ = {\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = {\n` +
        `${watchBuildSettings({ configuration, bundleId, teamId, marketingVersion, buildNumber, signing })}\n` +
        `\t\t\t};\n\t\t\tname = ${configuration};\n\t\t};\n`,
      `configuration ${configuration} de la montre`,
    );
  }
  out = insertBefore(
    out,
    "/* End XCConfigurationList section */",
    `\t\t${ids.configList} /* Build configuration list for PBXNativeTarget "${WATCH_TARGET}" */ = {\n` +
      `\t\t\tisa = XCConfigurationList;\n\t\t\tbuildConfigurations = (\n` +
      `\t\t\t\t${ids.debug} /* Debug */,\n\t\t\t\t${ids.release} /* Release */,\n\t\t\t);\n` +
      `\t\t\tdefaultConfigurationIsVisible = 0;\n\t\t\tdefaultConfigurationName = Release;\n\t\t};\n`,
    "liste de configurations de la montre",
  );

  // --- Sections que le template n'a pas forcément ------------------------
  // dstSubfolderSpec 16 = le dossier du produit, et dstPath le mène dans
  // App.app/Watch/ : c'est là, et nulle part ailleurs, qu'iOS va chercher
  // l'app de montre à installer sur le poignet.
  out = insertIntoSection(
    out,
    "PBXContainerItemProxy",
    `\t\t${ids.proxy} /* PBXContainerItemProxy */ = {\n\t\t\tisa = PBXContainerItemProxy;\n` +
      `\t\t\tcontainerPortal = ${projectId} /* Project object */;\n\t\t\tproxyType = 1;\n` +
      `\t\t\tremoteGlobalIDString = ${ids.target};\n\t\t\tremoteInfo = ${WATCH_TARGET};\n\t\t};\n`,
    "/* Begin PBXFileReference section */",
  );
  out = insertIntoSection(
    out,
    "PBXCopyFilesBuildPhase",
    `\t\t${ids.embed} /* Embed Watch Content */ = {\n\t\t\tisa = PBXCopyFilesBuildPhase;\n` +
      `\t\t\tbuildActionMask = 2147483647;\n\t\t\tdstPath = "$(CONTENTS_FOLDER_PATH)/Watch";\n\t\t\tdstSubfolderSpec = 16;\n` +
      `\t\t\tfiles = (\n\t\t\t\t${ids.appBuild} /* ${WATCH_TARGET}.app in Embed Watch Content */,\n\t\t\t);\n` +
      `\t\t\tname = "Embed Watch Content";\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n`,
    "/* Begin PBXFileReference section */",
  );
  out = insertIntoSection(
    out,
    "PBXTargetDependency",
    `\t\t${ids.dependency} /* PBXTargetDependency */ = {\n\t\t\tisa = PBXTargetDependency;\n` +
      `\t\t\ttarget = ${ids.target} /* ${WATCH_TARGET} */;\n` +
      `\t\t\ttargetProxy = ${ids.proxy} /* PBXContainerItemProxy */;\n\t\t};\n`,
    "/* Begin PBXFileReference section */",
  );

  // --- Rattachements : groupe racine, Products, projet --------------------
  const mainGroup = new RegExp(`(${mainGroupId} = \\{\\n\\t\\t\\tisa = PBXGroup;\\n\\t\\t\\tchildren = \\(\\n)`);
  if (!mainGroup.test(out)) throw new Error("enfants du groupe racine introuvables");
  out = out.replace(mainGroup, `$1\t\t\t\t${ids.group} /* ${WATCH_TARGET} */,\n`);

  const products = /(\/\* Products \*\/ = \{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = \(\n)/;
  if (!products.test(out)) throw new Error("groupe Products introuvable");
  out = out.replace(products, `$1\t\t\t\t${ids.appRef} /* ${WATCH_TARGET}.app */,\n`);

  const targets = /(\n\t\t\ttargets = \(\n)/;
  if (!targets.test(out)) throw new Error("liste des cibles du projet introuvable");
  out = out.replace(targets, `$1\t\t\t\t${ids.target} /* ${WATCH_TARGET} */,\n`);

  const attributes = /(TargetAttributes = \{\n)/;
  if (!attributes.test(out)) throw new Error("TargetAttributes du projet introuvables");
  out = out.replace(
    attributes,
    `$1\t\t\t\t\t${ids.target} = {\n\t\t\t\t\t\tCreatedOnToolsVersion = 26.0;\n\t\t\t\t\t};\n`,
  );

  return out;
}
