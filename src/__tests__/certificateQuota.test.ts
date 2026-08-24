import { describe, expect, it } from "vitest";
import {
  distributionCertificates,
  protectedUploads,
  revocableCertificates,
} from "../../scripts/lib/certificate-quota.mjs";

/**
 * Quel certificat de distribution la CI a le droit de révoquer. Se tromper ne
 * casse pas un build : cela invalide la signature d'un binaire déjà chez
 * Apple, et la release est rejetée à l'examen (ITMS-90035) des jours plus
 * tard. D'où ce test sur des données réelles, celles du blocage du tag v3.7.8.
 *
 * Rappel de la règle vérifiée ici : un binaire est signé par le dernier
 * certificat créé avant son envoi, et un certificat dont la fenêtre ne
 * contient aucun envoi encore protégé peut partir.
 */

/** Les trois certificats qui occupaient le quota le 23 août 2026. */
const certificate = (id: string, expirationDate: string, certificateType = "DISTRIBUTION") => ({
  id,
  attributes: { certificateType, displayName: "CI", expirationDate },
});

const CERTIFICATES = [
  certificate("R33A4CCD5R", "2027-08-18T23:56:32.000+00:00"),
  certificate("SA7386DCQJ", "2027-08-21T12:31:10.000+00:00"),
  certificate("T7X6S8JPNR", "2027-08-19T15:30:39.000+00:00"),
];

/** Un build tel que l'API le rend, dans la charge `included` des versions. */
const build = (id: string, version: string, uploadedDate: string, processingState = "VALID") => ({
  id,
  type: "builds",
  attributes: { version, uploadedDate, processingState },
});

const version = (versionString: string, appStoreState: string, buildId: string, createdDate: string) => ({
  id: `v-${versionString}`,
  attributes: { versionString, appStoreState, createdDate },
  relationships: { build: { data: { type: "builds", id: buildId } } },
});

const BUILDS = {
  "3070300": build("b3", "3070300", "2026-08-16T20:28:00.000+00:00"),
  "3070400": build("b4", "3070400", "2026-08-19T00:12:00.000+00:00"),
  "3070500": build("b5", "3070500", "2026-08-19T15:47:00.000+00:00"),
  "3070600": build("b6", "3070600", "2026-08-21T12:46:30.000+00:00"),
};

