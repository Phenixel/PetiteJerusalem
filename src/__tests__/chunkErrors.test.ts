import { describe, expect, it } from "vitest";
import { chunkNameFrom, isChunkLoadError } from "../config/chunkErrors";

/**
 * Détection d'un chunk hashé disparu après un déploiement. Les messages testés
 * sont ceux des navigateurs (Chrome, Firefox, Safari), pas notre rédaction :
 * c'est d'eux que dépend le rechargement qui répare la page.
 */

const FETCH_FAILED =
  "Failed to fetch dynamically imported module: https://petite-jerusalem.fr/assets/ShareReading-CqA1b2c3.js";
const FIREFOX_LOADING = "error loading dynamically imported module";
const SAFARI_IMPORT = "Importing a module script failed.";
// Réellement observé le 24/09/2026 sur Safari iOS 18.7, sur une page de
// session partagée : la réécriture SPA avait renvoyé app.html à la place du
// chunk demandé.
const SAFARI_MIME = "'text/html' is not a valid JavaScript MIME type.";
const CHROME_MIME =
  'Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html".';
const FIREFOX_MIME =
  "Loading module from “https://petite-jerusalem.fr/assets/index-Ab12Cd34.js” was blocked because of a disallowed MIME type (“text/html”).";

describe("isChunkLoadError", () => {
  it("reconnaît le module jugé introuvable", () => {
    expect(isChunkLoadError(new Error(FETCH_FAILED))).toBe(true);
    expect(isChunkLoadError(new Error(FIREFOX_LOADING))).toBe(true);
    expect(isChunkLoadError(new Error(SAFARI_IMPORT))).toBe(true);
  });

  it("reconnaît le module reçu avec le type MIME du HTML", () => {
    expect(isChunkLoadError(new TypeError(SAFARI_MIME))).toBe(true);
    expect(isChunkLoadError(new TypeError(CHROME_MIME))).toBe(true);
    expect(isChunkLoadError(new Error(FIREFOX_MIME))).toBe(true);
  });

  it("accepte une erreur qui n'en est pas une, sans casser", () => {
    expect(isChunkLoadError(SAFARI_MIME)).toBe(true);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it("laisse passer les erreurs applicatives", () => {
    expect(isChunkLoadError(new TypeError("undefined is not a function"))).toBe(false);
    expect(isChunkLoadError(new Error("Firebase: Error (auth/network-request-failed)."))).toBe(
      false,
    );
    // Un texte qui parle de type MIME sans être un module refusé.
    expect(isChunkLoadError(new Error("Le fichier envoyé a un type MIME inattendu"))).toBe(false);
  });
});

describe("chunkNameFrom", () => {
  it("retient le fichier cité par le message", () => {
    expect(chunkNameFrom(new Error(FETCH_FAILED))).toBe("ShareReading-CqA1b2c3.js");
  });

  it("renvoie null quand le message n'en cite aucun", () => {
    expect(chunkNameFrom(new TypeError(SAFARI_MIME))).toBe(null);
    expect(chunkNameFrom(new Error(SAFARI_IMPORT))).toBe(null);
  });
});
