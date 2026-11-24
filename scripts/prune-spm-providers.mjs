// Retire du plugin @capacitor-firebase/authentication les providers OAuth
// que l'app ne propose pas (voir capacitor.config.ts : Google et Apple).
//
// Avec CocoaPods, le plugin n'embarquait par défaut aucun SDK tiers (subspec
// « Lite », les providers s'ajoutaient un à un). Son Package.swift, lui,
// embarque TOUT le monde : le SDK Facebook complet (FBSDKCoreKit,
// FBSDKLoginKit, FBAEMKit, FBSDKCoreKit_Basics) partait dans l'app iOS en
// frameworks embarqués, environ 15 Mo installés, sans qu'aucun bouton
// « Continuer avec Facebook » n'existe. Le code du plugin est prévu pour :
// chaque provider est gardé par une directive (#if RGCFA_INCLUDE_FACEBOOK),
// retirer la dépendance et la directive suffit.
//
// npm install restaure le fichier d'origine du plugin : le script est donc
// rejoué à chaque `app:build` (avant `cap sync` ; le projet iOS référence le
// paquet de node_modules via symlink, cf. capacitor.config.ts). Idempotent,
// et il échoue bruyamment si une mise à jour du plugin change la forme de
// son Package.swift : mieux vaut un build rouge qu'un SDK réembarqué en
// silence.
//
// Android n'a pas ce problème : le build.gradle du plugin n'ajoute Facebook
// que si `rgcfaIncludeFacebook = true`, que scripts/setup-android.mjs ne pose
// pas (seul `rgcfaIncludeGoogle` l'est).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_PATH = join(
  import.meta.dirname,
  "..",
  "node_modules",
  "@capacitor-firebase",
  "authentication",
  "Package.swift",
);

const path = process.argv[2] ?? DEFAULT_PATH;

if (!existsSync(path)) {
  console.error(`prune-spm-providers: ${path} introuvable, lancer npm install d'abord.`);
  process.exit(1);
}

let content = readFileSync(path, "utf8");

if (!/facebook/i.test(content)) {
  console.log("prune-spm-providers: Package.swift déjà sans Facebook, rien à faire.");
  process.exit(0);
}

/** Retire un fragment en échouant bruyamment si l'ancre a disparu. */
function mustRemove(pattern, what) {
  const next = content.replace(pattern, "");
  if (next === content) {
    console.error(
      `prune-spm-providers: impossible de retirer « ${what} », le Package.swift du plugin a changé.\n` +
        "  Comparer avec node_modules/@capacitor-firebase/authentication/Package.swift et mettre ce script à jour.",
    );
    process.exit(1);
  }
  content = next;
}

// The anchors match the URL or the product name, never the version: a bump
// of the Facebook SDK must not break the pruning. The preceding comma goes
// with the line, each removed entry being the last of its list.
//
// Two shapes of Package.swift are handled. Up to 8.3, products and the
// directive were unconditional. Since 8.6 (swift-tools 6.1) the plugin
// declares SwiftPM traits ("Google", "Facebook", both on by default) and
// guards the products and the directive with `.when(traits: ["Facebook"])`.
// For that shape the "Facebook" trait is also dropped from the defaults and
// from the trait list, so nothing refers to it any more.
const WHEN_FACEBOOK = String.raw`(?:,\s*condition:\s*\.when\(traits:\s*\["Facebook"\]\))?`;
if (/traits:\s*\[/.test(content)) {
  mustRemove(/,\s*"Facebook"(?=\s*\]\))/, "trait Facebook in the default traits");
  mustRemove(
    /,\s*\n\s*\.trait\(\s*name:\s*"Facebook",[^)]*\)/,
    "trait Facebook declaration",
  );
}
mustRemove(
  /,\s*\n\s*\.package\(url: "https:\/\/github\.com\/facebook\/facebook-ios-sdk\.git"[^)]*\)/,
  "dépendance facebook-ios-sdk",
);
mustRemove(
  new RegExp(String.raw`,\s*\n\s*\.product\(name: "FacebookCore", package: "facebook-ios-sdk"${WHEN_FACEBOOK}\)`),
  "produit FacebookCore",
);
mustRemove(
  new RegExp(String.raw`,\s*\n\s*\.product\(name: "FacebookLogin", package: "facebook-ios-sdk"${WHEN_FACEBOOK}\)`),
  "produit FacebookLogin",
);
mustRemove(
  new RegExp(String.raw`,\s*\n\s*\.define\("RGCFA_INCLUDE_FACEBOOK"(?:,\s*\.when\(traits:\s*\["Facebook"\]\))?\)`),
  "directive RGCFA_INCLUDE_FACEBOOK",
);

// Garde-fous : Google reste (l'app s'en sert), et plus rien ne mentionne
// Facebook, sinon un embarquement passé au travers des ancres ci-dessus.
if (!content.includes('.product(name: "GoogleSignIn"') || !content.includes("RGCFA_INCLUDE_GOOGLE")) {
  console.error("prune-spm-providers: GoogleSignIn a disparu du Package.swift, élagage abandonné.");
  process.exit(1);
}
if (/facebook/i.test(content)) {
  console.error("prune-spm-providers: il reste une mention de Facebook après élagage, ancres à revoir.");
  process.exit(1);
}

writeFileSync(path, content);
console.log("prune-spm-providers: SDK Facebook retiré du build iOS (provider jamais proposé par l'app).");
