#!/usr/bin/env node
/**
 * Sonde d'authentification App Store Connect : signe un JWT avec
 * ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY et appelle l'API.
 *
 * But : faire échouer « Deploy iOS » en deux secondes avec un diagnostic
 * clair quand les secrets sont incohérents (mauvaise clé collée — la clé
 * APNs est un .p8 tout aussi valide pour openssl —, Key ID ou Issuer ID
 * erronés, clé révoquée), au lieu du « Authentication failed: Make sure a
 * bearer token was provided » d'xcodebuild après un quart d'heure de build.
 *
 * Usage : ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_PRIVATE_KEY=… node scripts/asc-auth-check.mjs
 */
import { createPrivateKey, sign as cryptoSign } from "node:crypto";

const keyId = process.env.ASC_KEY_ID?.trim();
const issuerId = process.env.ASC_ISSUER_ID?.trim();
const privateKeyPem = process.env.ASC_PRIVATE_KEY;
if (!keyId || !issuerId || !privateKeyPem) {
  console.error("asc-auth-check: ASC_KEY_ID, ASC_ISSUER_ID et ASC_PRIVATE_KEY sont requis");
  process.exit(1);
}

const base64url = (input) =>
  Buffer.from(input).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

let key;
try {
  key = createPrivateKey(privateKeyPem.replaceAll("\\n", "\n"));
} catch (error) {
  console.error(`asc-auth-check: ASC_PRIVATE_KEY n'est pas une clé lisible — ${error.message}`);
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const header = { alg: "ES256", kid: keyId, typ: "JWT" };
const payload = { iss: issuerId, iat: now, exp: now + 10 * 60, aud: "appstoreconnect-v1" };
const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
const signature = cryptoSign("sha256", Buffer.from(signingInput), {
  key,
  dsaEncoding: "ieee-p1363",
});
const token = `${signingInput}.${base64url(signature)}`;

const response = await fetch("https://api.appstoreconnect.apple.com/v1/apps?limit=1", {
  headers: { Authorization: `Bearer ${token}` },
});
if (response.ok) {
  console.log(`asc-auth-check: OK — l'API App Store Connect accepte la clé ${keyId}`);
  process.exit(0);
}
const body = await response.text();
console.error(
  `asc-auth-check: l'API App Store Connect répond ${response.status} — les secrets sont incohérents.\n` +
    `  Vérifier que ASC_PRIVATE_KEY est bien le AuthKey_${keyId}.p8 de la clé d'API « App Store Connect »\n` +
    "  (PAS la clé APNs, qui est aussi un .p8), et que ASC_KEY_ID / ASC_ISSUER_ID viennent de la même page\n" +
    "  Users and Access → Integrations. Une clé perdue ne se retélécharge pas : en créer une nouvelle\n" +
    "  et mettre à jour les trois secrets.\n" +
    `  Réponse : ${body.slice(0, 300)}`,
);
process.exit(1);
