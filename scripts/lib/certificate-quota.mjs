/**
 * Quota de certificats de distribution : lesquels peuvent partir, lesquels
 * doivent rester.
 *
 * Apple n'en accepte que trois par compte, et celui qui a signé un binaire
 * doit lui survivre : la signature d'origine est re-validée à chaque mise en
 * file d'examen (ITMS-90035, cf. l'en-tête de scripts/ios-signing.mjs). Il
 * faut donc désigner, sans se tromper, ceux dont plus aucun binaire ne dépend.
 *
 * L'API App Store Connect ne dit pas quel certificat a signé quel build, mais
 * elle date les deux : un binaire est signé par le dernier certificat créé
 * avant son envoi. La fenêtre d'un certificat va donc de sa création à celle
 * du suivant, et un certificat dont la fenêtre ne contient aucun envoi
 * protégé peut être révoqué.
 *
 * Ce fichier ne parle ni à Apple ni au trousseau : la décision se teste sans
 * réseau ni macOS (src/__tests__/certificateQuota.test.ts), le reste vit dans
 * scripts/ios-signing.mjs.
 */

/**
 * @typedef {{ id: string, displayName: string, expiration: string, created: number, keptFor?: string, revoked?: boolean }} Certificate
 * @typedef {{ label: string, uploadedAt: number }} Upload
 */

/** Le plafond Apple, par compte développeur. */
export const CERTIFICATE_QUOTA = 3;

/**
 * Les fenêtres se recouvrent de deux heures : la date de création est déduite
 * de l'expiration, à quelques minutes près, et un envoi tombé pile à la
 * frontière protège alors les deux certificats voisins plutôt qu'aucun. Se
 * tromper dans ce sens coûte une place du quota ; se tromper dans l'autre
 * coûte une release rejetée à l'examen.
 */
export const ATTRIBUTION_MARGIN_MS = 2 * 60 * 60 * 1000;

/**
 * Apple ne publie pas la date de création d'un certificat, seulement son
 * expiration, un an plus tard : on retranche une année *calendaire*, pas 365
 * jours, sinon une année bissextile décale la déduction d'un jour entier.
 * Reste l'écart observé, une dizaine de minutes, que la marge absorbe.
 *
 * @param {string | undefined} expirationDate
 * @returns {number}
 */
export function creationDate(expirationDate) {
  const expiration = new Date(expirationDate ?? "");
  if (Number.isNaN(expiration.getTime())) return 0;
  expiration.setUTCFullYear(expiration.getUTCFullYear() - 1);
  return expiration.getTime();
}

/**
 * États d'une version où la signature de son binaire compte encore : Apple la
 * re-valide à la mise en file d'examen, et une version en vente reste adossée
 * au certificat qui l'a signée.
 */
export const VERSION_STATES_IN_FLIGHT = new Set([
  "WAITING_FOR_REVIEW",
  "IN_REVIEW",
  "PENDING_APPLE_RELEASE",
  "PENDING_DEVELOPER_RELEASE",
  "PROCESSING_FOR_APP_STORE",
  "PROCESSING_FOR_DISTRIBUTION",
  "READY_FOR_SALE",
  "READY_FOR_DISTRIBUTION",
]);

/**
 * Les certificats de /v1/certificates, normalisés et ordonnés du plus ancien
 * au plus récent.
 *
 * @param {any[]} data
 * @returns {Certificate[]}
 */
export function distributionCertificates(data) {
  return data
    .map((entry) => ({
      id: entry.id,
      displayName: entry.attributes?.displayName ?? "?",
      expiration: entry.attributes?.expirationDate ?? "?",
      created: creationDate(entry.attributes?.expirationDate),
    }))
    .sort((a, b) => a.created - b.created);
}

/**
 * Les envois dont la signature compte encore, datés, à partir de
 * /v1/apps/{id}/appStoreVersions?include=build et de /v1/builds trié par
 * envoi décroissant :
 *
 * - le binaire de toute version qu'Apple regarde ou qui est en vente ;
 * - celui de la version la plus récente de la fiche, quel qu'en soit l'état :
 *   c'est elle qu'on soumettra, ou re-soumettra après un rejet ;
 * - le dernier binaire envoyé, et ceux qu'Apple traite encore, que la fiche
 *   ne les ait pas encore adoptés n'y change rien.
 *
 * @param {any} versionsResponse
 * @param {any} buildsResponse
 * @returns {Upload[]}
 */
export function protectedUploads(versionsResponse, buildsResponse) {
  /** @type {Upload[]} */
  const uploads = [];
  const builds = new Map(
    (versionsResponse.included ?? [])
      .filter((entry) => entry.type === "builds")
      .map((entry) => [entry.id, entry]),
  );
  [...(versionsResponse.data ?? [])]
    .sort((a, b) => Date.parse(b.attributes?.createdDate ?? 0) - Date.parse(a.attributes?.createdDate ?? 0))
    .forEach((version, index) => {
      const state = version.attributes?.appVersionState ?? version.attributes?.appStoreState;
      if (index > 0 && !VERSION_STATES_IN_FLIGHT.has(state)) return;
      const uploadedDate = builds.get(version.relationships?.build?.data?.id)?.attributes?.uploadedDate;
      if (!uploadedDate) return;
      uploads.push({
        label: `version ${version.attributes?.versionString} en ${state}`,
        uploadedAt: Date.parse(uploadedDate),
      });
    });
  (buildsResponse.data ?? []).forEach((build, index) => {
    if (index > 0 && build.attributes?.processingState !== "PROCESSING") return;
    if (!build.attributes?.uploadedDate) return;
    uploads.push({
      label: `build ${build.attributes.version} (${build.attributes.processingState})`,
      uploadedAt: Date.parse(build.attributes.uploadedDate),
    });
  });
  return uploads;
}

/**
 * Annote chaque certificat de ce qui le retient (`keptFor`) et rend ceux qui
 * peuvent partir, du plus ancien au plus récent. Le plus récent n'est jamais
 * de la partie : c'est celui du run précédent, dont le binaire vient peut-être
 * d'arriver chez Apple.
 *
 * @param {Certificate[]} certificates
 * @param {Upload[]} uploads
 * @returns {Certificate[]}
 */
export function revocableCertificates(certificates, uploads) {
  certificates.forEach((certificate, index) => {
    const next = certificates[index + 1];
    if (!next) {
      certificate.keptFor = "certificat du run précédent";
      return;
    }
    const from = certificate.created - ATTRIBUTION_MARGIN_MS;
    const to = next.created + ATTRIBUTION_MARGIN_MS;
    certificate.keptFor = uploads.find((upload) => upload.uploadedAt >= from && upload.uploadedAt < to)?.label;
  });
  return certificates.filter((certificate) => !certificate.keptFor);
}
