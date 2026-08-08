#!/usr/bin/env node
/**
 * Réapplique les ajustements natifs iOS après un `npx cap add ios`
 * (le dossier ios/ est git-ignoré, ce script rend le scaffold reproductible —
 * pendant iOS de scripts/setup-android.mjs).
 *
 * - Info.plist : nom affiché, langues, description d'usage de la position,
 *   background mode « remote-notification », déclaration de chiffrement
 *   (ITSAppUsesNonExemptEncryption) et schéma d'URL Google (REVERSED_CLIENT_ID)
 * - App.entitlements : Sign in with Apple + APNs (aps-environment piloté par
 *   la configuration : development en Debug, production en Release)
 * - PrivacyInfo.xcprivacy : manifeste de confidentialité (obligatoire depuis
 *   mai 2024 ; sans lui, l'upload déclenche les avertissements ITMS-91053)
 * - GoogleService-Info.plist : copié depuis la racine s'il s'y trouve
 * - AppDelegate.swift : hooks APNs (@capacitor-firebase/messaging) et
 *   Auth.auth().canHandle(url) (@capacitor-firebase/authentication)
 * - project.pbxproj : bundle id, équipe de signature, entitlements, versions,
 *   iPhone seulement, et enregistrement des deux ressources ci-dessus
 * - Icônes / splash générés depuis assets/logo.png
 *
 * Usage : node scripts/setup-ios.mjs
 *
 * Variables d'environnement (toutes optionnelles) :
 *   IOS_DEVELOPMENT_TEAM   Team ID Apple (10 caractères, ex. AB12CD34EF).
 *                          Requis pour signer — en local Xcode peut le poser
 *                          lui-même, en CI il doit être fourni.
 *   IOS_MARKETING_VERSION  CFBundleShortVersionString (ex. 3.6.4)
 *   IOS_BUILD_NUMBER       CFBundleVersion (entier strictement croissant)
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const iosDir = join(root, "ios");
const appDir = join(iosDir, "App/App");
const pbxprojPath = join(iosDir, "App/App.xcodeproj/project.pbxproj");

if (!existsSync(pbxprojPath)) {
  console.error("setup-ios: projet ios/ absent — lancer `npx cap add ios` d'abord (macOS + Xcode 26).");
  process.exit(1);
}

const BUNDLE_ID = "fr.petitejerusalem.app";
const DISPLAY_NAME = "Petite Jérusalem";
const TEAM_ID = process.env.IOS_DEVELOPMENT_TEAM?.trim();
const MARKETING_VERSION = process.env.IOS_MARKETING_VERSION?.trim();
const BUILD_NUMBER = process.env.IOS_BUILD_NUMBER?.trim();

/** Identifiant pbxproj (24 hexa majuscules) stable pour un même nom de fichier. */
const stableId = (seed) => createHash("md5").update(seed).digest("hex").slice(0, 24).toUpperCase();

/** Applique un remplacement en échouant bruyamment si l'ancre a disparu. */
function mustReplace(text, pattern, replacement, what) {
  const next = text.replace(pattern, replacement);
  if (next === text) {
    console.error(
      `setup-ios: impossible d'appliquer « ${what} » — le template Xcode de Capacitor a changé.\n` +
        "  Comparer avec node_modules/@capacitor/cli/assets/ios-spm-template.tar.gz et mettre ce script à jour.",
    );
    process.exit(1);
  }
  return next;
}

// ---------------------------------------------------------------------------
// 1. GoogleService-Info.plist (config Firebase — auth native + push)
// ---------------------------------------------------------------------------
const gsDest = join(appDir, "GoogleService-Info.plist");
const gsSource = join(root, "GoogleService-Info.plist");
if (!existsSync(gsDest) && existsSync(gsSource)) {
  copyFileSync(gsSource, gsDest);
  console.log("setup-ios: GoogleService-Info.plist copié dans ios/App/App/");
}
if (!existsSync(gsDest)) {
  console.warn(
    "setup-ios: ⚠️ GoogleService-Info.plist introuvable — l'auth native Google/Apple et le push ne fonctionneront pas.\n" +
      `  Console Firebase → projet → app iOS ${BUNDLE_ID} → télécharger GoogleService-Info.plist\n` +
      "  puis le placer à la racine du repo (il est git-ignoré) et relancer ce script.",
  );
}

