#!/usr/bin/env node
/**
 * Réapplique les ajustements natifs Android après un `npx cap add android`
 * (le dossier android/ est git-ignoré, ce script rend le scaffold reproductible).
 *
 * - android/local.properties : chemin du SDK Android
 * - AndroidManifest.xml : permissions POST_NOTIFICATIONS (rappel de lecture,
 *   Android 13+) et ACCESS_COARSE/FINE_LOCATION (horaires calculés pour la
 *   position de l'appareil, le plugin @capacitor/geolocation livre un
 *   manifest vide, l'app doit donc les déclarer elle-même)
 * - android/app/google-services.json : copié depuis la racine s'il s'y trouve
 *   (fichier téléchargé depuis la console Firebase, git-ignoré)
 * - android/app/build.gradle : signingConfigs.release (lit android/keystore.properties,
 *   git-ignoré ; fallback signature debug si absent) + versionName aligné sur le tag git
 * - Widgets d'écran d'accueil : copie native/android/ (providers Java, layouts)
 *   et déclare les receivers dans le manifest (voir docs/app-widgets.md)
 * - App Links : intent-filter vérifié sur le domaine, un lien du site ouvre
 *   l'app quand elle est installée (voir docs/app-links.md)
 *
 * Usage : node scripts/setup-android.mjs
 * Icônes/splash : npx @capacitor/assets generate --android (logo dans assets/logo.png)
 */
import { execSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { buildAndroidIntentFilter, APP_LINK_DOMAIN } from "./lib/app-links.mjs";

const root = join(import.meta.dirname, "..");
const androidDir = join(root, "android");

if (!existsSync(androidDir)) {
  console.error("setup-android: dossier android/ absent, lancer `npx cap add android` d'abord.");
  process.exit(1);
}

// 1. local.properties (SDK)
const localProps = join(androidDir, "local.properties");
if (!existsSync(localProps)) {
  const sdkDir = process.env.ANDROID_HOME ?? join(homedir(), "Library/Android/sdk");
  writeFileSync(localProps, `sdk.dir=${sdkDir}\n`);
  console.log(`setup-android: local.properties créé (sdk.dir=${sdkDir})`);
}

// 2. Permissions du manifest.
//    Le manifest d'un plugin Capacitor est fusionné dans celui de l'app, mais
//    celui de @capacitor/geolocation est vide : sans les deux lignes
//    ACCESS_*_LOCATION ci-dessous, requestPermissions() est refusé d'office et
//    la page Horaires reste bloquée sur Paris.
const manifestPath = join(androidDir, "app/src/main/AndroidManifest.xml");
let manifest = readFileSync(manifestPath, "utf8");
const PERMISSIONS = [
  {
    name: "android.permission.POST_NOTIFICATIONS",
    comment: "Rappel de lecture quotidien (Android 13+ exige la permission explicite)",
  },
  {
    name: "android.permission.ACCESS_COARSE_LOCATION",
    comment: "Horaires (zmanim) calculés pour la position de l'appareil",
  },
  { name: "android.permission.ACCESS_FINE_LOCATION" },
  {
    name: "android.permission.CAMERA",
    comment: "Miroir des téfilines (caméra frontale, rien n'est enregistré)",
  },
];
for (const { name, comment } of [...PERMISSIONS].reverse()) {
  if (manifest.includes(name)) continue;
  const line = `${comment ? `\n    <!-- ${comment} -->` : ""}\n    <uses-permission android:name="${name}" />`;
  manifest = manifest.replace(
    /(<uses-permission android:name="android\.permission\.INTERNET"\s*\/>)/,
    `$1${line}`,
  );
  console.log(`setup-android: permission ${name.split(".").pop()} ajoutée au manifest`);
}
// La caméra reste facultative : déclarer la permission suffirait à écarter du
// Play Store les appareils qui n'en ont pas, alors que tout le reste de l'app
// leur va.
const CAMERA_FEATURE =
  '<uses-feature android:name="android.hardware.camera" android:required="false" />';
if (!manifest.includes('android:name="android.hardware.camera"')) {
  manifest = manifest.replace(
    /(<uses-permission android:name="android\.permission\.INTERNET"\s*\/>)/,
    `$1\n\n    ${CAMERA_FEATURE}`,
  );
  console.log("setup-android: caméra déclarée facultative (uses-feature)");
}

writeFileSync(manifestPath, manifest);

// 3. google-services.json (config Firebase, requis pour auth native + push)
const gsSource = join(root, "google-services.json");
const gsDest = join(androidDir, "app/google-services.json");
if (existsSync(gsSource) && !existsSync(gsDest)) {
  copyFileSync(gsSource, gsDest);
  console.log("setup-android: google-services.json copié dans android/app/");
} else if (!existsSync(gsDest)) {
  console.warn(
    "setup-android: ⚠️ google-services.json introuvable, l'auth native Google et le push ne fonctionneront pas.\n" +
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

// Clé de signature release (android/keystore.properties, git-ignoré, voir
// docs/android-ci-cd.md). Absente sur les autres machines/CI :
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
      "setup-android: ⚠️ génération des icônes échouée, lancer à la main :\n" +
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

// 9. Widgets d'écran d'accueil (Horaires, Lecture du jour) : le code natif
//    vit dans native/android/ (versionné) et se recopie ici à chaque setup
//    android/ étant régénéré de zéro par la CI. Les providers lisent les
//    payloads JSON que l'app pousse via le plugin PjWidgets (voir
//    src/services/widgetService.ts et docs/app-widgets.md).
//    Copié AVANT le patch de MainActivity ci-dessous, qui référence la classe
//    PjWidgetsPlugin : un échec de copie doit interrompre avant ce patch,
//    jamais après (android/ resterait incompilable).
const widgetsSource = join(root, "native/android/app/src/main");
cpSync(widgetsSource, join(androidDir, "app/src/main"), { recursive: true });
console.log("setup-android: fichiers widgets copiés depuis native/android/");

//    Enregistrement du plugin + désactivation de l'overscroll (l'étirement
//    d'Android déforme toute la WebView ; le CSS overscroll-behavior ne
//    suffit pas). Patchs ADDITIFS : une MainActivity personnalisée à la main
//    n'est jamais réécrite en entier, chaque insertion est indépendante.
const mainActivityPath = join(
  androidDir,
  "app/src/main/java/fr/petitejerusalem/app/MainActivity.java",
);
if (existsSync(mainActivityPath)) {
  let mainActivity = readFileSync(mainActivityPath, "utf8");
  // Scaffold nu (pas de onCreate) : on pose le squelette complet.
  if (!mainActivity.includes("onCreate")) {
    mainActivity = `package fr.petitejerusalem.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }
}
`;
  }
  if (!mainActivity.includes("PjWidgetsPlugin")) {
    // Le plugin doit être connu du bridge avant sa création (avant super.onCreate).
    mainActivity = mainActivity.replace(
      /(\n\s*)(super\.onCreate\(savedInstanceState\);)/,
      `$1// Widgets d'écran d'accueil (voir native/android/ et docs/app-widgets.md).$1registerPlugin(PjWidgetsPlugin.class);$1$2`,
    );
    console.log("setup-android: plugin PjWidgets enregistré dans MainActivity");
  }
  if (!mainActivity.includes("setOverScrollMode")) {
    mainActivity = mainActivity.replace(
      /(\n\s*)(super\.onCreate\(savedInstanceState\);)/,
      `$1$2$1// L'étirement d'overscroll d'Android (stretch) déforme toute la$1// WebView, bottom bar comprise ; le CSS overscroll-behavior ne le$1// désactive pas, seul le mode natif de la vue le fait.$1this.bridge.getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);`,
    );
    if (!mainActivity.includes("import android.view.View;")) {
      mainActivity = mainActivity.replace(
        "import com.getcapacitor.BridgeActivity;",
        "import android.view.View;\nimport com.getcapacitor.BridgeActivity;",
      );
    }
    console.log("setup-android: overscroll désactivé dans MainActivity");
  }
  writeFileSync(mainActivityPath, mainActivity);
}

// 10. Déclaration des deux widgets dans le manifest.
let widgetManifest = readFileSync(manifestPath, "utf8");
if (!widgetManifest.includes("HorairesWidgetProvider")) {
  widgetManifest = widgetManifest.replace(
    /(\n\s*<\/application>)/,
    `

        <!-- Widgets d'écran d'accueil (voir native/android/ et docs/app-widgets.md) -->
        <receiver
            android:name=".HorairesWidgetProvider"
            android:exported="false"
            android:label="@string/pj_widget_horaires_label">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/widget_horaires_info" />
        </receiver>
        <receiver
            android:name=".LectureWidgetProvider"
            android:exported="false"
            android:label="@string/pj_widget_lecture_label">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/widget_lecture_info" />
        </receiver>$1`,
  );
  writeFileSync(manifestPath, widgetManifest);
  console.log("setup-android: widgets Horaires et Lecture déclarés dans le manifest");
}

// 11. Connexion Google native : sans ces variables, le plugin
//     @capacitor-firebase/authentication retombe sur androidx.credentials
//     1.2.0-rc01, une release candidate dont le Credential Manager est cassé
//     sur certains appareils (le bouton Google ne fait alors rien du tout,
//     issue capawesome capacitor-firebase#836). On épingle des versions stables.
const variablesGradlePath = join(androidDir, "variables.gradle");
const variablesGradle = readFileSync(variablesGradlePath, "utf8");
if (!variablesGradle.includes("androidxCredentialsVersion")) {
  writeFileSync(
    variablesGradlePath,
    variablesGradle.replace(
      /\n\}/,
      `

    // Connexion Google native (@capacitor-firebase/authentication).
    // rgcfaIncludeGoogle embarque les dépendances Google du plugin dans l'app
    // (sinon elles sont compileOnly et le runtime hérite des versions
    // transitives de firebase-auth, dont androidx.credentials 1.2.0-rc01, une
    // release candidate dont le Credential Manager est cassé sur certains
    // appareils : le bouton Google ne fait alors rien du tout, issue capawesome
    // capacitor-firebase#836). On épingle donc des versions stables.
    rgcfaIncludeGoogle = true
    androidxCredentialsVersion = '1.5.0'
    androidxCredentialsPlayServicesAuthVersion = '1.5.0'
    playServicesAuthVersion = '21.3.0'
    librariesIdentityGoogleidVersion = '1.1.1'
}`,
    ),
  );
  console.log("setup-android: versions androidx.credentials épinglées dans variables.gradle");
}

// 12. App Links : les liens du site ouvrent l'app installée.
//     `autoVerify` fait vérifier le domaine par le système à l'installation,
//     contre le fichier /.well-known/assetlinks.json servi par le site (écrit
//     par scripts/well-known.mjs). Sans cette vérification, Android afficherait
//     un sélecteur d'application au lieu d'ouvrir l'app ; sans intent-filter du
//     tout, le lien resterait au navigateur.
//     Les chemins couverts viennent de scripts/lib/app-links.mjs : la liste est
//     volontairement positive, `/__/auth/` (redirection Firebase Auth) ne doit
//     surtout pas être capturé.
let linksManifest = readFileSync(manifestPath, "utf8");
if (linksManifest.includes("android:autoVerify")) {
  console.log("setup-android: App Links déjà déclarés dans le manifest");
} else {
  const patched = linksManifest.replace(
    /(<category android:name="android\.intent\.category\.LAUNCHER"\s*\/>\s*<\/intent-filter>)/,
    `$1\n\n${buildAndroidIntentFilter()}`,
  );
  if (patched === linksManifest) {
    console.error(
      "setup-android: intent-filter LAUNCHER introuvable dans le manifest, App Links non déclarés.\n" +
        "  Le template Capacitor a changé : mettre ce script à jour (voir docs/app-links.md).",
    );
    process.exit(1);
  }
  writeFileSync(manifestPath, patched);
  console.log(`setup-android: App Links déclarés pour ${APP_LINK_DOMAIN}`);
}

console.log("setup-android: terminé.");
