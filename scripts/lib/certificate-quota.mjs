/**
 * Quota de certificats de distribution : lesquels peuvent partir, lesquels
 * doivent rester.
 *
 * Apple n'en accepte que trois par compte, et celui qui a signé un binaire
 * doit lui survivre : la signature d'origine est re-validée à chaque mise en
 * file d'examen (ITMS-90035, cf. l'en-tête de scripts/ios-signing.mjs). Il
 * faut donc désigner, sans se tromper, ceux dont plus aucun binaire ne dépend.
 *
 * L'API App Store Connect ne dit pas quel certificat a signé quel build. La CI
 * laisse donc la trace elle-même : le profil du run qui a envoyé son binaire
 * survit au run, porte le numéro de build dans son nom et référence le
 * certificat signataire. Chaque certificat suit alors le sort du build qu'il
 * a signé, exactement.
 *
 * Pour ceux qui n'ont pas cette trace (antérieurs aux marqueurs, ou laissés
 * par un run tué avant son nettoyage), il reste la déduction par les dates :
 * l'API date les certificats et les envois, et un binaire est signé par le
 * dernier certificat créé avant son envoi ; la fenêtre d'un certificat va de
 * sa création à celle du suivant, marge comprise.
 *
 * Ce fichier ne parle ni à Apple ni au trousseau : la décision se teste sans
 * réseau ni macOS (src/__tests__/certificateQuota.test.ts), le reste vit dans
 * scripts/ios-signing.mjs.
 */

/**
 * @typedef {{ id: string, type: string, displayName: string, expiration: string, created: number, keptFor?: string, revoked?: boolean }} Certificate
 * @typedef {{ label: string, buildNumber: string | undefined, uploadedAt: number }} Upload
 */

/** Le plafond Apple, par compte développeur. */
export const CERTIFICATE_QUOTA = 3;

/**
 * Les types de certificat qui occupent ce plafond. La CI ne crée que des
 * DISTRIBUTION (« Apple Distribution ») ; un IOS_DISTRIBUTION (l'ancien « iOS
 * Distribution »), créé à la main ou par Xcode, prend pourtant une place, et
 * un compte qui en porte un se voit refuser une création avec deux
 * certificats seulement à l'écran. D'où l'inventaire sans filtre de type :
 * mieux vaut voir ce qui occupe le quota que compter à côté.
 */
export const DISTRIBUTION_TYPES = new Set(["DISTRIBUTION", "IOS_DISTRIBUTION"]);

/** Le seul type que la CI fabrique, donc le seul qu'elle s'autorise à révoquer. */
export const CI_CERTIFICATE_TYPE = "DISTRIBUTION";

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
 * États d'une version dont le certificat doit survivre : Apple a le binaire
 * en main et n'a pas fini d'en regarder la signature. C'est exactement ce que
 * dit Apple au moment de révoquer un certificat : sont invalidées les apps
 * *soumises à l'examen* signées avec lui, celles déjà distribuées sur l'App
 * Store ne sont pas touchées. Une version déjà distribuée ne retient donc
 * plus rien, sauf à être la plus récente de la fiche, laquelle est protégée
 * par ailleurs : c'est elle qu'on soumettra, ou re-soumettra après un rejet.
 *
 * Le contraire coûtait une place du quota par release passée : le tag v3.7.8
 * a été bloqué par les certificats de 3.7.5 et 3.7.6, deux versions pourtant
 * déjà distribuées.
 */
export const VERSION_STATES_IN_FLIGHT = new Set([
  "WAITING_FOR_REVIEW",
  "IN_REVIEW",
  "PENDING_APPLE_RELEASE",
  "PENDING_DEVELOPER_RELEASE",
  "PROCESSING_FOR_APP_STORE",
  "PROCESSING_FOR_DISTRIBUTION",
]);

/**
 * Les certificats de /v1/certificates qui occupent le quota de distribution,
 * normalisés et ordonnés du plus ancien au plus récent. L'appelant interroge
 * l'API SANS filtre de type : ce qui occupe le quota se voit ici, pas
 * seulement ce que la CI a créé.
 *
 * @param {any[]} data
 * @returns {Certificate[]}
 */