/** REVERSED_CLIENT_ID : schéma d'URL exigé par le SDK Google Sign-In. */
let reversedClientId = null;
if (existsSync(gsDest)) {
  const match = readFileSync(gsDest, "utf8").match(
    /<key>REVERSED_CLIENT_ID<\/key>\s*<string>([^<]+)<\/string>/,
  );
  reversedClientId = match?.[1] ?? null;
  if (!reversedClientId) {
    console.warn(
      "setup-ios: ⚠️ REVERSED_CLIENT_ID absent de GoogleService-Info.plist — la connexion Google native échouera.",
    );
  }
}

// ---------------------------------------------------------------------------
// 2. Info.plist
// ---------------------------------------------------------------------------
const infoPlistPath = join(appDir, "Info.plist");
let infoPlist = readFileSync(infoPlistPath, "utf8");

/** Écrase la valeur d'une clé <string> existante, ou la crée. */
function setString(key, value) {
  const existing = new RegExp(`(<key>${key}</key>\\s*<string>)[^<]*(</string>)`);
  if (existing.test(infoPlist)) {
    infoPlist = infoPlist.replace(existing, (_m, open, close) => `${open}${value}${close}`);
  } else {
    addEntry(key, `\t<string>${value}</string>`);
  }
}

/** Ajoute une entrée si la clé est absente (idempotent). */
function addEntry(key, valueXml, label = key) {
  if (new RegExp(`<key>${key}</key>`).test(infoPlist)) return;
  infoPlist = mustReplace(
    infoPlist,
    /<\/dict>\s*<\/plist>\s*$/,
    `\t<key>${key}</key>\n${valueXml}\n</dict>\n</plist>\n`,
    `Info.plist : ajout de ${label}`,
  );
  console.log(`setup-ios: Info.plist — ${label} ajouté`);
}

setString("CFBundleDisplayName", DISPLAY_NAME);
setString("CFBundleDevelopmentRegion", "fr");

// armv7 (32 bits) n'existe plus depuis l'iPhone 5s ; arm64 est la valeur
// attendue par l'App Store pour une app moderne.
infoPlist = infoPlist.replace("<string>armv7</string>", "<string>arm64</string>");

addEntry(
  "CFBundleLocalizations",
  "\t<array>\n\t\t<string>fr</string>\n\t\t<string>en</string>\n\t\t<string>he</string>\n\t</array>",
  "langues (fr/en/he)",
);

// Sans cette clé, iOS **ferme l'app** à la première demande de position
// (page Horaires : les zmanim sont calculés localement pour la position).
addEntry(
  "NSLocationWhenInUseUsageDescription",
  "\t<string>Votre position sert à calculer les horaires du jour (zmanim) sur votre appareil. Elle n’est envoyée nulle part.</string>",
  "NSLocationWhenInUseUsageDescription",
);

// Réception des notifications push quand l'app est en arrière-plan.
addEntry(
  "UIBackgroundModes",
  "\t<array>\n\t\t<string>remote-notification</string>\n\t</array>",
  "UIBackgroundModes (remote-notification)",
);

// Évite le questionnaire « export compliance » à chaque build TestFlight :
// l'app n'utilise que le HTTPS du système (exemption standard).
addEntry(
  "ITSAppUsesNonExemptEncryption",
  "\t<false/>",
  "ITSAppUsesNonExemptEncryption (false)",
);

// Schémas d'URL. Les DEUX doivent vivre dans le même tableau : la clé
// CFBundleURLTypes est unique, et `addEntry` ne l'écrit que si elle est
// absente. Les déclarer séparément (Google ici, `petitejerusalem` à la main
// pour les widgets, cf. docs/app-widgets.md) casserait silencieusement l'un
// des deux — le second passage étant simplement ignoré.
const urlSchemes = [
  // Retour du flux Google Sign-In natif.
  ...(reversedClientId ? [reversedClientId] : []),
  // Deep-links des widgets d'écran d'accueil.
  "petitejerusalem",
];
addEntry(
  "CFBundleURLTypes",
  "\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n" +
    urlSchemes.map((scheme) => `\t\t\t\t<string>${scheme}</string>`).join("\n") +
    "\n\t\t\t</array>\n\t\t</dict>\n\t</array>",
  `schémas d'URL (${urlSchemes.join(", ")})`,
);

writeFileSync(infoPlistPath, infoPlist);

