#!/usr/bin/env node
/**
 * Réapplique les ajustements natifs Android après un `npx cap add android`
 * (le dossier android/ est git-ignoré, ce script rend le scaffold reproductible).
 *
 * - android/local.properties : chemin du SDK Android
 * - AndroidManifest.xml : permission POST_NOTIFICATIONS (rappel de lecture, Android 13+)
 * - android/app/google-services.json : copié depuis la racine s'il s'y trouve
 *   (fichier téléchargé depuis la console Firebase, git-ignoré)
 * - android/app/build.gradle : signingConfigs.release (lit android/keystore.properties,
 *   git-ignoré ; fallback signature debug si absent) + versionName aligné sur le tag git
 *
 * Usage : node scripts/setup-android.mjs
 * Icônes/splash : npx @capacitor/assets generate --android (logo dans assets/logo.png)
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const androidDir = join(root, "android");

if (!existsSync(androidDir)) {
  console.error("setup-android: dossier android/ absent — lancer `npx cap add android` d'abord.");
  process.exit(1);
}

// 1. local.properties (SDK)
const localProps = join(androidDir, "local.properties");
if (!existsSync(localProps)) {
  const sdkDir = process.env.ANDROID_HOME ?? join(homedir(), "Library/Android/sdk");
  writeFileSync(localProps, `sdk.dir=${sdkDir}\n`);
  console.log(`setup-android: local.properties créé (sdk.dir=${sdkDir})`);
}

// 2. Permission POST_NOTIFICATIONS
const manifestPath = join(androidDir, "app/src/main/AndroidManifest.xml");
const manifest = readFileSync(manifestPath, "utf8");
if (!manifest.includes("android.permission.POST_NOTIFICATIONS")) {
  writeFileSync(
    manifestPath,
    manifest.replace(
      /(<uses-permission android:name="android\.permission\.INTERNET"\s*\/>)/,
      `$1\n    <!-- Rappel de lecture quotidien (Android 13+ exige la permission explicite) -->\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />`,
    ),
  );
  console.log("setup-android: permission POST_NOTIFICATIONS ajoutée au manifest");
}

// 3. google-services.json (config Firebase — requis pour auth native + push)
const gsSource = join(root, "google-services.json");
const gsDest = join(androidDir, "app/google-services.json");
if (existsSync(gsSource) && !existsSync(gsDest)) {
  copyFileSync(gsSource, gsDest);
  console.log("setup-android: google-services.json copié dans android/app/");
} else if (!existsSync(gsDest)) {
  console.warn(
    "setup-android: ⚠️ google-services.json introuvable — l'auth native Google et le push ne fonctionneront pas.\n" +
      "  Console Firebase → projet → app Android fr.petitejerusalem.app → télécharger google-services.json\n" +
      "  puis le placer à la racine du repo ou dans android/app/.",
  );
}

// 4. Signature release (signingConfigs.release lisant keystore.properties,
//    fallback debug si absent) + versionName aligné sur le tag git
const appBuildGradlePath = join(androidDir, "app/build.gradle");
const appBuildGradle = readFileSync(appBuildGradlePath, "utf8");
if (!appBuildGradle.includes("keystorePropertiesFile")) {
  const patched = appBuildGradle
    .replace(
      "apply plugin: 'com.android.application'\n",
      `apply plugin: 'com.android.application'

// Clé de signature release (android/keystore.properties, git-ignoré — voir
// docs/android-release-plan.md étape 1). Absente sur les autres machines/CI :
// le build de release retombe alors sur la signature debug pour ne pas casser
// \`./gradlew bundleRelease\`/\`assembleRelease\` ailleurs que sur la machine qui
// publie réellement sur le Play Store.
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
`,
    )
    .replace('versionName "1.0"', 'versionName "3.0.0"')
    .replace(
      /(\s*)(buildTypes \{\s*\n\s*release \{\s*\n)/,
      `$1signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
$1$2            signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug
`,
    );
  writeFileSync(appBuildGradlePath, patched);
  console.log("setup-android: signingConfigs.release + versionName ajoutés à build.gradle");
}

// 5. Modèle de keystore.properties (le vrai fichier reste git-ignoré et doit
//    être rempli à la main avec les valeurs du keystore réel)
const keystorePropertiesExample = join(androidDir, "keystore.properties.example");
if (!existsSync(keystorePropertiesExample)) {
  writeFileSync(
    keystorePropertiesExample,
    `storeFile=/Users/phenixel/petite-jerusalem-release.keystore\nstorePassword=***\nkeyAlias=petite-jerusalem\nkeyPassword=***\n`,
  );
  console.log("setup-android: keystore.properties.example créé (à copier en keystore.properties et remplir)");
}

console.log("setup-android: terminé.");