export function distributionCertificates(data) {
  return data
    .filter((entry) => DISTRIBUTION_TYPES.has(entry.attributes?.certificateType))
    .map((entry) => ({
      id: entry.id,
      type: entry.attributes?.certificateType,
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
 * - le binaire de toute version qu'Apple a encore en main (examen en cours,
 *   traitement, publication en attente) ;
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
      const build = builds.get(version.relationships?.build?.data?.id);
      const uploadedDate = build?.attributes?.uploadedDate;
      if (!uploadedDate) return;
      uploads.push({
        label: `version ${version.attributes?.versionString} en ${state}`,
        buildNumber: build?.attributes?.version,
        uploadedAt: Date.parse(uploadedDate),
      });
    });
  (buildsResponse.data ?? []).forEach((build, index) => {
    if (index > 0 && build.attributes?.processingState !== "PROCESSING") return;
    if (!build.attributes?.uploadedDate) return;
    uploads.push({
      label: `build ${build.attributes.version} (${build.attributes.processingState})`,
      buildNumber: build.attributes.version,
      uploadedAt: Date.parse(build.attributes.uploadedDate),
    });
  });
  return uploads;
}

/**
 * Annote chaque certificat de ce qui le retient (`keptFor`) et rend ceux qui
 * peuvent partir, du plus ancien au plus récent. Le plus récent est épargné
 * d'office tant qu'on ignore ce qu'il a signé : c'est celui du run précédent,
 * dont le binaire vient peut-être d'arriver chez Apple. Avec un marqueur, il
 * est jugé comme les autres, sur le sort de SON binaire.
 *
 * `signedBuilds` donne, quand on la connaît, la provenance exacte : le profil
 * laissé en place par un run qui a envoyé son binaire porte le numéro de
 * build et référence le certificat qui l'a signé. Le certificat suit alors le
 * sort de CE build, sans marge ni déduction. Les certificats sans marqueur
 * retombent sur la fenêtre des dates, prudente : ceux d'avant l'arrivée des
 * marqueurs, et ceux d'un run tué avant son nettoyage.
 *
 * @param {Certificate[]} certificates
 * @param {Upload[]} uploads
 * @param {Map<string, string>} [signedBuilds] id de certificat vers numéro de build
 * @returns {Certificate[]}
 */
export function revocableCertificates(certificates, uploads, signedBuilds = new Map()) {
  // Un envoi déjà revendiqué par un marqueur ne protège personne d'autre :
  // son signataire est connu, la déduction par les dates n'a plus à couvrir
  // les voisins pour lui.
  const claimed = new Set(
    [...signedBuilds.values()].filter((build) => uploads.some((upload) => upload.buildNumber === build)),
  );
  certificates.forEach((certificate, index) => {
    const next = certificates[index + 1];
    if (certificate.type !== CI_CERTIFICATE_TYPE) {
      // Un certificat que la CI n'a pas fabriqué sert peut-être à quelqu'un,
      // sur un Mac : il occupe une place, on le dit, on n'y touche pas.
      certificate.keptFor = `type ${certificate.type}, créé hors CI`;
      return;
    }
    const signed = signedBuilds.get(certificate.id);
    if (signed) {
      // Provenance connue, y compris pour le plus récent : son marqueur dit
      // ce qu'il a signé, et si ce binaire est distribué et dépassé, il n'a
      // plus de raison d'occuper une place. C'est ce qui permet de tenir même
      // un quota de deux.
      const upload = uploads.find((candidate) => candidate.buildNumber === signed);
      certificate.keptFor = upload && `il a signé le build ${signed}, ${upload.label}`;
      return;
    }
    if (!next) {
      // Provenance inconnue et pas de suivant : c'est le certificat du run
      // précédent, dont le binaire vient peut-être d'arriver chez Apple.
      certificate.keptFor = "certificat du run précédent, provenance inconnue";
      return;
    }
    const from = certificate.created - ATTRIBUTION_MARGIN_MS;
    const to = next.created + ATTRIBUTION_MARGIN_MS;
    const upload = uploads.find(
      (candidate) =>
        !claimed.has(candidate.buildNumber) && candidate.uploadedAt >= from && candidate.uploadedAt < to,
    );
    certificate.keptFor = upload && `provenance inconnue, et sa fenêtre contient ${upload.label}`;
  });
  return certificates.filter((certificate) => !certificate.keptFor);
}
