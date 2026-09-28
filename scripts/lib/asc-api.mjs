/**
 * Client App Store Connect minimal, partagé par les scripts de release
 * (appstore-listing, asc-submit, asc-screenshots) : JWT ES256 signé avec la
 * clé d'API, et un `api()` qui rejoue les pannes passagères d'Apple et met en
 * forme les erreurs de l'API.
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
import { RETRY_ATTEMPTS, withRetry } from "./asc-retry.mjs";

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
 * Le texte d'une réponse d'erreur de l'API, raisons détaillées comprises.
 *
 * Quand Apple refuse une version entière (le 409 de la soumission à l'examen),
 * `detail` se contente de « please check associated errors to see why » : la
 * vraie raison (un champ obligatoire vide, une série de captures manquante)
 * est rangée dans `meta.associatedErrors`, par ressource. Sans elle, le
 * journal ne disait rien d'utile (tag v3.10.8).
 */
export function describeAscErrors(json, text) {
  if (!Array.isArray(json?.errors)) return text;
  return json.errors
    .flatMap((error) => [
      `${error.title} : ${error.detail}`,
      ...Object.values(error.meta?.associatedErrors ?? {})
        .flat()
        .map((reason) => `  ${reason.title ?? reason.code} : ${reason.detail ?? ""}`.trimEnd()),
    ])
    .join("\n  ");
}

/**
 * Fabrique le client. Les identifiants sont nettoyés ici (les secrets collés
 * dans l'interface GitHub embarquent facilement un blanc ou un retour à la
 * ligne, et le PEM peut arriver en une ligne avec des « \n » littéraux).
 *
 * `sleep` ne sert qu'aux tests, pour rejouer une panne sans attendre.
 */
export function createAscClient({ keyId, issuerId, privateKeyPem, sleep }) {
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
   * Une requête, sans rejeu. Jette, en cas d'erreur HTTP, une Error portant
   * `status` (code HTTP) et `body` (JSON de l'API) pour que les appelants
   * distinguent les 409 attendus des vrais échecs.
   */
  async function request(method, path, body) {
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
      const error = new Error(
        `${method} ${path} → ${response.status}\n  ${describeAscErrors(json, text)}`,
      );
      error.status = response.status;
      error.body = json;
      throw error;
    }
    return json;
  }

  /**
   * Appel API App Store Connect, rejoué quand Apple tombe (5xx, 429, pas de
   * réponse), même règle que la signature (scripts/lib/asc-retry.mjs). Seuls
   * GET et DELETE le sont : les rejouer ne coûte rien. Un POST ou un PATCH
   * rejoué pourrait créer en double, ou soumettre deux fois.
   *
   * Le tag v3.10.8 est mort faute de ce rejeu : un 500 « UNEXPECTED_ERROR »
   * sur une simple lecture a coupé appstore-listing.mjs juste après la
   * création de la version, avant qu'il en écrive les « Nouveautés », et
   * Apple a refusé la soumission d'une version incomplète.
   */
  async function api(method, path, body) {
    if (method !== "GET" && method !== "DELETE") return request(method, path, body);
    return withRetry(() => request(method, path, body), {
      ...(sleep ? { sleep } : {}),
      onFailure: (error, attempt) => {
        console.warn(
          `asc-api: ${method} ${path} a échoué (${error.status ?? "sans réponse"}), ` +
            `nouvelle tentative ${attempt}/${RETRY_ATTEMPTS}`,
        );
      },
    });
  }

  return { api };
}
