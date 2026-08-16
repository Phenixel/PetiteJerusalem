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

// /v1/apps vérifie les identifiants ; /v1/bundleIds, /v1/certificates et
// /v1/profiles sont les endpoints de PROVISIONING qu'utilise la signature
// automatique d'xcodebuild — ils peuvent répondre 403 avec une clé pourtant
// valide (accord de licence Apple Developer en attente, clé sans accès au
// portail…), ce qu'xcodebuild maquille en « Authentication failed: bearer
// token ».
const ENDPOINTS = ["/v1/apps", "/v1/bundleIds", "/v1/certificates", "/v1/profiles"];
let failed = false;
let appsOk = false;
let provisioningBlocked = false;
for (const path of ENDPOINTS) {
  const response = await fetch(`https://api.appstoreconnect.apple.com${path}?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = response.ok ? "" : (await response.text()).slice(0, 300);
  console.log(`asc-auth-check: ${path} → ${response.status}${body ? `\n  ${body}` : ""}`);
  if (path === "/v1/apps" && response.ok) appsOk = true;
  if (path !== "/v1/apps" && !response.ok) provisioningBlocked = true;
  if (!response.ok) failed = true;
}
// Une équipe SANS appareil enregistré ne peut pas obtenir de profil de
// DÉVELOPPEMENT (« Your team has no devices from which to generate a
// provisioning profile ») — c'est ce qui a masqué l'échec des premiers runs
// derrière un « Authentication failed: bearer token ». La CI n'en dépend plus :
// elle signe manuellement avec un profil « App Store », qui n'exige aucun
// appareil (scripts/ios-signing.mjs). Le compte reste affiché à titre
// d'information.
if (!failed) {
  const devices = await fetch("https://api.appstoreconnect.apple.com/v1/devices?limit=1", {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => (r.ok ? r.json() : null));
  const deviceCount = devices?.meta?.paging?.total ?? null;
  console.log(
    `asc-auth-check: OK — la clé ${keyId} a accès à l'App Store Connect ET au provisioning` +
      (deviceCount === null ? "" : ` (${deviceCount} appareil(s) enregistré(s))`),
  );
  process.exit(0);
}
if (appsOk && provisioningBlocked) {
  console.error(
    "asc-auth-check: la clé est valide mais les endpoints de PROVISIONING refusent —\n" +
      "  cause classique : un accord de licence Apple Developer en attente d'acceptation.\n" +
      "  Vérifier sur developer.apple.com (bandeau en haut du compte) et sur\n" +
      "  appstoreconnect.apple.com → Business/Accords, accepter, puis relancer.",
  );
} else {
  console.error(
    "asc-auth-check: authentification refusée — les secrets sont incohérents.\n" +
      `  Vérifier que ASC_PRIVATE_KEY est bien le AuthKey_${keyId}.p8 de la clé d'API « App Store Connect »\n` +
      "  (PAS la clé APNs, qui est aussi un .p8), et que ASC_KEY_ID / ASC_ISSUER_ID viennent de la même page\n" +
      "  Users and Access → Integrations. Une clé perdue ne se retélécharge pas : en créer une nouvelle\n" +
      "  et mettre à jour les trois secrets.",
  );
}
process.exit(1);
