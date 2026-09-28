// @vitest-environment node
import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAscClient, describeAscErrors } from "../../scripts/lib/asc-api.mjs";

/**
 * Le client App Store Connect des scripts de release (fiche, captures,
 * soumission). Le tag v3.10.8 est mort de ses deux manques : un 500 passager
 * sur une lecture a coupé appstore-listing.mjs avant les « Nouveautés » de la
 * version, puis le 409 de la soumission n'a pas dit pourquoi, la raison étant
 * rangée dans `meta.associatedErrors`. Ni réseau ni horloge : fetch est
 * remplacé, la pause injectée.
 */

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

/** Un client dont les pauses ne dorment pas ; elles sont comptées. */
function client() {
  const waited: number[] = [];
  const { api } = createAscClient({
    keyId: "KEY",
    issuerId: "ISSUER",
    privateKeyPem,
    sleep: async (ms: number) => void waited.push(ms),
  });
  return { api, waited };
}

/** Une réponse de l'API, JSON ou vide. */
const reply = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

const appleDown = () =>
  reply(500, {
    errors: [{ status: "500", code: "UNEXPECTED_ERROR", title: "An unexpected error occurred." }],
  });

/** fetch remplacé par une suite de réponses, une par appel. */
function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error("appel de trop");
    return next;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("api", () => {
  it("rejoue une lecture quand Apple tombe, et rend la réponse obtenue", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = stubFetch(appleDown(), reply(200, { data: [{ id: "fr-FR" }] }));
    const { api, waited } = client();

    await expect(api("GET", "/v1/appInfos/x/appInfoLocalizations")).resolves.toEqual({
      data: [{ id: "fr-FR" }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(waited).toEqual([3000]);
  });

  it("rejoue aussi une suppression", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = stubFetch(appleDown(), reply(204));
    const { api } = client();

    await api("DELETE", "/v1/appScreenshots/x");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ne rejoue ni une création ni une modification : elles pourraient partir deux fois", async () => {
    for (const method of ["POST", "PATCH"]) {
      const fetchMock = stubFetch(appleDown());
      const { api, waited } = client();

      await expect(api(method, "/v1/reviewSubmissions", { data: {} })).rejects.toMatchObject({
        status: 500,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(waited).toEqual([]);
    }
  });

  it("ne rejoue pas un 4xx, qui dit quelque chose de vrai sur la demande", async () => {
    const fetchMock = stubFetch(reply(404, { errors: [{ title: "Not found", detail: "nope" }] }));
    const { api } = client();

    await expect(api("GET", "/v1/apps/x")).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("met les raisons détaillées d'Apple dans le message d'erreur", async () => {
    stubFetch(
      reply(409, {
        errors: [
          {
            status: "409",
            code: "STATE_ERROR.ENTITY_STATE_INVALID",
            title: "appStoreVersions with id 'v1' is not in valid state.",
            detail: "This resource cannot be reviewed, please check associated errors to see why.",
            meta: {
              associatedErrors: {
                "/v1/appStoreVersionLocalizations/l1": [
                  {
                    code: "ENTITY_ERROR.ATTRIBUTE.REQUIRED",
                    title: "The provided entity is missing a required attribute",
                    detail: "You must provide a value for the attribute 'whatsNew' with this request",
                  },
                ],
              },
            },
          },
        ],
      }),
    );
    const { api } = client();

    await expect(api("POST", "/v1/reviewSubmissionItems", { data: {} })).rejects.toThrow(
      /whatsNew/,
    );
  });
});

describe("describeAscErrors", () => {
  it("rend le texte brut quand la réponse n'est pas une liste d'erreurs de l'API", () => {
    expect(describeAscErrors(null, "Bad Gateway")).toBe("Bad Gateway");
  });

  it("donne une ligne par erreur, puis ses raisons détaillées, par ressource", () => {
    const text = describeAscErrors(
      {
        errors: [
          {
            title: "Refusée",
            detail: "voir les raisons",
            meta: {
              associatedErrors: {
                "/v1/a": [{ title: "Nouveautés", detail: "vides" }],
                "/v1/b": [{ code: "SCREENSHOT_REQUIRED" }],
              },
            },
          },
        ],
      },
      "",
    );
    expect(text.split("\n")).toEqual([
      "Refusée : voir les raisons",
      "    Nouveautés : vides",
      "    SCREENSHOT_REQUIRED :",
    ]);
  });
});
