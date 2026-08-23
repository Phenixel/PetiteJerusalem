/**
 * Liens d'application : la source unique de ce qui, sur le domaine, doit
 * s'ouvrir dans l'app native quand elle est installée.
 *
 * Trois consommateurs, un seul endroit à tenir :
 *  - scripts/well-known.mjs, qui écrit les deux fichiers de preuve servis par
 *    le site (`/.well-known/assetlinks.json` pour Android, `apple-app-site-
 *    association` pour iOS) ;
 *  - scripts/setup-android.mjs, qui pose l'intent-filter App Links du manifest ;
 *  - scripts/setup-ios.mjs, qui déclare le domaine associé dans les entitlements.
 *
 * Comment ça marche, des deux côtés : le système lit le fichier servi par le
 * domaine, y trouve la signature de l'app installée, et ouvre alors l'app au
 * lieu du navigateur pour les chemins déclarés. Sans le fichier, ou sans la
 * bonne empreinte dedans, le lien reste dans le navigateur : rien ne casse,
 * la redirection ne se fait simplement pas.
 *
 * Deux valeurs publiques manquent au dépôt, parce qu'elles décrivent des clés
 * de signature qui, elles, n'y sont pas (voir docs/app-links.md) :
 *   ANDROID_APP_LINK_SHA256   empreintes SHA-256 du certificat qui signe l'app
 *                             (Play Console → Intégrité de l'app → signature).
 *                             Plusieurs valeurs séparées par des virgules :
 *                             clé de signature Play ET clé d'importation.
 *   IOS_DEVELOPMENT_TEAM      Team ID Apple (10 caractères), déjà utilisé par
 *                             scripts/setup-ios.mjs.
 * On peut les fournir par l'environnement (c'est ce que fait la CI, à partir
 * des secrets) ou les écrire en dur ci-dessous : ces deux valeurs finissent
 * publiées dans les fichiers `.well-known`, elles n'ont rien de secret.
 */

/** Domaine du site. Un seul host : chaque host déclaré doit servir sa preuve. */
export const APP_LINK_DOMAIN = "petite-jerusalem.fr";

/** Identifiant de l'app, commun aux deux plateformes (capacitor.config.ts). */
export const APP_ID = "fr.petitejerusalem.app";

/** Écrites en dur si on préfère ne pas dépendre de l'environnement. */
const ANDROID_SHA256_DEFAULT = [];
const APPLE_TEAM_ID_DEFAULT = "";

/**
 * Les chemins qui ouvrent l'app, préfixe par préfixe (les routes de
 * src/router/routes.ts ; un test le vérifie, src/__tests__/appLinks.test.ts).
 *
 * La liste est positive, et c'est le point : tout ce qui n'y figure pas reste
 * au navigateur. En particulier `/__/auth/`, le gestionnaire de redirection de
 * Firebase Auth (authDomain vaut le domaine du site) : capturé par l'app, il
 * couperait la connexion Google en plein vol sur le web mobile. Idem pour
 * `/og/`, `/texts/`, `/assets/` et `/fonts/`, qui ne sont pas des pages.
 */
export const APP_LINK_PATHS = [
  "/",
  // Les pages traduites vivent toutes sous un préfixe de langue (le français
  // reste à la racine) : deux préfixes suffisent à couvrir /en/shabbat-times,
  // /he/parasha et leurs voisines, y compris les sections traduites à venir.
  // Le test de couverture les compare une à une (src/__tests__/appLinks.test.ts).
  "/en",
  "/he",
  "/a-propos",
  "/admin",
  "/bibliotheque",
  "/calendrier",
  "/chiourim",
  "/conditions-utilisation",
  "/confidentialite",
  "/finir-le-chass",
  "/horaires",
  "/lire",
  "/login",
  "/mentions-legales",
  "/paracha",
  "/partage-tehilim",
  "/profile",
  "/session-management",
  "/share-reading",
  "/studio",
  "/tehilim",
  "/telechargements",
  "/zmanim",
];