// ---------------------------------------------------------------------------
// 3. App.entitlements — Sign in with Apple + APNs
// ---------------------------------------------------------------------------
// Apple **impose** « Sign in with Apple » dès qu'un autre login tiers est
// proposé (règle App Store 4.8, ici Google) — voir docs/app-native.md.
// aps-environment reste sur « development », comme le fait Xcode quand on
// coche la capacité Push Notifications : l'archive est signée avec un profil
// de développement, et c'est `xcodebuild -exportArchive` (method
// app-store-connect) qui re-signe avec le profil de distribution et bascule
// l'entitlement en « production ». Écrire « production » ici casserait au
// contraire l'archivage (l'entitlement ne correspondrait plus au profil).
const entitlementsPath = join(appDir, "App.entitlements");
if (!existsSync(entitlementsPath)) {
  writeFileSync(
    entitlementsPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>aps-environment</key>
\t<string>development</string>
\t<key>com.apple.developer.applesignin</key>
\t<array>
\t\t<string>Default</string>
\t</array>
</dict>
</plist>
`,
  );
  console.log("setup-ios: App.entitlements créé (Sign in with Apple + push)");
}

// ---------------------------------------------------------------------------
// 4. PrivacyInfo.xcprivacy — manifeste de confidentialité
// ---------------------------------------------------------------------------
// Obligatoire depuis mai 2024. Les « required reason APIs » utilisées ici
// viennent des plugins Capacitor : UserDefaults (@capacitor/preferences,
// index des textes hors ligne) et horodatage de fichiers
// (@capacitor/filesystem, textes téléchargés).
// Les données déclarées correspondent à ce que l'app envoie réellement :
// compte Firebase (e-mail, nom, identifiant), analytics PostHog, et la
// position **arrondie** transmise pour le rappel avant la chkia.
const privacyPath = join(appDir, "PrivacyInfo.xcprivacy");
if (!existsSync(privacyPath)) {
  const collected = (type, purposes, linked = true) =>
    `\t\t<dict>
\t\t\t<key>NSPrivacyCollectedDataType</key>
\t\t\t<string>NSPrivacyCollectedDataType${type}</string>
\t\t\t<key>NSPrivacyCollectedDataTypeLinked</key>
\t\t\t<${linked}/>
\t\t\t<key>NSPrivacyCollectedDataTypeTracking</key>
\t\t\t<false/>
\t\t\t<key>NSPrivacyCollectedDataTypePurposes</key>
\t\t\t<array>
${purposes.map((p) => `\t\t\t\t<string>NSPrivacyCollectedDataTypePurpose${p}</string>`).join("\n")}
\t\t\t</array>
\t\t</dict>`;

  writeFileSync(
    privacyPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>NSPrivacyTracking</key>
\t<false/>
\t<key>NSPrivacyTrackingDomains</key>
\t<array/>
\t<key>NSPrivacyCollectedDataTypes</key>
\t<array>
${collected("EmailAddress", ["AppFunctionality"])}
${collected("Name", ["AppFunctionality"])}
${collected("UserID", ["AppFunctionality", "Analytics"])}
${collected("CoarseLocation", ["AppFunctionality"])}
${collected("ProductInteraction", ["Analytics"])}
${collected("CrashData", ["AppFunctionality"], false)}
\t</array>
\t<key>NSPrivacyAccessedAPITypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryUserDefaults</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>CA92.1</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>C617.1</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryDiskSpace</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>E174.1</string>
\t\t\t</array>
\t\t</dict>
\t</array>
</dict>
</plist>
`,
  );
  console.log("setup-ios: PrivacyInfo.xcprivacy créé");
}

