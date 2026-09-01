#!/usr/bin/env node
/**
 * Réapplique les ajustements natifs iOS après un `npx cap add ios`
 * (le dossier ios/ est git-ignoré, ce script rend le scaffold reproductible
 * pendant iOS de scripts/setup-android.mjs).
 *
 * - Info.plist : nom affiché, langues, description d'usage de la position,
 *   background mode « remote-notification », déclaration de chiffrement
 *   (ITSAppUsesNonExemptEncryption) et schéma d'URL Google (REVERSED_CLIENT_ID)
 * - App.entitlements : Sign in with Apple + APNs (aps-environment piloté par
 *   la configuration : development en Debug, production en Release) +
 *   domaine associé, pour qu'un lien du site ouvre l'app (docs/app-links.md)
 * - PrivacyInfo.xcprivacy : manifeste de confidentialité (obligatoire depuis
 *   mai 2024 ; sans lui, l'upload déclenche les avertissements ITMS-91053)
 * - GoogleService-Info.plist : copié depuis la racine s'il s'y trouve
 * - AppDelegate.swift : hooks APNs (@capacitor-firebase/messaging),
 *   Auth.auth().canHandle(url) (@capacitor-firebase/authentication) et
 *   retour arrière par glissement depuis le bord de l'écran
 * - project.pbxproj : bundle id, équipe de signature, entitlements, versions,
 *   familles d'appareils (iPhone + iPad), et enregistrement des deux
 *   ressources ci-dessus
 * - Widgets d'écran d'accueil : le plugin dans la cible App, et la cible
 *   d'extension « PjWidgets » fabriquée de toutes pièces dans le pbxproj
 *   (sources de native/ios/, voir docs/app-widgets.md)
 * - Apple Watch : le plugin dans la cible App, et la cible d'application
 *   « PjWatch » fabriquée de la même façon, avec son icône et les Tehilim
 *   embarqués (sources de native/watchos/, voir docs/app-watch.md)
 * - Icônes / splash générés depuis assets/logo.png
 *
 * Usage : node scripts/setup-ios.mjs
 *
 * Variables d'environnement (toutes optionnelles) :
 *   IOS_DEVELOPMENT_TEAM   Team ID Apple (10 caractères, ex. AB12CD34EF).
 *                          Requis pour signer, en local Xcode peut le poser
 *                          lui-même, en CI il doit être fourni.
 *   IOS_MARKETING_VERSION  CFBundleShortVersionString (ex. 3.6.4)
 *   IOS_BUILD_NUMBER       CFBundleVersion (entier strictement croissant)
 *   IOS_WIDGET_PROVISIONING_PROFILE  profil de l'extension de widgets, en
 *                          signature manuelle seulement (CI) : un appex a son
 *                          propre App ID, donc son propre profil.
 *   IOS_WATCH_PROVISIONING_PROFILE   profil de l'app de montre, pour la même
 *                          raison : elle a elle aussi son propre App ID.
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { APP_LINK_DOMAIN } from "./lib/app-links.mjs";
import {
  addAppSource,
  addWidgetExtension,
  APP_GROUP,
  widgetEntitlements,
  registerViewController,
  widgetInfoPlist,
  WIDGET_TARGET,
} from "./lib/xcode-widgets.mjs";
import {
  addWatchApp,
  watchAppIconContents,
  watchInfoPlist,
  WATCH_BUNDLE_SUFFIX,
  WATCH_SOURCES,
  WATCH_TARGET,
} from "./lib/xcode-watch.mjs";
import { buildTehilimAsset, TEHILIM_ASSET } from "./lib/watch-tehilim.mjs";

const root = join(import.meta.dirname, "..");
const iosDir = join(root, "ios");
const appDir = join(iosDir, "App/App");
const pbxprojPath = join(iosDir, "App/App.xcodeproj/project.pbxproj");

if (!existsSync(pbxprojPath)) {
  console.error("setup-ios: projet ios/ absent, lancer `npx cap add ios` d'abord (macOS + Xcode 26).");
  process.exit(1);
}

const BUNDLE_ID = "fr.petitejerusalem.app";
const DISPLAY_NAME = "Petite Jérusalem";
/** Widgets d'écran d'accueil : l'App ID de la cible d'extension. */
const WIDGET_BUNDLE_ID = `${BUNDLE_ID}.${WIDGET_TARGET}`;
/** Apple Watch : l'App ID de l'app de montre (suffixe imposé par Apple). */
const WATCH_BUNDLE_ID = `${BUNDLE_ID}.${WATCH_BUNDLE_SUFFIX}`;
const TEAM_ID = process.env.IOS_DEVELOPMENT_TEAM?.trim();
const MARKETING_VERSION = process.env.IOS_MARKETING_VERSION?.trim();
const BUILD_NUMBER = process.env.IOS_BUILD_NUMBER?.trim();
// Signature manuelle : uniquement en CI, où scripts/ios-signing.mjs a posé un
// profil « App Store » et son identité (cf. l'en-tête de ce script pour le
// pourquoi). En local, Xcode continue de gérer la signature tout seul.
const PROVISIONING_PROFILE = process.env.IOS_PROVISIONING_PROFILE?.trim();
const WIDGET_PROVISIONING_PROFILE = process.env.IOS_WIDGET_PROVISIONING_PROFILE?.trim();
const WATCH_PROVISIONING_PROFILE = process.env.IOS_WATCH_PROVISIONING_PROFILE?.trim();
const CODE_SIGN_IDENTITY = process.env.IOS_CODE_SIGN_IDENTITY?.trim();
const MANUAL_SIGNING = Boolean(PROVISIONING_PROFILE && CODE_SIGN_IDENTITY);
for (const [name, value] of [
  // Chacun des deux paquets embarqués a son propre App ID, donc son propre
  // profil : sans lui l'archive échouerait bien plus loin, sur un message de
  // signature.
  ["IOS_WIDGET_PROVISIONING_PROFILE", WIDGET_PROVISIONING_PROFILE],
  ["IOS_WATCH_PROVISIONING_PROFILE", WATCH_PROVISIONING_PROFILE],
]) {
  if (!MANUAL_SIGNING || value) continue;
  console.error(
    `setup-ios: signature manuelle sans ${name}.\n` +
      "  scripts/ios-signing.mjs --setup l'expose ; le lancer avant ce script.",
  );
  process.exit(1);
}