/** Un chemin est-il de ceux que l'app ouvre ? (préfixe exact ou sous-chemin) */
export function isAppLinkPath(path) {
  return APP_LINK_PATHS.some((prefix) =>
    prefix === "/" ? path === "/" : path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** Empreinte SHA-256 d'un certificat : 32 octets en hexadécimal, séparés par « : ». */
const SHA256_FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/**
 * Empreintes du certificat de signature Android, depuis l'environnement
 * (`ANDROID_APP_LINK_SHA256`, séparées par virgule, espace ou retour à la
 * ligne) ou de la constante ci-dessus. Les valeurs mal formées sont écartées
 * avec leur raison : un fichier `assetlinks.json` accepté mais faux ne se
 * remarquerait qu'au moment où un lien n'ouvre pas l'app.
 */
export function androidFingerprints(env = process.env) {
  const raw = env.ANDROID_APP_LINK_SHA256?.trim();
  const listed = raw ? raw.split(/[\s,;]+/).filter(Boolean) : ANDROID_SHA256_DEFAULT;
  const valid = [];
  const invalid = [];
  for (const entry of listed) {
    const normalized = entry.toUpperCase();
    if (SHA256_FINGERPRINT.test(normalized)) valid.push(normalized);
    else invalid.push(entry);
  }
  return { valid, invalid };
}

/** Team ID Apple, depuis l'environnement ou la constante ci-dessus. */
export function appleTeamId(env = process.env) {
  const teamId = (env.APPLE_TEAM_ID ?? env.IOS_DEVELOPMENT_TEAM ?? APPLE_TEAM_ID_DEFAULT).trim();
  if (!teamId) return { teamId: null, invalid: null };
  if (!/^[0-9A-Z]{10}$/i.test(teamId)) return { teamId: null, invalid: teamId };
  return { teamId: teamId.toUpperCase(), invalid: null };
}

/**
 * `/.well-known/assetlinks.json` : Android y lit que le domaine délègue ses
 * URLs à l'app signée par ces empreintes (« Digital Asset Links »).
 */
export function buildAssetLinks(fingerprints) {
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: APP_ID,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

/**
 * `/.well-known/apple-app-site-association` : iOS y lit quels chemins du
 * domaine appartiennent à l'app. Deux composants par préfixe, le chemin
 * lui-même et ce qui vit dessous, plutôt qu'un `/prefixe*` qui attraperait
 * aussi les chemins simplement voisins.
 */
export function buildAppleAppSiteAssociation(teamId) {
  const components = APP_LINK_PATHS.flatMap((path) =>
    path === "/" ? [{ "/": "/" }] : [{ "/": path }, { "/": `${path}/*` }],
  );
  return {
    applinks: {
      // Champ vide mais attendu par les versions d'iOS antérieures à 13.
      apps: [],
      details: [{ appIDs: [`${teamId}.${APP_ID}`], components }],
    },
  };
}

/**
 * L'intent-filter Android : `autoVerify` déclenche la vérification du domaine
 * à l'installation ; sans elle, le système proposerait un sélecteur
 * d'application au lieu d'ouvrir l'app directement.
 *
 * `path` pour le chemin exact et `pathPrefix` pour ce qui vit dessous, même
 * raison que côté iOS : `pathPrefix="/tehilim"` attraperait aussi
 * `/tehilim-autre-chose`.
 */
export function buildAndroidIntentFilter(indent = "            ") {
  const data = APP_LINK_PATHS.flatMap((path) =>
    path === "/"
      ? [`    <data android:path="/" />`]
      : [`    <data android:path="${path}" />`, `    <data android:pathPrefix="${path}/" />`],
  );
  return [
    `<intent-filter android:autoVerify="true">`,
    `    <action android:name="android.intent.action.VIEW" />`,
    `    <category android:name="android.intent.category.DEFAULT" />`,
    `    <category android:name="android.intent.category.BROWSABLE" />`,
    `    <data android:scheme="https" />`,
    `    <data android:host="${APP_LINK_DOMAIN}" />`,
    ...data,
    `</intent-filter>`,
  ]
    .map((line) => `${indent}${line}`)
    .join("\n");
}