// ---------------------------------------------------------------------------
// 5. AppDelegate.swift — hooks APNs et Firebase Auth
// ---------------------------------------------------------------------------
// Sans les trois méthodes APNs, @capacitor-firebase/messaging n'obtient
// jamais de token FCM ; sans Auth.auth().canHandle(url), le retour du flux
// OAuth Google est intercepté par le proxy Capacitor au lieu de Firebase.
const appDelegatePath = join(appDir, "AppDelegate.swift");
let appDelegate = readFileSync(appDelegatePath, "utf8");
if (!appDelegate.includes("capacitorDidRegisterForRemoteNotifications")) {
  appDelegate = mustReplace(
    appDelegate,
    "import Capacitor\n",
    "import Capacitor\nimport FirebaseAuth\n",
    "AppDelegate : import FirebaseAuth",
  );
  appDelegate = mustReplace(
    appDelegate,
    "        // Override point for customization after application launch.\n        return true",
    "        // Override point for customization after application launch.\n" +
      "        // (FirebaseApp.configure() est appelé par les plugins @capacitor-firebase.)\n" +
      "        return true",
    "AppDelegate : commentaire didFinishLaunching",
  );
  appDelegate = mustReplace(
    appDelegate,
    "        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)",
    "        // Retour du flux OAuth Google : c'est Firebase Auth qui doit le\n" +
      "        // traiter, pas le proxy Capacitor.\n" +
      "        if Auth.auth().canHandle(url) {\n" +
      "            return true\n" +
      "        }\n" +
      "        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)",
    "AppDelegate : Auth.auth().canHandle(url)",
  );
  appDelegate = mustReplace(
    appDelegate,
    /\n\}\s*$/,
    `
    // --- APNs (@capacitor-firebase/messaging) --------------------------------

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        NotificationCenter.default.post(name: Notification.Name.init("didReceiveRemoteNotification"), object: completionHandler, userInfo: userInfo)
    }

}
`,
    "AppDelegate : méthodes APNs",
  );
  writeFileSync(appDelegatePath, appDelegate);
  console.log("setup-ios: AppDelegate.swift — hooks APNs et Firebase Auth ajoutés");
}

// ---------------------------------------------------------------------------
// 6. project.pbxproj
// ---------------------------------------------------------------------------
let pbxproj = readFileSync(pbxprojPath, "utf8");