/** Identifiant pbxproj (24 hexa majuscules) stable pour un même nom de fichier. */
const stableId = (seed) => createHash("md5").update(seed).digest("hex").slice(0, 24).toUpperCase();

/** Applique un remplacement en échouant bruyamment si l'ancre a disparu. */
function mustReplace(text, pattern, replacement, what) {
  const next = text.replace(pattern, replacement);
  if (next === text) {
    console.error(
      `setup-ios: impossible d'appliquer « ${what} », le template Xcode de Capacitor a changé.\n` +
        "  Comparer avec node_modules/@capacitor/cli/assets/ios-spm-template.tar.gz et mettre ce script à jour.",
    );
    process.exit(1);
  }
  return next;
}

// ---------------------------------------------------------------------------
// 1. GoogleService-Info.plist (config Firebase, auth native + push)
// ---------------------------------------------------------------------------
const gsDest = join(appDir, "GoogleService-Info.plist");
const gsSource = join(root, "GoogleService-Info.plist");
if (!existsSync(gsDest) && existsSync(gsSource)) {
  copyFileSync(gsSource, gsDest);
  console.log("setup-ios: GoogleService-Info.plist copié dans ios/App/App/");
}
if (!existsSync(gsDest)) {
  console.warn(
    "setup-ios: ⚠️ GoogleService-Info.plist introuvable, l'auth native Google/Apple et le push ne fonctionneront pas.\n" +
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
      "setup-ios: ⚠️ REVERSED_CLIENT_ID absent de GoogleService-Info.plist, la connexion Google native échouera.",
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
  console.log(`setup-ios: Info.plist, ${label} ajouté`);
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
const LOCATION_PURPOSE =
  "Votre position sert à calculer les horaires du jour (zmanim) sur votre appareil. Elle n’est envoyée nulle part.";
addEntry(
  "NSLocationWhenInUseUsageDescription",
  `\t<string>${LOCATION_PURPOSE}</string>`,
  "NSLocationWhenInUseUsageDescription",
);

// L'app ne demande QUE l'autorisation « quand l'app est utilisée », mais
// @capacitor/geolocation s'appuie sur ion-ios-geolocation, dont le code
// référence l'API « always », il n'en faut pas plus pour qu'Apple exige la
// chaîne correspondante (ITMS-90683 sur le build 3.7.0 : « Missing purpose
// string in Info.plist »). L'invite ne sera jamais montrée à l'utilisateur,
// d'où le même texte que ci-dessus, comme le recommande le plugin.
addEntry(
  "NSLocationAlwaysAndWhenInUseUsageDescription",
  `\t<string>${LOCATION_PURPOSE}</string>`,
  "NSLocationAlwaysAndWhenInUseUsageDescription",
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
// des deux, le second passage étant simplement ignoré.
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
// 3. App.entitlements, Sign in with Apple + APNs + domaine associé
// ---------------------------------------------------------------------------
// Apple **impose** « Sign in with Apple » dès qu'un autre login tiers est
// proposé (règle App Store 4.8, ici Google), voir docs/app-native.md.
//
// Les entitlements doivent correspondre EXACTEMENT au profil qui signe, sinon
// l'archive échoue (« doesn't match the entitlements file ») :
//
// - En local (signature automatique), Xcode archive avec un profil de
//   développement : aps-environment = development, et c'est
//   `xcodebuild -exportArchive` qui bascule l'entitlement en production en
//   re-signant.
// - En CI (signature manuelle, scripts/ios-signing.mjs), l'archive est
//   directement signée avec un profil « App Store » : aps-environment vaut
//   production.
//
// L'App Group des widgets, lui, est là dans les deux cas : c'est le seul
// espace que l'app et son extension partagent. L'API App Store Connect ne sait
// ni créer un groupe ni l'attacher à un App ID, c'est donc une manipulation à
// faire une fois dans le portail Apple (docs/app-widgets.md) ; en CI,
// scripts/ios-signing.mjs vérifie que le profil le porte avant l'archive.
//
// Le domaine associé (`applinks:`) suit la même règle : la capacité Associated
// Domains doit être active sur l'App ID, sinon l'archive est refusée. En CI,
// scripts/ios-signing.mjs l'active avant de créer le profil ; en local, Xcode
// s'en charge à la première archive. iOS confronte ensuite ce domaine au
// fichier /.well-known/apple-app-site-association servi par le site (écrit par
// scripts/well-known.mjs) : c'est lui qui dit quels chemins ouvrent l'app.
const entitlementsPath = join(appDir, "App.entitlements");
if (existsSync(entitlementsPath)) {
  // Fichier d'un ios/ plus ancien, d'avant les widgets : sans l'App Group,
  // l'extension ne lirait aucun payload. Ajout à part, la création ci-dessous
  // ne repassant jamais sur un fichier existant.
  const existing = readFileSync(entitlementsPath, "utf8");
  if (!existing.includes(APP_GROUP)) {
    writeFileSync(
      entitlementsPath,
      mustReplace(
        existing,
        /<\/dict>\s*<\/plist>\s*$/,
        `\t<key>com.apple.security.application-groups</key>\n\t<array>\n\t\t<string>${APP_GROUP}</string>\n\t</array>\n</dict>\n</plist>\n`,
        "App.entitlements : ajout de l'App Group",
      ),
    );
    console.log("setup-ios: App Group ajouté à App.entitlements");
  }
} else {
  writeFileSync(
    entitlementsPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>aps-environment</key>
\t<string>${MANUAL_SIGNING ? "production" : "development"}</string>
\t<key>com.apple.developer.applesignin</key>
\t<array>
\t\t<string>Default</string>
\t</array>
\t<key>com.apple.developer.associated-domains</key>
\t<array>
\t\t<string>applinks:${APP_LINK_DOMAIN}</string>
\t</array>
\t<key>com.apple.security.application-groups</key>
\t<array>
\t\t<string>${APP_GROUP}</string>
\t</array>
</dict>
</plist>
`,
  );
  console.log(
    `setup-ios: App.entitlements créé (Sign in with Apple + push${MANUAL_SIGNING ? " production" : ""} + App Group + applinks:${APP_LINK_DOMAIN})`,
  );
}

// ---------------------------------------------------------------------------
// 4. PrivacyInfo.xcprivacy, manifeste de confidentialité
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
// 5. AppDelegate.swift, hooks APNs et Firebase Auth
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
  console.log("setup-ios: AppDelegate.swift, hooks APNs et Firebase Auth ajoutés");
}

// Retour arrière par glissement depuis le bord de l'écran : le geste système
// que tout iPhone propose, et que les WKWebView désactivent par défaut. Sur
// Android l'équivalent est le bouton retour, câblé dans src/main.ts, d'où un
// retour arrière qui marchait là-bas et pas ici. Capacitor n'expose aucune
// option de configuration pour ce réglage : il faut le poser sur la webview,
// qui n'existe qu'une fois la vue du contrôleur chargée, d'où l'attente de
// la notification capacitorViewDidAppear.
// (Le pendant côté web est dans src/assets/main.css : overscroll-behavior sur
// l'axe horizontal couperait le geste malgré ce réglage.)
// Bloc à part, avec sa propre garde : il doit s'appliquer aussi aux projets
// ios/ déjà passés par une version antérieure de ce script.
if (!appDelegate.includes("allowsBackForwardNavigationGestures")) {
  appDelegate = mustReplace(
    appDelegate,
    "        // (FirebaseApp.configure() est appelé par les plugins @capacitor-firebase.)\n        return true",
    "        // (FirebaseApp.configure() est appelé par les plugins @capacitor-firebase.)\n" +
      "        // Retour arrière par glissement depuis le bord de l'écran : désactivé\n" +
      "        // par défaut sur WKWebView, et sans réglage Capacitor pour l'activer.\n" +
      "        // L'observateur vit autant que l'app : rien à désenregistrer.\n" +
      "        _ = NotificationCenter.default.addObserver(forName: .capacitorViewDidAppear, object: nil, queue: .main) { [weak self] _ in\n" +
      "            let controller = self?.window?.rootViewController as? CAPBridgeViewController\n" +
      "            controller?.webView?.allowsBackForwardNavigationGestures = true\n" +
      "        }\n" +
      "        return true",
    "AppDelegate : retour arrière par glissement",
  );
  writeFileSync(appDelegatePath, appDelegate);
  console.log("setup-ios: AppDelegate.swift, retour arrière par glissement activé");
}

// ---------------------------------------------------------------------------
// 6. Widgets d'écran d'accueil : sources du plugin et de l'extension
// ---------------------------------------------------------------------------
// Le code natif des widgets est versionné dans native/ios/ (comme celui
// d'Android dans native/android/) et recopié ici, ios/ étant régénéré de zéro
// à chaque run de CI. Deux destinations :
//   - la cible App reçoit le plugin (PjWidgetsPlugin) et le contrôleur qui
//     l'enregistre (PjViewController, obligatoire depuis Capacitor 5) ;
//   - la cible d'extension reçoit les widgets SwiftUI eux-mêmes, avec son
//     Info.plist (NSExtension) et ses entitlements (l'App Group).
// L'enregistrement dans le projet Xcode se fait plus bas, dans le pbxproj.
const nativeIosDir = join(root, "native/ios");
const APP_PLUGIN_SOURCES = [
  "PjWidgetsPlugin.swift",
  "PjWatchPlugin.swift",
  "PjViewController.swift",
];
for (const name of APP_PLUGIN_SOURCES) {
  copyFileSync(join(nativeIosDir, "App", name), join(appDir, name));
}

const widgetDir = join(iosDir, "App", WIDGET_TARGET);
mkdirSync(widgetDir, { recursive: true });
copyFileSync(
  join(nativeIosDir, WIDGET_TARGET, `${WIDGET_TARGET}.swift`),
  join(widgetDir, `${WIDGET_TARGET}.swift`),
);
writeFileSync(join(widgetDir, "Info.plist"), widgetInfoPlist(DISPLAY_NAME));
writeFileSync(join(widgetDir, `${WIDGET_TARGET}.entitlements`), widgetEntitlements());
console.log(`setup-ios: sources des widgets copiées depuis native/ios/ (App + ${WIDGET_TARGET})`);

// ---------------------------------------------------------------------------
// 6 bis. Apple Watch : les sources de l'app de montre, son icône, ses Tehilim
// ---------------------------------------------------------------------------
// Même principe que les widgets : le code vit dans native/watchos/ (versionné)
// et se recopie ici. Trois choses de plus qu'une extension :
//   - un Info.plist qui dit « app de montre » (WKApplication) et la relie à
//     l'app iPhone (WKCompanionAppBundleIdentifier) ;
//   - un catalogue d'icônes : sans lui, l'App Store refuse l'archive, et rien
//     avant ne le signale ;
//   - les 150 Tehilim, embarqués plutôt qu'envoyés (docs/app-watch.md).
const watchDir = join(iosDir, "App", WATCH_TARGET);
mkdirSync(watchDir, { recursive: true });
for (const name of WATCH_SOURCES) {
  copyFileSync(join(root, "native/watchos", WATCH_TARGET, name), join(watchDir, name));
}
writeFileSync(join(watchDir, "Info.plist"), watchInfoPlist(DISPLAY_NAME, BUNDLE_ID));

// L'icône : celle de l'app (assets/logo.png fait déjà 1024 points de côté,
// la seule taille que watchOS demande depuis Xcode 14).
const appIconDir = join(watchDir, "Assets.xcassets/AppIcon.appiconset");
mkdirSync(appIconDir, { recursive: true });
copyFileSync(join(root, "assets/logo.png"), join(appIconDir, "AppIcon.png"));
writeFileSync(join(appIconDir, "Contents.json"), watchAppIconContents("AppIcon.png"));
writeFileSync(
  join(watchDir, "Assets.xcassets/Contents.json"),
  `${JSON.stringify({ info: { author: "xcode", version: 1 } }, null, 2)}\n`,
);

const tehilim = JSON.parse(readFileSync(join(root, "public/texts/tehilim.json"), "utf8"));
writeFileSync(join(watchDir, TEHILIM_ASSET), JSON.stringify(buildTehilimAsset(tehilim)));
console.log(`setup-ios: sources de la montre copiées depuis native/watchos/ (${WATCH_TARGET})`);

// Le plugin doit être enregistré à la main depuis Capacitor 5 :
// PjViewController remplace CAPBridgeViewController comme classe du view
// controller du storyboard (transformation et pourquoi du `customModule`
// dans scripts/lib/xcode-widgets.mjs).
const storyboardPath = join(appDir, "Base.lproj/Main.storyboard");
const storyboard = readFileSync(storyboardPath, "utf8");
const patched = registerViewController(storyboard);
if (patched !== storyboard) {
  writeFileSync(storyboardPath, patched);
  console.log("setup-ios: PjViewController posé dans Main.storyboard");
}

// ---------------------------------------------------------------------------
// 7. project.pbxproj
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

/**
 * Les identifiants des deux configurations de build d'une cible, via sa
 * XCConfigurationList. Repérer les configurations « qui portent un bundle id »
 * suffisait tant que le projet n'avait qu'une cible ; l'extension de widgets a
 * les siennes, et un deuxième passage du script en aurait alors trouvé quatre.
 */
function targetConfigurationIds(target) {
  const listId = pbxproj.match(
    new RegExp(
      `buildConfigurationList = ([0-9A-F]{24}) \\/\\* Build configuration list for PBXNativeTarget "${target}" \\*\\/`,
    ),
  )?.[1];
  if (!listId) return [];
  const list = pbxproj.match(new RegExp(`${listId} \\/\\*[^*]*\\*\\/ = \\{[\\s\\S]*?\\n\\t\\t\\};`))?.[0];
  return [...(list ?? "").matchAll(/([0-9A-F]{24}) \/\* (?:Debug|Release) \*\//g)].map((m) => m[1]);
}

let configsPatched = 0;
for (const configId of targetConfigurationIds("App")) {
  const block = new RegExp(
    `\\t\\t${configId} \\/\\* (?:Debug|Release) \\*\\/ = \\{\\n\\t\\t\\tisa = XCBuildConfiguration;[\\s\\S]*?\\n\\t\\t\\};`,
  );
  pbxproj = pbxproj.replace(block, (found) => {
    configsPatched++;
    let out = found;
    out = setSetting(out, "CODE_SIGN_ENTITLEMENTS", "App/App.entitlements");
    // Les réglages de signature vivent ici, dans la cible App, et jamais en
    // argument d'xcodebuild : passés en ligne de commande ils s'appliqueraient
    // AUSSI aux dizaines de paquets SPM (Firebase, GoogleUtilities…), qui les
    // rejettent (« has conflicting provisioning settings »).
    if (MANUAL_SIGNING) {
      out = setSetting(out, "CODE_SIGN_STYLE", "Manual");
      out = setSetting(out, "CODE_SIGN_IDENTITY", `"${CODE_SIGN_IDENTITY}"`);
      out = setSetting(out, "PROVISIONING_PROFILE_SPECIFIER", `"${PROVISIONING_PROFILE}"`);
    } else {
      out = setSetting(out, "CODE_SIGN_STYLE", "Automatic");
    }
    // 1,2 = iPhone + iPad (la valeur par défaut du template). L'app est le
    // site responsive : elle tourne telle quelle sur iPad, et une app
    // iPhone-seule y serait affichée dans une fenêtre à l'échelle, en moins
    // bien. Contrepartie : l'App Store exige un jeu de captures 13 pouces.
    out = setSetting(out, "TARGETED_DEVICE_FAMILY", '"1,2"');
    if (TEAM_ID) out = setSetting(out, "DEVELOPMENT_TEAM", TEAM_ID);
    if (MARKETING_VERSION) out = setSetting(out, "MARKETING_VERSION", MARKETING_VERSION);
    if (BUILD_NUMBER) out = setSetting(out, "CURRENT_PROJECT_VERSION", BUILD_NUMBER);
    return out;
  });
}

if (configsPatched !== 2) {
  console.error(
    `setup-ios: ${configsPatched} configuration(s) de build trouvée(s) au lieu de 2, le template Xcode de Capacitor a changé.`,
  );
  process.exit(1);
}

// Widgets : le plugin dans la cible App, puis la cible d'extension elle-même.
// Après le patch ci-dessus, dont les ancres (groupe App, phase Sources) sont
// les premières du fichier : la cible d'extension a les mêmes, et les ajouter
// avant la brouillerait.
try {
  for (const name of APP_PLUGIN_SOURCES) pbxproj = addAppSource(pbxproj, name);
  pbxproj = addWidgetExtension(pbxproj, {
    bundleId: WIDGET_BUNDLE_ID,
    teamId: TEAM_ID,
    marketingVersion: MARKETING_VERSION ?? "1.0",
    buildNumber: BUILD_NUMBER ?? "1",
    signing: MANUAL_SIGNING
      ? { manual: true, identity: CODE_SIGN_IDENTITY, profile: WIDGET_PROVISIONING_PROFILE }
      : { manual: false },
  });
  console.log(`setup-ios: cible d'extension ${WIDGET_TARGET} (${WIDGET_BUNDLE_ID}) enregistrée`);
  pbxproj = addWatchApp(pbxproj, {
    bundleId: WATCH_BUNDLE_ID,
    teamId: TEAM_ID,
    marketingVersion: MARKETING_VERSION ?? "1.0",
    buildNumber: BUILD_NUMBER ?? "1",
    signing: MANUAL_SIGNING
      ? { manual: true, identity: CODE_SIGN_IDENTITY, profile: WATCH_PROVISIONING_PROFILE }
      : { manual: false },
  });
  console.log(`setup-ios: cible de montre ${WATCH_TARGET} (${WATCH_BUNDLE_ID}) enregistrée`);
} catch (error) {
  console.error(
    `setup-ios: cible des widgets ou de la montre impossible à écrire, ${error.message}\n` +
      "  Le template Xcode de Capacitor a changé : comparer avec\n" +
      "  node_modules/@capacitor/cli/assets/ios-spm-template.tar.gz et mettre\n" +
      "  scripts/lib/xcode-widgets.mjs et xcode-watch.mjs à jour.",
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
    "setup-ios: ⚠️ IOS_DEVELOPMENT_TEAM non défini, Xcode demandera l'équipe de signature à la première ouverture.",
  );
}

// ---------------------------------------------------------------------------
// 8. Schéma Xcode partagé
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
    console.error("setup-ios: cible App introuvable dans le pbxproj, impossible de générer le schéma.");
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
// 9. Icônes et écran de lancement (assets/logo.png)
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
      "setup-ios: ⚠️ génération des icônes échouée, lancer à la main :\n" +
        "  npx @capacitor/assets generate --ios --assetPath assets --iconBackgroundColor '#f5eedc' --iconBackgroundColorDark '#f5eedc'",
    );
  }
}

console.log("setup-ios: terminé.");
