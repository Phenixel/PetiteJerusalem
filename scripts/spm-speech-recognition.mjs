// Donne à @capacitor-community/speech-recognition (la dictée de la recherche)
// ce qu'il lui manque pour le build iOS : un paquet Swift.
//
// Capacitor 8 construit l'app iOS avec Swift Package Manager, plus de
// CocoaPods (voir capacitor.config.ts). `cap sync` n'y embarque que les
// plugins qui portent un Package.swift ; les autres sont laissés de côté avec
// un simple avertissement (« Some installed Capacitor plugins are not
// compatible with SPM »), et l'app s'installe sans eux : le micro paraîtrait
// dans la recherche et échouerait à chaque appui. Ce plugin, en 7.0.1, ne
// connaît que CocoaPods : un podspec, et une classe à l'ancienne, déclarée au
// pont par une macro Objective-C (ios/Plugin/Plugin.m).
//
// Le script fabrique donc, dans le plugin installé :
//
//   Package.swift                                  le paquet, sur le modèle de
//                                                  ceux des plugins officiels ;
//   ios/Sources/SpeechRecognitionPlugin/
//     SpeechRecognition.swift                      la classe du plugin, telle
//                                                  quelle (copie de Plugin.swift) ;
//     SpeechRecognitionBridge.swift                ce que la macro faisait :
//                                                  la conformité CAPBridgedPlugin
//                                                  (identifiant, nom JS, méthodes),
//                                                  lue dans Plugin.m pour ne
//                                                  jamais diverger de l'original.
//
// Un paquet SPM ne mélange pas Swift et Objective-C dans une cible : le .m ne
// peut pas voyager, d'où la conformité écrite en Swift, dans une extension.
// `cap sync` retrouve la classe par son nom (`@objc(SpeechRecognition)`), et
// le pont l'instancie par ce nom au lancement : rien d'autre à déclarer.
//
// npm install restaure le plugin d'origine : le script est rejoué à chaque
// `app:build`, avant `cap sync`, comme prune-spm-providers.mjs. Idempotent, et
// il s'efface de lui-même le jour où le plugin livrera son propre Package.swift :
// il ne touche qu'à un paquet qu'il a écrit (marqué comme tel).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_ROOT = join(
  import.meta.dirname,
  "..",
  "node_modules",
  "@capacitor-community",
  "speech-recognition",
);

const root = process.argv[2] ?? DEFAULT_ROOT;
const MARKER = "// Généré par scripts/spm-speech-recognition.mjs (Petite Jérusalem)";
const TARGET = "SpeechRecognitionPlugin";
const PRODUCT = "CapacitorCommunitySpeechRecognition";

function fail(message) {
  console.error(`spm-speech-recognition: ${message}`);
  process.exit(1);
}

if (!existsSync(root)) fail(`${root} introuvable, lancer npm install d'abord.`);

const packagePath = join(root, "Package.swift");
if (existsSync(packagePath) && !readFileSync(packagePath, "utf8").includes(MARKER)) {
  console.log(
    "spm-speech-recognition: le plugin livre son propre Package.swift, rien à faire (ce script peut être retiré).",
  );
  process.exit(0);
}

const pluginSwiftPath = join(root, "ios", "Plugin", "Plugin.swift");
const pluginObjcPath = join(root, "ios", "Plugin", "Plugin.m");
if (!existsSync(pluginSwiftPath) || !existsSync(pluginObjcPath)) {
  fail(
    "ios/Plugin/Plugin.swift ou Plugin.m introuvable : le plugin a changé de forme, mettre ce script à jour.",
  );
}

const pluginSwift = readFileSync(pluginSwiftPath, "utf8");
const pluginObjc = readFileSync(pluginObjcPath, "utf8");

// La classe, telle que le pont la nomme.
const classMatch = pluginSwift.match(/@objc\((\w+)\)\s*\n\s*public class (\w+): CAPPlugin\b/);
if (!classMatch || classMatch[1] !== classMatch[2]) {
  fail("classe du plugin non reconnue dans Plugin.swift, mettre ce script à jour.");
}
const className = classMatch[1];
if (/CAPBridgedPlugin/.test(pluginSwift)) {
  fail("Plugin.swift se déclare déjà CAPBridgedPlugin : le plugin a évolué, ce script est de trop.");
}

// Le nom JS et les méthodes : ceux de la macro, et seulement eux.
const jsMatch = pluginObjc.match(/CAP_PLUGIN\(\s*(\w+)\s*,\s*"([^"]+)"/);
if (!jsMatch || jsMatch[1] !== className) {
  fail("macro CAP_PLUGIN introuvable ou d'une autre classe dans Plugin.m, mettre ce script à jour.");
}
const jsName = jsMatch[2];
const methods = [...pluginObjc.matchAll(/CAP_PLUGIN_METHOD\(\s*(\w+)\s*,\s*(CAPPluginReturn\w+)\s*\)/g)].map(
  ([, name, returnType]) => ({ name, returnType }),
);
if (methods.length === 0) fail("aucune CAP_PLUGIN_METHOD dans Plugin.m, mettre ce script à jour.");

const packageSwift = `${MARKER}
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "${PRODUCT}",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "${PRODUCT}",
            targets: ["${TARGET}"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "${TARGET}",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/${TARGET}")
    ]
)
`;

const bridgeSwift = `${MARKER}
// Ce que la macro CAP_PLUGIN de ios/Plugin/Plugin.m déclarait au pont, écrit en
// Swift : un paquet SPM ne mélange pas Objective-C et Swift dans une cible.
import Capacitor

extension ${className}: CAPBridgedPlugin {
    public var identifier: String { "${className}" }
    public var jsName: String { "${jsName}" }
    public var pluginMethods: [CAPPluginMethod] {
        [
${methods.map(({ name, returnType }) => `            CAPPluginMethod(name: "${name}", returnType: ${returnType})`).join(",\n")}
        ]
    }
}
`;

const sourcesDir = join(root, "ios", "Sources", TARGET);
mkdirSync(sourcesDir, { recursive: true });

/** N'écrit que ce qui change : `cap sync` ne se croit pas obligé de tout refaire. */
function writeIfChanged(path, content) {
  if (existsSync(path) && readFileSync(path, "utf8") === content) return false;
  writeFileSync(path, content);
  return true;
}

const changed = [
  writeIfChanged(packagePath, packageSwift),
  writeIfChanged(join(sourcesDir, `${className}.swift`), `${MARKER}\n${pluginSwift}`),
  writeIfChanged(join(sourcesDir, `${className}Bridge.swift`), bridgeSwift),
].some(Boolean);

console.log(
  changed
    ? `spm-speech-recognition: paquet Swift écrit pour ${className} (${methods.length} méthodes), le plugin entre dans le build iOS.`
    : "spm-speech-recognition: paquet Swift déjà à jour.",
);
