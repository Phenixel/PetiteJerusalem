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
import { execSync } from "node:child_process";
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

// 6. Icônes launcher + splash générées depuis assets/logo.png. Sans cette
//    étape, un android/ fraîchement scaffoldé garde les icônes par défaut de
//    Capacitor (ou d'anciennes icônes), différentes de la fiche Play Store.
//    Marqueur d'idempotence : le splash-dark n'existe pas dans le scaffold nu.
const generatedMarker = join(androidDir, "app/src/main/res/drawable-port-night-xxxhdpi/splash.png");
if (!existsSync(generatedMarker)) {
  try {
    execSync("npx @capacitor/assets generate --android --assetPath assets --iconBackgroundColor '#f5eedc' --iconBackgroundColorDark '#f5eedc'", {
      cwd: root,
      stdio: "inherit",
    });
    console.log("setup-android: icônes et splash générés depuis assets/logo.png");
  } catch {
    console.warn(
      "setup-android: ⚠️ génération des icônes échouée — lancer à la main :\n" +
        "  npx @capacitor/assets generate --android --assetPath assets --iconBackgroundColor '#f5eedc' --iconBackgroundColorDark '#f5eedc'",
    );
  }
}

// 7. Icône adaptative : @capacitor/assets insère la couche de fond avec un
//    inset de 16.7 %, ce qui laisse un anneau autour de l'icône sur le
//    launcher. On remplace le fond par une couleur pleine (le beige du logo),
//    seule la couche avant garde son inset.
const launcherBgColor = join(androidDir, "app/src/main/res/values/ic_launcher_background.xml");
const anydpiDir = join(androidDir, "app/src/main/res/mipmap-anydpi-v26");
if (existsSync(anydpiDir)) {
  writeFileSync(
    launcherBgColor,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#F5EEDC</color>\n</resources>`,
  );
  for (const name of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
    const iconXmlPath = join(anydpiDir, name);
    if (!existsSync(iconXmlPath)) continue;
    const iconXml = readFileSync(iconXmlPath, "utf8");
    const patched = iconXml.replace(
      /<background>[\s\S]*?<\/background>/,
      `<background android:drawable="@color/ic_launcher_background" />`,
    );
    if (patched !== iconXml) {
      writeFileSync(iconXmlPath, patched);
      console.log(`setup-android: fond plein appliqué à ${name}`);
    }
  }
}

// 8. Barre système aux couleurs de l'app (statusBarColor est ignoré par les
//    API récentes ; c'est le windowBackground qui colore la bande sous la
//    barre d'état en edge-to-edge). Valeurs synchronisées avec
//    src/assets/main.css (--color-bg-beige et le fond sombre du body) et
//    src/composables/useNativeStatusBar.ts.
const stylesPath = join(androidDir, "app/src/main/res/values/styles.xml");
const styles = readFileSync(stylesPath, "utf8");
const noActionBarMarker =
  '<style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">';
if (styles.includes(noActionBarMarker) && !styles.includes("android:windowBackground")) {
  writeFileSync(
    stylesPath,
    styles.replace(
      noActionBarMarker,
      `${noActionBarMarker}
        <item name="android:statusBarColor">#F4F1EA</item>
        <item name="android:windowLightStatusBar">true</item>
        <item name="android:navigationBarColor">#FFFFFF</item>
        <item name="android:windowLightNavigationBar">true</item>
        <item name="android:windowBackground">#F4F1EA</item>`,
    ),
  );
  console.log("setup-android: couleurs de barre système ajoutées à styles.xml");
}
const nightDir = join(androidDir, "app/src/main/res/values-night");
const nightStyles = join(nightDir, "styles.xml");
if (!existsSync(nightStyles)) {
  const { mkdirSync } = await import("node:fs");
  mkdirSync(nightDir, { recursive: true });
  writeFileSync(
    nightStyles,
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Mode sombre : la barre système suit le fond sombre de l'app (main.css). -->
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:statusBarColor">#111827</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:navigationBarColor">#1F2937</item>
        <item name="android:windowLightNavigationBar">false</item>
        <item name="android:windowBackground">#111827</item>
    </style>
</resources>
`,
  );
  console.log("setup-android: values-night/styles.xml créé (barre système sombre)");
}

// 9. Overscroll : l'effet d'étirement d'Android déforme toute la WebView
//    (bottom bar comprise). Le CSS overscroll-behavior ne suffit pas, il faut
//    le désactiver sur la vue native.
const mainActivityPath = join(
  androidDir,
  "app/src/main/java/fr/petitejerusalem/app/MainActivity.java",
);
if (existsSync(mainActivityPath)) {
  const mainActivity = readFileSync(mainActivityPath, "utf8");
  if (!mainActivity.includes("setOverScrollMode")) {
    writeFileSync(
      mainActivityPath,
      `package fr.petitejerusalem.app;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // L'étirement d'overscroll d'Android (stretch) déforme toute la
        // WebView, bottom bar comprise ; le CSS overscroll-behavior ne le
        // désactive pas, seul le mode natif de la vue le fait.
        this.bridge.getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
    }
}
`,
    );
    console.log("setup-android: overscroll désactivé dans MainActivity");
  }
}

console.log("setup-android: terminé.");