/** Enregistre un fichier de ios/App/App/ dans le projet Xcode (phase Resources). */
function addResource(name, fileType) {
  if (pbxproj.includes(`/* ${name} */`)) return;
  const fileRefId = stableId(`${name}#fileRef`);
  const buildFileId = stableId(`${name}#buildFile`);

  pbxproj = mustReplace(
    pbxproj,
    "/* End PBXBuildFile section */",
    `\t\t${buildFileId} /* ${name} in Resources */ = {isa = PBXBuildFile; fileRef = ${fileRefId} /* ${name} */; };\n/* End PBXBuildFile section */`,
    `pbxproj : PBXBuildFile de ${name}`,
  );
  pbxproj = mustReplace(
    pbxproj,
    "/* End PBXFileReference section */",
    `\t\t${fileRefId} /* ${name} */ = {isa = PBXFileReference; lastKnownFileType = ${fileType}; path = ${name}; sourceTree = "<group>"; };\n/* End PBXFileReference section */`,
    `pbxproj : PBXFileReference de ${name}`,
  );
  pbxproj = mustReplace(
    pbxproj,
    /(\/\* App \*\/ = \{\s*isa = PBXGroup;[\s\S]*?children = \(\n)/,
    `$1\t\t\t\t${fileRefId} /* ${name} */,\n`,
    `pbxproj : groupe App de ${name}`,
  );
  pbxproj = mustReplace(
    pbxproj,
    /(isa = PBXResourcesBuildPhase;[\s\S]*?files = \(\n)/,
    `$1\t\t\t\t${buildFileId} /* ${name} in Resources */,\n`,
    `pbxproj : phase Resources de ${name}`,
  );
  console.log(`setup-ios: ${name} enregistré dans le projet Xcode`);
}

addResource("PrivacyInfo.xcprivacy", "text.plist.xml");
if (existsSync(gsDest)) addResource("GoogleService-Info.plist", "text.plist.xml");

// Bundle id (cap add le pose depuis appId, on le rend explicite et idempotent).
pbxproj = pbxproj.replaceAll("com.getcapacitor.App", BUNDLE_ID);

/** Pose ou remplace un réglage dans un bloc buildSettings. */
function setSetting(block, key, value) {
  const existing = new RegExp(`(\\n\\t+${key} = )[^;]*(;)`);
  if (existing.test(block)) {
    return block.replace(existing, (_m, open, close) => `${open}${value}${close}`);
  }
  return block.replace(/(buildSettings = \{\n)/, (m) => `${m}\t\t\t\t${key} = ${value};\n`);
}

let configsPatched = 0;
pbxproj = pbxproj.replace(
  /isa = XCBuildConfiguration;[\s\S]*?name = (?:Debug|Release);/g,
  (block) => {
    // Les deux configurations au niveau projet n'ont pas de bundle id : on ne
    // touche qu'à celles de la cible App.
    if (!block.includes("PRODUCT_BUNDLE_IDENTIFIER")) return block;
    configsPatched++;
    let out = block;
    out = setSetting(out, "CODE_SIGN_ENTITLEMENTS", "App/App.entitlements");
    out = setSetting(out, "CODE_SIGN_STYLE", "Automatic");
    // 1,2 = iPhone + iPad (la valeur par défaut du template). L'app est le
    // site responsive : elle tourne telle quelle sur iPad, et une app
    // iPhone-seule y serait affichée dans une fenêtre à l'échelle, en moins
    // bien. Contrepartie : l'App Store exige un jeu de captures 13 pouces.
    out = setSetting(out, "TARGETED_DEVICE_FAMILY", '"1,2"');
    if (TEAM_ID) out = setSetting(out, "DEVELOPMENT_TEAM", TEAM_ID);
    if (MARKETING_VERSION) out = setSetting(out, "MARKETING_VERSION", MARKETING_VERSION);
    if (BUILD_NUMBER) out = setSetting(out, "CURRENT_PROJECT_VERSION", BUILD_NUMBER);
    return out;
  },
);

if (configsPatched !== 2) {
  console.error(
    `setup-ios: ${configsPatched} configuration(s) de build trouvée(s) au lieu de 2 — le template Xcode de Capacitor a changé.`,
  );
  process.exit(1);
}

writeFileSync(pbxprojPath, pbxproj);
console.log(
  `setup-ios: pbxproj mis à jour (bundle ${BUNDLE_ID}` +
    `${TEAM_ID ? `, équipe ${TEAM_ID}` : ""}` +
    `${MARKETING_VERSION ? `, version ${MARKETING_VERSION}` : ""}` +
    `${BUILD_NUMBER ? ` (${BUILD_NUMBER})` : ""})`,
);

if (!TEAM_ID) {
  console.warn(
    "setup-ios: ⚠️ IOS_DEVELOPMENT_TEAM non défini — Xcode demandera l'équipe de signature à la première ouverture.",
  );
}

// ---------------------------------------------------------------------------
// 7. Schéma Xcode partagé
// ---------------------------------------------------------------------------
// Le template Capacitor n'en contient aucun : Xcode en fabrique un dans
// xcuserdata à la première ouverture, mais une machine de CI qui ne fait que
// `xcodebuild archive -scheme App` n'a alors aucun schéma à utiliser. On le
// versionne donc dans le projet généré.
const schemeDir = join(iosDir, "App/App.xcodeproj/xcshareddata/xcschemes");
const schemePath = join(schemeDir, "App.xcscheme");
if (!existsSync(schemePath)) {
  const targetId = pbxproj.match(/([0-9A-F]{24}) \/\* App \*\/ = \{\s*isa = PBXNativeTarget;/)?.[1];
  if (!targetId) {
    console.error("setup-ios: cible App introuvable dans le pbxproj — impossible de générer le schéma.");
    process.exit(1);
  }
  const buildableReference = `<BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "${targetId}"
               BuildableName = "App.app"
               BlueprintName = "App"
               ReferencedContainer = "container:App.xcodeproj">
            </BuildableReference>`;
  mkdirSync(schemeDir, { recursive: true });
  writeFileSync(
    schemePath,
    `<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "2600"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            ${buildableReference}
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES">
      <Testables>
      </Testables>
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         ${buildableReference}
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         ${buildableReference}
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
`,
  );
  console.log("setup-ios: schéma Xcode partagé « App » créé");
}

// ---------------------------------------------------------------------------
// 8. Icônes et écran de lancement (assets/logo.png)
// ---------------------------------------------------------------------------
// @capacitor/assets produit les mêmes noms de fichiers que le scaffold nu
// (AppIcon-512@2x.png, splash-2732x2732*.png) : aucun fichier ne peut servir
// de marqueur, on en écrit donc un explicitement après un succès.
const iconMarker = join(appDir, "Assets.xcassets/.pj-assets-generated");
if (!existsSync(iconMarker)) {
  try {
    execSync(
      "npx @capacitor/assets generate --ios --assetPath assets --iconBackgroundColor '#f5eedc' --iconBackgroundColorDark '#f5eedc'",
      { cwd: root, stdio: "inherit" },
    );
    writeFileSync(iconMarker, "");
    console.log("setup-ios: icônes et splash générés depuis assets/logo.png");
  } catch {
    console.warn(
      "setup-ios: ⚠️ génération des icônes échouée — lancer à la main :\n" +
        "  npx @capacitor/assets generate --ios --assetPath assets --iconBackgroundColor '#f5eedc' --iconBackgroundColorDark '#f5eedc'",
    );
  }
}

console.log("setup-ios: terminé.");
