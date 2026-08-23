#!/usr/bin/env node
/**
 * Écrit les deux fichiers que le domaine doit servir pour qu'un lien du site
 * ouvre l'app installée au lieu du navigateur :
 *
 *   dist/.well-known/assetlinks.json              (Android App Links)
 *   dist/.well-known/apple-app-site-association   (iOS Universal Links)
 *
 * Lancé par `npm run build`, après le prérendu SEO. Ce qu'il y met vient de
 * scripts/lib/app-links.mjs (domaine, chemins, identifiants de signature).
 *
 * Valeurs manquantes : le script le dit et n'écrit pas le fichier concerné,
 * sans faire échouer le build. Un fichier absent laisse simplement les liens
 * s'ouvrir dans le navigateur ; un fichier présent mais faux ferait croire au
 * système que la vérification a été faite. Voir docs/app-links.md.
 *
 * Usage : node scripts/well-known.mjs [dossier]   (dossier par défaut : dist)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  APP_LINK_DOMAIN,
  androidFingerprints,
  appleTeamId,
  buildAppleAppSiteAssociation,
  buildAssetLinks,
} from "./lib/app-links.mjs";

const root = process.argv[2] ?? "dist";
const wellKnown = join(root, ".well-known");

/** Avertissement visible dans le résumé d'un run GitHub Actions. */
function warn(message) {
  const prefix = process.env.GITHUB_ACTIONS ? "::warning::" : "⚠️ ";
  console.warn(`${prefix}[well-known] ${message}`);
}

function write(name, content) {
  mkdirSync(wellKnown, { recursive: true });
  writeFileSync(join(wellKnown, name), `${JSON.stringify(content, null, 2)}\n`, "utf-8");
  console.log(`[well-known] ${root}/.well-known/${name}`);
}

// Android : les empreintes SHA-256 du certificat qui signe l'app publiée.
const { valid: fingerprints, invalid } = androidFingerprints();
for (const entry of invalid) {
  warn(`empreinte SHA-256 ignorée, format attendu « AB:CD:...:EF » (32 octets) : ${entry}`);
}
if (fingerprints.length) {
  write("assetlinks.json", buildAssetLinks(fingerprints));
} else {
  warn(
    "assetlinks.json non écrit : aucune empreinte SHA-256. Les liens du site " +
      "n'ouvriront pas l'app Android (ANDROID_APP_LINK_SHA256, voir docs/app-links.md).",
  );
}

// iOS : le Team ID Apple, qui préfixe l'identifiant de l'app.
const { teamId, invalid: badTeamId } = appleTeamId();
if (badTeamId) warn(`Team ID Apple ignoré, 10 caractères attendus : ${badTeamId}`);
if (teamId) {
  write("apple-app-site-association", buildAppleAppSiteAssociation(teamId));
} else {
  warn(
    "apple-app-site-association non écrit : aucun Team ID Apple. Les liens du " +
      "site n'ouvriront pas l'app iOS (IOS_DEVELOPMENT_TEAM, voir docs/app-links.md).",
  );
}

console.log(`[well-known] domaine : ${APP_LINK_DOMAIN}`);