describe("quota de certificats de distribution", () => {
  const certificates = () => distributionCertificates(structuredClone(CERTIFICATES));

  it("ordonne les certificats du plus ancien au plus récent", () => {
    expect(certificates().map((c) => c.id)).toEqual(["R33A4CCD5R", "T7X6S8JPNR", "SA7386DCQJ"]);
  });

  it("libère une place quand les versions distribuées ont pris toute la place", () => {
    // L'état réel du compte le 23 août 2026 : 3.7.6 et 3.7.5 distribuées,
    // 3.7.4 restée en brouillon (son job de soumission avait échoué). Trois
    // certificats, un par release, et le quota plein.
    const versions = {
      data: [
        version("3.7.6", "READY_FOR_DISTRIBUTION", "b6", "2026-08-21T12:46:50.000+00:00"),
        version("3.7.5", "READY_FOR_DISTRIBUTION", "b5", "2026-08-19T15:47:20.000+00:00"),
        version("3.7.4", "PREPARE_FOR_SUBMISSION", "b4", "2026-08-19T00:12:40.000+00:00"),
      ],
      included: Object.values(BUILDS),
    };
    const builds = { data: [BUILDS["3070600"], BUILDS["3070500"], BUILDS["3070400"]] };

    const list = certificates();
    const revocable = revocableCertificates(list, protectedUploads(versions, builds));

    // Le plus ancien part, et lui seul : une place suffit. 3.7.5 est
    // distribuée, Apple n'en regardera plus la signature.
    expect(revocable.map((c) => c.id)).toEqual(["R33A4CCD5R"]);
    // La version la plus récente de la fiche retient le sien, et son voisin
    // par la marge : l'envoi tombe dans les deux fenêtres.
    expect(list.find((c) => c.id === "SA7386DCQJ")?.keptFor).toBe("certificat du run précédent, provenance inconnue");
    expect(list.find((c) => c.id === "T7X6S8JPNR")?.keptFor).toContain("3.7.6");
  });

  it("ne touche à rien quand une version est en examen", () => {
    // Même compte, mais 3.7.5 est repartie à l'examen : son certificat, et
    // son voisin par la marge, redeviennent intouchables. Une place reste
    // libérable, celle du plus ancien, seulement si son propre binaire ne
    // retient rien : ici 3.7.4 est en brouillon, mais l'envoi de 3.7.5 tombe
    // dans sa fenêtre, donc plus rien ne part et le run échoue en disant
    // pourquoi, plutôt que de parier sur une signature.
    const versions = {
      data: [
        version("3.7.6", "PREPARE_FOR_SUBMISSION", "b6", "2026-08-21T12:46:50.000+00:00"),
        version("3.7.5", "IN_REVIEW", "b5", "2026-08-19T15:47:20.000+00:00"),
        version("3.7.4", "PREPARE_FOR_SUBMISSION", "b4", "2026-08-19T00:12:40.000+00:00"),
      ],
      included: Object.values(BUILDS),
    };
    const builds = { data: [BUILDS["3070600"]] };

    const list = certificates();
    const revocable = revocableCertificates(list, protectedUploads(versions, builds));

    expect(revocable).toEqual([]);
    expect(list.find((c) => c.id === "R33A4CCD5R")?.keptFor).toContain("3.7.5");
  });

  it("ne protège pas une version distribuée que la suivante a remplacée", () => {
    // 3.7.4 a été distribuée puis remplacée : Apple ne regardera plus sa
    // signature, son certificat peut partir. Seule la plus récente de la
    // fiche, 3.7.6, retient le sien.
    const versions = {
      data: [
        version("3.7.6", "READY_FOR_DISTRIBUTION", "b6", "2026-08-21T12:46:50.000+00:00"),
        version("3.7.4", "READY_FOR_DISTRIBUTION", "b4", "2026-08-19T00:12:40.000+00:00"),
      ],
      included: Object.values(BUILDS),
    };
    const builds = { data: [BUILDS["3070600"]] };

    const list = certificates();
    const revocable = revocableCertificates(list, protectedUploads(versions, builds));

    expect(revocable.map((c) => c.id)).toEqual(["R33A4CCD5R"]);
  });

  it("protège le dernier binaire envoyé, que la fiche ne l'ait pas encore adopté", () => {
    const versions = { data: [], included: [] };
    const builds = { data: [BUILDS["3070400"]] };

    const list = certificates();
    const revocable = revocableCertificates(list, protectedUploads(versions, builds));

    // 3070400 tient R33A4CCD5R ; SA7386DCQJ est le plus récent, hors jeu.
    expect(revocable.map((c) => c.id)).toEqual(["T7X6S8JPNR"]);
  });

  it("protège un binaire encore en traitement chez Apple, pas un binaire dépassé", () => {
    const versions = { data: [], included: [] };
    const dernier = build("b8", "3070800", "2026-08-23T07:50:00.000+00:00");
    const enTraitement = build("b5b", "3070500", "2026-08-19T15:35:00.000+00:00", "PROCESSING");
    const dépassé = { ...enTraitement, attributes: { ...enTraitement.attributes, processingState: "VALID" } };

    // Le binaire en traitement retient son certificat, et son voisin par la
    // marge : plus rien à libérer.
    expect(
      revocableCertificates(certificates(), protectedUploads(versions, { data: [dernier, enTraitement] })),
    ).toEqual([]);

    // Le même binaire une fois traité et dépassé ne retient plus rien.
    expect(
      revocableCertificates(certificates(), protectedUploads(versions, { data: [dernier, dépassé] })).map(
        (c) => c.id,
      ),
    ).toEqual(["R33A4CCD5R", "T7X6S8JPNR"]);
  });

  it("suit le marqueur du profil plutôt que les dates, quand il existe", () => {
    // Provenance exacte : chaque certificat a laissé derrière lui le profil du
    // build qu'il a signé. 3.7.6 est la version la plus récente, son
    // certificat reste ; celui de 3.7.5 part, sans que la marge des dates
    // vienne le sauver comme pour un certificat de provenance inconnue.
    const signedBuilds = new Map([
      ["R33A4CCD5R", "3070400"],
      ["T7X6S8JPNR", "3070500"],
      ["SA7386DCQJ", "3070600"],
    ]);
    const versions = {
      data: [
        version("3.7.6", "READY_FOR_DISTRIBUTION", "b6", "2026-08-21T12:46:50.000+00:00"),
        version("3.7.5", "READY_FOR_DISTRIBUTION", "b5", "2026-08-19T15:47:20.000+00:00"),
      ],
      included: Object.values(BUILDS),
    };
    const builds = { data: [BUILDS["3070600"]] };

    const list = certificates();
    const revocable = revocableCertificates(list, protectedUploads(versions, builds), signedBuilds);

    expect(revocable.map((c) => c.id)).toEqual(["R33A4CCD5R", "T7X6S8JPNR"]);
  });

  it("garde le certificat du build en examen, même ancien, grâce à son marqueur", () => {
    // Le plus ancien a signé le binaire aujourd'hui en examen : deux releases
    // plus tard, les dates seules l'auraient cru dépassé.
    const signedBuilds = new Map([
      ["R33A4CCD5R", "3070400"],
      ["T7X6S8JPNR", "3070500"],
      ["SA7386DCQJ", "3070600"],
    ]);
    const versions = {
      data: [
        version("3.7.6", "PREPARE_FOR_SUBMISSION", "b6", "2026-08-21T12:46:50.000+00:00"),
        version("3.7.4", "IN_REVIEW", "b4", "2026-08-19T00:12:40.000+00:00"),
      ],
      included: Object.values(BUILDS),
    };
    const builds = { data: [BUILDS["3070600"]] };

    const list = certificates();
    const revocable = revocableCertificates(list, protectedUploads(versions, builds), signedBuilds);

    expect(revocable.map((c) => c.id)).toEqual(["T7X6S8JPNR"]);
    expect(list.find((c) => c.id === "R33A4CCD5R")?.keptFor).toContain("3070400");
  });

  it("compte un certificat créé hors CI, sans jamais y toucher", () => {
    // Un « iOS Distribution » fabriqué à la main occupe une place du quota :
    // l'ignorer, c'est compter à côté et ne pas comprendre le refus d'Apple.
    // Le révoquer casserait la signature de quelqu'un, sur son Mac.
    const list = distributionCertificates([
      ...structuredClone(CERTIFICATES).slice(0, 1),
      certificate("XY12345678", "2027-09-01T10:00:00.000+00:00", "IOS_DISTRIBUTION"),
    ]);
    const revocable = revocableCertificates(list, protectedUploads({ data: [] }, { data: [] }));

    expect(list.map((c) => c.id)).toEqual(["R33A4CCD5R", "XY12345678"]);
    expect(revocable.map((c) => c.id)).toEqual(["R33A4CCD5R"]);
    expect(list.find((c) => c.id === "XY12345678")?.keptFor).toContain("hors CI");
  });

  it("laisse tomber les types qui n'occupent pas le quota de distribution", () => {
    const list = distributionCertificates([
      ...structuredClone(CERTIFICATES).slice(0, 1),
      certificate("DEV1234567", "2027-09-01T10:00:00.000+00:00", "DEVELOPMENT"),
    ]);

    expect(list.map((c) => c.id)).toEqual(["R33A4CCD5R"]);
  });

  it("un envoi revendiqué par un marqueur ne protège plus le certificat voisin", () => {
    // Le binaire de 3.7.6 appartient à SA7386DCQJ, son marqueur le dit. Sans
    // cela, la marge des dates le faisait aussi protéger T7X6S8JPNR, de
    // provenance inconnue, qui restait à vie.
    const signedBuilds = new Map([["SA7386DCQJ", "3070600"]]);
    const versions = {
      data: [version("3.7.6", "IN_REVIEW", "b6", "2026-08-21T12:46:50.000+00:00")],
      included: Object.values(BUILDS),
    };
    const builds = { data: [BUILDS["3070600"]] };

    const list = certificates();
    const revocable = revocableCertificates(list, protectedUploads(versions, builds), signedBuilds);

    expect(revocable.map((c) => c.id)).toEqual(["R33A4CCD5R", "T7X6S8JPNR"]);
    expect(list.find((c) => c.id === "SA7386DCQJ")?.keptFor).toContain("il a signé le build 3070600");
  });

  it("libère même le plus récent quand son marqueur dit que son binaire est dépassé", () => {
    // Un compte au quota serré (deux certificats) ne tiendrait pas si le
    // dernier était intouchable par principe : son marqueur suffit à savoir
    // qu'il ne signe plus rien que quiconque regarde.
    const signedBuilds = new Map([
      ["T7X6S8JPNR", "3070500"],
      ["SA7386DCQJ", "3070600"],
    ]);
    const versions = {
      data: [
        version("3.7.8", "IN_REVIEW", "b8", "2026-08-23T09:16:40.000+00:00"),
        version("3.7.6", "READY_FOR_DISTRIBUTION", "b6", "2026-08-21T12:46:50.000+00:00"),
      ],
      included: [...Object.values(BUILDS), build("b8", "3070800", "2026-08-23T09:16:25.000+00:00")],
    };
    const builds = { data: [build("b8", "3070800", "2026-08-23T09:16:25.000+00:00")] };

    const list = certificates().filter((c) => c.id !== "R33A4CCD5R");
    const revocable = revocableCertificates(list, protectedUploads(versions, builds), signedBuilds);

    expect(revocable.map((c) => c.id)).toEqual(["T7X6S8JPNR", "SA7386DCQJ"]);
  });

  it("ne révoque jamais le certificat le plus récent, même sans aucun envoi", () => {
    const list = certificates();
    const revocable = revocableCertificates(list, protectedUploads({ data: [] }, { data: [] }));

    expect(revocable.map((c) => c.id)).toEqual(["R33A4CCD5R", "T7X6S8JPNR"]);
    expect(list.at(-1)?.keptFor).toBe("certificat du run précédent, provenance inconnue");
  });
});
