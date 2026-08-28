/**
 * Client App Store Connect minimal, partagé par les scripts de release
 * (appstore-listing, asc-submit, asc-screenshots) : JWT ES256 signé avec la
 * clé d'API, et un `api()` qui met en forme les erreurs de l'API.
 *
 * Le jeton Apple vit 20 minutes au maximum, mais un script peut durer plus
 * longtemps (asc-submit attend le traitement du build, jusqu'à 45 minutes) :
 * le client re-signe donc un jeton frais toutes les 10 minutes.
 *
 * asc-auth-check.mjs garde volontairement sa propre copie de la signature :
 * sa raison d'être est de diagnostiquer chaque étape séparément (clé
 * illisible, Key ID ou Issuer ID erronés, clé révoquée) avec un message
 * dédié, là où ce client suppose des identifiants sains.
 */
import { createPrivateKey, sign as cryptoSign } from "node:crypto";

const base64url = (input) =>
  Buffer.from(input).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

/**
 * États dans lesquels les métadonnées d'une version App Store (textes,
 * captures, build attaché) sont encore modifiables. WAITING_FOR_REVIEW n'en
 * fait pas partie : l'API répond 409 STATE_ERROR.
 */
export const EDITABLE_STATES = [
  "PREPARE_FOR_SUBMISSION",
  "DEVELOPER_REJECTED",
  "REJECTED",
  "METADATA_REJECTED",
  "INVALID_BINARY",
];

/** `appStoreState` est déprécié depuis l'API 3.3 au profit d'`appVersionState`. */
export const versionState = (v) => v.attributes.appVersionState ?? v.attributes.appStoreState;

/**
 * Fabrique le client. Les identifiants sont nettoyés ici (les secrets collés
 * dans l'interface GitHub embarquent facilement un blanc ou un retour à la
 * ligne, et le PEM peut arriver en une ligne avec des « \n » littéraux).
 */
export function createAscClient({ keyId, issuerId, privateKeyPem }) {
  const kid = keyId.trim();
  const iss = issuerId.trim();
  const key = createPrivateKey(privateKeyPem.replaceAll("\\n", "\n"));

  let cachedToken = null;
  let cachedAt = 0;
  function token() {
    if (cachedToken && Date.now() - cachedAt < 10 * 60 * 1000) return cachedToken;
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "ES256", kid, typ: "JWT" };
    const payload = { iss, iat: now, exp: now + 20 * 60, aud: "appstoreconnect-v1" };
    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
    // JOSE attend la signature ECDSA au format brut R||S, pas le DER d'OpenSSL.
    const signature = cryptoSign("sha256", Buffer.from(signingInput), {
      key,
      dsaEncoding: "ieee-p1363",
    });
    cachedToken = `${signingInput}.${base64url(signature)}`;
    cachedAt = Date.now();
    return cachedToken;
  }

  /**
   * Appel API App Store Connect. Jette, en cas d'erreur HTTP, une Error
   * portant `status` (code HTTP) et `body` (JSON de l'API) pour que les
   * appelants distinguent les 409 attendus des vrais échecs.
   */
  async function api(method, path, body) {
    const response = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token()}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    const json = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const detail = json?.errors?.map((e) => `${e.title} : ${e.detail}`).join("\n  ") ?? text;
      const error = new Error(`${method} ${path} → ${response.status}\n  ${detail}`);
      error.status = response.status;
      error.body = json;
      throw error;
    }
    return json;
  }

  return { api };
}
